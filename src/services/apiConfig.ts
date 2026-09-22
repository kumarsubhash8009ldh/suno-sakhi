/**
 * Global API Base URL Configuration for Web & Capacitor Android
 */
export const LIVE_SERVER_URL = '';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // 1. Custom backend URL override if saved by user or settings
    const customUrl = localStorage.getItem('sunosakhi_api_base_url');
    if (customUrl && customUrl.trim()) return customUrl.trim().replace(/\/$/, '');

    // 2. If running in Capacitor Android Native environment
    const isCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (window.location.hostname === 'localhost' && window.location.port === '')
    );

    if (isCapacitor) {
      return LIVE_SERVER_URL;
    }

    // 3. Running on local node server or custom port
    if (
      window.location.origin &&
      window.location.origin !== 'null' &&
      !window.location.origin.includes('web.app') &&
      !window.location.origin.includes('firebaseapp.com') &&
      !window.location.origin.includes('capacitor:')
    ) {
      return window.location.origin.replace(/\/$/, '');
    }

    return LIVE_SERVER_URL;
  }
  return LIVE_SERVER_URL;
};
