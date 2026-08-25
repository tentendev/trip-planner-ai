import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// PWA: register the service worker (offline shell + installed-app experience).
// Skipped on local dev hosts so the SW never caches during development.
if ('serviceWorker' in navigator) {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]') {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.info('[PWA] Service worker registered'))
      .catch((err) => console.warn('[PWA] Service worker registration failed:', err));
  }
}
