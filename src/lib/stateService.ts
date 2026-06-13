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

const SEED_BRANDS = [
  "BATTERY (CLOCK)", "Bigotti", "Bonia", "Caesar", "Casio", "Cro wc", "Chronctech",
  "Digitec", "Daniel klein", "J.bovier", "L. strap", "Mini Focus", "Naviforce",
  "Pvc strap", "R-bat", "R&E", "REWARDS WATCH", "S-bat", "Slo/pokemon", "S.parts",
  "Submarine", "service"
];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: 'anonymous_or_unauth',
      email: null,
      emailVerified: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error Details:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Local Storage Fallback Helpers
function getLocalBrands(): Brand[] {
  const data = localStorage.getItem('retail_sales_brands');
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // fallback
    }
  }
  
  // Default Seed
  const defaultBrands: Brand[] = SEED_BRANDS.map((name, index) => ({
    id: `b_${Date.now()}_${index}`,
    name,
    sortOrder: index + 1
  }));
  localStorage.setItem('retail_sales_brands', JSON.stringify(defaultBrands));
  return defaultBrands;
}

function setLocalBrands(brands: Brand[]) {
  localStorage.setItem('retail_sales_brands', JSON.stringify(brands));
}

function getLocalSales(): DailySale[] {
  const data = localStorage.getItem('retail_sales_daily');
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // fallback
    }
  }
  return [];
}

function setLocalSales(sales: DailySale[]) {
  localStorage.setItem('retail_sales_daily', JSON.stringify(sales));
}

// Main State Service
export const stateService = {
  /**
   * Fetches all brands, ordered by sortOrder. If Firestore is empty or and placeholder is active, seeds brands first.
   */
  async getBrands(): Promise<Brand[]> {
    if (isPlaceholder || !db) {
      return getLocalBrands().sort((a, b) => a.sortOrder - b.sortOrder);
    }

    try {
      const q = query(collection(db, 'brands'));
      const snapshot = await getDocs(q);
      const list: Brand[] = [];
      snapshot.forEach((snapDoc) => {
        const d = snapDoc.data();
        list.push({
          id: snapDoc.id,
          name: d.name || '',
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 100
        });
      });

      if (list.length === 0) {
        // Automatically seed Firestore with default brands
        console.log('Seeding Firestore with default brands...');
        const batch = writeBatch(db);
        const seededList: Brand[] = [];
        for (let i = 0; i < SEED_BRANDS.length; i++) {
          const brandId = `brand_${SEED_BRANDS[i].toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i}`;
          const brandRef = doc(db, 'brands', brandId);
          const brandData = {
            name: SEED_BRANDS[i],
            sortOrder: i + 1
          };
          batch.set(brandRef, brandData);
          seededList.push({ id: brandId, ...brandData });
        }
        await batch.commit();
        setLocalBrands(seededList);
        return seededList;
      }

      list.sort((a, b) => a.sortOrder - b.sortOrder);
      setLocalBrands(list); // keeps local storage mirrored
      return list;
    } catch (err) {
      console.warn("Could not load from Firestore. Using local storage.", err);
      return getLocalBrands().sort((a, b) => a.sortOrder - b.sortOrder);
    }
  },

  /**
   * Adds or updates a brand
   */
  async saveBrand(name: string, sortOrder: number, id?: string): Promise<Brand> {
    const brandName = name.trim();
    if (!brandName) {
      throw new Error("Brand name cannot be empty");
    }

    // Load existing to verify uniqueness
    const brands = await this.getBrands();
    const dup = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase() && b.id !== id);
    if (dup) {
      throw new Error(`A brand named "${brandName}" already exists.`);
    }

    const targetId = id || `brand_${Date.now()}`;
    const newBrand: Brand = {
      id: targetId,
      name: brandName,
      sortOrder
    };

    if (isPlaceholder || !db) {
      const updated = brands.filter(b => b.id !== targetId);
      updated.push(newBrand);
      setLocalBrands(updated);
      return newBrand;
    }

    try {
      const brandRef = doc(db, 'brands', targetId);
      await setDoc(brandRef, {
        name: brandName,
        sortOrder
      });
      // updating local mirror
      const updated = brands.filter(b => b.id !== targetId);
      updated.push(newBrand);
      setLocalBrands(updated);
      return newBrand;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `brands/${targetId}`);
      // Fallback
      const updated = brands.filter(b => b.id !== targetId);
      updated.push(newBrand);
      setLocalBrands(updated);
      return newBrand;
    }
  },

  /**
   * Saves the sorted list order in bulk
   */
  async saveBrandsOrder(orderedBrands: Brand[]): Promise<void> {
    if (isPlaceholder || !db) {
      setLocalBrands(orderedBrands);
      return;
    }

    try {
      const batch = writeBatch(db);
      orderedBrands.forEach((b) => {
        const ref = doc(db, 'brands', b.id);
        batch.set(ref, {
          name: b.name,
          sortOrder: b.sortOrder
        });
      });
      await batch.commit();
      setLocalBrands(orderedBrands);
    } catch (err) {
      console.error("Bulk sort order save failed on Firestore. Mirroring to local storage.", err);
      setLocalBrands(orderedBrands);
    }
  },

  /**
   * Deletes a brand
   */
  async deleteBrand(id: string): Promise<void> {
    const brands = await this.getBrands();
    const updated = brands.filter(b => b.id !== id);
    setLocalBrands(updated);

    if (isPlaceholder || !db) {
      return;
    }

    try {
      const ref = doc(db, 'brands', id);
      await deleteDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `brands/${id}`);
    }
  },

  /**
   * Fetches daily sales for a specific date
   */
  async getDailySales(date: string): Promise<DailySale[]> {
    if (isPlaceholder || !db) {
      const allSales = getLocalSales();
      return allSales.filter(s => s.date === date);
    }

    try {
      const q = query(collection(db, 'daily_sales'), where('date', '==', date));
      const snapshot = await getDocs(q);
      const list: DailySale[] = [];
      snapshot.forEach((snapDoc) => {
        const d = snapDoc.data();
        list.push({
          id: snapDoc.id,
          date: d.date || date,
          brandId: d.brandId || '',
          salesAmount: typeof d.salesAmount === 'number' ? d.salesAmount : 0,
          quantitySold: typeof d.quantitySold === 'number' ? d.quantitySold : 0,
          mtdSalesAmount: typeof d.mtdSalesAmount === 'number' ? d.mtdSalesAmount : undefined,
          mtdQuantitySold: typeof d.mtdQuantitySold === 'number' ? d.mtdQuantitySold : undefined
        });
      });
      return list;
    } catch (err) {
      console.warn("Could not query daily sales from Firestore, falling back to cached local storage.", err);
      const allSales = getLocalSales();
      return allSales.filter(s => s.date === date);
    }
  },

  /**
   * Saves daily sales inputs for multiple brands (bulk upsert)
   */
  async saveDailySales(date: string, salesInputs: SalesInput[]): Promise<void> {
    // Write local first for responsiveness and safety
    const allSales = getLocalSales();
    let updatedSales = allSales.filter(s => s.date !== date);
    
    const recordsToSave = salesInputs.map(input => {
      const record: DailySale = {
        id: `${date}_${input.brandId}`,
        date,
        brandId: input.brandId,
        salesAmount: input.salesAmount,
        quantitySold: input.quantitySold,
        mtdSalesAmount: input.mtdSalesAmount,
        mtdQuantitySold: input.mtdQuantitySold
      };
      return record;
    });

    updatedSales = [...updatedSales, ...recordsToSave];
    setLocalSales(updatedSales);

    if (isPlaceholder || !db) {
      return;
    }

    try {
      const batch = writeBatch(db);
      recordsToSave.forEach((record) => {
        const ref = doc(db, 'daily_sales', record.id);
        const dataToSave: any = {
          date: record.date,
          brandId: record.brandId,
          salesAmount: record.salesAmount,
          quantitySold: record.quantitySold
        };
        if (record.mtdSalesAmount !== undefined) {
          dataToSave.mtdSalesAmount = record.mtdSalesAmount;
        }
        if (record.mtdQuantitySold !== undefined) {
          dataToSave.mtdQuantitySold = record.mtdQuantitySold;
        }
        batch.set(ref, dataToSave);
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to commit daily sales to Firestore. Saved in local state.", err);
    }
  },

  /**
   * Fetches the entire month's sales to compute dynamic Month-To-Date (MTD) totals
   * Format of datePrefix: "YYYY-MM" (e.g. "2026-06")
   */
  async getMonthlySales(datePrefix: string): Promise<DailySale[]> {
    if (isPlaceholder || !db) {
      const allSales = getLocalSales();
      return allSales.filter(s => s.date.startsWith(datePrefix));
    }

    try {
      // Query daily sales for selected month (since date format is YYYY-MM-DD, 
      // we can filter between first day range YYYY-MM-01 and YYYY-MM-31)
      const start = `${datePrefix}-01`;
      const end = `${datePrefix}-31`;
      const q = query(
        collection(db, 'daily_sales'), 
        where('date', '>=', start),
        where('date', '<=', end)
      );
      const snapshot = await getDocs(q);
      const list: DailySale[] = [];
      snapshot.forEach((snapDoc) => {
        const d = snapDoc.data();
        list.push({
          id: snapDoc.id,
          date: d.date || '',
          brandId: d.brandId || '',
          salesAmount: typeof d.salesAmount === 'number' ? d.salesAmount : 0,
          quantitySold: typeof d.quantitySold === 'number' ? d.quantitySold : 0,
          mtdSalesAmount: typeof d.mtdSalesAmount === 'number' ? d.mtdSalesAmount : undefined,
          mtdQuantitySold: typeof d.mtdQuantitySold === 'number' ? d.mtdQuantitySold : undefined
        });
      });
      return list;
    } catch (err) {
      console.warn("Could not query monthly sales, falling back to local storage statistics.", err);
      const allSales = getLocalSales();
      return allSales.filter(s => s.date.startsWith(datePrefix));
    }
  },

  /**
   * Resets all sales records for a given month (YYYY-MM)
   */
  async resetMonthlySales(datePrefix: string): Promise<void> {
    const allSales = getLocalSales();
    const filtered = allSales.filter(s => !s.date.startsWith(datePrefix));
    setLocalSales(filtered);

    if (isPlaceholder || !db) {
      return;
    }

    try {
      const start = `${datePrefix}-01`;
      const end = `${datePrefix}-31`;
      const q = query(
        collection(db, 'daily_sales'), 
        where('date', '>=', start),
        where('date', '<=', end)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((snapDoc) => {
        batch.delete(snapDoc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to reset monthly sales on Firestore.", err);
    }
  }
};
