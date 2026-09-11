import { useEffect, useRef } from 'react';

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    function handler(event: KeyboardEvent) {
      const callback = mapRef.current[event.key];
      if (callback) {
        callback(event);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
