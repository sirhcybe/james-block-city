/**
 * Offline play (spec 007): register the service worker that the production build writes
 * (`sw.js`, see vite.config.ts). Never in dev, so hot reload always serves fresh files.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No offline support (private mode, file://): the game still plays online.
    });
  });
}
