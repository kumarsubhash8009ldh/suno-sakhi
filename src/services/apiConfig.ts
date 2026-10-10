export const LIVE_SERVER_URL: string = '';

/**
 * Checks whether an external Node/Express API backend is explicitly configured.
 * Prevents 404/HTML fetch spam when hosted as a static SPA on Firebase Hosting or Vite dev server.
 */
export const hasExternalApiBackend = (): boolean => {
  if (LIVE_SERVER_URL && LIVE_SERVER_URL.trim()) return true;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sunosakhi_api_base_url');
    if (saved && saved.trim()) return true;
    const host = window.location.hostname;
    const port = window.location.port;
    // Only treat port 5000 / 8080 local Express servers as having /api/*
    if ((host === 'localhost' || host === '127.0.0.1') && (port === '5000' || port === '8080')) {
      return true;
    }
  }
  return false;
};

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sunosakhi_api_base_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/$/, '');
    }

    const origin = window.location.origin;
    if (origin && (origin.startsWith('http://') || origin.startsWith('https://'))) {
      return origin.replace(/\/$/, '');
    }
  }
  if (LIVE_SERVER_URL) {
    return LIVE_SERVER_URL.replace(/\/$/, '');
  }
  return 'http://localhost:5000';
};
