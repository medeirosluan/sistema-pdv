import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { KioskContext, type KioskContextValue } from './kioskContext';

export function KioskProvider({ children }: { children: ReactNode }) {
  const [kiosk, setKiosk] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      if (!document.fullscreenElement) {
        setKiosk(false);
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const enter = useCallback(async () => {
    setKiosk(true);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen pode ser bloqueado; mantém o layout kiosk mesmo assim
    }
  }, []);

  const exit = useCallback(async () => {
    setKiosk(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<KioskContextValue>(
    () => ({
      kiosk,
      enter,
      exit,
      toggle: async () => {
        if (kiosk) {
          await exit();
        } else {
          await enter();
        }
      },
    }),
    [kiosk, enter, exit],
  );

  return (
    <KioskContext.Provider value={value}>{children}</KioskContext.Provider>
  );
}
