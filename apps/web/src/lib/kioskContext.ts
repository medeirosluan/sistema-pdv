import { createContext } from 'react';

export interface KioskContextValue {
  kiosk: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

export const KioskContext = createContext<KioskContextValue | undefined>(
  undefined,
);
