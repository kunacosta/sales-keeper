import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  Plus, 
  Minus, 
  List, 
  RotateCcw, 
  History,
  Check,
  X,
  Copy,
  Save,
  AlertCircle,
  Share2,
  Package,
  Clock,
  LayoutDashboard,
  Settings,
  Search,
  ArrowUpRight,
  Database,
  Smartphone,
  ChevronUp,
  CloudZap,
  RefreshCw,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { stateService, Brand, DailySale, SalesInput } from './lib/stateService.ts';

// --- HELPERS ---
const fmt = (n: number | string) => {
  const f = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(f)) return '0';
  return f % 1 === 0 ? f.toLocaleString() : f.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: '2-digit' };
  return d.toLocaleDateString('en-GB', options).replace(/ /g, ' ');
};

const getMonthYear = (dateStr: string) => {
  const d = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { month: 'short', year: '2-digit' };
  return d.toLocaleDateString('en-GB', options);
};

// --- STYLED COMPONENTS ---

const GlassCard = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={`bg-[#0f172a]/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const StatCard = ({ title, value, icon: Icon, colorClass, suffix = "" }: { title: string, value: string | number, icon: any, colorClass: string, suffix?: string }) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    className="bg-[#0f172a]/60 backdrop-blur-xl border border-white/5 p-4 rounded-3xl flex flex-col gap-1 relative overflow-hidden group"
  >
    <div className={`absolute -right-2 -top-2 w-16 h-16 opacity-10 blur-2xl rounded-full ${colorClass}`} />
    <div className="flex items-center gap-2 mb-1">
      <div className={`p-1.5 rounded-lg ${colorClass} bg-opacity-20`}>
        <Icon className={`w-3 h-3 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <motion.span 
        key={value}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-xl font-black text-white font-mono"
      >
        {value}
      </motion.span>
      {suffix && <span className="text-slate-500 text-[10px] font-mono font-bold">{suffix}</span>}
    </div>
    <div className={`absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 ${colorClass}`} />
  </motion.div>
);

// --- MAIN APP ---

export default function App() {
  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [entryMode, setEntryMode] = useState<'ops' | 'audit'>('ops'); // ops = daily, audit = MTD override
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showMobileReceipt, setShowMobileReceipt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data State
  const [brands, setBrands] = useState<Brand[]>([]);
  const [monthlySales, setMonthlySales] = useState<DailySale[]>([]);
  const [entryDate, setEntryDate] = useState<string>(getTodayStr());
  
  // Draft State (for real-time editing before global save)
  const [draftSales, setDraftSales] = useState<Record<string, { rm: string, qty: string }>>({});
  const [isDirty, setIsDirty] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSyncing(stateService.isSyncing());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshData(entryDate, entryMode);
  }, [entryDate, entryMode]);

  const loadData = async () => {
    const b = await stateService.getBrands();
    setBrands(b);
    await refreshData(getTodayStr(), entryMode);
  };

  const refreshData = async (date: string, mode: 'ops' | 'audit') => {
    const mSales = await stateService.getMonthlySales(date.substring(0, 7));
    setMonthlySales(mSales);
    
    // Initialize draft from current data
    const dayStats = stateService.getDashboardStats(date);
    const newDraft: Record<string, { rm: string, qty: string }> = {};
    Object.entries(dayStats).forEach(([id, s]) => {
      if (mode === 'ops') {
        newDraft[id] = { 
          rm: s.dailyRM > 0 ? s.dailyRM.toString() : '', 
          qty: s.dailyQty > 0 ? s.dailyQty.toString() : '' 
        };
      } else {
        newDraft[id] = { 
          rm: s.mtdRM > 0 ? s.mtdRM.toString() : '', 
          qty: s.mtdQty > 0 ? s.mtdQty.toString() : '' 
        };
      }
    });
    setDraftSales(newDraft);
    setIsDirty(false);
  };

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    const brandStats = stateService.getDashboardStats(entryDate);
    
    let todayRM = 0;
    let todayQty = 0;
    let monthlyRM = 0;

    // Use draft values for today's totals to show live updates
    Object.keys(draftSales).forEach(id => {
      const d = draftSales[id];
      todayRM += parseFloat(d.rm) || 0;
      todayQty += parseInt(d.qty) || 0;
    });

    // MTD RM includes today's draft vs today's previous value
    Object.values(brandStats).forEach(s => {
      monthlyRM += s.mtdRM;
    });

    // Adjustment: Subtract old dailyRM, add draft RM for accurate MTD live view
    Object.entries(brandStats).forEach(([id, s]) => {
      const draftRM = parseFloat(draftSales[id]?.rm) || 0;
      monthlyRM = monthlyRM - s.dailyRM + draftRM;
    });

    return { todayRM, todayQty, monthlyRM, brandStats };
  }, [draftSales, entryDate, monthlySales]);

  const filteredBrands = useMemo(() => {
    return brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [brands, searchQuery]);

  // --- WHATSAPP SUMMARY GENERATOR ---
  const whatsappSummary = useMemo(() => {
    if (brands.length === 0) return 'No data available...';
    
    const d = new Date(entryDate);
    const dateLabel = formatDate(entryDate);
    const dayNum = d.getDate();
    const monthYr = getMonthYear(entryDate);

    const brandLines: string[] = [];
    let totalDay = 0;
    let totalMon = 0;

    brands.forEach(b => {
      const s = stats.brandStats[b.id] || { dailyRM: 0, dailyQty: 0, mtdRM: 0, mtdQty: 0 };
      const dRM = parseFloat(draftSales[b.id]?.rm) || 0;
      const dQty = parseInt(draftSales[b.id]?.qty) || 0;
      const mRM = s.mtdRM - s.dailyRM + dRM;
      const mQty = s.mtdQty - s.dailyQty + dQty;

      if (dRM > 0 || dQty > 0 || mRM > 0) {
        brandLines.push(`${b.name} =${fmt(dRM)}/${fmt(mRM)}⌚${fmt(dQty)}/${fmt(mQty)}`);
        totalDay += dRM;
        totalMon += mRM;
      }
    });

    return [
      `${dateLabel}(MRT)`,
      `*Sale RM ${fmt(totalDay)}`,
      ...brandLines,
      `\nTotal 1-${dayNum} ${monthYr}`,
      `*Rm ${fmt(totalMon)}`
    ].join('\n');
  }, [brands, stats, draftSales, entryDate]);

  // --- HANDLERS ---
  const handleKeyDown = (e: React.KeyboardEvent, brandId: string, field: 'rm' | 'qty') => {
    const currentIndex = filteredBrands.findIndex(b => b.id === brandId);
    if (e.key === 'ArrowDown') {
      const nextBrand = filteredBrands[currentIndex + 1];
      if (nextBrand) {
        const nextInput = document.querySelector(`[data-brand="${nextBrand.id}"][data-field="${field}"]`) as HTMLInputElement;
        nextInput?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      const prevBrand = filteredBrands[currentIndex - 1];
      if (prevBrand) {
        const prevInput = document.querySelector(`[data-brand="${prevBrand.id}"][data-field="${field}"]`) as HTMLInputElement;
        prevInput?.focus();
      }
    }
  };

  const handleInputChange = (brandId: string, field: 'rm' | 'qty', value: string) => {
    setDraftSales(prev => ({
      ...prev,
      [brandId]: {
        ...prev[brandId],
        [field]: value
      }
    }));
    setIsDirty(true);
  };

  const handleGlobalSave = async () => {
    try {
      const salesInputs: SalesInput[] = Object.entries(draftSales).map(([brandId, vals]) => {
        const input: SalesInput = {
          brandId,
          salesAmount: 0,
          quantitySold: 0
        };

        if (entryMode === 'ops') {
          input.salesAmount = parseFloat(vals.rm) || 0;
          input.quantitySold = parseInt(vals.qty) || 0;
        } else {
          // Audit Mode: Set overrides
          input.mtdSalesAmount = parseFloat(vals.rm) || 0;
          input.mtdQuantitySold = parseInt(vals.qty) || 0;
          
          // Preserve existing daily values for that date
          const currentDay = stats.brandStats[brandId];
          input.salesAmount = currentDay?.dailyRM || 0;
          input.quantitySold = currentDay?.dailyQty || 0;
        }
        return input;
      });
      
      await stateService.saveDailySales(entryDate, salesInputs);
      await refreshData(entryDate, entryMode);
      showStatus('success', entryMode === 'ops' ? 'Command Center Synced' : 'MTD Overrides Applied');
    } catch (err) {
      showStatus('error', 'Sync Failed');
    }
  };

  const showStatus = (type: 'success' | 'error', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(whatsappSummary);
    showStatus('success', 'Receipt Copied');
  };

  // --- RENDER PARTS ---

  const renderCommandCenter = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-12rem)]">
      {/* LEFT COLUMN: Input Grid */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Header Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard title="Revenue" value={fmt(stats.todayRM)} icon={TrendingUp} colorClass="bg-emerald-500" suffix="RM" />
          <StatCard title="Units" value={stats.todayQty} icon={Package} colorClass="bg-indigo-500" suffix="PCS" />
          <StatCard title="MTD Total" value={fmt(stats.monthlyRM)} icon={Database} colorClass="bg-amber-500" suffix="RM" className="hidden md:flex" />
        </div>

        {/* The Grid */}
        <GlassCard className="flex-1 flex flex-col shadow-2xl border-white/5">
          <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/[0.02]">
             <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[#020617] p-2 px-4 rounded-2xl border border-white/10 group focus-within:border-indigo-500/50 transition-all">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <input 
                    type="date" 
                    value={entryDate} 
                    onChange={e => setEntryDate(e.target.value)}
                    className="bg-transparent text-white outline-none text-xs font-mono uppercase font-bold"
                  />
                </div>
                
                {/* Audit Mode Toggle */}
                <div className="flex bg-[#020617] border border-white/10 p-1 rounded-2xl">
                  <button 
                    onClick={() => setEntryMode('ops')}
                    title="Daily Sales Mode"
                    className={`p-2 rounded-xl transition-all ${entryMode === 'ops' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Package className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setEntryMode('audit')}
                    title="Monthly Audit Mode"
                    className={`p-2 rounded-xl transition-all ${entryMode === 'audit' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
             </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Quick find brand..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#020617] border border-white/10 rounded-2xl text-white text-xs outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.01] border-b border-white/5">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Brand</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                    {entryMode === 'ops' ? 'RM Sale' : 'MTD RM Override'}
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
                    {entryMode === 'ops' ? 'Quantity' : 'MTD QTY Override'}
                  </th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredBrands.map(brand => {
                  const s = stats.brandStats[brand.id] || { dailyRM: 0, dailyQty: 0, mtdRM: 0, mtdQty: 0 };
                  const hasData = entryMode === 'ops' 
                    ? (parseFloat(draftSales[brand.id]?.rm) || 0) > 0 || (parseInt(draftSales[brand.id]?.qty) || 0) > 0
                    : false; // MTD overrides are their own status
                  
                  return (
                    <motion.tr 
                      key={brand.id}
                      layout
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold transition-colors ${hasData ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {brand.name}
                          </span>
                          <span className="text-[10px] text-slate-600 font-mono">
                            {entryMode === 'ops' ? `MTD: ${fmt(s.mtdRM)}` : `Today: ${fmt(s.dailyRM)}`}
                          </span>
                        </div>
                      </td>
                      <td className="p-2">
                        <input 
                          type="number"
                          step="any"
                          inputMode="decimal"
                          data-brand={brand.id}
                          data-field="rm"
                          value={draftSales[brand.id]?.rm || ''}
                          onChange={e => handleInputChange(brand.id, 'rm', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, brand.id, 'rm')}
                          onFocus={e => e.target.select()}
                          placeholder="0.00"
                          className={`w-full bg-[#020617]/50 border rounded-xl p-2.5 text-center text-white font-mono text-sm outline-none transition-all ${entryMode === 'ops' ? 'border-white/5 focus:border-emerald-500/50' : 'border-amber-500/20 focus:border-amber-500/50'}`}
                        />
                      </td>
                      <td className="p-2">
                         <input 
                          type="number"
                          inputMode="numeric"
                          data-brand={brand.id}
                          data-field="qty"
                          value={draftSales[brand.id]?.qty || ''}
                          onChange={e => handleInputChange(brand.id, 'qty', e.target.value)}
                          onKeyDown={e => handleKeyDown(e, brand.id, 'qty')}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          className={`w-full bg-[#020617]/50 border rounded-xl p-2.5 text-center text-white font-mono text-sm outline-none transition-all ${entryMode === 'ops' ? 'border-white/5 focus:border-indigo-500/50' : 'border-amber-500/20 focus:border-amber-500/50'}`}
                        />
                      </td>
                      <td className="p-4 text-right">
                        {hasData ? (
                           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Check className="w-3 h-3" />
                           </motion.div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-white/5 mx-auto opacity-20" />
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            {filteredBrands.length === 0 && (
              <div className="p-12 text-center text-slate-600 italic text-sm">No brands found for "{searchQuery}"</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* RIGHT COLUMN: Persistent Live Receipt (Desktop only) */}
      <div className="hidden lg:flex w-80 flex-col gap-6 sticky top-8 h-fit">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2 px-2">
          <Share2 className="w-3 h-3" /> Live WhatsApp Feed
        </h2>
        
        <div className="relative">
          {/* WhatsApp Bubble Design */}
          <div className="bg-[#0b141a] rounded-[2rem] rounded-tr-none p-5 border border-white/5 shadow-2xl relative">
            {/* Typing Indicator if dirty */}
            <AnimatePresence>
              {isDirty && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute -top-3 left-6 px-2 py-0.5 bg-emerald-500 text-[8px] font-black text-black rounded-full"
                >
                  UPDATING...
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-emerald-500 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all">
              {whatsappSummary}
            </div>
            
            <div className="mt-4 flex justify-end items-center gap-1 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <Check className="w-3 h-3 text-emerald-500" />
            </div>
          </div>
          {/* Bubble Tail */}
          <div className="absolute top-0 -right-2 w-4 h-4 bg-[#0b141a] clip-path-polygon-[0_0,100%_0,0_100%]" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={copyToClipboard}
            className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <Copy className="w-4 h-4" /> Copy for WhatsApp
          </button>
          <button 
            onClick={() => {
              const url = `whatsapp://send?text=${encodeURIComponent(whatsappSummary)}`;
              window.open(url, '_blank');
            }}
            className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <ArrowUpRight className="w-4 h-4" /> Forward to Chat
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl"><Settings className="w-5 h-5 text-indigo-400" /></div>
          System Control
        </h2>
        <button 
          onClick={async () => {
            const name = prompt("Enter brand name:");
            if (name) {
              await stateService.saveBrand(name, brands.length + 1);
              setBrands(await stateService.getBrands());
              showStatus('success', 'Asset Added');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" /> New Brand
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <GlassCard className="p-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <List className="w-3 h-3" /> Active Portfolio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {brands.map((b, i) => (
              <div key={b.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between group">
                <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <span className="text-[8px] font-mono text-slate-600">{i+1}</span>
                  {b.name}
                </span>
                <button 
                  onClick={async () => {
                    if (confirm(`Remove ${b.name}?`)) {
                      await stateService.deleteBrand(b.id);
                      setBrands(await stateService.getBrands());
                      showStatus('success', 'Asset Removed');
                    }
                  }}
                  className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassCard 
            className="p-5 cursor-pointer group hover:bg-white/[0.04] transition-all"
            onClick={async () => {
              if (confirm("Reset ALL data for this month?")) {
                await stateService.resetMonthlySales(entryDate.substring(0, 7));
                await refreshData(entryDate);
                showStatus('success', 'Cycle Reset');
              }
            }}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 group-hover:rotate-180 transition-transform duration-500">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <div className="text-white font-black text-sm uppercase tracking-tighter">Hard Reset</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Wipe {getMonthYear(entryDate)}</div>
              </div>
            </div>
          </GlassCard>

          <GlassCard 
            className="p-5 flex items-center gap-4"
          >
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
              <History className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-white font-black text-sm uppercase tracking-tighter">Sync Status</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                {isSyncing ? 'Synchronizing...' : 'Live & Encrypted'}
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`} />
          </GlassCard>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-900/5 blur-[150px] rounded-full" />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-blue-900/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-8 pt-6 pb-32">
        {/* TOP NAV BAR */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-40 animate-pulse" />
              <div className="relative w-12 h-12 bg-[#020617] border-2 border-indigo-500 rounded-2xl flex items-center justify-center">
                <CloudZap className="w-7 h-7 text-indigo-500" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-white tracking-[0.1em] uppercase">RETAIL PRO</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">COMMAND CENTER</span>
                <span className="text-[10px] text-slate-600 font-mono">v4.0.1-STABLE</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <AnimatePresence>
              {isDirty && (
                <motion.button 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onClick={handleGlobalSave}
                  className="px-6 py-2.5 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 hover:bg-indigo-600 transition-all flex items-center gap-2 group"
                >
                  <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Sync Changes
                </motion.button>
              )}
            </AnimatePresence>
            
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Ops
              </button>
              <button 
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'admin' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Sys
              </button>
            </div>
          </div>
        </header>

        {/* MAIN VIEW */}
        <main className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' ? renderCommandCenter() : renderAdmin()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* MOBILE RECEIPT TOGGLE */}
        <div className="lg:hidden fixed bottom-6 right-6 z-40">
           <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowMobileReceipt(true)}
            className="w-14 h-14 bg-emerald-500 text-[#020617] rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40 border-4 border-[#020617]"
          >
            <Share2 className="w-6 h-6" />
          </motion.button>
        </div>

        {/* MOBILE RECEIPT SHEET */}
        <AnimatePresence>
          {showMobileReceipt && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowMobileReceipt(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[50]"
              />
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="fixed bottom-0 left-0 right-0 bg-[#0b141a] border-t border-white/10 rounded-t-[3rem] p-8 z-[60] shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-8" />
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter">
                    <div className="p-2 bg-emerald-500/20 rounded-xl"><Share2 className="w-5 h-5 text-emerald-500" /></div>
                    WHATSAPP RECEIPT
                  </h3>
                  <button onClick={() => setShowMobileReceipt(false)} className="p-2 bg-white/5 rounded-full">
                    <X className="w-6 h-6 text-slate-500" />
                  </button>
                </div>
                
                <div className="bg-[#020617] p-6 rounded-[2rem] border border-white/10 text-emerald-500 font-mono text-xs whitespace-pre-wrap leading-relaxed mb-8 shadow-inner overflow-y-auto">
                  {whatsappSummary}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { copyToClipboard(); setShowMobileReceipt(false); }}
                    className="py-5 bg-emerald-500 text-black rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                    <Copy className="w-5 h-5" /> Copy
                  </button>
                  <button 
                    onClick={() => {
                      const url = `whatsapp://send?text=${encodeURIComponent(whatsappSummary)}`;
                      window.open(url, '_blank');
                    }}
                    className="py-5 bg-white/5 border border-white/10 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-5 h-5" /> Forward
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* STATUS TOASTS */}
        <AnimatePresence>
          {status && (
            <motion.div 
              initial={{ opacity: 0, y: -50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -50, x: '-50%' }}
              className={`fixed top-8 left-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-2xl ${
                status.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${status.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-black`}>
                {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <span className="font-black text-xs uppercase tracking-widest">{status.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FOOTER SYNC STATUS (Desktop) */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#020617]/80 backdrop-blur-xl border-t border-white/5 px-8 py-3 z-30 hidden md:flex items-center justify-between">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isSyncing ? 'Synchronizing Node' : 'System Ready'}</span>
          </div>
          <div className="h-3 w-px bg-white/10" />
          <div className="text-[9px] font-mono text-slate-600 uppercase">Latency: 24ms</div>
        </div>
        
        <div className="flex items-center gap-4">
           {isDirty && (
             <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Unsaved Local Draft Active</span>
           )}
           <button onClick={loadData} className="p-1 hover:text-indigo-400 transition-colors">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </footer>
    </div>
  );
}
