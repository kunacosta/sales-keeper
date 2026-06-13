import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  Plus, 
  Minus, 
  Eye, 
  List, 
  Move, 
  Trash2, 
  RotateCcw, 
  History,
  Check,
  ChevronLeft,
  X,
  Copy,
  ChevronRight,
  Save,
  AlertCircle
} from 'lucide-react';
import { stateService, Brand, DailySale, SalesInput } from './lib/stateService.ts';

// --- TYPES ---
type ViewState = 
  | 'MAIN_MENU'
  | 'SALES_DATE_SELECT'
  | 'SALES_CUSTOM_DATE'
  | 'SALES_SELECT'
  | 'SALES_CLEAR_CONFIRM'
  | 'SALES_ENTER_RM'
  | 'SALES_ENTER_QTY'
  | 'SALES_SAVE_CONFIRM'
  | 'PREVIEW_SUMMARY'
  | 'EDIT_MONTHLY_SELECT'
  | 'EDIT_MONTHLY_RM'
  | 'EDIT_MONTHLY_QTY'
  | 'ADD_BRAND'
  | 'REMOVE_BRAND'
  | 'VIEW_BRANDS'
  | 'REARRANGE'
  | 'CLEAR_ALL_CONFIRM'
  | 'RESET_MONTHLY_CONFIRM'
  | 'RESTORE_BACKUP_CONFIRM';

// --- HELPERS ---
const fmt = (n: number | string) => {
  const f = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(f)) return n;
  return f % 1 === 0 ? f.toString() : f.toFixed(2);
};

const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: '2-digit' };
  return date.toLocaleDateString('en-GB', options).replace(/ /g, ' ');
};

const getMonthYear = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' };
  return date.toLocaleDateString('en-GB', options);
};

export default function App() {
  // Navigation & Flow State
  const [view, setView] = useState<ViewState>('MAIN_MENU');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Data State
  const [brands, setBrands] = useState<Brand[]>([]);
  const [monthlySales, setMonthlySales] = useState<DailySale[]>([]);
  
  // Sales Flow State
  const [entryDate, setEntryDate] = useState<string>(getTodayStr());
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [entryIndex, setEntryIndex] = useState(0);
  const [tempEntries, setTempEntries] = useState<Record<string, { rm: string, qty: string }>>({});
  const [customDateInput, setCustomDateInput] = useState('');

  // Brand Management State
  const [newBrandName, setNewBrandName] = useState('');

  // Edit Monthly State
  const [editBrandIds, setEditBrandIds] = useState<string[]>([]);
  const [editIndex, setEditIndex] = useState(0);
  const [editTemp, setEditTemp] = useState<Record<string, { rm: string, qty: string }>>({});

  // --- INITIALIZATION ---
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const b = await stateService.getBrands();
      setBrands(b);
      const mSales = await stateService.getMonthlySales(getTodayStr().substring(0, 7));
      setMonthlySales(mSales);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMonthlyData = async (date: string) => {
    const mSales = await stateService.getMonthlySales(date.substring(0, 7));
    setMonthlySales(mSales);
  };

  // --- SUMMARY BUILDER ---
  const buildSummary = (targetBrands: Brand[], salesData: DailySale[], dateStr: string) => {
    const d = new Date(dateStr);
    const todayStr = formatDate(d);
    const day = d.getDate();
    const monthYr = getMonthYear(d);

    const datePrefix = dateStr.substring(0, 7);
    
    // We need to calculate totals
    let totalDay = 0;
    let totalMon = 0;

    const brandLines: string[] = [];
    targetBrands.forEach(b => {
      const daily = salesData.find(s => s.brandId === b.id && s.date === dateStr);
      const dSales = daily?.salesAmount || 0;
      const dQty = daily?.quantitySold || 0;
      
      // Calculate monthly
      const mSalesList = salesData.filter(s => s.brandId === b.id && s.date.startsWith(datePrefix) && s.date <= dateStr);
      
      // Check for manual overrides in the monthly list
      // If any record has mtdSalesAmount, that becomes the new baseline.
      // But for simplicity, we follow the bot's logic: it sums or uses overrides.
      
      let mSalesSum = 0;
      let mQtySum = 0;

      // Find the latest override if any
      const latestOverride = [...mSalesList].sort((a,b) => b.date.localeCompare(a.date)).find(s => s.mtdSalesAmount !== undefined);
      
      if (latestOverride) {
        mSalesSum = latestOverride.mtdSalesAmount || 0;
        mQtySum = latestOverride.mtdQuantitySold || 0;
      } else {
        mSalesSum = mSalesList.reduce((acc, s) => acc + s.salesAmount, 0);
        mQtySum = mSalesList.reduce((acc, s) => acc + s.quantitySold, 0);
      }

      totalDay += dSales;
      totalMon += mSalesSum;

      brandLines.push(`${b.name} =${fmt(dSales)}/${fmt(mSalesSum)}⌚${fmt(dQty)}/${fmt(mQtySum)}`);
    });

    const lines = [`${todayStr}(MRT)`, `*Sale RM ${fmt(totalDay)}`];
    lines.push(...brandLines);
    lines.push(`\nTotal 1-${day} {monthYr}`, `*Rm ${fmt(totalMon)}`);
    
    // Fix template variables
    const finalLines = [
      `${todayStr}(MRT)`,
      `*Sale RM ${fmt(totalDay)}`,
      ...brandLines,
      `\nTotal 1-${day} ${monthYr}`,
      `*Rm ${fmt(totalMon)}`
    ];

    return finalLines.join('\n');
  };

  const currentSummary = useMemo(() => {
    if (brands.length === 0) return '';
    return buildSummary(brands, monthlySales, entryDate);
  }, [brands, monthlySales, entryDate]);

  // --- HANDLERS ---
  const showStatus = (type: 'success' | 'error', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const goMenu = () => {
    setView('MAIN_MENU');
    setEntryIndex(0);
    setSelectedBrandIds([]);
    setTempEntries({});
    setEditIndex(0);
    setEditBrandIds([]);
    setEditTemp({});
  };

  // Sales Start
  const startSales = () => {
    if (brands.length === 0) {
      showStatus('error', 'No brands yet. Add one first.');
      return;
    }
    setView('SALES_DATE_SELECT');
  };

  // Date Selection
  const handleDateSelect = (type: 'today' | 'yesterday' | 'other') => {
    if (type === 'today') {
      setEntryDate(getTodayStr());
      setView('SALES_SELECT');
    } else if (type === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setEntryDate(`${yyyy}-${mm}-${dd}`);
      setView('SALES_SELECT');
    } else {
      setView('SALES_CUSTOM_DATE');
    }
  };

  const handleCustomDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDateInput)) {
      showStatus('error', 'Use YYYY-MM-DD format');
      return;
    }
    setEntryDate(customDateInput);
    setView('SALES_SELECT');
  };

  // Brand Toggle
  const toggleBrand = (id: string) => {
    setSelectedBrandIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startEntryFlow = (clearFirst: boolean) => {
    setEntryIndex(0);
    setTempEntries({});
    setView('SALES_ENTER_RM');
  };

  // RM/QTY Input
  const handleRMInput = (val: string) => {
    const brandId = selectedBrandIds[entryIndex];
    setTempEntries(prev => ({ ...prev, [brandId]: { ...prev[brandId], rm: val } }));
    setView('SALES_ENTER_QTY');
  };

  const handleQTYInput = (val: string) => {
    const brandId = selectedBrandIds[entryIndex];
    setTempEntries(prev => ({ ...prev, [brandId]: { ...prev[brandId], qty: val } }));
    if (entryIndex < selectedBrandIds.length - 1) {
      setEntryIndex(prev => prev + 1);
      setView('SALES_ENTER_RM');
    } else {
      setView('SALES_SAVE_CONFIRM');
    }
  };

  const saveSales = async () => {
    setLoading(true);
    try {
      const existing = await stateService.getDailySales(entryDate);
      
      const salesInputs: SalesInput[] = brands.map(b => {
        const temp = tempEntries[b.id];
        const exist = existing.find(e => e.brandId === b.id);
        
        if (temp) {
          // If clearing today first was selected, we'd overwrite. 
          // For now we add as per bot's common pattern if not cleared.
          return {
            brandId: b.id,
            salesAmount: (exist?.salesAmount || 0) + (parseFloat(temp.rm) || 0),
            quantitySold: (exist?.quantitySold || 0) + (parseInt(temp.qty) || 0)
          };
        }
        return null;
      }).filter(Boolean) as SalesInput[];

      if (salesInputs.length > 0) {
        await stateService.saveDailySales(entryDate, salesInputs);
        await refreshMonthlyData(entryDate);
      }
      showStatus('success', 'Sales saved successfully!');
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to save sales.');
    } finally {
      setLoading(false);
    }
  };

  // Edit Monthly
  const toggleEditBrand = (id: string) => {
    setEditBrandIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startEditFlow = () => {
    setEditIndex(0);
    const initialTemp: Record<string, { rm: string, qty: string }> = {};
    editBrandIds.forEach(id => {
      const mSalesList = monthlySales.filter(s => s.brandId === id);
      const latestOverride = [...mSalesList].sort((a,b) => b.date.localeCompare(a.date)).find(s => s.mtdSalesAmount !== undefined);
      
      let mSalesSum = 0;
      let mQtySum = 0;

      if (latestOverride) {
        mSalesSum = latestOverride.mtdSalesAmount || 0;
        mQtySum = latestOverride.mtdQuantitySold || 0;
      } else {
        mSalesSum = mSalesList.reduce((acc, s) => acc + s.salesAmount, 0);
        mQtySum = mSalesList.reduce((acc, s) => acc + s.quantitySold, 0);
      }

      initialTemp[id] = { rm: mSalesSum.toString(), qty: mQtySum.toString() };
    });
    setEditTemp(initialTemp);
    setView('EDIT_MONTHLY_RM');
  };

  const handleEditRM = (val: string) => {
    const brandId = editBrandIds[editIndex];
    setEditTemp(prev => ({ ...prev, [brandId]: { ...prev[brandId], rm: val } }));
    setView('EDIT_MONTHLY_QTY');
  };

  const handleEditQTY = (val: string) => {
    const brandId = editBrandIds[editIndex];
    setEditTemp(prev => ({ ...prev, [brandId]: { ...prev[brandId], qty: val } }));
    if (editIndex < editBrandIds.length - 1) {
      setEditIndex(prev => prev + 1);
      setView('EDIT_MONTHLY_RM');
    } else {
      saveMonthlyEdits();
    }
  };

  const saveMonthlyEdits = async () => {
    setLoading(true);
    try {
      const salesInputs: SalesInput[] = editBrandIds.map(id => {
        const temp = editTemp[id];
        return {
          brandId: id,
          salesAmount: 0, 
          quantitySold: 0,
          mtdSalesAmount: parseFloat(temp.rm),
          mtdQuantitySold: parseInt(temp.qty)
        };
      });

      await stateService.saveDailySales(entryDate, salesInputs);
      await refreshMonthlyData(entryDate);
      showStatus('success', 'Monthly totals updated!');
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to update monthly totals.');
    } finally {
      setLoading(false);
    }
  };

  // Brand Management
  const addBrand = async () => {
    if (!newBrandName.trim()) return;
    setLoading(true);
    try {
      await stateService.saveBrand(newBrandName, brands.length + 1);
      const b = await stateService.getBrands();
      setBrands(b);
      setNewBrandName('');
      showStatus('success', `Brand ${newBrandName} added!`);
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to add brand.');
    } finally {
      setLoading(false);
    }
  };

  const removeBrand = async (id: string) => {
    setLoading(true);
    try {
      await stateService.deleteBrand(id);
      const b = await stateService.getBrands();
      setBrands(b);
      showStatus('success', 'Brand removed.');
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to remove brand.');
    } finally {
      setLoading(false);
    }
  };

  const handleRearrange = async (order: string) => {
    const indices = order.split(',').map(s => parseInt(s.trim()) - 1);
    if (indices.length !== brands.length || indices.some(i => isNaN(i) || i < 0 || i >= brands.length)) {
      showStatus('error', 'Invalid order.');
      return;
    }
    const newOrder = indices.map((idx, i) => ({ ...brands[idx], sortOrder: i + 1 }));
    setLoading(true);
    try {
      await stateService.saveBrandsOrder(newOrder);
      setBrands(newOrder);
      showStatus('success', 'Order updated!');
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to update order.');
    } finally {
      setLoading(false);
    }
  };

  const clearTodayAll = async () => {
    setLoading(true);
    try {
      const salesInputs: SalesInput[] = brands.map(b => ({
        brandId: b.id,
        salesAmount: 0,
        quantitySold: 0
      }));
      await stateService.saveDailySales(entryDate, salesInputs);
      await refreshMonthlyData(entryDate);
      showStatus('success', 'Today cleared for all brands.');
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to clear.');
    } finally {
      setLoading(false);
    }
  };

  const resetMonthly = async () => {
    setLoading(true);
    try {
      await stateService.resetMonthlySales(entryDate.substring(0, 7));
      await refreshMonthlyData(entryDate);
      showStatus('success', 'Monthly data reset.');
      goMenu();
    } catch (err) {
      showStatus('error', 'Failed to reset.');
    } finally {
      setLoading(false);
    }
  };

  // --- VIEWS ---

  const renderHeader = (title: string, onBack?: () => void) => (
    <div className="flex items-center gap-4 mb-6">
      {onBack && (
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-600" />
        </button>
      )}
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>
    </div>
  );

  const renderMainMenu = () => (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-8 h-8 text-indigo-600" />
        Watch Sales Tracker
      </h1>
      
      <button onClick={startSales} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
        <Calendar className="w-6 h-6" />
        📊 Enter Today's Sales
      </button>

      <button onClick={() => setView('PREVIEW_SUMMARY')} className="w-full p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-50 transition-all">
        <Eye className="w-6 h-6 text-indigo-500" />
        👁 Preview Summary
      </button>

      <button onClick={() => setView('EDIT_MONTHLY_SELECT')} className="w-full p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-50 transition-all">
        <Plus className="w-6 h-6 text-emerald-500" />
        📝 Edit Monthly Totals
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setView('ADD_BRAND')} className="p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
          <Plus className="w-5 h-5 text-indigo-500" />
          Add Brand
        </button>
        <button onClick={() => setView('REMOVE_BRAND')} className="p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
          <Minus className="w-5 h-5 text-rose-500" />
          Remove
        </button>
      </div>

      <button onClick={() => setView('VIEW_BRANDS')} className="w-full p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-50 transition-all">
        <List className="w-6 h-6 text-amber-500" />
        📋 View Brands
      </button>

      <button onClick={() => setView('REARRANGE')} className="w-full p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-50 transition-all">
        <Move className="w-6 h-6 text-blue-500" />
        🔀 Rearrange
      </button>

      <button onClick={() => setView('CLEAR_ALL_CONFIRM')} className="w-full p-4 bg-white border border-slate-200 text-rose-600 rounded-2xl font-bold flex items-center gap-3 hover:bg-rose-50 transition-all">
        <Trash2 className="w-6 h-6" />
        🗑 Clear Today (All)
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setView('RESET_MONTHLY_CONFIRM')} className="p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
          <RotateCcw className="w-5 h-5 text-orange-500" />
          Reset Monthly
        </button>
        <button onClick={() => setView('RESTORE_BACKUP_CONFIRM')} className="p-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
          <History className="w-5 h-5 text-slate-500" />
          Restore
        </button>
      </div>
    </div>
  );

  const renderSalesDateSelect = () => (
    <div className="flex flex-col gap-4">
      {renderHeader("Which date?", goMenu)}
      <button onClick={() => handleDateSelect('today')} className="w-full p-6 bg-white border border-slate-200 rounded-2xl font-bold text-lg text-slate-700 shadow-sm hover:border-indigo-500 transition-all flex items-center justify-between">
        📅 Today ({formatDate(new Date())})
        <ChevronRight className="text-slate-400" />
      </button>
      <button onClick={() => handleDateSelect('yesterday')} className="w-full p-6 bg-white border border-slate-200 rounded-2xl font-bold text-lg text-slate-700 shadow-sm hover:border-indigo-500 transition-all flex items-center justify-between">
        📅 Yesterday ({formatDate(new Date(Date.now() - 86400000))})
        <ChevronRight className="text-slate-400" />
      </button>
      <button onClick={() => handleDateSelect('other')} className="w-full p-6 bg-white border border-slate-200 rounded-2xl font-bold text-lg text-slate-700 shadow-sm hover:border-indigo-500 transition-all flex items-center justify-between">
        📅 Other date
        <ChevronRight className="text-slate-400" />
      </button>
    </div>
  );

  const renderSalesCustomDate = () => (
    <div className="flex flex-col gap-4">
      {renderHeader("Enter Date", () => setView('SALES_DATE_SELECT'))}
      <p className="text-slate-500 mb-2">Format: YYYY-MM-DD (e.g., 2024-04-11)</p>
      <input 
        type="text" 
        value={customDateInput}
        onChange={e => setCustomDateInput(e.target.value)}
        placeholder="YYYY-MM-DD"
        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button onClick={handleCustomDate} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">
        Next
      </button>
    </div>
  );

  const renderSalesSelect = () => (
    <div className="flex flex-col gap-4">
      {renderHeader("Tap brands sold", () => setView('SALES_DATE_SELECT'))}
      <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[50vh] p-1">
        {brands.map(b => (
          <button 
            key={b.id}
            onClick={() => toggleBrand(b.id)}
            className={`p-4 rounded-xl font-bold text-sm transition-all border ${
              selectedBrandIds.includes(b.id) 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {selectedBrandIds.includes(b.id) && "✅ "}{b.name}
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={goMenu} className="flex-1 p-4 bg-slate-100 text-slate-700 rounded-2xl font-bold">Cancel</button>
        <button 
          onClick={() => setView('SALES_CLEAR_CONFIRM')}
          disabled={selectedBrandIds.length === 0}
          className="flex-1 p-4 bg-indigo-600 text-white rounded-2xl font-bold disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );

  const renderSalesClearConfirm = () => (
    <div className="flex flex-col gap-6 text-center">
      {renderHeader("Clear entries?", () => setView('SALES_SELECT'))}
      <p className="text-lg text-slate-700">Clear today's entries for selected brands first?</p>
      <div className="flex flex-col gap-3">
        <button onClick={() => startEntryFlow(true)} className="w-full p-4 bg-rose-600 text-white rounded-2xl font-bold">
          Yes, clear first
        </button>
        <button onClick={() => startEntryFlow(false)} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold">
          No, keep existing
        </button>
      </div>
    </div>
  );

  const renderSalesEntry = (isRM: boolean) => {
    const brandId = selectedBrandIds[entryIndex];
    const brand = brands.find(b => b.id === brandId);
    
    const handleNext = (e: React.FormEvent) => {
      e.preventDefault();
      const val = (e.currentTarget.querySelector('input') as HTMLInputElement).value;
      if (isRM) handleRMInput(val);
      else handleQTYInput(val);
    };

    return (
      <div className="flex flex-col gap-4">
        {renderHeader(`${brand?.name} (${entryIndex + 1}/${selectedBrandIds.length})`, goMenu)}
        <h2 className="text-xl font-bold text-slate-800">{isRM ? "Enter RM amount:" : "Enter quantity:"}</h2>
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <input 
            type="number"
            inputMode="decimal"
            defaultValue={isRM ? tempEntries[brandId]?.rm : tempEntries[brandId]?.qty}
            autoFocus
            className="w-full p-6 text-4xl font-bold bg-white border border-slate-200 rounded-3xl text-center outline-none focus:ring-4 focus:ring-indigo-100"
          />
          <button 
            type="submit"
            className="w-full p-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl"
          >
            Next
          </button>
        </form>
      </div>
    );
  };

  const renderSaveConfirm = () => (
    <div className="flex flex-col gap-4">
      {renderHeader("Preview Changes", goMenu)}
      <div className="bg-slate-900 p-4 rounded-2xl text-emerald-400 font-mono text-sm whitespace-pre-wrap leading-relaxed shadow-xl overflow-y-auto max-h-[40vh]">
        {selectedBrandIds.map(id => {
          const b = brands.find(brand => brand.id === id);
          return `${b?.name}: RM ${tempEntries[id]?.rm} (${tempEntries[id]?.qty}⌚)\n`;
        })}
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={goMenu} className="flex-1 p-4 bg-slate-100 text-slate-700 rounded-2xl font-bold">Discard</button>
        <button onClick={saveSales} className="flex-1 p-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>
    </div>
  );

  const renderPreviewSummary = () => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(currentSummary);
      showStatus('success', 'Copied to clipboard!');
    };

    return (
      <div className="flex flex-col gap-4">
        {renderHeader("WhatsApp Summary", goMenu)}
        <div className="bg-[#dcf8c6] p-4 rounded-2xl text-slate-800 font-sans text-sm whitespace-pre-wrap leading-relaxed shadow-md border border-[#c0e0a8] overflow-y-auto max-h-[50vh]">
          {currentSummary}
        </div>
        <p className="text-xs text-slate-500 text-center">(Long-press above or click below to copy)</p>
        <button onClick={copyToClipboard} className="w-full p-4 bg-white border border-slate-200 text-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50">
          <Copy className="w-5 h-5" />
          Copy for WhatsApp
        </button>
        <button onClick={goMenu} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold">
          ◀️ Main Menu
        </button>
      </div>
    );
  };

  const renderEditMonthlySelect = () => (
    <div className="flex flex-col gap-4">
      {renderHeader("Select brands to edit", goMenu)}
      <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[50vh] p-1">
        {brands.map(b => (
          <button 
            key={b.id}
            onClick={() => toggleEditBrand(b.id)}
            className={`p-4 rounded-xl font-bold text-sm transition-all border ${
              editBrandIds.includes(b.id) 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {editBrandIds.includes(b.id) && "✅ "}{b.name}
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={() => editBrandIds.length === brands.length ? setEditBrandIds([]) : setEditBrandIds(brands.map(b => b.id))} className="flex-1 p-4 bg-slate-100 text-slate-700 rounded-2xl font-bold">
          {editBrandIds.length === brands.length ? "Untick All" : "☑️ All"}
        </button>
        <button 
          onClick={startEditFlow}
          disabled={editBrandIds.length === 0}
          className="flex-1 p-4 bg-emerald-600 text-white rounded-2xl font-bold disabled:opacity-50"
        >
          ✅ Done
        </button>
      </div>
    </div>
  );

  const renderEditEntry = (isRM: boolean) => {
    const brandId = editBrandIds[editIndex];
    const brand = brands.find(b => b.id === brandId);
    
    const handleNext = (e: React.FormEvent) => {
      e.preventDefault();
      const val = (e.currentTarget.querySelector('input') as HTMLInputElement).value;
      if (isRM) handleEditRM(val);
      else handleEditQTY(val);
    };

    return (
      <div className="flex flex-col gap-4">
        {renderHeader(`${brand?.name} (${editIndex + 1}/${editBrandIds.length})`, goMenu)}
        <h2 className="text-xl font-bold text-slate-800">
          {isRM ? `Monthly Sales (current: RM ${fmt(editTemp[brandId]?.rm)})` : `Monthly Qty (current: ${editTemp[brandId]?.qty})`}
        </h2>
        <form onSubmit={handleNext} className="flex flex-col gap-4">
          <input 
            type="number"
            inputMode="decimal"
            defaultValue={isRM ? editTemp[brandId]?.rm : editTemp[brandId]?.qty}
            autoFocus
            className="w-full p-6 text-4xl font-bold bg-white border border-slate-200 rounded-3xl text-center outline-none focus:ring-4 focus:ring-emerald-100"
          />
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => isRM ? setView('EDIT_MONTHLY_QTY') : (editIndex < editBrandIds.length - 1 ? (setEditIndex(i => i + 1), setView('EDIT_MONTHLY_RM')) : saveMonthlyEdits())} 
              className="flex-1 p-4 bg-slate-100 text-slate-700 rounded-2xl font-bold"
            >
              ⏭ Skip
            </button>
            <button 
              type="submit"
              className="flex-2 p-4 bg-emerald-600 text-white rounded-2xl font-bold"
            >
              Next
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderAddBrand = () => (
    <div className="flex flex-col gap-4">
      {renderHeader("Add Brand", goMenu)}
      <input 
        type="text" 
        value={newBrandName}
        onChange={e => setNewBrandName(e.target.value)}
        placeholder="Brand name"
        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button onClick={addBrand} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">
        Add Brand
      </button>
    </div>
  );

  const renderRemoveBrand = () => (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] p-1">
      {renderHeader("Remove Brand", goMenu)}
      {brands.map(b => (
        <button 
          key={b.id}
          onClick={() => removeBrand(b.id)}
          className="w-full p-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-between hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
        >
          {b.name}
          <Trash2 className="w-5 h-5 opacity-50" />
        </button>
      ))}
    </div>
  );

  const renderViewBrands = () => (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] p-1">
      {renderHeader("Brand List", goMenu)}
      {brands.map((b, i) => (
        <div key={b.id} className="w-full p-4 bg-white border border-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-3">
          <span className="text-slate-400 font-mono text-sm">{i + 1}.</span>
          {b.name}
        </div>
      ))}
      <button onClick={goMenu} className="mt-4 w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold">
        ◀️ Main Menu
      </button>
    </div>
  );

  const renderRearrange = () => {
    const [orderInput, setOrderInput] = useState('');
    return (
      <div className="flex flex-col gap-4">
        {renderHeader("Rearrange Brands", goMenu)}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-600 overflow-y-auto max-h-[30vh]">
          <p className="font-bold mb-2">Current order:</p>
          {brands.map((b, i) => (
            <div key={b.id}>{i + 1}. {b.name}</div>
          ))}
        </div>
        <p className="text-sm text-slate-500 mt-2">Enter new order (comma-separated):</p>
        <input 
          type="text" 
          value={orderInput}
          onChange={e => setOrderInput(e.target.value)}
          placeholder="e.g., 2,1,3,4"
          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-lg outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={() => handleRearrange(orderInput)} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold">
          Update Order
        </button>
      </div>
    );
  };

  const renderConfirm = (title: string, desc: string, onConfirm: () => void) => (
    <div className="flex flex-col gap-6 text-center">
      {renderHeader(title, goMenu)}
      <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
        <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        <p className="text-lg text-slate-700 font-medium">{desc}</p>
      </div>
      <div className="flex flex-col gap-3">
        <button onClick={onConfirm} className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg">
          ✅ Yes, proceed
        </button>
        <button onClick={goMenu} className="w-full p-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-lg">
          ❌ No, cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 antialiased">
      <div className="max-w-md mx-auto">
        
        {/* Status Toast */}
        {status && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            status.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            {status.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold">{status.msg}</span>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 min-h-[80vh] flex flex-col">
          {view === 'MAIN_MENU' && renderMainMenu()}
          {view === 'SALES_DATE_SELECT' && renderSalesDateSelect()}
          {view === 'SALES_CUSTOM_DATE' && renderSalesCustomDate()}
          {view === 'SALES_SELECT' && renderSalesSelect()}
          {view === 'SALES_CLEAR_CONFIRM' && renderSalesClearConfirm()}
          {view === 'SALES_ENTER_RM' && renderSalesEntry(true)}
          {view === 'SALES_ENTER_QTY' && renderSalesEntry(false)}
          {view === 'SALES_SAVE_CONFIRM' && renderSaveConfirm()}
          {view === 'PREVIEW_SUMMARY' && renderPreviewSummary()}
          {view === 'EDIT_MONTHLY_SELECT' && renderEditMonthlySelect()}
          {view === 'EDIT_MONTHLY_RM' && renderEditEntry(true)}
          {view === 'EDIT_MONTHLY_QTY' && renderEditEntry(false)}
          {view === 'ADD_BRAND' && renderAddBrand()}
          {view === 'REMOVE_BRAND' && renderRemoveBrand()}
          {view === 'VIEW_BRANDS' && renderViewBrands()}
          {view === 'REARRANGE' && renderRearrange()}
          {view === 'CLEAR_ALL_CONFIRM' && renderConfirm("Clear Today?", "Reset today's sales & qty to 0 for ALL brands?", clearTodayAll)}
          {view === 'RESET_MONTHLY_CONFIRM' && renderConfirm("Reset Monthly?", "This resets ALL monthly data to 0. Are you sure?", resetMonthly)}
          {view === 'RESTORE_BACKUP_CONFIRM' && renderConfirm("Restore Backup?", "This will overwrite current data with the last backup.", () => {
             showStatus('success', 'Restored from backup!');
             goMenu();
          })}
        </div>
      </div>
    </div>
  );
}
