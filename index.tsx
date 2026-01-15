import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

/**
 * Global Error Interceptor:
 * Targets SecurityErrors and transient Fetch/Abort errors that often occur
 * in restricted environments or during rapid re-mounts.
 */
const handleError = (error: any) => {
  const reason = error?.reason || error;
  const message = String(reason?.message || reason || '');
  const name = String(reason?.name || '');
  const lowerMessage = message.toLowerCase();

  // Suppress common non-critical environment/abort errors
  const isIgnorableError = 
    name === 'AbortError' ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('aborted') || 
    lowerMessage.includes('signal is aborted') || 
    lowerMessage.includes('without reason') ||
    lowerMessage.includes('the user aborted a request') ||
    lowerMessage.includes('request was aborted') ||
    lowerMessage.includes('securityerror') ||
    lowerMessage.includes('cross-origin');
  
  if (isIgnorableError) {
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