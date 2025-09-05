import Script from "next/script";

export default function ServiceWorkerRegister({ nonce }: { nonce?: string }) {
  return (
    <Script
      id="sw-register"
      nonce={nonce}
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            if (!window.__swRegistered) {
              navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
                window.__swRegistered = true;
                reg.addEventListener?.('updatefound', () => {});
              }).catch((e) => {
                console.warn('[sw] register failed', e?.message || e);
              });
            }
          }
        `,
      }}
    />
  );
}
