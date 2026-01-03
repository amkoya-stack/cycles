/**
 * Push Notification Manager
 * Handles service worker registration and push notification subscription
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string | null = null;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return false;
    }

    if (!('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('Service Worker registered');

      // Get VAPID public key from backend
      await this.fetchVapidKey();

      // Check if user is subscribed
      this.subscription = await this.registration.pushManager.getSubscription();

      // If not subscribed and we have VAPID key, request permission
      if (!this.subscription && this.vapidPublicKey) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await this.subscribe();
        }
      } else if (this.subscription) {
        // Already subscribed, register with backend
        await this.registerToken(this.subscription);
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  /**
   * Fetch VAPID public key from backend
   */
  private async fetchVapidKey(): Promise<void> {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        return;
      }

      const response = await fetch(`${API_BASE_URL}/wallet/push/vapid-key`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.publicKey) {
          this.vapidPublicKey = data.publicKey;
        }
      }
    } catch (error) {
      console.error('Failed to fetch VAPID key:', error);
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<boolean> {
    if (!this.registration || !this.vapidPublicKey) {
      console.warn('Service worker or VAPID key not available');
      return false;
    }

    try {
      // Convert VAPID key to Uint8Array
      const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Register token with backend
      await this.registerToken(this.subscription);

      console.log('Subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return false;
    }

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        // Unregister from backend
        await fetch(`${API_BASE_URL}/wallet/push/unregister`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: JSON.stringify(this.subscription),
          }),
        });
      }

      // Unsubscribe from push manager
      await this.subscription.unsubscribe();
      this.subscription = null;

      console.log('Unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Register push token with backend
   */
  private async registerToken(subscription: PushSubscription): Promise<void> {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        return;
      }

      await fetch(`${API_BASE_URL}/wallet/push/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: JSON.stringify(subscription),
          platform: 'web',
          userAgent: navigator.userAgent,
        }),
      });
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  /**
   * Check if user has granted permission
   */
  async getPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }
    const subscription = await this.registration.pushManager.getSubscription();
    return subscription !== null;
  }

  /**
   * Convert VAPID key from URL-safe base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Export singleton instance
export const pushNotificationManager = new PushNotificationManager();

