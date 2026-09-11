import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/auth.tsx';
import { ConfirmProvider } from './components/ui/ConfirmDialog.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { KioskProvider } from './lib/kiosk.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <KioskProvider>
            <ToastProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </ToastProvider>
          </KioskProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
