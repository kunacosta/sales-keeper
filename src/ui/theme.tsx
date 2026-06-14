import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, AlertCircle } from 'lucide-react';

export const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={`bg-white border border-slate-200 rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

export const StatCard = ({ title, value, icon: Icon, colorClass, suffix = "", className = "" }: { title: string, value: string | number, icon: any, colorClass: string, suffix?: string, className?: string }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className={`bg-white border border-slate-200 shadow-sm p-4 rounded-3xl flex flex-col gap-1 relative overflow-hidden group ${className}`}
  >
    <div className="flex items-center gap-2 mb-1">
      <div className={`p-1.5 rounded-lg ${colorClass} bg-opacity-10`}>
        <Icon className={`w-3 h-3 ${colorClass.replace('bg-', 'text-').replace('-600', '-600')}`} />
      </div>
      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <motion.span
        key={value}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-xl font-black text-slate-900 font-mono"
      >
        {value}
      </motion.span>
      {suffix && <span className="text-slate-400 text-[10px] font-mono font-bold">{suffix}</span>}
    </div>
    <div className={`absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 ${colorClass}`} />
  </motion.div>
);

export const PrimaryButton = ({ children, onClick, disabled, className = "", type = "button" }: { children: React.ReactNode, onClick?: () => void, disabled?: boolean, className?: string, type?: 'button' | 'submit' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-3 px-5 transition-colors ${className}`}
  >
    {children}
  </button>
);

export const GhostButton = ({ children, onClick, disabled, className = "" }: { children: React.ReactNode, onClick?: () => void, disabled?: boolean, className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 hover:text-slate-900 font-bold rounded-2xl py-3 px-5 transition-colors ${className}`}
  >
    {children}
  </button>
);

export const Toast = ({ status }: { status: { type: 'success' | 'error', msg: string } | null }) => (
  <AnimatePresence>
    {status && (
      <motion.div
        initial={{ opacity: 0, y: -50, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: -50, x: '-50%' }}
        className={`fixed top-6 left-1/2 z-[100] px-6 py-3.5 rounded-3xl shadow-xl flex items-center gap-3 border bg-white ${
          status.type === 'success' ? 'border-emerald-200 text-emerald-700' : 'border-rose-200 text-rose-700'
        }`}
      >
        <div className={`p-1.5 rounded-lg ${status.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
          {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </div>
        <span className="font-black text-xs uppercase tracking-widest">{status.msg}</span>
      </motion.div>
    )}
  </AnimatePresence>
);
