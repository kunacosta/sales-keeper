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

interface SyncOperation {
  id: string;
  type: 'SAVE_DAILY_SALES' | 'SAVE_BRAND' | 'DELETE_BRAND' | 'SAVE_BRANDS_ORDER' | 'RESET_MONTHLY_SALES';
  payload: any;
  timestamp: number;
}

function getSyncQueue(): SyncOperation[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem('retail_sales_sync_queue');
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [];
}

function setSyncQueue(queue: SyncOperation[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('retail_sales_sync_queue', JSON.stringify(queue));
}

function addToSyncQueue(type: SyncOperation['type'], payload: any) {
  const queue = getSyncQueue();
  const op: SyncOperation = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    timestamp: Date.now()
  };
  queue.push(op);
  setSyncQueue(queue);
}

// Local Storage Fallback Helpers
function getLocalBrands(): Brand[] {
  if (typeof window === 'undefined') return [];
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
  if (typeof window === 'undefined') return;
  localStorage.setItem('retail_sales_brands', JSON.stringify(brands));
}

function getLocalSales(): DailySale[] {
  if (typeof window === 'undefined') return [];
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
  if (typeof window === 'undefined') return;
  localStorage.setItem('retail_sales_daily', JSON.stringify(sales));
}

// Main State Service
export const stateService = {
  /**
   * Returns true if there are pending operations in the sync queue.
   */
  isSyncing(): boolean {
    return getSyncQueue().length > 0;
  },

  /**
   * Processes the sync queue in the background.
   */
  async syncOfflineData(): Promise<void> {
    if (isPlaceholder || !db || !navigator.onLine) return;

    const queue = getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Processing sync queue: ${queue.length} items`);
    const remainingQueue: SyncOperation[] = [...queue];

    for (const op of queue) {
      try {
        switch (op.type) {
          case 'SAVE_DAILY_SALES': {
            const { date, recordsToSave } = op.payload;
            const batch = writeBatch(db);
            recordsToSave.forEach((record: any) => {
              const ref = doc(db, 'daily_sales', record.id);
              const dataToSave: any = {
                date: record.date,
                brandId: record.brandId,
                salesAmount: record.salesAmount,
                quantitySold: record.quantitySold
              };
              if (record.mtdSalesAmount !== undefined) dataToSave.mtdSalesAmount = record.mtdSalesAmount;
              if (record.mtdQuantitySold !== undefined) dataToSave.mtdQuantitySold = record.mtdQuantitySold;
              batch.set(ref, dataToSave);
            });
            await batch.commit();
            break;
          }
          case 'SAVE_BRAND': {
            const { id, name, sortOrder } = op.payload;
            await setDoc(doc(db, 'brands', id), { name, sortOrder });
            break;
          }
          case 'DELETE_BRAND': {
            await deleteDoc(doc(db, 'brands', op.payload.id));
            break;
          }
          case 'SAVE_BRANDS_ORDER': {
            const batch = writeBatch(db);
            op.payload.orderedBrands.forEach((b: Brand) => {
              batch.set(doc(db, 'brands', b.id), { name: b.name, sortOrder: b.sortOrder });
            });
            await batch.commit();
            break;
          }
          case 'RESET_MONTHLY_SALES': {
            const { datePrefix } = op.payload;
            const start = `${datePrefix}-01`;
            const end = `${datePrefix}-31`;
            const q = query(collection(db, 'daily_sales'), where('date', '>=', start), where('date', '<=', end));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach((snapDoc) => batch.delete(snapDoc.ref));
            await batch.commit();
            break;
          }
        }
        // Success: remove from remaining queue
        const idx = remainingQueue.findIndex(item => item.id === op.id);
        if (idx > -1) remainingQueue.splice(idx, 1);
        setSyncQueue(remainingQueue);
      } catch (err) {
        console.error(`Sync failed for operation ${op.id}:`, err);
        // If it's a network error, stop processing and retry later
        if (!navigator.onLine) break;
      }
    }
  },

  /**
   * Fetches all brands, ordered by sortOrder. If Firestore is empty or and placeholder is active, seeds brands first.
   */
  async getBrands(): Promise<Brand[]> {
    // Return local immediately
    const local = getLocalBrands().sort((a, b) => a.sortOrder - b.sortOrder);
    
    if (isPlaceholder || !db) return local;

    // Trigger background fetch to update local mirror
    this._refreshBrandsFromFirestore();
    
    return local;
  },

  async _refreshBrandsFromFirestore() {
    try {
      const snapshot = await getDocs(query(collection(db, 'brands')));
      const list: Brand[] = [];
      snapshot.forEach((snapDoc) => {
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
        // Seed if empty
        const batch = writeBatch(db);
        const seededList: Brand[] = [];
        for (let i = 0; i < SEED_BRANDS.length; i++) {
          const brandId = `brand_${SEED_BRANDS[i].toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i}`;
          const brandRef = doc(db, 'brands', brandId);
          const brandData = { name: SEED_BRANDS[i], sortOrder: i + 1 };
          batch.set(brandRef, brandData);
          seededList.push({ id: brandId, ...brandData });
        }
        await batch.commit();
        setLocalBrands(seededList);
      }
    } catch (err) {
      console.warn("Background brands refresh failed", err);
    }
  },

  /**
   * Adds or updates a brand
   */
  async saveBrand(name: string, sortOrder: number, id?: string): Promise<Brand> {
    const brandName = name.trim();
    if (!brandName) throw new Error("Brand name cannot be empty");

    const brands = getLocalBrands();
    const targetId = id || `brand_${Date.now()}`;
    const newBrand: Brand = { id: targetId, name: brandName, sortOrder };

    // 1. Update Local
    const updated = brands.filter(b => b.id !== targetId);
    updated.push(newBrand);
    setLocalBrands(updated);

    // 2. Add to Sync Queue
    addToSyncQueue('SAVE_BRAND', { id: targetId, name: brandName, sortOrder });

    // 3. Trigger background sync
    this.syncOfflineData();

    return newBrand;
  },

  /**
   * Saves the sorted list order in bulk
   */
  async saveBrandsOrder(orderedBrands: Brand[]): Promise<void> {
    setLocalBrands(orderedBrands);
    addToSyncQueue('SAVE_BRANDS_ORDER', { orderedBrands });
    this.syncOfflineData();
  },

  /**
   * Deletes a brand
   */
  async deleteBrand(id: string): Promise<void> {
    const brands = getLocalBrands();
    const updated = brands.filter(b => b.id !== id);
    setLocalBrands(updated);

    addToSyncQueue('DELETE_BRAND', { id });
    this.syncOfflineData();
  },

  /**
   * Fetches daily sales for a specific date
   */
  async getDailySales(date: string): Promise<DailySale[]> {
    const allSales = getLocalSales();
    return allSales.filter(s => s.date === date);
  },

  /**
   * Saves daily sales inputs for multiple brands (bulk upsert)
   */
  async saveDailySales(date: string, salesInputs: SalesInput[]): Promise<void> {
    // 1. Update Local State INSTANTLY
    const allSales = getLocalSales();
    let updatedSales = allSales.filter(s => s.date !== date);
    
    const recordsToSave = salesInputs.map(input => ({
      id: `${date}_${input.brandId}`,
      date,
      brandId: input.brandId,
      salesAmount: input.salesAmount,
      quantitySold: input.quantitySold,
      mtdSalesAmount: input.mtdSalesAmount,
      mtdQuantitySold: input.mtdQuantitySold
    }));

    updatedSales = [...updatedSales, ...recordsToSave];
    setLocalSales(updatedSales);

    // 2. Add to sync queue for background processing
    addToSyncQueue('SAVE_DAILY_SALES', { date, recordsToSave });

    // 3. Trigger fire-and-forget sync
    this.syncOfflineData();
  },

  /**
   * Fetches the entire month's sales from local storage
   */
  async getMonthlySales(datePrefix: string): Promise<DailySale[]> {
    const allSales = getLocalSales();
    return allSales.filter(s => s.date.startsWith(datePrefix));
  },

  /**
   * Resets all sales records for a given month (YYYY-MM)
   */
  async resetMonthlySales(datePrefix: string): Promise<void> {
    const allSales = getLocalSales();
    const filtered = allSales.filter(s => !s.date.startsWith(datePrefix));
    setLocalSales(filtered);

    addToSyncQueue('RESET_MONTHLY_SALES', { datePrefix });
    this.syncOfflineData();
  },

  /**
   * Helper to calculate MTD totals and daily summaries from local data
   */
  getDashboardStats(date: string) {
    const allSales = getLocalSales();
    const datePrefix = date.substring(0, 7);
    const monthSales = allSales.filter(s => s.date.startsWith(datePrefix));
    
    const stats: Record<string, { dailyRM: number, dailyQty: number, mtdRM: number, mtdQty: number }> = {};
    const brands = getLocalBrands();

    brands.forEach(b => {
      const dEntry = monthSales.find(s => s.brandId === b.id && s.date === date);
      const bMonthList = monthSales.filter(s => s.brandId === b.id && s.date <= date);
      
      let mtdRM = 0;
      let mtdQty = 0;

      // Find latest override if exists
      const latestOverride = [...bMonthList].sort((a,b) => b.date.localeCompare(a.date)).find(s => s.mtdSalesAmount !== undefined);
      
      if (latestOverride) {
        mtdRM = latestOverride.mtdSalesAmount || 0;
        mtdQty = latestOverride.mtdQuantitySold || 0;
      } else {
        mtdRM = bMonthList.reduce((acc, s) => acc + s.salesAmount, 0);
        mtdQty = bMonthList.reduce((acc, s) => acc + s.quantitySold, 0);
      }

      stats[b.id] = {
        dailyRM: dEntry?.salesAmount || 0,
        dailyQty: dEntry?.quantitySold || 0,
        mtdRM,
        mtdQty
      };
    });

    return stats;
  }
};

