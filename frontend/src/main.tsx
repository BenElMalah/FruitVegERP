import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.scss';
import './styles/tailwind.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
