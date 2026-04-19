import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
  } catch (e: any) {
    container.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>App Crash</h1>
      <pre>${e.message}\n${e.stack}</pre>
    </div>`;
  }
}

window.onerror = (msg, url, line) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: red;">
      <h1>Global Error</h1>
      <p>${msg}</p>
      <p>${url}:${line}</p>
    </div>`;
  }
};