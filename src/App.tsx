import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Upload, 
  FileImage, 
  Sparkles, 
  Trash2, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  Copy, 
  TrendingUp, 
  AlertCircle, 
  Layers, 
  SlidersHorizontal,
  RefreshCw
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
  
  // Interaction/UI states
  const [loading, setLoading] = useState<boolean>(true);
  const [aiParsing, setAiParsing] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Brand management state
  const [newBrandName, setNewBrandName] = useState<string>('');
  const [brandError, setBrandError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setDailySalesInputs(initialInputs);
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

  // Save changes
  const handleSave = async () => {
    try {
      setLoading(true);
      const inputs = Object.entries(dailySalesInputs).map(([brandId, val]) => ({
        brandId,
        salesAmount: parseFloat(val.salesAmount) || 0,
        quantitySold: parseInt(val.quantitySold, 10) || 0
      }));

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

  // AI OCR photo input handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processImageFile(file);
  };

  const processImageFile = async (file: File) => {
    try {
      setAiParsing(true);
      setAiStatus('Reading raw photograph bytes...');
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          setAiStatus('Orchestrating layout and contacting Gemini Vision AI...');

          const brandNamesList = brands.map(b => b.name);

          const response = await fetch('/api/parse-receipt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image: base64Data,
              mimeType: file.type,
              brands: brandNamesList
            })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Server parsing request returned an error.');
          }

          if (data && Array.isArray(data.sales)) {
            setAiStatus('Mapping extracted data into brand fields...');
            
            // Map sales elements to current brand inputs
            const updatedInputs = { ...dailySalesInputs };
            
            data.sales.forEach((item: { brand: string; sales_amount: number; quantity_sold: number }) => {
              // Exact match or fuzzy case insensitive search
              const foundBrand = brands.find(b => b.name.toLowerCase() === item.brand.toLowerCase());
              if (foundBrand) {
                updatedInputs[foundBrand.id] = {
                  salesAmount: item.sales_amount > 0 ? String(item.sales_amount) : '',
                  quantitySold: item.quantity_sold > 0 ? String(item.quantity_sold) : ''
                };
              }
            });

            setDailySalesInputs(updatedInputs);
            setSaveStatus({
              type: 'success',
              message: 'Gemini AI successfully extracted sales values.'
            });
            setTimeout(() => setSaveStatus(null), 3000);
          } else {
            throw new Error('Unrecognized response format from Gemini engine.');
          }

        } catch (err: any) {
          console.error(err);
          setSaveStatus({
            type: 'error',
            message: `AI Error: ${err.message}`
          });
        } finally {
          setAiParsing(false);
          setAiStatus('');
        }
      };
    } catch (err: any) {
      setAiParsing(false);
      setAiStatus('');
      setSaveStatus({
        type: 'error',
        message: `Failed to load file: ${err.message}`
      });
    }
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

            {/* AI Photo Scan Panel */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 bg-indigo-50 text-indigo-500 rounded-bl-2xl text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Core Engine</span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    Auto-Fill Sales from Receipt Photo
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 max-w-xl">
                    Take a snapshot or select an image file of the checkout paper register. 
                    Gemini Vision OCR will read values and auto-fill sales outputs dynamically for active brands below.
                  </p>
                </div>

                {/* Photo Dropzone Block */}
                <div 
                  className={`w-full md:w-auto min-w-[240px] border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                    aiParsing 
                      ? 'bg-indigo-50 border-indigo-300' 
                      : 'bg-stone-50 border-slate-200 hover:border-indigo-400 hover:bg-slate-100'
                  }`}
                  onClick={() => !aiParsing && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                    disabled={aiParsing}
                  />

                  {aiParsing ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                      <span className="text-sm font-semibold text-indigo-800">Processing Document...</span>
                      <p className="text-xs text-indigo-500 font-medium px-2">{aiStatus}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-7 h-7 text-indigo-500" />
                      <span className="text-sm font-bold text-slate-700">Upload or Snap Photo</span>
                      <p className="text-2xs text-slate-500 font-medium">Supports JPG, PNG with checkout ledger lines</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Brands inputs and list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  Daily Brands Ledger ({brands.length} active brands)
                </span>
                <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                   Currency RM (Malaysian Ringgit)
                </span>
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
                  {brands.map((brand) => {
                    const savedMtd = getBrandMTD(brand.id);
                    return (
                      <div 
                        key={brand.id} 
                        className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Brand Name Column */}
                        <div className="min-w-[180px]">
                          <span className="font-bold text-slate-800">{brand.name}</span>
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-500 mt-1">
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-2xs font-mono font-bold tracking-wider">
                              MTD
                            </span>
                            <span>RM {savedMtd.salesAmount.toFixed(2)}</span>
                            <span className="text-slate-300">•</span>
                            <span>{savedMtd.quantitySold} Qty</span>
                          </div>
                        </div>

                        {/* Input Fields Row */}
                        <div className="flex items-center gap-4 flex-1 max-w-lg justify-start md:justify-end">
                          <div className="flex-1 sm:max-w-[180px]">
                            <label className="block sm:hidden text-2xs font-bold text-slate-400 uppercase mb-1">Sales RM</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">RM</span>
                              <input
                                type="text"
                                value={dailySalesInputs[brand.id]?.salesAmount || ''}
                                onChange={(e) => handleInputChange(brand.id, 'salesAmount', e.target.value)}
                                placeholder="0.00"
                                className="w-full text-right text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="w-24 sm:w-28 shrink-0">
                            <label className="block sm:hidden text-2xs font-bold text-slate-400 uppercase mb-1">Quantity</label>
                            <input
                              type="text"
                              value={dailySalesInputs[brand.id]?.quantitySold || ''}
                              onChange={(e) => handleInputChange(brand.id, 'quantitySold', e.target.value)}
                              placeholder="0"
                              className="w-full text-center text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
