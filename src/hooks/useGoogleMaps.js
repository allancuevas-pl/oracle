/**
 * useGoogleMaps — loads the Google Maps JS SDK (Places library) on demand.
 *
 * The API key is stored in localStorage under STORAGE_KEY so it never has to
 * be hard-coded in source or committed to git. The user pastes it once via the
 * Settings page; from then on it auto-loads whenever the hook is mounted.
 *
 * The script is loaded at most once per browser session; subsequent calls
 * to useGoogleMaps just read the already-loaded global.
 */

import { useState, useEffect } from 'react';

export const STORAGE_KEY = 'oracle_google_maps_key';

// Module-level state so the script is only injected once regardless of how
// many components call useGoogleMaps concurrently.
let _loadState = 'idle'; // 'idle' | 'loading' | 'loaded' | 'error'
let _subscribers = [];

function notifySubscribers(state) {
  _subscribers.forEach((fn) => fn(state));
  _subscribers = [];
}

export function getGoogleMapsKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setGoogleMapsKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage blocked (privacy mode) — silently ignore
  }
}

function loadScript(key) {
  if (_loadState === 'loaded') return Promise.resolve();
  if (_loadState === 'loading') {
    return new Promise((resolve, reject) => {
      _subscribers.push((s) => (s === 'loaded' ? resolve() : reject()));
    });
  }

  _loadState = 'loading';
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'oracle-gmaps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _loadState = 'loaded';
      notifySubscribers('loaded');
      resolve();
    };
    script.onerror = () => {
      _loadState = 'error';
      notifySubscribers('error');
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Returns { isLoaded, isError, hasKey }
 *
 * - isLoaded: true once window.google.maps.places is ready
 * - isError:  true if the script failed to load (bad key, network, etc.)
 * - hasKey:   true if a key exists in localStorage (regardless of load state)
 */
export function useGoogleMaps() {
  const key = getGoogleMapsKey();
  const [status, setStatus] = useState(() => {
    if (!key) return 'no-key';
    if (typeof window !== 'undefined' && window.google?.maps?.places) return 'loaded';
    return _loadState === 'loaded' ? 'loaded' : _loadState === 'error' ? 'error' : 'idle';
  });

  useEffect(() => {
    if (!key) {
      setStatus('no-key');
      return;
    }
    if (window.google?.maps?.places) {
      setStatus('loaded');
      return;
    }
    if (_loadState === 'loaded') {
      setStatus('loaded');
      return;
    }

    setStatus('loading');
    loadScript(key)
      .then(() => setStatus('loaded'))
      .catch(() => setStatus('error'));
  }, [key]);

  return {
    isLoaded: status === 'loaded',
    isError: status === 'error',
    hasKey: !!key,
  };
}
