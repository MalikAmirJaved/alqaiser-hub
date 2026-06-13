/**
 * Register the service worker for background notifications
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined') return null;
  
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
  return null;
}

/**
 * Request permission from the user to show desktop notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show a desktop notification
 * Uses the Service Worker for persistent notifications if available,
 * otherwise falls back to the normal Notification API.
 */
export function showDesktopNotification(
  title: string,
  options?: { body?: string; icon?: string; data?: any }
) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Use Service Worker for reliable background notifications
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body: options?.body,
        icon: options?.icon || '/favicon.ico',
        data: options?.data,
      });
    });
  } else {
    // Fallback for older browsers or when SW not active
    new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
    });
  }
}