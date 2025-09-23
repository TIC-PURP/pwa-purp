// Minimal SW registrar with auto-update + skip waiting.
// Path: /src/components/ServiceWorkerRegister.tsx
'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Auto-skip-waiting on new updates
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // New update is ready
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data === 'RELOAD_PAGE') {
            window.location.reload();
          }
        });
      } catch (e) {
        console.error('SW register error', e);
      }
    };
    register();
  }, []);

  return null;
}