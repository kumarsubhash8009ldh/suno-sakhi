import { Capacitor } from '@capacitor/core';

let activeGuards = 0;
let isWebListenersAttached = false;

// Custom event listeners
type SecurityViolationListener = (type: 'screenshot' | 'recording_focus') => void;
type BlurListener = (blurred: boolean) => void;

const violationListeners = new Set<SecurityViolationListener>();
const blurListeners = new Set<BlurListener>();

/**
 * Handle keydown for PrintScreen / Snipping tool shortcuts
 */
const handleKeyDown = (e: KeyboardEvent) => {
  // PrintScreen key
  if (e.key === 'PrintScreen' || e.keyCode === 44) {
    e.preventDefault();
    clearClipboardSafely();
    notifyViolation('screenshot');
    return;
  }

  // Windows Snipping Tool (Win + Shift + S) or Mac Screenshot (Cmd + Shift + 3 / 4)
  if (
    (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === 'S' || e.key === 's' || e.key === '3' || e.key === '4'))
  ) {
    e.preventDefault();
    clearClipboardSafely();
    notifyViolation('screenshot');
  }
};

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'PrintScreen' || e.keyCode === 44) {
    clearClipboardSafely();
    notifyViolation('screenshot');
  }
};

const handleWindowBlur = () => {
  if (activeGuards > 0) {
    notifyBlur(true);
  }
};

const handleWindowFocus = () => {
  if (activeGuards > 0) {
    notifyBlur(false);
  }
};

const handleVisibilityChange = () => {
  if (activeGuards > 0) {
    notifyBlur(document.visibilityState === 'hidden');
  }
};

const handleContextMenu = (e: MouseEvent) => {
  if (activeGuards > 0) {
    e.preventDefault();
  }
};

const clearClipboardSafely = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('').catch(() => {});
    }
  } catch {}
};

const notifyViolation = (type: 'screenshot' | 'recording_focus') => {
  violationListeners.forEach((fn) => {
    try {
      fn(type);
    } catch {}
  });
};

const notifyBlur = (blurred: boolean) => {
  blurListeners.forEach((fn) => {
    try {
      fn(blurred);
    } catch {}
  });
};

const attachWebListeners = () => {
  if (isWebListenersAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('contextmenu', handleContextMenu, true);
  isWebListenersAttached = true;
};

const detachWebListeners = () => {
  if (!isWebListenersAttached || typeof window === 'undefined') return;
  window.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('keyup', handleKeyUp, true);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('focus', handleWindowFocus);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('contextmenu', handleContextMenu, true);
  isWebListenersAttached = false;
};

/**
 * Enable or disable FLAG_SECURE on Android and anti-screenshot/screen recording guards on Web.
 * ONLY invoked during video activities (video calls, video preview).
 */
export const setVideoScreenSecurity = (enable: boolean): void => {
  if (enable) {
    activeGuards++;
  } else {
    activeGuards = Math.max(0, activeGuards - 1);
  }

  const shouldBeSecure = activeGuards > 0;

  // 1. Android Native Layer (FLAG_SECURE)
  try {
    const win = window as any;
    // Android WebView JavascriptInterface
    if (win.AndroidSecurity && typeof win.AndroidSecurity.setSecureScreen === 'function') {
      win.AndroidSecurity.setSecureScreen(shouldBeSecure);
      console.log(`[ScreenSecurity] Android FLAG_SECURE: ${shouldBeSecure}`);
    }

    // Capacitor Plugin ScreenSecurity
    if (Capacitor.isPluginAvailable('ScreenSecurity')) {
      const plugin = (Capacitor as any).Plugins?.ScreenSecurity;
      if (plugin) {
        if (shouldBeSecure) {
          plugin.enable().catch(() => {});
        } else {
          plugin.disable().catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[ScreenSecurity] Native bridge warning:', err);
  }

  // 2. Web Browser Safeguards
  if (typeof document !== 'undefined') {
    if (shouldBeSecure) {
      document.body.classList.add('video-secure-active');
      attachWebListeners();
    } else {
      document.body.classList.remove('video-secure-active');
      detachWebListeners();
      notifyBlur(false);
    }
  }
};

/**
 * Subscribe to security violation events (e.g. screenshot attempts)
 */
export const onSecurityViolation = (callback: SecurityViolationListener): (() => void) => {
  violationListeners.add(callback);
  return () => {
    violationListeners.delete(callback);
  };
};

/**
 * Subscribe to window blur events (e.g. external screen recorder or snipping tool takes focus)
 */
export const onWindowBlurChange = (callback: BlurListener): (() => void) => {
  blurListeners.add(callback);
  return () => {
    blurListeners.delete(callback);
  };
};
