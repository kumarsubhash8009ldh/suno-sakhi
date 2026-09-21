import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sunosakhi.app',
  appName: 'Suno Sakhi',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
