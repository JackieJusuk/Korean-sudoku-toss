import { Device, SafeArea, Screen, Storage, User } from '@apps-in-toss/web-framework';
import type { HapticFeedbackType } from '@apps-in-toss/web-framework';

/**
 * Thin, failure-tolerant wrappers around the App-in-Toss SDK. Every call
 * degrades gracefully — outside the Toss app (plain browser, tests) or on an
 * older Toss version the game must still start and play normally.
 */

/** Bridge calls can hang outside the Toss app, so reads give up after this. */
const BRIDGE_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, ms = BRIDGE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('bridge timeout')), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function safeLocalStorage(): globalThis.Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The per-game user identifier (`getUserKeyForGame` / `User.getAnonymousKey`).
 * Returns null when unavailable (older Toss app, outside Toss), in which case
 * data is kept under a device-local key instead.
 */
export async function getGameUserKey(): Promise<string | null> {
  try {
    if (!User.getAnonymousKey.isSupported()) return null;
    const result = await withTimeout(User.getAnonymousKey());
    return result?.type === 'HASH' && result.hash ? result.hash : null;
  } catch {
    return null;
  }
}

export async function readItem(key: string): Promise<string | null> {
  try {
    return await withTimeout(Storage.getItem(key));
  } catch {
    return safeLocalStorage()?.getItem(key) ?? null;
  }
}

export async function writeItem(key: string, value: string): Promise<void> {
  try {
    await withTimeout(Storage.setItem(key, value));
  } catch {
    try {
      safeLocalStorage()?.setItem(key, value);
    } catch {
      // Storage full or blocked — progress just won't persist this time.
    }
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await withTimeout(Storage.removeItem(key));
  } catch {
    safeLocalStorage()?.removeItem(key);
  }
}

/** Keeps the game in portrait, as the board layout is designed for it. */
export function lockPortrait(): void {
  try {
    if (Screen.setOrientation.isSupported()) {
      Screen.setOrientation({ type: 'portrait' }).catch(() => {});
    }
  } catch {
    // Unsupported environment — the CSS layout still works in any orientation.
  }
}

export function haptic(type: HapticFeedbackType): void {
  try {
    Device.triggerHaptic({ type }).catch(() => {});
  } catch {
    // No haptics outside the Toss app.
  }
}

/**
 * Mirrors the SDK's safe-area insets into CSS variables (`--safe-top`, etc.)
 * so layout never sits under the notch / Dynamic Island. CSS falls back to
 * `env(safe-area-inset-*)` when the SDK has no value. Returns an unsubscribe.
 */
export function syncSafeAreaInsets(): () => void {
  const apply = (insets: { top: number; bottom: number; left: number; right: number }) => {
    const style = document.documentElement.style;
    style.setProperty('--safe-top', `${insets.top}px`);
    style.setProperty('--safe-bottom', `${insets.bottom}px`);
    style.setProperty('--safe-left', `${insets.left}px`);
    style.setProperty('--safe-right', `${insets.right}px`);
  };

  try {
    apply(SafeArea.get());
    return SafeArea.subscribe({ onEvent: apply });
  } catch {
    return () => {};
  }
}
