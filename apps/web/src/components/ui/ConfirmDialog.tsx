import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Modal } from '../Modal';
import {
  ConfirmContext,
  type ConfirmFn,
  type ConfirmOptions,
} from './confirmContext';

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const value = useMemo(() => confirm, [confirm]);

  function finish(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state !== null}
        title={state?.title ?? ''}
        onClose={() => finish(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => finish(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {state?.cancelLabel ?? 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={() => finish(true)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                state?.danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {state?.confirmLabel ?? 'Confirmar'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}
