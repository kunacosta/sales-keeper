import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Check, CheckCheck, Eraser, ArrowRight } from 'lucide-react';
import { Brand } from '../lib/stateService.ts';
import { PrimaryButton } from '../ui/theme.tsx';

interface Props {
  brands: Brand[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onNext: () => void;
  title: string;
  subtitle: string;
  nextLabel?: string;
}

export default function BrandPicker({ brands, selectedIds, onChange, onNext, title, subtitle, nextLabel = 'Next' }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => brands.filter(b => b.name.toLowerCase().includes(query.toLowerCase())),
    [brands, query]
  );

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const selectAllFiltered = () => {
    const ids = new Set(selectedIds);
    filtered.forEach(b => ids.add(b.id));
    onChange(Array.from(ids));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
        <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search brand..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-500">
          {selectedIds.length} selected
        </span>
        <div className="flex items-center gap-2">
          <button onClick={selectAllFiltered} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors">
            <CheckCheck className="w-3.5 h-3.5" /> All
          </button>
          <button onClick={() => onChange([])} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors">
            <Eraser className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {filtered.map(b => {
          const active = selectedIds.includes(b.id);
          return (
            <motion.button
              key={b.id}
              layout
              whileTap={{ scale: 0.97 }}
              onClick={() => toggle(b.id)}
              className={`flex items-center justify-between gap-2 p-3 rounded-2xl border text-left text-sm font-bold transition-colors ${
                active
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="truncate">{b.name}</span>
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent'}`}>
                <Check className="w-3 h-3" />
              </span>
            </motion.button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-400 italic text-sm">No brands match "{query}"</div>
        )}
      </div>

      <PrimaryButton onClick={onNext} disabled={selectedIds.length === 0} className="w-full">
        {nextLabel} <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </div>
  );
}
