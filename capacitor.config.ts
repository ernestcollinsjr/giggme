import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7e0de257a51c436696271ae4ae99ae10',
  appName: 'giggme',
  webDir: 'dist',
  server: {
    url: 'https://7e0de257-a51c-4366-9627-1ae4ae99ae10.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
