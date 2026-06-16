import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Watch, Share2, ShoppingCart, CalendarRange, Settings2, Store } from 'lucide-react';
import { stateService, setActiveOutlet, Brand, DailySale } from './lib/stateService.ts';
import { getTodayStr } from './lib/format.ts';
import { buildWhatsappSummary, BrandStat } from './lib/summary.ts';
import { OUTLETS, outletsForEmail } from './lib/outlets.ts';
import { useAuth } from './lib/AuthContext.tsx';
import { Card, Toast } from './ui/theme.tsx';
import { MobileReceiptSheet } from './ui/WhatsappReceipt.tsx';
import DailyWizard from './features/DailyWizard.tsx';
import MonthlyEditor from './features/MonthlyEditor.tsx';
import BrandsManager from './features/BrandsManager.tsx';

type Tab = 'daily' | 'monthly' | 'brands';

const TABS: { id: Tab, label: string, icon: any }[] = [
  { id: 'daily', label: 'Daily', icon: ShoppingCart },
  { id: 'monthly', label: 'Monthly', icon: CalendarRange },
  { id: 'brands', label: 'Brands', icon: Settings2 },
];

export default function App() {
  const { user } = useAuth();
  const allowed = useMemo(() => outletsForEmail(user?.email), [user]);

  const [outlet, setOutlet] = useState<string>(() => outletsForEmail(user?.email)[0] ?? '');
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [monthlySales, setMonthlySales] = useState<DailySale[]>([]);
  const [entryDate, setEntryDate] = useState<string>(getTodayStr());
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const outletCode = OUTLETS[outlet]?.code ?? 'MRT';

  // Single load path — always sets the active outlet FIRST so reads hit the
  // right collections/cache, then pulls Firestore and refreshes local state.
  const loadAll = async (code: string, date: string) => {
    if (!code) return;
    setActiveOutlet(code);
    await stateService.pullSalesFromFirestore(date.substring(0, 7));
    setBrands(await stateService.getBrands());
    setMonthlySales(await stateService.getMonthlySales(date.substring(0, 7)));
  };

  // Runs on mount, when the owner switches outlet, and when the date changes.
  useEffect(() => {
    loadAll(outlet, entryDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet, entryDate]);

  // Re-sync when the tab/app comes back into focus (e.g. switching back on phone)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAll(outlet, entryDate);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet, entryDate]);

  useEffect(() => {
    const interval = setInterval(() => setIsSyncing(stateService.isSyncing()), 2000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = async (date: string) => {
    setMonthlySales(await stateService.getMonthlySales(date.substring(0, 7)));
  };

  const reloadBrands = async () => {
    setBrands(await stateService.getBrands());
    await refreshData(entryDate);
  };

  const brandStats = useMemo<Record<string, BrandStat>>(
    () => stateService.getDashboardStats(entryDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryDate, monthlySales, brands, outlet]
  );

  const showStatus = (type: 'success' | 'error', msg: string) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  };

  const receiptSummary = useMemo(
    () => buildWhatsappSummary(brands, brandStats, {}, entryDate, { seedFromSaved: true, outletCode }),
    [brands, brandStats, entryDate, outletCode]
  );

  // No outlet assigned to this login
  if (allowed.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-slate-900 mb-1">No outlet assigned</h2>
          <p className="text-slate-500 text-sm">
            Your account ({user?.email}) isn't linked to an outlet yet. Ask the owner to add you.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 font-sans selection:bg-indigo-200 overflow-x-hidden">
      {/* Soft background accents */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/30 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-200/20 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-[1100px] mx-auto px-4 md:px-8 pt-6 pb-16">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Watch className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Watch Sales</h1>
              <span className="text-[11px] font-bold text-slate-400">{outletCode} · Daily & monthly tracker</span>
            </div>
          </div>

          {/* OUTLET SWITCHER — only for accounts with more than one outlet */}
          {allowed.length > 1 && (
            <div className="flex bg-white border border-slate-200 shadow-sm p-1 rounded-2xl">
              {allowed.map(code => {
                const active = outlet === code;
                return (
                  <button
                    key={code}
                    onClick={() => { setOutlet(code); setActiveTab('daily'); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                      active ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    {OUTLETS[code]?.code ?? code}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* TAB BAR + RECEIPT */}
        <div className="flex items-center justify-between gap-3 mb-7">
          <div className="flex bg-white border border-slate-200 shadow-sm p-1 rounded-2xl">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    active ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowReceipt(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Receipt</span>
          </button>
        </div>

        {/* MAIN */}
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${outlet}-${activeTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'daily' && (
                <DailyWizard
                  brands={brands}
                  entryDate={entryDate}
                  onDateChange={setEntryDate}
                  brandStats={brandStats}
                  showStatus={showStatus}
                  onSaved={() => refreshData(entryDate)}
                  outletCode={outletCode}
                />
              )}
              {activeTab === 'monthly' && (
                <MonthlyEditor
                  brands={brands}
                  entryDate={entryDate}
                  onDateChange={setEntryDate}
                  brandStats={brandStats}
                  showStatus={showStatus}
                  onSaved={() => refreshData(entryDate)}
                />
              )}
              {activeTab === 'brands' && (
                <BrandsManager
                  brands={brands}
                  entryDate={entryDate}
                  isSyncing={isSyncing}
                  showStatus={showStatus}
                  onChanged={reloadBrands}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileReceiptSheet
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        summary={receiptSummary}
        onCopied={() => showStatus('success', 'Receipt copied')}
      />

      <Toast status={status} />
    </div>
  );
}
