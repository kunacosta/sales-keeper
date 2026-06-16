import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { db, isPlaceholder } from './firebase.ts';
import { OUTLETS, Outlet } from './outlets.ts';

export interface Brand {
  id: string;
  name: string;
  sortOrder: number;
}

export interface DailySale {
  id: string; // YYYY-MM-DD_brandId
  date: string; // YYYY-MM-DD
  brandId: string;
  salesAmount: number;
  quantitySold: number;
  mtdSalesAmount?: number;
  mtdQuantitySold?: number;
}

export interface SalesInput {
  brandId: string;
  salesAmount: number;
  quantitySold: number;
  mtdSalesAmount?: number;
  mtdQuantitySold?: number;
}

const SEED_BRANDS: Record<string, string[]> = {
  MRT: [
    "BATTERY (CLOCK)", "Bonia", "Caesar", "Casio", "Cro wc", "Chronctech", "Digitec",
    "Daniel klein", "J.bovier", "L. strap", "Mini Focus", "Naviforce", "Pvc strap",
    "R-bat", "R&E", "REWARDS WATCH", "S-bat", "S.B. Polo", "Slo/pokemon", "S.parts",
    "Submarine", "service"
  ],
  JCI: [
    "ALBA", "BIGOTTI", "BONIA", "CASIO", "BABY-G", "EDIFICE", "G-SHOCK", "CITOLE",
    "DANIEL KLEIN", "ECO DRIVE", "FREE GIFT", "J.BOVIER", "LONGINES", "LEATHER STRAP",
    "MINI FOCUS", "MIDO", "NAVIFORCE", "P.V.C STRAP", "RENATA BATTERY", "SONY BATTERY",
    "SANTA POLO", "SEIKO", "SEIKO 5", "SEIKO SPORTS 5", "SERVICE", "SPARE PARTS",
    "STAINLESS STEEL STRAP", "TISSOT"
  ],
};

// ---------------------------------------------------------------------------
// Active outlet — drives which Firestore collections and localStorage keys are
// used. MRT's prefix is '' so existing data is reused with no migration.
// ---------------------------------------------------------------------------

let currentOutlet: Outlet = OUTLETS.MRT;

export function setActiveOutlet(code: string) {
  currentOutlet = OUTLETS[code] ?? OUTLETS.MRT;
}

const brandsCol = () => `${currentOutlet.prefix}brands`;
const salesCol = () => `${currentOutlet.prefix}daily_sales`;
const brandsKey = () => `${currentOutlet.prefix}retail_sales_brands`;
const salesKey = () => `${currentOutlet.prefix}retail_sales_daily`;

// ---------------------------------------------------------------------------
// localStorage cache helpers — used for fast synchronous reads
// ---------------------------------------------------------------------------

function getLocalBrands(): Brand[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(brandsKey());
  if (data) {
    try { return JSON.parse(data); } catch { /* fall through */ }
  }
  const seeds = SEED_BRANDS[currentOutlet.code] ?? SEED_BRANDS.MRT;
  const defaultBrands: Brand[] = seeds.map((name, index) => ({
    id: `b_${Date.now()}_${index}`,
    name,
    sortOrder: index + 1
  }));
  localStorage.setItem(brandsKey(), JSON.stringify(defaultBrands));
  return defaultBrands;
}

function setLocalBrands(brands: Brand[]) {
  if (typeof window !== 'undefined')
    localStorage.setItem(brandsKey(), JSON.stringify(brands));
}

function getLocalSales(): DailySale[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(salesKey());
  if (data) {
    try { return JSON.parse(data); } catch { /* fall through */ }
  }
  return [];
}

function setLocalSales(sales: DailySale[]) {
  if (typeof window !== 'undefined')
    localStorage.setItem(salesKey(), JSON.stringify(sales));
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export const stateService = {

  // Always false — no more async sync queue
  isSyncing(): boolean { return false; },

  // ---------------------------------------------------------------------------
  // Brands
  // ---------------------------------------------------------------------------

  async getBrands(): Promise<Brand[]> {
    const local = getLocalBrands().sort((a, b) => a.sortOrder - b.sortOrder);
    if (isPlaceholder || !db) return local;
    this._refreshBrandsFromFirestore();
    return local;
  },

  async _refreshBrandsFromFirestore() {
    try {
      const snapshot = await getDocs(query(collection(db, brandsCol())));
      const list: Brand[] = [];
      snapshot.forEach(snapDoc => {
        const d = snapDoc.data();
        list.push({
          id: snapDoc.id,
          name: d.name || '',
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 100
        });
      });

      if (list.length > 0) {
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        setLocalBrands(list);
      } else {
        const seeds = SEED_BRANDS[currentOutlet.code] ?? SEED_BRANDS.MRT;
        const batch = writeBatch(db);
        const seededList: Brand[] = [];
        for (let i = 0; i < seeds.length; i++) {
          const brandId = `brand_${seeds[i].toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i}`;
          const brandData = { name: seeds[i], sortOrder: i + 1 };
          batch.set(doc(db, brandsCol(), brandId), brandData);
          seededList.push({ id: brandId, ...brandData });
        }
        await batch.commit();
        setLocalBrands(seededList);
      }
    } catch (err) {
      console.warn('Background brands refresh failed', err);
    }
  },

  async saveBrand(name: string, sortOrder: number, id?: string): Promise<Brand> {
    const brandName = name.trim();
    if (!brandName) throw new Error('Brand name cannot be empty');
    const targetId = id || `brand_${Date.now()}`;
    const newBrand: Brand = { id: targetId, name: brandName, sortOrder };

    // Write to Firestore first (awaited), then update cache
    if (!isPlaceholder && db) {
      await setDoc(doc(db, brandsCol(), targetId), { name: brandName, sortOrder });
    }
    const brands = getLocalBrands();
    setLocalBrands([...brands.filter(b => b.id !== targetId), newBrand]);
    return newBrand;
  },

  async saveBrandsOrder(orderedBrands: Brand[]): Promise<void> {
    if (!isPlaceholder && db) {
      const batch = writeBatch(db);
      orderedBrands.forEach(b => {
        batch.set(doc(db, brandsCol(), b.id), { name: b.name, sortOrder: b.sortOrder });
      });
      await batch.commit();
    }
    setLocalBrands(orderedBrands);
  },

  async deleteBrand(id: string): Promise<void> {
    if (!isPlaceholder && db) {
      await deleteDoc(doc(db, brandsCol(), id));
    }
    setLocalBrands(getLocalBrands().filter(b => b.id !== id));
  },

  // ---------------------------------------------------------------------------
  // Sales
  // ---------------------------------------------------------------------------

  async getDailySales(date: string): Promise<DailySale[]> {
    return getLocalSales().filter(s => s.date === date);
  },

  async saveDailySales(date: string, salesInputs: SalesInput[]): Promise<void> {
    const records: DailySale[] = salesInputs.map(input => ({
      id: `${date}_${input.brandId}`,
      date,
      brandId: input.brandId,
      salesAmount: input.salesAmount,
      quantitySold: input.quantitySold,
      ...(input.mtdSalesAmount !== undefined && { mtdSalesAmount: input.mtdSalesAmount }),
      ...(input.mtdQuantitySold !== undefined && { mtdQuantitySold: input.mtdQuantitySold }),
    }));

    // Write to Firestore first (awaited)
    if (!isPlaceholder && db) {
      const batch = writeBatch(db);
      records.forEach(record => {
        const data: Record<string, unknown> = {
          date: record.date,
          brandId: record.brandId,
          salesAmount: record.salesAmount,
          quantitySold: record.quantitySold,
        };
        if (record.mtdSalesAmount !== undefined) data.mtdSalesAmount = record.mtdSalesAmount;
        if (record.mtdQuantitySold !== undefined) data.mtdQuantitySold = record.mtdQuantitySold;
        batch.set(doc(db, salesCol(), record.id), data);
      });
      await batch.commit();
    }

    // Update local cache
    const allSales = getLocalSales();
    setLocalSales([...allSales.filter(s => s.date !== date), ...records]);
  },

  async getMonthlySales(datePrefix: string): Promise<DailySale[]> {
    return getLocalSales().filter(s => s.date.startsWith(datePrefix));
  },

  async resetMonthlySales(datePrefix: string): Promise<void> {
    if (!isPlaceholder && db) {
      const start = `${datePrefix}-01`;
      const end = `${datePrefix}-31`;
      const snapshot = await getDocs(
        query(collection(db, salesCol()), where('date', '>=', start), where('date', '<=', end))
      );
      const batch = writeBatch(db);
      snapshot.forEach(snapDoc => batch.delete(snapDoc.ref));
      await batch.commit();
    }
    setLocalSales(getLocalSales().filter(s => !s.date.startsWith(datePrefix)));
  },

  // ---------------------------------------------------------------------------
  // Cross-device sync — pull Firestore into local cache on app load / focus
  // ---------------------------------------------------------------------------

  async pullSalesFromFirestore(datePrefix: string): Promise<void> {
    if (isPlaceholder || !db) return;
    try {
      const [year, month] = datePrefix.split('-').map(Number);
      const prevMonth = month === 1
        ? `${year - 1}-12`
        : `${year}-${String(month - 1).padStart(2, '0')}`;

      const allFetched: DailySale[] = [];
      for (const prefix of [prevMonth, datePrefix]) {
        const snapshot = await getDocs(
          query(collection(db, salesCol()),
            where('date', '>=', `${prefix}-01`),
            where('date', '<=', `${prefix}-31`))
        );
        snapshot.forEach(snapDoc => {
          const d = snapDoc.data();
          const sale: DailySale = {
            id: snapDoc.id,
            date: d.date,
            brandId: d.brandId,
            salesAmount: d.salesAmount ?? 0,
            quantitySold: d.quantitySold ?? 0,
          };
          if (d.mtdSalesAmount !== undefined) sale.mtdSalesAmount = d.mtdSalesAmount;
          if (d.mtdQuantitySold !== undefined) sale.mtdQuantitySold = d.mtdQuantitySold;
          allFetched.push(sale);
        });
      }

      const fetchedDates = new Set(allFetched.map(s => s.date));
      const local = getLocalSales().filter(s => !fetchedDates.has(s.date));
      setLocalSales([...local, ...allFetched]);
    } catch (err) {
      console.warn('pullSalesFromFirestore failed', err);
    }
  },

  // ---------------------------------------------------------------------------
  // Dashboard stats (synchronous, reads local cache)
  // ---------------------------------------------------------------------------

  getDashboardStats(date: string) {
    const allSales = getLocalSales();
    const datePrefix = date.substring(0, 7);
    const monthSales = allSales.filter(s => s.date.startsWith(datePrefix));
    const brands = getLocalBrands();

    const stats: Record<string, { dailyRM: number; dailyQty: number; mtdRM: number; mtdQty: number }> = {};

    brands.forEach(b => {
      const dEntry = monthSales.find(s => s.brandId === b.id && s.date === date);
      const bMonthList = monthSales.filter(s => s.brandId === b.id && s.date <= date);

      const latestOverride = [...bMonthList]
        .sort((a, b) => b.date.localeCompare(a.date))
        .find(s => s.mtdSalesAmount !== undefined);

      let mtdRM: number;
      let mtdQty: number;
      if (latestOverride) {
        // Base = override value + the override record's own daily salesAmount
        // + any daily entries on dates AFTER the override date
        const afterOverride = bMonthList.filter(s => s.date > latestOverride.date);
        mtdRM = (latestOverride.mtdSalesAmount || 0)
          + (latestOverride.salesAmount || 0)
          + afterOverride.reduce((acc, s) => acc + s.salesAmount, 0);
        mtdQty = (latestOverride.mtdQuantitySold || 0)
          + (latestOverride.quantitySold || 0)
          + afterOverride.reduce((acc, s) => acc + s.quantitySold, 0);
      } else {
        mtdRM = bMonthList.reduce((acc, s) => acc + s.salesAmount, 0);
        mtdQty = bMonthList.reduce((acc, s) => acc + s.quantitySold, 0);
      }

      stats[b.id] = {
        dailyRM: dEntry?.salesAmount || 0,
        dailyQty: dEntry?.quantitySold || 0,
        mtdRM,
        mtdQty,
      };
    });

    return stats;
  },
};
