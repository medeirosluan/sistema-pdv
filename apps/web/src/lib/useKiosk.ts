import { useContext } from 'react';
import { KioskContext, type KioskContextValue } from './kioskContext';

export function useKiosk(): KioskContextValue {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk deve ser usado dentro de KioskProvider');
  }
  return context;
}
