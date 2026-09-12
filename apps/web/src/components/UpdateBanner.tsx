import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  checkForUpdate,
  installUpdateAndRestart,
  isTauri,
  type UpdateInfo,
} from '../lib/tauri';

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    // Checagem silenciosa em segundo plano: uma falha aqui (rede instável,
    // GitHub fora do ar) não deve incomodar o operador, só não mostra o aviso.
    checkForUpdate()
      .then(setUpdate)
      .catch(() => undefined);
  }, []);

  if (!update || dismissed) {
    return null;
  }

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      await installUpdateAndRestart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao instalar atualização');
      setInstalling(false);
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm shadow-lg">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      <div className="flex-1">
        <p className="font-medium text-slate-900">
          Nova versão disponível ({update.version})
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Reinicia o app para aplicar a atualização.
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {installing ? 'Instalando...' : 'Atualizar agora'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        title="Depois"
        className="text-slate-400 transition hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
