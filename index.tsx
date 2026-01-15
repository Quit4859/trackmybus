import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

/**
 * Global Error Interceptor:
 * Targets SecurityErrors and transient Fetch/Abort errors that often occur
 * in restricted cross-origin environments or during rapid re-mounts.
 */
const handleError = (error: any) => {
  const message = error?.message || error?.reason?.message || String(error || '');
  const name = error?.name || error?.reason?.name || '';
  const lowerMessage = message.toLowerCase();

  const isSecurityError = lowerMessage.includes('securityerror') || lowerMessage.includes('cross-origin');
  
  // Suppress "Failed to fetch", Abort errors, and specifically the "without reason" variant.
  const isIgnorableError = 
    name === 'AbortError' ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('aborted') || 
    lowerMessage.includes('signal is aborted') || 
    lowerMessage.includes('without reason') ||
    lowerMessage.includes('the user aborted a request') ||
    lowerMessage.includes('request was aborted') ||
    lowerMessage.includes('signal is aborted without reason') || // Explicit check
    error?.reason?.name === 'AbortError';
  
  if (isSecurityError || isIgnorableError) {
    // Silently handle to keep console/UI clean from non-fatal environment-specific issues
    return true;
  }
  return false;
};

window.addEventListener('error', (event) => {
  if (handleError(event.error || event)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (handleError(event.reason)) {
    event.preventDefault();
    event.stopPropagation();
  }
});

const initApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React Init Error:", error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}