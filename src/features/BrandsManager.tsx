import { useState } from 'react';
import { Plus, Trash2, List, RotateCcw, RefreshCw } from 'lucide-react';
import { Brand, stateService } from '../lib/stateService.ts';
import { getMonthYear } from '../lib/format.ts';
import { Card, PrimaryButton } from '../ui/theme.tsx';

interface Props {
  brands: Brand[];
  entryDate: string;
  isSyncing: boolean;
  showStatus: (type: 'success' | 'error', msg: string) => void;
  onChanged: () => void | Promise<void>;
}

export default function BrandsManager({ brands, entryDate, isSyncing, showStatus, onChanged }: Props) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const addBrand = async () => {
    const name = newName.trim();
    if (!name) return;
    if (brands.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      showStatus('error', 'Brand already exists');
      return;
    }
    await stateService.saveBrand(name, brands.length + 1);
    setNewName('');
    await onChanged();
    showStatus('success', 'Brand added');
  };

  const deleteBrand = async (id: string) => {
    await stateService.deleteBrand(id);
    setConfirmDeleteId(null);
    await onChanged();
    showStatus('success', 'Brand removed');
  };

  const hardReset = async () => {
    await stateService.resetMonthlySales(entryDate.substring(0, 7));
    setConfirmReset(false);
    await onChanged();
    showStatus('success', 'Month reset');
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <Card className="p-6">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add a brand
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addBrand(); }}
            placeholder="Brand name"
            className="flex-1 bg-white border border-slate-300 rounded-2xl py-3 px-4 text-slate-900 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
          />
          <PrimaryButton onClick={addBrand} disabled={!newName.trim()}>
            <Plus className="w-4 h-4" /> Add
          </PrimaryButton>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
          <List className="w-3.5 h-3.5" /> Brands ({brands.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {brands.map((b, i) => (
            <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-2 truncate">
                <span className="text-[10px] font-mono text-slate-400">{i + 1}</span>
                {b.name}
              </span>
              {confirmDeleteId === b.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => deleteBrand(b.id)} className="px-2 py-1 text-[10px] font-black uppercase rounded-lg bg-rose-600 text-white">Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-[10px] font-black uppercase rounded-lg bg-slate-200 text-slate-600">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteId(b.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-slate-900 font-black text-sm">Reset month</div>
              <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Wipe {getMonthYear(entryDate)}</div>
            </div>
          </div>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button onClick={hardReset} className="flex-1 py-2 text-xs font-black uppercase rounded-xl bg-rose-600 text-white">Confirm reset</button>
              <button onClick={() => setConfirmReset(false)} className="py-2 px-3 text-xs font-black uppercase rounded-xl bg-slate-100 text-slate-600">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="w-full py-2 text-xs font-black uppercase rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
              Reset this month
            </button>
          )}
        </Card>

        <Card className="p-5 flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1">
            <div className="text-slate-900 font-black text-sm">Sync status</div>
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
              {isSyncing ? 'Saving…' : 'All saved'}
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`} />
        </Card>
      </div>
    </div>
  );
}
