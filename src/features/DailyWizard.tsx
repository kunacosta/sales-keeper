import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ArrowLeft, ArrowRight, RotateCcw, Save, Check, Plus } from 'lucide-react';
import { Brand, SalesInput, stateService } from '../lib/stateService.ts';
import { BrandStat, buildWhatsappSummary } from '../lib/summary.ts';
import { fmt } from '../lib/format.ts';
import { Card, PrimaryButton, GhostButton } from '../ui/theme.tsx';
import { WhatsappReceipt } from '../ui/WhatsappReceipt.tsx';
import BrandPicker from './BrandPicker.tsx';

type Step = 'select' | 'entry' | 'review' | 'done';
type Draft = Record<string, { rm: string; qty: string }>;

interface Props {
  brands: Brand[];
  entryDate: string;
  onDateChange: (d: string) => void;
  brandStats: Record<string, BrandStat>;
  showStatus: (type: 'success' | 'error', msg: string) => void;
  onSaved: () => void | Promise<void>;
}

export default function DailyWizard({ brands, entryDate, onDateChange, brandStats, showStatus, onSaved }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>({});

  const brandById = useMemo(() => Object.fromEntries(brands.map(b => [b.id, b])), [brands]);

  const restart = () => {
    setSelectedIds([]);
    setDraft({});
    setIndex(0);
    setStep('select');
  };

  const startEntry = () => {
    // Sort selected IDs by their position in the brands array so the wizard
    // pages in the same order the user arranged brands.
    const brandOrder = Object.fromEntries(brands.map((b, i) => [b.id, i]));
    const ordered = [...selectedIds].sort((a, b) => (brandOrder[a] ?? 999) - (brandOrder[b] ?? 999));
    setSelectedIds(ordered);
    const seeded: Draft = {};
    ordered.forEach(id => {
      const s = brandStats[id];
      seeded[id] = {
        rm: s && s.dailyRM > 0 ? String(s.dailyRM) : '',
        qty: s && s.dailyQty > 0 ? String(s.dailyQty) : '',
      };
    });
    setDraft(seeded);
    setIndex(0);
    setStep('entry');
  };

  const setField = (id: string, field: 'rm' | 'qty', value: string) => {
    setDraft(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async () => {
    try {
      // saveDailySales replaces ALL records for the date, so write every brand:
      // drafted values for selected brands, the stored record for the rest. Any
      // existing month-override fields are carried over so they aren't wiped.
      const existing = await stateService.getDailySales(entryDate);
      const exMap = Object.fromEntries(existing.map(s => [s.brandId, s]));
      const inputs: SalesInput[] = brands.map(b => {
        const ex = exMap[b.id];
        const d = draft[b.id];
        const input: SalesInput = {
          brandId: b.id,
          salesAmount: d ? (parseFloat(d.rm) || 0) : (ex?.salesAmount ?? 0),
          quantitySold: d ? (parseInt(d.qty) || 0) : (ex?.quantitySold ?? 0),
        };
        if (ex?.mtdSalesAmount !== undefined) input.mtdSalesAmount = ex.mtdSalesAmount;
        if (ex?.mtdQuantitySold !== undefined) input.mtdQuantitySold = ex.mtdQuantitySold;
        return input;
      });
      await stateService.saveDailySales(entryDate, inputs);
      await onSaved();
      showStatus('success', 'Sales saved');
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Save failed:', msg);
      showStatus('error', msg.includes('permission') || msg.includes('Missing or insufficient')
        ? 'Permission denied — check Firestore rules'
        : 'Save failed: ' + msg.slice(0, 80));
    }
  };

  const summary = useMemo(
    () => buildWhatsappSummary(brands, brandStats, draft, entryDate, { seedFromSaved: true }),
    [brands, brandStats, draft, entryDate]
  );

  // --- SELECT STEP ---
  if (step === 'select') {
    return (
      <Card className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-2 px-3 w-fit">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <input
            type="date"
            value={entryDate}
            onChange={e => onDateChange(e.target.value)}
            className="bg-transparent text-slate-900 outline-none text-xs font-mono font-bold"
          />
        </div>
        <BrandPicker
          brands={brands}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          onNext={startEntry}
          title="Enter daily sales"
          subtitle="Pick the brands you sold today, then key in the values one by one."
          nextLabel="Start entry"
        />
      </Card>
    );
  }

  // --- ENTRY STEP ---
  if (step === 'entry') {
    const currentId = selectedIds[index];
    const brand = brandById[currentId];
    const d = draft[currentId] || { rm: '', qty: '' };
    const isLast = index === selectedIds.length - 1;

    return (
      <Card className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
            Brand {index + 1} of {selectedIds.length}
          </span>
          <button onClick={restart} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
          >
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">{brand?.name}</h2>
            <p className="text-slate-500 text-xs mb-6">Current today: RM {fmt(brandStats[currentId]?.dailyRM || 0)} · {fmt(brandStats[currentId]?.dailyQty || 0)} pcs</p>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Sales (RM)</span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  autoFocus
                  value={d.rm}
                  onChange={e => setField(currentId, 'rm', e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 rounded-2xl p-4 text-center text-slate-900 font-mono text-2xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Quantity (pcs)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={d.qty}
                  onChange={e => setField(currentId, 'qty', e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  className="w-full bg-white border border-slate-300 rounded-2xl p-4 text-center text-slate-900 font-mono text-2xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                />
              </label>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-3 mt-8">
          <GhostButton onClick={() => (index > 0 ? setIndex(index - 1) : setStep('select'))} className="flex-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </GhostButton>
          <PrimaryButton onClick={() => (isLast ? setStep('review') : setIndex(index + 1))} className="flex-1">
            {isLast ? 'Review' : 'Next'} <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        </div>
      </Card>
    );
  }

  // --- REVIEW STEP ---
  if (step === 'review') {
    const totalRM = selectedIds.reduce((sum, id) => sum + (parseFloat(draft[id]?.rm) || 0), 0);
    const totalQty = selectedIds.reduce((sum, id) => sum + (parseInt(draft[id]?.qty) || 0), 0);

    return (
      <Card className="p-6 max-w-lg mx-auto">
        <h2 className="text-lg font-black text-slate-900 tracking-tight mb-1">Review & save</h2>
        <p className="text-slate-500 text-sm mb-5">Check the values for {new Date(entryDate).toLocaleDateString('en-GB')}.</p>

        <div className="flex flex-col divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden mb-6">
          {selectedIds.map(id => {
            const d = draft[id] || { rm: '', qty: '' };
            return (
              <div key={id} className="flex items-center justify-between p-3.5 bg-white">
                <span className="text-sm font-bold text-slate-700">{brandById[id]?.name}</span>
                <span className="text-sm font-mono text-slate-900">
                  RM {d.rm ? fmt(d.rm) : '0'} <span className="text-slate-300 mx-1">·</span> {d.qty ? fmt(d.qty) : '0'} pcs
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between p-3.5 bg-indigo-50">
            <span className="text-sm font-black text-indigo-700">Daily total</span>
            <span className="text-sm font-mono font-black text-indigo-700">
              RM {fmt(totalRM)} <span className="text-indigo-300 mx-1">·</span> {fmt(totalQty)} pcs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GhostButton onClick={() => { setIndex(selectedIds.length - 1); setStep('entry'); }} className="flex-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </GhostButton>
          <PrimaryButton onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4" /> Save
          </PrimaryButton>
        </div>
      </Card>
    );
  }

  // --- DONE STEP ---
  return (
    <Card className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
          <Check className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Saved</h2>
          <p className="text-slate-500 text-xs">Send this to WhatsApp.</p>
        </div>
      </div>

      <WhatsappReceipt summary={summary} onCopied={() => showStatus('success', 'Receipt copied')} />

      <PrimaryButton onClick={restart} className="w-full mt-5">
        <Plus className="w-4 h-4" /> New entry
      </PrimaryButton>
    </Card>
  );
}
