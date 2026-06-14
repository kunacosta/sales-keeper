import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from './lib/AuthContext.tsx';
import Login from './Login.tsx';
import App from './App.tsx';

export default function AppGate() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#020617]">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <>
      <App />
      <button
        onClick={() => logout()}
        title="Sign out"
        className="fixed top-3 right-3 z-50 flex items-center gap-1.5 bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 text-slate-300 hover:text-white text-xs font-bold rounded-full py-2 px-3 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </>
  );
}
