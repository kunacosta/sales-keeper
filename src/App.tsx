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
  PlusCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { stateService, Brand, DailySale } from './lib/stateService.ts';

// ===============================================
// MONTHLY / RANGE TOTALS BULK SYSTEM
// ===============================================
export const getDatesInRange = (startStr: string, endStr: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }
  
  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const formatPrettyDate = (dateStr: string): string => {
  if (!dateStr || !dateStr.includes('-')) return '';
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  if (isNaN(dateObj.getTime())) return dateStr;
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', weekday: 'short' };
  return dateObj.toLocaleDateString('en-US', options);
};

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
  const [dailySalesInputs, setDailySalesInputs] = useState<{ [brandId: string]: { salesAmount: string; quantitySold: string; mtdSalesAmount: string; mtdQuantitySold: string } }>({});
  
  // Choose brand selection state & temporary key-in inputs (Multi-Selection enabled)
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [isBrandConfirmed, setIsBrandConfirmed] = useState<boolean>(false);
  const [wizardInputs, setWizardInputs] = useState<{ [brandId: string]: { salesAmount: string; quantitySold: string; mtdSalesAmount: string; mtdQuantitySold: string } }>({});
  const [showOnlyWithSales, setShowOnlyWithSales] = useState<boolean>(true);

  // Monthly Totals Overrides Editor States
  const [showMonthlyTotalsPanel, setShowMonthlyTotalsPanel] = useState<boolean>(false);
  const [monthlyTotalsSearch, setMonthlyTotalsSearch] = useState<string>('');

  // Dataset Viewer States
  const [showDatasetViewer, setShowDatasetViewer] = useState<boolean>(false);
  const [datasetViewerSearch, setDatasetViewerSearch] = useState<string>('');
  const [datasetGrouping, setDatasetGrouping] = useState<'byDate' | 'byBrand'>('byDate');
  const [expandedDates, setExpandedDates] = useState<{ [date: string]: boolean }>({});
  const [expandedBrands, setExpandedBrands] = useState<{ [brandId: string]: boolean }>({});
  const [datasetViewMode, setDatasetViewMode] = useState<'table' | 'whatsapp'>('whatsapp');
  const [datasetCopied, setDatasetCopied] = useState<boolean>(false);

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
          quantitySold: found && found.quantitySold > 0 ? String(found.quantitySold) : '',
          mtdSalesAmount: found && found.mtdSalesAmount && found.mtdSalesAmount > 0 ? String(found.mtdSalesAmount) : '',
          mtdQuantitySold: found && found.mtdQuantitySold && found.mtdQuantitySold > 0 ? String(found.mtdQuantitySold) : ''
        };
      });
      
      setDailySalesInputs(initialInputs);
      
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

  // Helper: Computes/gets MTD stats for a given brand
  const getBrandMTD = (brandId: string) => {
    const currentInput = dailySalesInputs[brandId];
    const mtdInputAmt = currentInput?.mtdSalesAmount;
    const mtdInputQty = currentInput?.mtdQuantitySold;

    const savedRecord = monthlySales.find(s => s.brandId === brandId && s.date === selectedDate);

    let salesAmountSum = 0;
    let quantitySoldSum = 0;

    // Determine MTD Sales Amount
    if (mtdInputAmt && parseFloat(mtdInputAmt) >= 0) {
      salesAmountSum = parseFloat(mtdInputAmt);
    } else if (savedRecord && typeof savedRecord.mtdSalesAmount === 'number' && savedRecord.mtdSalesAmount > 0) {
      salesAmountSum = savedRecord.mtdSalesAmount;
    } else {
      // Dynamic fallback (standard summing)
      let sum = 0;
      monthlySales.forEach((sale) => {
        if (sale.brandId === brandId && sale.date <= selectedDate) {
          sum += sale.salesAmount;
        }
      });
      const currentInputAmt = parseFloat(currentInput?.salesAmount || '0') || 0;
      const wasAlreadySavedInMonth = monthlySales.some(s => s.brandId === brandId && s.date === selectedDate);
      if (!wasAlreadySavedInMonth) {
        sum += currentInputAmt;
      } else {
        const savedRec = monthlySales.find(s => s.brandId === brandId && s.date === selectedDate);
        if (savedRec) {
          sum = sum - savedRec.salesAmount + currentInputAmt;
        }
      }
      salesAmountSum = sum;
    }

    // Determine MTD Quantity
    if (mtdInputQty && parseInt(mtdInputQty, 10) >= 0) {
      quantitySoldSum = parseInt(mtdInputQty, 10);
    } else if (savedRecord && typeof savedRecord.mtdQuantitySold === 'number' && savedRecord.mtdQuantitySold > 0) {
      quantitySoldSum = savedRecord.mtdQuantitySold;
    } else {
      // Dynamic fallback (standard summing)
      let sum = 0;
      monthlySales.forEach((sale) => {
        if (sale.brandId === brandId && sale.date <= selectedDate) {
          sum += sale.quantitySold;
        }
      });
      const currentInputQty = parseInt(currentInput?.quantitySold || '0', 10) || 0;
      const wasAlreadySavedInMonth = monthlySales.some(s => s.brandId === brandId && s.date === selectedDate);
      if (!wasAlreadySavedInMonth) {
        sum += currentInputQty;
      } else {
        const savedRec = monthlySales.find(s => s.brandId === brandId && s.date === selectedDate);
        if (savedRec) {
          sum = sum - savedRec.quantitySold + currentInputQty;
        }
      }
      quantitySoldSum = sum;
    }

    return {
      salesAmount: salesAmountSum,
      quantitySold: quantitySoldSum
    };
  };

  // Shift calendar month by 1
  const handleShiftMonth = (direction: 'prev' | 'next') => {
    const [yearStr, monthStr, dayStr] = selectedDate.split('-');
    const currentYear = parseInt(yearStr, 10);
    const currentMonth = parseInt(monthStr, 10); // 1-indexed
    const currentDay = parseInt(dayStr, 10);
    
    let targetMonth = direction === 'prev' ? currentMonth - 1 : currentMonth + 1;
    let targetYear = currentYear;
    
    if (targetMonth < 1) {
      targetMonth = 12;
      targetYear -= 1;
    } else if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
    
    const targetMonthStr = String(targetMonth).padStart(2, '0');
    const totalDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = currentDay > totalDaysInTargetMonth ? 1 : currentDay;
    const targetDayStr = String(targetDay).padStart(2, '0');
    
    const newDateStr = `${targetYear}-${targetMonthStr}-${targetDayStr}`;
    setSelectedDate(newDateStr);
  };

  // Helper properties to draw current monthly progress calendar grid
  const getDaysInActiveMonth = () => {
    const [yearStr, monthStr] = selectedDate.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-indexed
    
    // Total days in this active month
    const totalDays = new Date(year, month, 0).getDate();
    
    // Day of the week of first day of that month (0=Sunday, 1=Monday, ..., 6=Saturday)
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    
    return {
      year,
      month,
      totalDays,
      firstDayIndex
    };
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
    const initialWizardInputs: { [brandId: string]: { salesAmount: string; quantitySold: string; mtdSalesAmount: string; mtdQuantitySold: string } } = {};
    selectedBrandIds.forEach(id => {
      initialWizardInputs[id] = {
        salesAmount: dailySalesInputs[id]?.salesAmount || '',
        quantitySold: dailySalesInputs[id]?.quantitySold || '',
        mtdSalesAmount: dailySalesInputs[id]?.mtdSalesAmount || '',
        mtdQuantitySold: dailySalesInputs[id]?.mtdQuantitySold || ''
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
  const handleWizardInputChange = (brandId: string, field: 'salesAmount' | 'quantitySold' | 'mtdSalesAmount' | 'mtdQuantitySold', value: string) => {
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
            quantitySold: draft.quantitySold.replace(/[^0-9]/g, ''),
            mtdSalesAmount: draft.mtdSalesAmount ? draft.mtdSalesAmount.replace(/[^0-9.]/g, '') : '',
            mtdQuantitySold: draft.mtdQuantitySold ? draft.mtdQuantitySold.replace(/[^0-9]/g, '') : ''
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
          quantitySold: dailySalesInputs[brandId]?.quantitySold || '',
          mtdSalesAmount: dailySalesInputs[brandId]?.mtdSalesAmount || '',
          mtdQuantitySold: dailySalesInputs[brandId]?.mtdQuantitySold || ''
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
        const item = val as { salesAmount: string; quantitySold: string; mtdSalesAmount: string; mtdQuantitySold: string };
        return {
          brandId,
          salesAmount: parseFloat(item.salesAmount) || 0,
          quantitySold: parseInt(item.quantitySold, 10) || 0,
          mtdSalesAmount: item.mtdSalesAmount && parseFloat(item.mtdSalesAmount) > 0 ? parseFloat(item.mtdSalesAmount) : undefined,
          mtdQuantitySold: item.mtdQuantitySold && parseInt(item.mtdQuantitySold, 10) > 0 ? parseInt(item.mtdQuantitySold, 10) : undefined
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
        cleared[b.id] = { salesAmount: '', quantitySold: '', mtdSalesAmount: '', mtdQuantitySold: '' };
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


  // Helper: Computes the dynamic sum (without MTD manual override) up to selectedDate
  const getCalculatedMTD = (brandId: string) => {
    const currentInput = dailySalesInputs[brandId];
    let salesSum = 0;
    let qtySum = 0;

    // Dynamic fallback (standard summing)
    monthlySales.forEach((sale) => {
      if (sale.brandId === brandId && sale.date <= selectedDate) {
        salesSum += sale.salesAmount;
        qtySum += sale.quantitySold;
      }
    });

    const currentInputAmt = parseFloat(currentInput?.salesAmount || '0') || 0;
    const currentInputQty = parseInt(currentInput?.quantitySold || '0', 10) || 0;
    const wasAlreadySavedInMonth = monthlySales.some(s => s.brandId === brandId && s.date === selectedDate);
    
    if (!wasAlreadySavedInMonth) {
      salesSum += currentInputAmt;
      qtySum += currentInputQty;
    } else {
      const savedRec = monthlySales.find(s => s.brandId === brandId && s.date === selectedDate);
      if (savedRec) {
        salesSum = salesSum - savedRec.salesAmount + currentInputAmt;
        qtySum = qtySum - savedRec.quantitySold + currentInputQty;
      }
    }

    return { salesAmount: salesSum, quantitySold: qtySum };
  };

  // Monthly Totals Overrides Handlers
  const handleMonthlyOverrideChange = (brandId: string, field: 'mtdSalesAmount' | 'mtdQuantitySold', value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setDailySalesInputs(prev => ({
      ...prev,
      [brandId]: {
        salesAmount: prev[brandId]?.salesAmount || '',
        quantitySold: prev[brandId]?.quantitySold || '',
        mtdSalesAmount: prev[brandId]?.mtdSalesAmount || '',
        mtdQuantitySold: prev[brandId]?.mtdQuantitySold || '',
        [field]: cleanValue
      }
    }));
  };

  const handleSaveMonthlyOverrides = async () => {
    try {
      setLoading(true);
      await handleSave();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Dataset Viewer Helpers
  const getPrevDaysInActiveMonth = () => {
    if (!selectedDate || !selectedDate.includes('-')) return [];
    const [yearStr, monthStr, dayStr] = selectedDate.split('-');
    const day = parseInt(dayStr, 10);
    const prevDays: string[] = [];
    
    // Day 1 to latest/selected day (inclusive)
    for (let d = 1; d <= day; d++) {
      const dStr = String(d).padStart(2, '0');
      prevDays.push(`${yearStr}-${monthStr}-${dStr}`);
    }
    
    return prevDays;
  };

  const toggleDateExpanded = (dateStr: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const toggleBrandExpanded = (brandId: string) => {
    setExpandedBrands(prev => ({
      ...prev,
      [brandId]: !prev[brandId]
    }));
  };

  const getDayTotals = (dateStr: string) => {
    const listForDate = monthlySales.filter(s => s.date === dateStr);
    const totalSales = listForDate.reduce((sum, s) => sum + s.salesAmount, 0);
    const totalQty = listForDate.reduce((sum, s) => sum + s.quantitySold, 0);
    const enteredBrandsCount = listForDate.filter(s => s.salesAmount > 0 || s.quantitySold > 0).length;
    return { totalSales, totalQty, enteredBrandsCount };
  };

  const generateWhatsAppDatasetText = () => {
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

    return report;
  };

  const handleCopyWhatsAppDataset = () => {
    const text = generateWhatsAppDatasetText();
    navigator.clipboard.writeText(text);
    setDatasetCopied(true);
    setTimeout(() => setDatasetCopied(false), 3000);
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

            {/* Quick Actions Panel */}
            <div className="flex justify-end gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowDatasetViewer(!showDatasetViewer);
                  setDatasetViewerSearch('');
                  setExpandedDates({});
                  setExpandedBrands({});
                }}
                className="py-1.5 px-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-350 text-emerald-800 hover:text-emerald-900 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>💬 {showDatasetViewer ? 'Close WhatsApp Dataset Viewer' : 'View WhatsApp Dataset (Day 1 to Latest)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMonthlyTotalsPanel(!showMonthlyTotalsPanel);
                  setMonthlyTotalsSearch('');
                }}
                className="py-1.5 px-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>📊 {showMonthlyTotalsPanel ? 'Close Monthly Totals Editor' : 'Adjust Monthly Totals (Overrides)'}</span>
              </button>
            </div>

            {showDatasetViewer && (
              <div className="bg-white rounded-2xl border border-emerald-150 shadow-md overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-slate-50 via-slate-50/50 to-emerald-50/40 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg shadow-2xs">
                      💬
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Month Dataset Viewer (Day 1 to Latest Day)</h3>
                      <p className="text-xs text-slate-500 font-medium font-sans">Verify and copy logs from Day 1 to your selected active reporting date formatted beautifully for WhatsApp.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDatasetViewer(false)}
                    className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                  {/* Mode Selector Tab Bar */}
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold self-start gap-1">
                    <button
                      type="button"
                      onClick={() => setDatasetViewMode('table')}
                      className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        datasetViewMode === 'table'
                          ? 'bg-white text-emerald-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      📁 Interactive Tables
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatasetViewMode('whatsapp')}
                      className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        datasetViewMode === 'whatsapp'
                          ? 'bg-white text-emerald-800 shadow-sm'
                          : 'text-slate-550 hover:text-slate-800'
                      }`}
                    >
                      💬 WhatsApp Format
                    </button>
                  </div>

                  {/* Top Search Controls Bar */}
                  {datasetViewMode === 'table' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                      {/* View Grouping selector tabs */}
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold self-start">
                        <button
                          type="button"
                          onClick={() => {
                            setDatasetGrouping('byDate');
                            setDatasetViewerSearch('');
                          }}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            datasetGrouping === 'byDate'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Group by Day
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDatasetGrouping('byBrand');
                            setDatasetViewerSearch('');
                          }}
                          className={`px-3 py-1.5 rounded-md transition-all ${
                            datasetGrouping === 'byBrand'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Group by Brand
                        </button>
                      </div>

                      {/* Filter search box */}
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs max-w-xs w-full">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Filter by brand name..."
                          value={datasetViewerSearch}
                          onChange={(e) => setDatasetViewerSearch(e.target.value)}
                          className="w-full text-xs bg-transparent outline-none placeholder:text-slate-400 font-medium text-slate-700"
                        />
                        {datasetViewerSearch && (
                          <button
                            type="button"
                            onClick={() => setDatasetViewerSearch('')}
                            className="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Range Information Banner */}
                  {(() => {
                    const prevDates = getPrevDaysInActiveMonth();
                    if (prevDates.length === 0) {
                      return (
                        <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl">
                          <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                            No days logged in the active month!
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            The viewer displays dataset logs starting from Day 1 of the active month up to your latest reporting date.
                          </p>
                        </div>
                      );
                    }

                    const startDateStr = prevDates[0];
                    const endDateStr = prevDates[prevDates.length - 1];

                    return (
                      <div className="text-2xs font-bold text-emerald-800 bg-emerald-50/75 py-1.5 px-3 rounded-lg border border-emerald-100 flex items-center justify-between font-sans">
                        <span>📅 Period: {formatPrettyDate(startDateStr)} to {formatPrettyDate(endDateStr)}</span>
                        <span className="opacity-80">Total {prevDates.length} Day{prevDates.length > 1 ? 's' : ''} Tracked</span>
                      </div>
                    );
                  })()}

                  {/* Main lists (Interactive Tables vs. WhatsApp format live preview) */}
                  {datasetViewMode === 'table' ? (
                    <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                      {/* GROUP BY DATE */}
                      {datasetGrouping === 'byDate' && getPrevDaysInActiveMonth().length > 0 && (
                        (() => {
                          const prevDates = [...getPrevDaysInActiveMonth()].reverse(); // reverse chronological (yesterday first!)
                          return prevDates.map((dateStr) => {
                            const isExpanded = !!expandedDates[dateStr];
                            const { totalSales, totalQty, enteredBrandsCount } = getDayTotals(dateStr);
                            
                            // Filter the actual saved sales records for that date (optionally filtered by search)
                            const daySales = monthlySales.filter(s => {
                              if (s.date !== dateStr) return false;
                              if (datasetViewerSearch) {
                                const bName = brands.find(b => b.id === s.brandId)?.name || '';
                                return bName.toLowerCase().includes(datasetViewerSearch.toLowerCase());
                              }
                              return s.salesAmount > 0 || s.quantitySold > 0 || s.mtdSalesAmount !== undefined;
                            });

                            return (
                              <div key={dateStr} className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-2xs">
                                {/* Header Accordion Triggers */}
                                <div 
                                  onClick={() => toggleDateExpanded(dateStr)}
                                  className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4 select-none"
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                    <span className="font-bold text-slate-850 text-xs">
                                      {formatPrettyDate(dateStr)}
                                    </span>
                                    {enteredBrandsCount > 0 ? (
                                      <span className="text-[10px] bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {enteredBrandsCount} entered
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-450 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        no records
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-right text-xs font-semibold text-slate-500 font-mono">
                                    <span className="font-bold text-slate-700">RM {totalSales.toFixed(2)}</span>
                                    <span className="text-slate-350 ml-1.5 mr-1.5">•</span>
                                    <span>{totalQty} sold</span>
                                  </div>
                                </div>

                                {/* Accordion Content */}
                                {isExpanded && (
                                  <div className="border-t border-slate-100 p-3 bg-slate-50/30">
                                    {daySales.length === 0 ? (
                                      <div className="py-4 text-center text-slate-400 text-[11px] font-medium font-sans">
                                        {datasetViewerSearch ? "No matching brand entries on this date." : "No sales figures entered for this date."}
                                      </div>
                                    ) : (
                                      <table className="w-full text-left border-collapse text-2xs">
                                        <thead>
                                          <tr className="border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                            <th className="py-1.5 px-2">Brand Category</th>
                                            <th className="py-1.5 px-2 text-right">Today Sales</th>
                                            <th className="py-1.5 px-2 text-center">Today Qty</th>
                                            <th className="py-1.5 px-2 text-right">Manual MTD Override</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {daySales.map((s) => {
                                            const brandName = brands.find(b => b.id === s.brandId)?.name || 'Unknown Brand';
                                            const hasOverride = s.mtdSalesAmount !== undefined || s.mtdQuantitySold !== undefined;
                                            return (
                                              <tr key={s.id} className="hover:bg-slate-50/40 font-medium">
                                                <td className="py-1.5 px-2 font-bold text-slate-700">{brandName}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-slate-600">RM {s.salesAmount.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 text-center font-mono text-slate-600">{s.quantitySold} sold</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-amber-700">
                                                  {hasOverride ? (
                                                    <span className="bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-bold text-amber-800">
                                                      Yes (RM {s.mtdSalesAmount?.toFixed(0)} / {s.mtdQuantitySold} sold)
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-350">—</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()
                      )}

                      {/* GROUP BY BRAND */}
                      {datasetGrouping === 'byBrand' && (
                        (() => {
                          const prevDates = getPrevDaysInActiveMonth();
                          const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(datasetViewerSearch.toLowerCase()));
                          
                          if (filteredBrands.length === 0) {
                            return (
                              <div className="py-8 text-center text-slate-400 text-xs font-medium font-sans">
                                No matching brand categories found.
                              </div>
                            );
                          }

                          return filteredBrands.map((brand) => {
                            const isExpanded = !!expandedBrands[brand.id];
                            
                            // All entries for this brand on preceding dates
                            const brandEntries = monthlySales.filter(s => s.brandId === brand.id && prevDates.includes(s.date));
                            const daysWithSales = brandEntries.filter(s => s.salesAmount > 0 || s.quantitySold > 0).length;
                            
                            // Calculate periodic total
                            const totalSales = brandEntries.reduce((sum, s) => sum + s.salesAmount, 0);
                            const totalQty = brandEntries.reduce((sum, s) => sum + s.quantitySold, 0);

                            return (
                              <div key={brand.id} className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-2xs">
                                <div 
                                  onClick={() => toggleBrandExpanded(brand.id)}
                                  className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4 select-none"
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                    <span className="font-bold text-slate-850 text-xs">
                                      {brand.name}
                                    </span>
                                    {daysWithSales > 0 ? (
                                      <span className="text-[10px] bg-emerald-50 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {daysWithSales} days logged
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-450 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        empty brand
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-right text-xs font-semibold text-slate-500 font-mono">
                                    <span className="font-bold text-slate-700">RM {totalSales.toFixed(2)}</span>
                                    <span className="text-slate-350 ml-1.5 mr-1.5">•</span>
                                    <span>{totalQty} sold</span>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="border-t border-slate-100 p-3 bg-slate-50/30">
                                    {brandEntries.length === 0 ? (
                                      <div className="py-4 text-center text-slate-400 text-[11px] font-medium font-sans">
                                        No daily logs found for this brand in the period.
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-2xs">
                                          <thead>
                                            <tr className="border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                              <th className="py-1.5 px-2">Reporting Date</th>
                                              <th className="py-1.5 px-2 text-right">Daily Sales</th>
                                              <th className="py-1.5 px-2 text-center">Daily Qty</th>
                                              <th className="py-1.5 px-2 text-right">Running Sales Total</th>
                                              <th className="py-1.5 px-2 text-right">MTD Override</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 bg-white">
                                            {(() => {
                                              // Sort brand entries chronologically for natural timeline
                                              const sortedEntries = [...brandEntries].sort((a, b) => a.date.localeCompare(b.date));
                                              let runningSalesSum = 0;
                                              
                                              return sortedEntries.map((s) => {
                                                runningSalesSum += s.salesAmount;
                                                const hasOverride = s.mtdSalesAmount !== undefined || s.mtdQuantitySold !== undefined;
                                                return (
                                                  <tr key={s.id} className="hover:bg-slate-50/40 font-medium">
                                                    <td className="py-1.5 px-2 font-bold text-slate-700">{formatPrettyDate(s.date)}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono text-slate-600 font-bold">RM {s.salesAmount.toFixed(2)}</td>
                                                    <td className="py-1.5 px-2 text-center font-mono text-slate-600">{s.quantitySold} sold</td>
                                                    <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-700">RM {runningSalesSum.toFixed(2)}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono text-amber-700">
                                                      {hasOverride ? (
                                                        <span className="bg-amber-50 px-1 py-0.5 rounded border border-amber-100 font-bold text-amber-800">
                                                          RM {s.mtdSalesAmount?.toFixed(0)}
                                                        </span>
                                                      ) : (
                                                        <span className="text-slate-350">—</span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              });
                                            })()}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 animate-fade-in text-left">
                      {/* Copy Action Banner */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50/60 p-4 rounded-xl border border-emerald-150">
                        <div className="flex gap-2.5 items-start">
                          <span className="text-xl">📢</span>
                          <div className="text-xs text-slate-600 font-medium leading-relaxed">
                            <span className="font-bold text-emerald-900 block mb-0.5">Copy & Share directly with your group</span>
                            This template is formatted precisely with brackets, stars, and bullet points for elegant rendering as a native WhatsApp message list.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyWhatsAppDataset}
                          className={`py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer select-none active:scale-97 shrink-0 ${
                            datasetCopied
                              ? 'bg-emerald-750 text-white hover:bg-emerald-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{datasetCopied ? '✓ Copied Message!' : 'Copy WhatsApp Message'}</span>
                        </button>
                      </div>

                      {/* Live WhatsApp Mockup Frame */}
                      <div className="p-4 sm:p-6 bg-[#efeae2] rounded-2xl border border-slate-200.5 shadow-inner relative overflow-hidden min-h-[300px]">
                        {/* WhatsApp bubble aligned to right */}
                        <div className="relative z-10 flex justify-end">
                          <div className="bg-[#d9fdd3] text-slate-800 rounded-2xl rounded-tr-none px-4 py-3.5 shadow-sm max-w-xl w-full relative border border-[#c1f8b6]">
                            {/* WhatsApp bubble triangle tip */}
                            <div className="absolute right-[-7px] top-0 w-0 h-0 border-t-[10px] border-t-[#d9fdd3] border-r-[10px] border-r-transparent"></div>
                            
                            {/* Content Body */}
                            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 tracking-normal select-text break-words">
                              {generateWhatsAppDatasetText()}
                            </pre>
                            
                            {/* Footer timestamp and double-check read tick */}
                            <div className="flex items-center justify-end gap-1 mt-3 text-[9px] text-slate-400 font-bold select-none">
                              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="text-[#53bdeb] font-extrabold flex">
                                <span>✓</span><span className="-ml-0.5">✓</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {showMonthlyTotalsPanel && (
              <div className="bg-white rounded-2xl border border-indigo-150 shadow-md overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-slate-50 via-slate-50/50 to-indigo-50/40 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-2xs">
                      📊
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Monthly Totals Editor</h3>
                      <p className="text-xs text-slate-500 font-medium">Manually adjust or correct cumulative Month-To-Date (MTD) totals for the active date ({selectedDate}) if anything went wrong.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMonthlyTotalsPanel(false)}
                    className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="p-5 flex flex-col gap-4">
                  {/* Brand Table Search */}
                  <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filter brand categories..."
                      value={monthlyTotalsSearch}
                      onChange={(e) => setMonthlyTotalsSearch(e.target.value)}
                      className="w-full text-xs bg-transparent outline-none placeholder:text-slate-400 font-medium text-slate-700"
                    />
                    {monthlyTotalsSearch && (
                      <button
                        type="button"
                        onClick={() => setMonthlyTotalsSearch('')}
                        className="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Grid of Brand Inputs */}
                  <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto bg-slate-50/20">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <th className="py-2 px-4">Brand Category</th>
                          <th className="py-2 px-4 text-slate-500 font-semibold text-center w-[120px]">Calculated MTD</th>
                          <th className="py-2 px-4 w-[160px]">Manual MTD Net Sales</th>
                          <th className="py-2 px-4 w-[140px]">Manual MTD Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {brands
                          .filter(b => b.name.toLowerCase().includes(monthlyTotalsSearch.toLowerCase()))
                          .map((brand) => {
                            const calculated = getCalculatedMTD(brand.id);
                            const currentOverrideSales = dailySalesInputs[brand.id]?.mtdSalesAmount || '';
                            const currentOverrideQty = dailySalesInputs[brand.id]?.mtdQuantitySold || '';
                            
                            const hasOverride = currentOverrideSales !== '' || currentOverrideQty !== '';
                            
                            return (
                              <tr key={brand.id} className={`hover:bg-slate-50/50 transition-colors ${hasOverride ? 'bg-amber-50/15' : ''}`}>
                                <td className="py-2.5 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700">{brand.name}</span>
                                    {hasOverride && (
                                      <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                        Override Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <div className="text-[10px] font-semibold text-slate-400 leading-normal">
                                    RM {calculated.salesAmount.toFixed(2)}
                                  </div>
                                  <div className="text-[9px] font-medium text-slate-400">
                                    {calculated.quantitySold} sold
                                  </div>
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="relative max-w-[140px]">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-2xs font-extrabold text-slate-400">RM</span>
                                    <input
                                      type="text"
                                      placeholder="No override"
                                      value={currentOverrideSales}
                                      onChange={(e) => handleMonthlyOverrideChange(brand.id, 'mtdSalesAmount', e.target.value)}
                                      className="w-full text-right text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                                    />
                                  </div>
                                </td>
                                <td className="py-2.5 px-4">
                                  <input
                                    type="text"
                                    placeholder="No override"
                                    value={currentOverrideQty}
                                    onChange={(e) => handleMonthlyOverrideChange(brand.id, 'mtdQuantitySold', e.target.value)}
                                    className="w-full text-center text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-[110px] outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        {brands.filter(b => b.name.toLowerCase().includes(monthlyTotalsSearch.toLowerCase())).length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 text-xs font-medium">
                              No matching brand categories found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Row */}
                  <div className="flex gap-3 justify-end border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Are you sure you want to clear all manual monthly overrides for this date? The system will revert to dynamically summing daily entries.")) {
                          const updated = { ...dailySalesInputs };
                          brands.forEach(b => {
                            if (updated[b.id]) {
                              updated[b.id] = {
                                ...updated[b.id],
                                mtdSalesAmount: '',
                                mtdQuantitySold: ''
                              };
                            }
                          });
                          setDailySalesInputs(updated);
                        }
                      }}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-250 hover:text-slate-800 text-slate-550 text-xs font-bold rounded-xl transition-all active:scale-97 cursor-pointer"
                    >
                      Clear Monthly Overrides
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleSaveMonthlyOverrides}
                      className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-97 cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Save Monthly Overrides</span>
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}


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
                          const hasDaily = parseFloat(dailySalesInputs[b.id]?.salesAmount || '0') > 0 || parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10) > 0;
                          const hasMtd = parseFloat(dailySalesInputs[b.id]?.mtdSalesAmount || '0') > 0 || parseInt(dailySalesInputs[b.id]?.mtdQuantitySold || '0', 10) > 0;
                          const hasValues = hasDaily || hasMtd;
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
                                <span className="text-[9px] text-emerald-650 opacity-90 font-semibold uppercase mt-0.5 tracking-tight flex flex-col items-center">
                                  {hasDaily && (
                                    <span>T: RM {parseFloat(dailySalesInputs[b.id]?.salesAmount || '0').toFixed(0)} ({parseInt(dailySalesInputs[b.id]?.quantitySold || '0', 10)}⌚)</span>
                                  )}
                                  {hasMtd && (
                                    <span>M: RM {parseFloat(dailySalesInputs[b.id]?.mtdSalesAmount || '0').toFixed(0)} ({parseInt(dailySalesInputs[b.id]?.mtdQuantitySold || '0', 10)}⌚)</span>
                                  )}
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
                            onClick={() => { setSelectedBrandIds([]); setWizardInputs({}); }}
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
                          <div className="md:col-span-3 flex items-center gap-2.5">
                            <span className="w-5.5 h-5.5 bg-indigo-50 text-indigo-600 rounded-md flex items-center justify-center font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800 text-sm truncate">{brandName}</span>
                          </div>

                          {/* Daily Input row of 2 */}
                          <div className="md:col-span-4 grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Today Sales</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">RM</span>
                                <input
                                  type="text"
                                  placeholder="0.00"
                                  value={wizardInputs[bId]?.salesAmount || ''}
                                  onChange={(e) => handleWizardInputChange(bId, 'salesAmount', e.target.value)}
                                  className="wizard-sales-input w-full text-right text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Today Qty</label>
                              <input
                                type="text"
                                placeholder="0"
                                value={wizardInputs[bId]?.quantitySold || ''}
                                onChange={(e) => handleWizardInputChange(bId, 'quantitySold', e.target.value)}
                                className="w-full text-center text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          {/* MTD Input row of 2 */}
                          <div className="md:col-span-4 grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">MTD Sales</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">RM</span>
                                <input
                                  type="text"
                                  placeholder="0.00"
                                  value={wizardInputs[bId]?.mtdSalesAmount || ''}
                                  onChange={(e) => handleWizardInputChange(bId, 'mtdSalesAmount', e.target.value)}
                                  className="w-full text-right text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">MTD Qty</label>
                              <input
                                type="text"
                                placeholder="0"
                                value={wizardInputs[bId]?.mtdQuantitySold || ''}
                                onChange={(e) => handleWizardInputChange(bId, 'mtdQuantitySold', e.target.value)}
                                className="w-full text-center text-xs font-semibold bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                              />
                            </div>
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
                      const hasDaily = parseFloat(dailySalesInputs[brand.id]?.salesAmount || '0') > 0 || parseInt(dailySalesInputs[brand.id]?.quantitySold || '0', 10) > 0;
                      const hasMtdInput = parseFloat(dailySalesInputs[brand.id]?.mtdSalesAmount || '0') > 0 || parseInt(dailySalesInputs[brand.id]?.mtdQuantitySold || '0', 10) > 0;
                      const hasValues = hasDaily || hasMtdInput;
                      
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
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" title="Values keyed in" />
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

                          {/* Displays Selected Daily & Direct MTD Metrics */}
                          <div className="flex items-center gap-6 justify-start md:justify-end flex-wrap">
                            {/* Today stats block */}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Today's Sales</span>
                              <span className={`font-mono text-xs font-bold ${hasDaily ? 'text-slate-800' : 'text-slate-400 font-normal shadow-3xs'}`}>
                                RM {parseFloat(dailySalesInputs[brand.id]?.salesAmount || '0').toFixed(2)} ({parseInt(dailySalesInputs[brand.id]?.quantitySold || '0', 10)} sold)
                              </span>
                            </div>

                            {/* Direct MTD stats block */}
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">MTD Input Override</span>
                              <span className={`font-mono text-xs font-bold ${hasMtdInput ? 'text-indigo-650' : 'text-slate-400 font-normal shadow-3xs'}`}>
                                {hasMtdInput ? (
                                  <span>RM {parseFloat(dailySalesInputs[brand.id]?.mtdSalesAmount || '0').toFixed(2)} ({parseInt(dailySalesInputs[brand.id]?.mtdQuantitySold || '0', 15)} sold)</span>
                                ) : (
                                  <span>none</span>
                                )}
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
                                      [brand.id]: { salesAmount: '', quantitySold: '', mtdSalesAmount: '', mtdQuantitySold: '' }
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
