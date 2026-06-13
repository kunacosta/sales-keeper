import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Trash2, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  Copy, 
  TrendingUp, 
  AlertCircle, 
  SlidersHorizontal,
  RefreshCw,
  Search,
  PenLine,
  X,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { stateService, Brand, DailySale } from './lib/stateService.ts';

export default function App() {
  // Current tab: 'entry' or 'management'
  const [activeTab, setActiveTab] = useState<'entry' | 'management'>('entry');
  
  // Date configuration (defaults to today's local date)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // State elements
  const [brands, setBrands] = useState<Brand[]>([]);
  const [monthlySales, setMonthlySales] = useState<DailySale[]>([]);
  const [dailySalesInputs, setDailySalesInputs] = useState<{ [brandId: string]: { salesAmount: string; quantitySold: string } }>({});
  
  // Choose brand selection state & temporary key-in inputs (Multi-Selection enabled)
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [isBrandConfirmed, setIsBrandConfirmed] = useState<boolean>(false);
  const [wizardInputs, setWizardInputs] = useState<{ [brandId: string]: { salesAmount: string; quantitySold: string } }>({});
  const [showOnlyWithSales, setShowOnlyWithSales] = useState<boolean>(true);

  // Batch Report Import States
  const [rawTextToImport, setRawTextToImport] = useState<string>('');
  const [showImportPanel, setShowImportPanel] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'amber' | 'error'; text: string } | null>(null);
  const [pendingInputs, setPendingInputs] = useState<{ [brandId: string]: { salesAmount: string; quantitySold: string } } | null>(null);

  // Interaction/UI states
  const [loading, setLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Brand management state
  const [newBrandName, setNewBrandName] = useState<string>('');
  const [brandError, setBrandError] = useState<string | null>(null);

  // Load basic configurations
  useEffect(() => {
    loadBaseData();
  }, [selectedDate]);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const bList = await stateService.getBrands();
      setBrands(bList);

      // Load monthly sales to compute running MTD totals
      const yearMonth = selectedDate.substring(0, 7); // YYYY-MM
      const mSales = await stateService.getMonthlySales(yearMonth);
      setMonthlySales(mSales);

      // Load current day's saved input values
      const dSales = await stateService.getDailySales(selectedDate);
      
      // Map loaded values to input states
      const initialInputs: typeof dailySalesInputs = {};
      bList.forEach((b) => {
        const found = dSales.find(s => s.brandId === b.id);
        initialInputs[b.id] = {
          salesAmount: found && found.salesAmount > 0 ? String(found.salesAmount) : '',
          quantitySold: found && found.quantitySold > 0 ? String(found.quantitySold) : ''
        };
      });
      
      if (pendingInputs) {
        const merged = { ...initialInputs, ...pendingInputs };
        setDailySalesInputs(merged);
        setPendingInputs(null); // Reset queue
      } else {
        setDailySalesInputs(initialInputs);
      }
      
      // Reset active brand key-in selection on date change
      setSelectedBrandIds([]);
      setIsBrandConfirmed(false);
      setWizardInputs({});
      
      setSaveStatus(null);
    } catch (err) {
      console.error('Error loading static dataset:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Computes MTD stats for a given brand
  // MTD sums historical sales from the 1st of the month UP TO the selected date (inclusive)
  const getBrandMTD = (brandId: string) => {
    let salesAmountSum = 0;
    let quantitySoldSum = 0;

    // We filter monthlySales where date is <= selectedDate
    monthlySales.forEach((sale) => {
      if (sale.brandId === brandId && sale.date <= selectedDate) {
        salesAmountSum += sale.salesAmount;
        quantitySoldSum += sale.quantitySold;
      }
    });

    // Also factor in current unsaved/inputted values from the state to make it real-time!
    const currentInput = dailySalesInputs[brandId];
    const currentInputAmt = parseFloat(currentInput?.salesAmount || '0') || 0;
    const currentInputQty = parseInt(currentInput?.quantitySold || '0', 10) || 0;

    // Find if the current date is already saved in monthlySales to avoid double-counting
    const wasAlreadySavedInMonth = monthlySales.some(s => s.brandId === brandId && s.date === selectedDate);
    if (!wasAlreadySavedInMonth) {
      salesAmountSum += currentInputAmt;
      quantitySoldSum += currentInputQty;
    } else {
      // If it was already saved, replace the saved monthly record value with current real-time input
      const savedRecord = monthlySales.find(s => s.brandId === brandId && s.date === selectedDate);
      if (savedRecord) {
        salesAmountSum = salesAmountSum - savedRecord.salesAmount + currentInputAmt;
        quantitySoldSum = quantitySoldSum - savedRecord.quantitySold + currentInputQty;
      }
    }

    return {
      salesAmount: salesAmountSum,
      quantitySold: quantitySoldSum
    };
  };

  // Change input handler
  const handleInputChange = (brandId: string, field: 'salesAmount' | 'quantitySold', value: string) => {
    // Only allow numbers and decimal places
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setDailySalesInputs(prev => ({
      ...prev,
      [brandId]: {
        ...prev[brandId],
        [field]: cleanValue
      }
    }));
  };

  // Clear all current selections
  const handleClearSelectionState = () => {
    setSelectedBrandIds([]);
  };

  // Select/Toggle a brand in multi-selection mode
  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandIds(prev => {
      if (prev.includes(brandId)) {
        return prev.filter(id => id !== brandId);
      } else {
        return [...prev, brandId];
      }
    });
  };

  // User clicked "Done" to confirm selected brands and start typing the numbers
  const handleConfirmBrand = () => {
    if (selectedBrandIds.length === 0) return;
    
    // Initialize wizard inputs with existing values from dailySalesInputs (or empty if none)
    const initialWizardInputs: { [brandId: string]: { salesAmount: string; quantitySold: string } } = {};
    selectedBrandIds.forEach(id => {
      initialWizardInputs[id] = {
        salesAmount: dailySalesInputs[id]?.salesAmount || '',
        quantitySold: dailySalesInputs[id]?.quantitySold || ''
      };
    });
    
    setWizardInputs(initialWizardInputs);
    setIsBrandConfirmed(true);
    
    // Focus the first sales amount input field in the grid
    setTimeout(() => {
      const firstInput = document.querySelector('.wizard-sales-input') as HTMLInputElement;
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);
  };

  // Cancel/Undo or change active selection
  const handleCancelSelection = () => {
    setIsBrandConfirmed(false);
    setSelectedBrandIds([]);
    setWizardInputs({});
  };

  // Handle value key-in change for a specific brand in the active wizard
  const handleWizardInputChange = (brandId: string, field: 'salesAmount' | 'quantitySold', value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setWizardInputs(prev => ({
      ...prev,
      [brandId]: {
        ...prev[brandId],
        [field]: cleanValue
      }
    }));
  };

  // Remove a brand from the current active key-in wizard (e.g. if selected by mistake)
  const handleRemoveBrandFromWizard = (brandId: string) => {
    const updatedIds = selectedBrandIds.filter(id => id !== brandId);
    setSelectedBrandIds(updatedIds);
    setWizardInputs(prev => {
      const copy = { ...prev };
      delete copy[brandId];
      return copy;
    });
    
    // If no brands are left, go back to Step 1
    if (updatedIds.length === 0) {
      setIsBrandConfirmed(false);
    }
  };

  // Apply all keyed values from the wizard list to the dailySalesInputs daily ledger
  const applyWizardBrandValues = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedBrandIds.length === 0) return;

    setDailySalesInputs(prev => {
      const updated = { ...prev };
      selectedBrandIds.forEach(id => {
        const draft = wizardInputs[id];
        if (draft) {
          updated[id] = {
            salesAmount: draft.salesAmount.replace(/[^0-9.]/g, ''),
            quantitySold: draft.quantitySold.replace(/[^0-9]/g, '')
          };
        }
      });
      return updated;
    });

    // Alert the user that they successfully mapped the items
    const brandNames = selectedBrandIds
      .map(id => brands.find(b => b.id === id)?.name || '')
      .filter(Boolean)
      .join(', ');

    setSaveStatus({
      type: 'success',
      message: `Updated values for: ${brandNames}. Save Daily Sales to lock it in!`
    });
    setTimeout(() => setSaveStatus(null), 4000);

    // Reset controls
    setSelectedBrandIds([]);
    setWizardInputs({});
    setIsBrandConfirmed(false);
  };

  // Load an existing record into the interactive panel to edit/re-adjust it immediately
  const loadBrandForEdit = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    if (brand) {
      setSelectedBrandIds([brandId]);
      setWizardInputs({
        [brandId]: {
          salesAmount: dailySalesInputs[brandId]?.salesAmount || '',
          quantitySold: dailySalesInputs[brandId]?.quantitySold || ''
        }
      });
      setIsBrandConfirmed(true); // Straight to edit value inputs
      
      // Auto scroll to key-in panel so user has focus
      const panel = document.getElementById('brand-keyin-panel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // Auto focus key-in amount field
      setTimeout(() => {
        const firstInput = document.querySelector('.wizard-sales-input') as HTMLInputElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 200);
    }
  };

  // Save changes
  const handleSave = async () => {
    try {
      setLoading(true);
      const inputs = Object.entries(dailySalesInputs).map(([brandId, val]) => {
        const item = val as { salesAmount: string; quantitySold: string };
        return {
          brandId,
          salesAmount: parseFloat(item.salesAmount) || 0,
          quantitySold: parseInt(item.quantitySold, 10) || 0
        };
      });

      await stateService.saveDailySales(selectedDate, inputs);
      
      // Reload monthly sales to refresh calculation caches
      const yearMonth = selectedDate.substring(0, 7);
      const mSales = await stateService.getMonthlySales(yearMonth);
      setMonthlySales(mSales);

      setSaveStatus({
        type: 'success',
        message: 'Daily record successfully saved and synchronized!'
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Failed to save daily sales. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Zero out inputs
  const handleClearToday = () => {
    if (window.confirm("Are you sure you want to clear all quantities and amounts entered for today?")) {
      const cleared: typeof dailySalesInputs = {};
      brands.forEach((b) => {
        cleared[b.id] = { salesAmount: '', quantitySold: '' };
      });
      setDailySalesInputs(cleared);
    }
  };

  // Copy structured report to clipboard
  const handleCopyReport = async () => {
    try {
      const monthNames = [
        "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
        "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
      ];
      
      const [yearStr, monthStr, dayStr] = selectedDate.split('-');
      const dayNum = parseInt(dayStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const yearNum = parseInt(yearStr, 10);
      const formattedMonth = monthNames[monthNum - 1] || "MONTH";

      // 1. Compute Daily Total Sales Sum
      let dailyTotalSales = 0;
      brands.forEach((b) => {
        const amt = parseFloat(dailySalesInputs[b.id]?.salesAmount || '0') || 0;
        dailyTotalSales += amt;
      });

      // 2. Compute grand total of MTD sales RM for all brands combined
      let grandTotalMTD = 0;
      brands.forEach((b) => {
        grandTotalMTD += getBrandMTD(b.id).salesAmount;
      });

      // 3. Construct specific template
      let report = `${dayNum} ${formattedMonth} ${yearNum}(MRT)\n`;
      report += `*Sale RM ${dailyTotalSales.toFixed(2)}\n\n`;

      brands.forEach((b) => {
        const dailyAmt = parseFloat(dailySalesInputs[b.id]?.salesAmount || '0') || 0;
        const dailyQty = parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10) || 0;
        const mtd = getBrandMTD(b.id);

        report += `${b.name} =${dailyAmt > 0 ? dailyAmt.toFixed(2) : '0'}/${mtd.salesAmount > 0 ? mtd.salesAmount.toFixed(2) : '0'}⌚${dailyQty}/${mtd.quantitySold}\n`;
      });

      report += `\nTotal 1-${dayNum} ${formattedMonth} ${yearNum}\n`;
      report += `*Rm ${grandTotalMTD.toFixed(2)}`;

      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // ==========================================
  // BATCH REPORT TEXT PARSER & IMPORT ROUTINES
  // ==========================================
  const extractDateFromText = (text: string): string | null => {
    const monthShortMap: { [key: string]: string } = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      june: '06', july: '07', sept: '09'
    };

    // Case 1: DD MMM YY or DD MMM YYYY (separated by space, dash or slash)
    const regex1 = /(\d{1,2})[\s\-/\\]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-/\\]+(\d{2,4})/i;
    const match1 = text.match(regex1);
    if (match1) {
      const day = match1[1].padStart(2, '0');
      const monthLabel = match1[2].toLowerCase();
      const month = monthShortMap[monthLabel] || '01';
      let year = match1[3];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }

    // Case 2: YYYY-MM-DD
    const regex2 = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
    const match2 = text.match(regex2);
    if (match2) {
      return `${match2[1]}-${match2[2].padStart(2, '0')}-${match2[3].padStart(2, '0')}`;
    }

    // Case 3: DD-MM-YYYY or DD/MM/YYYY
    const regex3 = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/;
    const match3 = text.match(regex3);
    if (match3) {
      const day = match3[1].padStart(2, '0');
      const month = match3[2].padStart(2, '0');
      let year = match3[3];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const findBrandMatch = (brandRaw: string): Brand | undefined => {
    const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = cleanStr(brandRaw);
    if (!target) return undefined;
    
    // 1. Exact cleaned match
    let found = brands.find(b => cleanStr(b.name) === target);
    if (found) return found;

    // 2. Contains match (as fallback)
    found = brands.find(b => cleanStr(b.name).includes(target) || target.includes(cleanStr(b.name)));
    return found;
  };

  const handleImportReport = () => {
    setImportMessage(null);
    if (!rawTextToImport.trim()) {
      setImportMessage({ type: 'error', text: 'Please enter or paste report text first.' });
      return;
    }

    const lines = rawTextToImport.split('\n');
    const detectedDateStr = extractDateFromText(rawTextToImport);
    const newInputs = { ...dailySalesInputs };
    let matchCount = 0;
    let totalLinesParsed = 0;

    // Robust capture regex for lines like: Bonia =0/1798⌚0/3 or Naviforce =199/1594⌚2/11 or service =0/15⌚0/2
    // We match "BrandName = todaySale/mtdSale⌚todayQty/mtdQty" or with space separators instead of "⌚"
    const metricsRegex = /^([\d.\s]+)\/([\d.\s]+)(?:⌚|\s+|\/)([\d\s]+)\/([\d\s]+)/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes('=')) continue;

      const delimiterIndex = trimmed.indexOf('=');
      const brandRaw = trimmed.substring(0, delimiterIndex).trim();
      const rightPart = trimmed.substring(delimiterIndex + 1).trim();

      const foundBrand = findBrandMatch(brandRaw);
      if (foundBrand) {
        totalLinesParsed++;
        // Clean out any spaces inside the right part for more consistent matches
        const cleanedRightPart = rightPart.replace(/\s+/g, ' ');
        const match = cleanedRightPart.match(metricsRegex);
        if (match) {
          const todaySale = match[1].trim();
          const todayQty = match[3].trim();

          const todaySaleNum = parseFloat(todaySale) || 0;
          const todayQtyNum = parseInt(todayQty, 10) || 0;

          newInputs[foundBrand.id] = {
            salesAmount: todaySaleNum > 0 ? String(todaySaleNum) : '',
            quantitySold: todayQtyNum > 0 ? String(todayQtyNum) : ''
          };
          matchCount++;
        }
      }
    }

    if (totalLinesParsed === 0) {
      setImportMessage({
        type: 'error',
        text: 'Could not find any matching lines with format "Brand = TodaySale/MtdSale⌚TodayQty/MtdQty". Please check format.'
      });
      return;
    }

    // Helper closure to set state
    const applyInputsOnCurrentDate = () => {
      setDailySalesInputs(newInputs);
      setImportMessage({
        type: 'success',
        text: `Extracted & mapped ${matchCount} matching brand entries successfully! Please click the "Save Daily Sales to Database" button at the bottom of the ledger to persist!`
      });
      setRawTextToImport('');
    };

    if (detectedDateStr && detectedDateStr !== selectedDate) {
      if (window.confirm(`Detected date: ${detectedDateStr} (different from currently active ${selectedDate}). Would you like to switch active date to ${detectedDateStr} and import these records?`)) {
        // Enqueue inputs so loadBaseData applies them for the new loaded date
        setPendingInputs(newInputs);
        setSelectedDate(detectedDateStr);
        setImportMessage({
          type: 'success',
          text: `Switched reporting date to ${detectedDateStr}. Extracted & mapped ${matchCount} brand entries successfully. Click "Save Daily Sales to Database" below to compile!`
        });
        setRawTextToImport('');
      } else {
        // If they refuse, apply to the current active date anyway as requested
        applyInputsOnCurrentDate();
      }
    } else {
      applyInputsOnCurrentDate();
    }
  };

  const loadJune12Example = () => {
    setRawTextToImport(`12 Jun 26(MRT)
*Sale RM 314

BATTERY (CLOCK) =0/0⌚0/0
Bigotti =0/625⌚0/2
Bonia =0/1798⌚0/3
Caesar =0/0⌚0/0
Casio =0/2547⌚0/16
Cro wc =0/818⌚0/5
Chronctech =0/0⌚0/0
Digitec =0/0⌚0/0
Daniel klein =0/0⌚0/0
J.bovier =0/0⌚0/0
L. strap =0/69⌚0/1
Mini Focus =0/0⌚0/0
Naviforce =199/1594⌚2/11
Pvc strap =0/0⌚0/0
R-bat =0/120⌚0/3
R&E =0/0⌚0/0
REWARDS WATCH =0/0⌚0/1
S-bat =87/1193⌚4/48
Slo/pokemon =0/139.8⌚0/2
S.parts =28/138⌚2/14
Submarine =0/700⌚0/8
service =0/15⌚0/2

Total 1-12 Jun 26
*Rm 9756.8`);
  };

  // View B: Brand management operations
  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandError(null);
    const trimmed = newBrandName.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      const nextSortOrder = brands.length > 0 
        ? Math.max(...brands.map(b => b.sortOrder)) + 1 
        : 1;

      const newB = await stateService.saveBrand(trimmed, nextSortOrder);
      setBrands(prev => [...prev, newB].sort((a,b) => a.sortOrder - b.sortOrder));
      setNewBrandName('');
    } catch (err: any) {
      setBrandError(err.message || 'Failed to add brand.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? All associated sales records will be detached.`)) {
      try {
        setLoading(true);
        await stateService.deleteBrand(id);
        setBrands(prev => prev.filter(b => b.id !== id));
      } catch (err) {
        console.error('Delete brand failure:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMoveBrand = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= brands.length) return;

    const list = [...brands];
    
    // Swap item values
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    // Recalculate ordered sequence
    const updated = list.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1
    }));

    setBrands(updated);
    await stateService.saveBrandsOrder(updated);
  };

  // Compute stats for View A top headers
  const getTodayCombinedStats = () => {
    let salesTotal = 0;
    let qtyTotal = 0;
    
    brands.forEach((b) => {
      salesTotal += parseFloat(dailySalesInputs[b.id]?.salesAmount || '0') || 0;
      qtyTotal += parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10) || 0;
    });

    return { salesTotal, qtyTotal };
  };

  const getMonthCombinedStats = () => {
    let salesTotalMtd = 0;
    let qtyTotalMtd = 0;
    
    brands.forEach((b) => {
      const bMtd = getBrandMTD(b.id);
      salesTotalMtd += bMtd.salesAmount;
      qtyTotalMtd += bMtd.quantitySold;
    });

    return { salesTotalMtd, qtyTotalMtd };
  };

  const todayStats = getTodayCombinedStats();
  const monthStats = getMonthCombinedStats();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <TrendingUp className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Retail Sales Tracker</h1>
              <p className="text-xs text-slate-500 font-medium">Legacy Bot Replacement App</p>
            </div>
          </div>

          <div className="flex bg-slate-150 p-1 rounded-xl items-center border border-slate-200">
            <button
              id="tab-entry"
              onClick={() => setActiveTab('entry')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'entry' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Sales Entry</span>
            </button>
            <button
              id="tab-brand"
              onClick={() => setActiveTab('management')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'management' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Brands Setup</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Save Status Notification Panel */}
        <AnimatePresence>
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl flex items-start gap-3 shadow-md border ${
                saveStatus.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{saveStatus.message}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View A: SALES DAILY ENTRY */}
        {activeTab === 'entry' && (
          <div className="flex flex-col gap-6">
            {/* Top Toolbar Widget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {/* Date Selector Box */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between gap-3">
                <label className="text-xs font-bold text-slate-400 tracking-wider uppercase">Active Reporting Date</label>
                <div className="relative">
                  <input
                    type="date"
                    id="entry-date-picker"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Real-time Statistics Totals Cards */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Today Combined</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">RM {todayStats.salesTotal.toFixed(2)}</p>
                  <span className="text-xs font-mono font-medium text-slate-500">{todayStats.qtyTotal} items sold</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Month-To-Date (MTD)</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">RM {monthStats.salesTotalMtd.toFixed(2)}</p>
                  <span className="text-xs font-mono font-medium text-slate-500">{monthStats.qtyTotalMtd} accumulated items</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Collapsible Batch Importer Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-xs">
                    📝
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Batch Import / Paste Historical Report</h3>
                    <p className="text-xs text-slate-500">Paste your structured text report (e.g. WhatsApp / legacy format) to auto-fill the daily records instantly.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowImportPanel(!showImportPanel);
                    setImportMessage(null);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:border-indigo-300 text-indigo-600 hover:bg-indigo-50/20 font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-97 cursor-pointer flex items-center gap-1.5"
                >
                  {showImportPanel ? 'Hide Importer' : 'Paste & Autofill Report'}
                </button>
              </div>

              {showImportPanel && (
                <div className="p-5 flex flex-col gap-4 animate-in fade-in duration-200">
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3.5 border border-slate-150 leading-relaxed">
                    <strong className="text-slate-700">Instructions:</strong> Paste the text report containing lines like <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-indigo-600 text-[11px]">BrandName = 199/1594⌚2/11</code>. The tool will automatically locate the correct Watch Brand from your setup, parse today's sale price (<strong className="text-indigo-600">RM 199</strong>) and quantity sold (<strong className="text-indigo-600">2⌚</strong>), and map them. If a date is detected in the text (e.g. <code className="bg-white px-1.5 py-0.5 rounded border font-mono">12 Jun 26</code>), you will be asked to switch to that date automatically!
                  </div>

                  {importMessage && (
                    <div className={`p-4 rounded-xl flex items-start gap-2.5 text-xs font-bold leading-normal border ${
                      importMessage.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : importMessage.type === 'amber'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                      <div>{importMessage.text}</div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Report Textbox</span>
                      <button
                        type="button"
                        onClick={loadJune12Example}
                        className="text-[10px] text-indigo-600 font-bold bg-indigo-55 hover:bg-indigo-100/80 px-2 py-1 rounded transition-all active:scale-95 cursor-pointer"
                      >
                        Load June 12 Report Paste Example
                      </button>
                    </label>
                    <textarea
                      rows={8}
                      placeholder="Paste your daily text here..."
                      value={rawTextToImport}
                      onChange={(e) => setRawTextToImport(e.target.value)}
                      className="w-full text-xs font-mono font-medium p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:font-sans placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setRawTextToImport('')}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-500 text-xs font-bold rounded-xl transition-all active:scale-97 cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleImportReport}
                      className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Analyze & Load Report</span>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* INTERACTIVE BRAND SELECTOR & KEY-IN PANEL (MULTI-SELECT SUPPORTED) */}
            <div id="brand-keyin-panel" className="bg-white p-5 rounded-2xl border border-indigo-150 shadow-md relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 p-3 bg-indigo-50 text-indigo-600 rounded-bl-xl text-xs font-bold tracking-wide">
                Interactive Wizard
              </div>

              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-1">
                <PlusCircle className="w-5.5 h-5.5 text-indigo-600" />
                {!isBrandConfirmed 
                  ? `Step 1: Choose Brand Category` 
                  : `Step 2: Key-In Values (${selectedBrandIds.length} Brand${selectedBrandIds.length > 1 ? 's' : ''})`
                }
              </h2>
              <p className="text-slate-500 text-sm max-w-2xl mb-4">
                {!isBrandConfirmed 
                  ? "Select one or multiple watch brands by tapping the buttons below, then press Done. Brands with existing sales display a green badge."
                  : "Type in today's sales figures (RM) and quantities sold for your selected brands. Correct mistakes by clicking the X next to any brand row."
                }
              </p>

              {!isBrandConfirmed ? (
                // STEP 1: VISUAL BUTTONS SELECTION GRID (NO SEARCH BAR REQUIRED AS REQUESTED)
                <div className="flex flex-col gap-3">
                  {/* Buttons Grid container */}
                  <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl max-h-72 overflow-y-auto">
                    {brands.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-medium">
                        No brands active currently. Setup brands in "Brands Setup" first!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {brands.map((b) => {
                          const isSelected = selectedBrandIds.includes(b.id);
                          const hasValues = parseFloat(dailySalesInputs[b.id]?.salesAmount || '0') > 0 || parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10) > 0;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectBrand(b.id)}
                              className={`group relative py-3 px-4 rounded-xl text-xs font-bold transition-all text-center flex flex-col justify-center items-center gap-1 border border-solid select-none active:scale-97 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300 shadow-md scale-102'
                                  : hasValues
                                    ? 'bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                              }`}
                            >
                              {hasValues && (
                                <span className="absolute top-1 right-1 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                              )}
                              <span className="truncate max-w-full">{b.name}</span>
                              {hasValues && (
                                <span className="text-[9px] text-emerald-650 opacity-90 font-semibold uppercase mt-0.5 tracking-tight">
                                  RM {parseFloat(dailySalesInputs[b.id]?.salesAmount || '0').toFixed(0)} ({parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10)}⌚)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selection footer */}
                  <div className="flex items-center justify-between gap-4 mt-1 flex-wrap-reverse sm:flex-nowrap">
                    <div className="text-xs font-medium text-slate-500">
                      {selectedBrandIds.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <span>
                            Selected: <strong className="text-indigo-600 text-sm font-bold bg-indigo-50 px-2 py-0.5 rounded-lg">{selectedBrandIds.length}</strong> watch brand{selectedBrandIds.length > 1 ? 's' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={handleClearSelectionState}
                            className="text-slate-400 hover:text-rose-600 font-bold ml-1 hover:underline transition-all cursor-pointer"
                          >
                            Clear All selection
                          </button>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <span>•</span> Tap to select one or more brand buttons above
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={selectedBrandIds.length === 0}
                      onClick={handleConfirmBrand}
                      className="py-2.5 px-6 font-bold text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 ml-auto active:scale-98 cursor-pointer"
                    >
                      <span>Done, Enter Values</span>
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                // STEP 2: MULTI BRAND KEY-IN SHEET (GRID DESIGN TO BATCH ADJUST SELECTIONS & CORRECT MISTAKES RAPIDLY)
                <form onSubmit={applyWizardBrandValues} className="bg-indigo-50/20 p-4 sm:p-5 border border-indigo-100 rounded-2xl flex flex-col gap-4 mt-2">
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-indigo-100/55">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Keying products:</span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg">
                        {selectedBrandIds.length} Brand{selectedBrandIds.length > 1 ? 's' : ''} Selected
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCancelSelection}
                      className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-150 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 active:scale-97 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Wrong Selection? Choose Again</span>
                    </button>
                  </div>

                  {/* Scrollable list of active brands with inputs side-by-side */}
                  <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
                    {selectedBrandIds.map((bId, idx) => {
                      const brandName = brands.find(b => b.id === bId)?.name || 'Unknown Brand';
                      return (
                        <div 
                          key={bId} 
                          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white p-3.5 rounded-xl border border-slate-150/80 shadow-2xs hover:border-indigo-200 transition-all group duration-200"
                        >
                          {/* Brand Info */}
                          <div className="md:col-span-4 flex items-center gap-2.5">
                            <span className="w-5.5 h-5.5 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800 text-sm truncate">{brandName}</span>
                          </div>

                          {/* Sales Input */}
                          <div className="md:col-span-4">
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">RM</span>
                              <input
                                type="text"
                                placeholder="0.00"
                                value={wizardInputs[bId]?.salesAmount || ''}
                                onChange={(e) => handleWizardInputChange(bId, 'salesAmount', e.target.value)}
                                className="wizard-sales-input w-full text-right text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Quantity Input */}
                          <div className="md:col-span-3">
                            <input
                              type="text"
                              placeholder="0"
                              value={wizardInputs[bId]?.quantitySold || ''}
                              onChange={(e) => handleWizardInputChange(bId, 'quantitySold', e.target.value)}
                              className="w-full text-center text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                            />
                          </div>

                          {/* Fast Close Button (In case of user error / tapping wrong brand in Step 1) */}
                          <div className="md:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveBrandFromWizard(bId)}
                              title="Remove this brand from key-in list"
                              className="text-slate-300 hover:text-rose-650 hover:bg-slate-100 p-1.5 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Submission row */}
                  <div className="flex gap-3 justify-end items-center pt-2.5 border-t border-indigo-100/55">
                    <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">
                      *Tapping "Apply to List" merges all rows below!
                    </span>
                    <button
                      type="submit"
                      className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-1.5 active:scale-98 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Apply all to List</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Current day's summary and dynamic ledger grids */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    Daily Sales Ledger
                  </span>
                  <span className="text-2xs font-bold px-2 py-0.5 bg-slate-250 text-slate-600 rounded-full uppercase tracking-wider">
                    {selectedDate}
                  </span>
                </div>

                {/* Filter and layout tabs */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                  <button
                    onClick={() => setShowOnlyWithSales(true)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      showOnlyWithSales 
                        ? 'bg-white text-indigo-600 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Entered Today ({brands.filter(b => (parseFloat(dailySalesInputs[b.id]?.salesAmount) > 0 || parseInt(dailySalesInputs[b.id]?.quantitySold, 10) > 0)).length})
                  </button>
                  <button
                    onClick={() => setShowOnlyWithSales(false)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      !showOnlyWithSales 
                        ? 'bg-white text-indigo-600 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Show All ({brands.length})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                  <span>Loading ledger records...</span>
                </div>
              ) : brands.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold">
                  No active brands found. Setup brands in the "Brands Setup" tab first!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(() => {
                    const filteredBrands = showOnlyWithSales
                      ? brands.filter(b => {
                          const amt = parseFloat(dailySalesInputs[b.id]?.salesAmount || '0') || 0;
                          const qty = parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10) || 0;
                          return amt > 0 || qty > 0;
                        })
                      : brands;

                    if (filteredBrands.length === 0) {
                      return (
                        <div className="p-12 text-center">
                          <p className="text-slate-400 font-medium text-sm">No daily sales entries recorded so far for this date.</p>
                          <p className="text-xs text-indigo-500 font-semibold mt-1.5">
                            👉 Select a watch brand from the creator dropdown above to key in a record!
                          </p>
                        </div>
                      );
                    }

                    return filteredBrands.map((brand) => {
                      const savedMtd = getBrandMTD(brand.id);
                      const hasValues = parseFloat(dailySalesInputs[brand.id]?.salesAmount || '0') > 0 || parseInt(dailySalesInputs[brand.id]?.quantitySold || '0', 10) > 0;
                      
                      return (
                        <div 
                          key={brand.id} 
                          className={`p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                            selectedBrandIds.includes(brand.id) 
                              ? 'bg-indigo-50/45' 
                              : hasValues 
                                ? 'bg-indigo-50/10 hover:bg-indigo-50/20' 
                                : 'bg-white hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Brand Info Column */}
                          <div className="min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-base">{brand.name}</span>
                              {hasValues && (
                                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" title="Values keyed in for today" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-1">
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-2xs font-mono font-bold tracking-wider">
                                MTD
                              </span>
                              <span>RM {savedMtd.salesAmount.toFixed(2)}</span>
                              <span className="text-slate-300">•</span>
                              <span>{savedMtd.quantitySold} Qty</span>
                            </div>
                          </div>

                          {/* Displays Selected Daily Metrics */}
                          <div className="flex items-center gap-6 justify-start md:justify-end flex-wrap">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xs font-bold text-slate-400 uppercase tracking-wide">Sales Total:</span>
                              <span className={`font-mono text-sm font-bold ${hasValues ? 'text-slate-800' : 'text-slate-400'}`}>
                                RM {parseFloat(dailySalesInputs[brand.id]?.salesAmount || '0').toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xs font-bold text-slate-400 uppercase tracking-wide font-medium">Quantity:</span>
                              <span className={`font-mono text-sm font-bold ${hasValues ? 'text-slate-800' : 'text-slate-400'}`}>
                                {parseInt(dailySalesInputs[brand.id]?.quantitySold || '0', 10)} sold
                              </span>
                            </div>

                            {/* Rapid Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => loadBrandForEdit(brand.id)}
                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-lg flex items-center gap-1 transition-colors"
                              >
                                <PenLine className="w-3.5 h-3.5" />
                                <span>Key-In</span>
                              </button>

                              {hasValues && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDailySalesInputs(prev => ({
                                      ...prev,
                                      [brand.id]: { salesAmount: '', quantitySold: '' }
                                    }));
                                  }}
                                  title="Clear Entry"
                                  className="p-1 px-1.5 hover:bg-rose-50 hover:text-rose-650 text-slate-400 rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Bottom Form Actions Control */}
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-end mt-4">
              <button
                id="btn-clear"
                onClick={handleClearToday}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-600 transition-colors"
              >
                Clear Today
              </button>

              <button
                id="btn-copy-report"
                onClick={handleCopyReport}
                disabled={brands.length === 0}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-4.5 h-4.5 text-emerald-600" /> : <Copy className="w-4.5 h-4.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Ledger Report'}</span>
              </button>

              <button
                id="btn-save"
                onClick={handleSave}
                disabled={loading || brands.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Daily Sales
              </button>
            </div>
          </div>
        )}

        {/* View B: BRAND MANAGEMENT MODULE */}
        {activeTab === 'management' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Create Brand Column */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
              <h3 className="font-bold text-lg text-slate-900">Add New Brand Category</h3>
              <p className="text-xs text-slate-500">
                Create new target product labels. Newly added items will dynamically expand the sales fields in active reports.
              </p>

              <form onSubmit={handleAddBrand} className="flex flex-col gap-3 mt-2">
                <div>
                  <label className="text-2xs font-bold text-slate-400 uppercase tracking-wide">Brand Name</label>
                  <input
                    type="text"
                    value={newBrandName}
                    onChange={(e) => {
                      setNewBrandName(e.target.value);
                      if (brandError) setBrandError(null);
                    }}
                    placeholder="Enter Brand Name (e.g. Seiko)"
                    className="w-full text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mt-1 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>

                {brandError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{brandError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !newBrandName.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl tracking-wide shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Brand</span>
                </button>
              </form>
            </div>

            {/* Brands Order Listing & Reorganization Column */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden md:col-span-2">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  Categorized Active Brands list ({brands.length})
                </span>
                <span className="text-2xs font-medium text-slate-400 italic">
                  Drag triggers / arrow clicks alter sorting in reports
                </span>
              </div>

              {loading && brands.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold">
                  Syncing category files...
                </div>
              ) : brands.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold">
                  No active brands. Create one on the left panel!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {brands.map((brand, idx) => (
                    <div 
                      key={brand.id} 
                      className="p-3.5 px-5 flex items-center justify-between gap-4 bg-white hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-slate-100 text-slate-500 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">{brand.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Sort operations */}
                        <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                          <button
                            onClick={() => handleMoveBrand(idx, 'up')}
                            disabled={idx === 0}
                            title="Move Up"
                            className="p-1 rounded text-slate-500 hover:bg-white hover:text-indigo-600 disabled:opacity-20 transition-all"
                          >
                            <ChevronUp className="w-4.5 h-4.5" />
                          </button>
                          <button
                            onClick={() => handleMoveBrand(idx, 'down')}
                            disabled={idx === brands.length - 1}
                            title="Move Down"
                            className="p-1 rounded text-slate-500 hover:bg-white hover:text-indigo-600 disabled:opacity-20 transition-all"
                          >
                            <ChevronDown className="w-4.5 h-4.5" />
                          </button>
                        </div>

                        {/* Delete entry */}
                        <button
                          onClick={() => handleDeleteBrand(brand.id, brand.name)}
                          title="Delete Brand"
                          className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
