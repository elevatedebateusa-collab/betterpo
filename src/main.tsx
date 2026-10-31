import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

console.log('[Elevate Chamber] main.tsx initializing...');

// Global error catcher to surface any silent errors onto screen
window.addEventListener('error', (e) => {
  console.error('[Chamber Window Error]', e);
  const root = document.getElementById('root');
  if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
    root.innerHTML = `
      <div style="min-height:100vh;background:#FFFDF9;color:#C85A32;font-family:serif;padding:32px;display:flex;align-items:center;justify-content:center;">
        <div style="max-width:540px;background:#FBF7EE;border:2px solid #C85A32;border-radius:12px;padding:24px;box-shadow:3px 4px 0px rgba(60,48,38,0.15);">
          <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:bold;">Chamber Display Exception</h2>
          <p style="font-size:13px;color:#4B453F;margin:0 0 12px 0;">${e.message || 'Unknown runtime error'}</p>
          <pre style="background:#FFFDF9;border:1px solid #ECE0CD;padding:12px;border-radius:6px;font-family:monospace;font-size:11px;overflow:auto;max-height:160px;color:#746C65;">${e.filename || ''}:${e.lineno || 0}</pre>
        </div>
      </div>
    `;
  }
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  const errMsg = 'Fatal Error: Target container <div id="root"></div> not found in index.html.';
  console.error(errMsg);
  const fallback = document.createElement('div');
  fallback.style.cssText = 'padding:24px;color:#C85A32;background:#FBF7EE;font-family:serif;min-height:100vh;';
  fallback.innerHTML = `<h2>Chamber Initialization Failed</h2><p>${errMsg}</p>`;
  document.body.appendChild(fallback);
} else {
  try {
    const root = createRoot(rootElement);
    (window as unknown as { __REACT_HYDRATED__?: boolean }).__REACT_HYDRATED__ = true;
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    console.log('[Elevate Chamber] React root.render successfully dispatched.');
  } catch (err: unknown) {
    console.error('[Elevate Chamber] Fatal error during createRoot.render:', err);
    rootElement.innerHTML = `
      <div style="background-color:#FBF7EE;color:#C85A32;min-height:100vh;padding:32px;font-family:serif;display:flex;align-items:center;justify-content:center;">
        <div style="max-width:600px;background:#FFFDF9;border:2px solid #C85A32;border-radius:12px;padding:24px;box-shadow:3px 4px 0px rgba(60,48,38,0.15);">
          <h2 style="color:#C85A32;margin-top:0;">React Mounting Exception</h2>
          <pre style="background:#FBF7EE;padding:12px;border-radius:6px;overflow:auto;font-family:monospace;font-size:12px;color:#4B453F;">${err instanceof Error ? err.stack || err.message : String(err)}</pre>
          <button onclick="localStorage.clear(); window.location.reload();" style="padding:8px 16px;background:#C85A32;color:#FFF;border:none;border-radius:6px;font-weight:bold;cursor:pointer;margin-top:12px;">
            Clear Local Storage & Reload
          </button>
        </div>
      </div>
    `;
  }
}
