import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import AuthGate from './features/AuthGate';
import ErrorBoundary from './features/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthGate>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
);
