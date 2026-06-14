import { motion, AnimatePresence } from 'motion/react';
import { Copy, ArrowUpRight, Share2, X } from 'lucide-react';

const forwardToWhatsapp = (summary: string) => {
  const url = `whatsapp://send?text=${encodeURIComponent(summary)}`;
  window.open(url, '_blank');
};

/**
 * The light WhatsApp-style receipt bubble plus Copy / Forward actions.
 * Used inline (daily review, desktop side panel) and inside the mobile sheet.
 */
export function WhatsappReceipt({ summary, onCopied }: { summary: string, onCopied?: () => void }) {
  const copy = () => {
    navigator.clipboard.writeText(summary);
    onCopied?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-[1.5rem] p-5 shadow-sm">
        <div className="text-emerald-800 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all">
          {summary}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={copy}
          className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
        >
          <Copy className="w-4 h-4" /> Copy
        </button>
        <button
          onClick={() => forwardToWhatsapp(summary)}
          className="py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" /> Forward
        </button>
      </div>
    </div>
  );
}

export function MobileReceiptSheet({ open, onClose, summary, onCopied }: { open: boolean, onClose: () => void, summary: string, onCopied?: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[50]"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 rounded-t-[2.5rem] p-7 z-[60] shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-7" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 tracking-tight">
                <div className="p-2 bg-emerald-50 rounded-xl"><Share2 className="w-5 h-5 text-emerald-600" /></div>
                WhatsApp Receipt
              </h3>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <WhatsappReceipt summary={summary} onCopied={onCopied} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
