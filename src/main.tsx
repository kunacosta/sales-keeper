import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from './lib/AuthContext.tsx';
import AppGate from './AppGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  </StrictMode>,
);
