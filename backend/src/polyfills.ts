// Polyfill for crypto.randomUUID (not available in Node 18 Alpine)
// This file must be loaded before any other imports
import * as crypto from 'crypto';

if (typeof (crypto as any).randomUUID !== 'function') {
  (crypto as any).randomUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Also add to global scope for modules that access it directly
if (typeof globalThis !== 'undefined' && !(globalThis as any).crypto) {
  (globalThis as any).crypto = crypto;
}
