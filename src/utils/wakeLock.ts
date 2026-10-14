// Screen Wake Lock API helper to keep the camera device awake during WiFi streaming

class WakeLockManager {
  private sentinel: any = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  async request(): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  async release(): Promise<void> {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
        this.sentinel = null;
      } catch {
        // Ignore errors on release
      }
    }
  }
}

export const wakeLock = new WakeLockManager();
