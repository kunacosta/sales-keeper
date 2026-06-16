import { useState, useRef } from 'react';
import { Plus, Trash2, List, RotateCcw, RefreshCw, GripVertical, Layers, X } from 'lucide-react';
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
  const [bulkInput, setBulkInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [localOrder, setLocalOrder] = useState<Brand[]>([]);
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  // Use localOrder while dragging, fall back to props
  const displayBrands = localOrder.length > 0 ? localOrder : brands;

  const addBrand = async () => {
    const name = newName.trim();
    if (!name) return;
    if (brands.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      showStatus('error', 'Brand already exists');
      return;
    }
    try {
      await stateService.saveBrand(name, brands.length + 1);
      setNewName('');
      setLocalOrder([]);
      await onChanged();
      showStatus('success', 'Brand added');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showStatus('error', msg.includes('permission') || msg.includes('Missing or insufficient')
        ? 'Permission denied — publish updated Firestore rules'
        : 'Add failed: ' + msg.slice(0, 80));
    }
  };

  const deleteBrand = async (id: string) => {
    try {
      await stateService.deleteBrand(id);
      setConfirmDeleteId(null);
      setLocalOrder([]);
      await onChanged();
      showStatus('success', 'Brand removed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showStatus('error', 'Delete failed: ' + msg.slice(0, 80));
    }
  };

  const bulkAdd = async () => {
    const names = bulkInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !brands.some(b => b.name.toLowerCase() === l.toLowerCase()));
    if (names.length === 0) { showStatus('error', 'No new brands to add'); return; }
    try {
      await stateService.saveBrandsMany(names);
      setBulkInput('');
      setLocalOrder([]);
      await onChanged();
      showStatus('success', `${names.length} brand${names.length > 1 ? 's' : ''} added`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showStatus('error', 'Bulk add failed: ' + msg.slice(0, 80));
    }
  };

  const clearAllBrands = async () => {
    try {
      await stateService.deleteAllBrands();
      setConfirmClearAll(false);
      setLocalOrder([]);
      await onChanged();
      showStatus('success', 'All brands removed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showStatus('error', 'Clear failed: ' + msg.slice(0, 80));
    }
  };

  const hardReset = async () => {
    await stateService.resetMonthlySales(entryDate.substring(0, 7));
    setConfirmReset(false);
    await onChanged();
    showStatus('success', 'Month reset');
  };

  const onDragStart = (i: number) => {
    dragIndex.current = i;
    if (localOrder.length === 0) setLocalOrder([...brands]);
  };

  const onDragEnter = (i: number) => {
    dragOverIndex.current = i;
    if (dragIndex.current === null || dragIndex.current === i) return;
    setLocalOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current!, 1);
      next.splice(i, 0, moved);
      dragIndex.current = i;
      return next;
    });
  };

  const onDragEnd = async () => {
    dragIndex.current = null;
    dragOverIndex.current = null;
    if (localOrder.length === 0) return;
    const reordered = localOrder.map((b, i) => ({ ...b, sortOrder: i + 1 }));
    await stateService.saveBrandsOrder(reordered);
    await onChanged();
    setLocalOrder([]);
    showStatus('success', 'Order saved');
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
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5" /> Add many brands at once
        </h3>
        <p className="text-[11px] text-slate-400 mb-3">One brand per line. Duplicates are skipped.</p>
        <textarea
          value={bulkInput}
          onChange={e => setBulkInput(e.target.value)}
          placeholder={"ALBA\nBIGOTTI\nBONIA"}
          rows={6}
          className="w-full bg-white border border-slate-300 rounded-2xl py-3 px-4 text-slate-900 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none font-mono"
        />
        <PrimaryButton onClick={bulkAdd} disabled={!bulkInput.trim()} className="mt-3 w-full">
          <Plus className="w-4 h-4" /> Add all
        </PrimaryButton>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <List className="w-3.5 h-3.5" /> Brands ({brands.length})
          </h3>
          {brands.length > 0 && (
            confirmClearAll ? (
              <div className="flex items-center gap-1">
                <button onClick={clearAllBrands} className="px-2 py-1 text-[10px] font-black uppercase rounded-lg bg-rose-600 text-white">Remove all</button>
                <button onClick={() => setConfirmClearAll(false)} className="px-2 py-1 text-[10px] font-black uppercase rounded-lg bg-slate-200 text-slate-600">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClearAll(true)} className="flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors">
                <X className="w-3 h-3" /> Clear all
              </button>
            )
          )}
        </div>
        <p className="text-[11px] text-slate-400 mb-4">Drag the <GripVertical className="w-3 h-3 inline" /> handle to reorder.</p>
        <div className="flex flex-col gap-2">
          {displayBrands.map((b, i) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 cursor-default select-none"
            >
              <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing shrink-0" />
              <span className="text-[10px] font-mono text-slate-400 w-5 shrink-0">{i + 1}</span>
              <span className="text-sm font-medium text-slate-700 flex-1 truncate">{b.name}</span>
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
