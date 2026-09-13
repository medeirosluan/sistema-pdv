import {
  BarChart3,
  Download,
  HelpCircle,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Minimize2,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import type { UserRole } from '../lib/api';
import { refreshCatalog } from '../lib/offline/catalogCache';
import {
  countPendingCashMovements,
  countPendingCashSession,
  syncPendingCashClose,
  syncPendingCashMovements,
  syncPendingCashOpen,
} from '../lib/offline/cashQueue';
import {
  countPendingSales,
  onPendingChanged,
  syncPendingSales,
} from '../lib/offline/salesQueue';
import { useOnlineStatus } from '../lib/offline/useOnlineStatus';
import { useKiosk } from '../lib/useKiosk';
import { useCan, type Permission } from '../lib/permissions';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { useHotkeys } from '../lib/useHotkeys';
import { ChangePasswordModal } from './ChangePasswordModal';
import { UpdateBanner } from './UpdateBanner';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  permission?: Permission;
  platformAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    to: '/painel',
    label: 'Visão geral',
    icon: LayoutDashboard,
    end: true,
    permission: 'reports.view',
  },
  { to: '/pdv', label: 'PDV', icon: ShoppingCart, permission: 'sales.create' },
  { to: '/vendas', label: 'Vendas', icon: Receipt, permission: 'sales.view' },
  { to: '/produtos', label: 'Produtos', icon: Package, permission: 'products.view' },
  { to: '/clientes', label: 'Clientes', icon: Users, permission: 'customers.view' },
  { to: '/caixa', label: 'Caixa', icon: Wallet, permission: 'cash.operate' },
  {
    to: '/usuarios',
    label: 'Usuários',
    icon: UserCog,
    permission: 'users.manage',
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    permission: 'reports.view',
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    permission: 'settings.manage',
  },
  {
    to: '/auditoria',
    label: 'Auditoria',
    icon: History,
    permission: 'settings.manage',
  },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, platformAdminOnly: true },
];

const roleLabels: Record<UserRole, string> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente',
  CASHIER: 'Operador de caixa',
};

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Layout() {
  const { user, logout } = useAuth();
  const can = useCan();
  const online = useOnlineStatus();
  const { kiosk, exit: exitKiosk } = useKiosk();
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { canInstall, install } = useInstallPrompt();

  useEffect(() => {
    if (!user?.tenant.id) {
      return;
    }
    const tenantId = user.tenant.id;
    let active = true;
    const refreshCount = () => {
      Promise.all([
        countPendingSales(tenantId),
        countPendingCashMovements(tenantId),
        countPendingCashSession(tenantId),
      ]).then(([sales, movements, session]) => {
        if (active) {
          setPendingCount(sales + movements + session);
        }
      });
    };
    refreshCount();
    const unsubscribe = onPendingChanged(refreshCount);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.tenant.id]);

  const runSync = useCallback(async (tenantId: string) => {
    setSyncing(true);
    try {
      await Promise.all([
        refreshCatalog(tenantId),
        (async () => {
          // a abertura precisa sincronizar antes das vendas/movimentações e
          // do fechamento, já que essas dependem de um caixa aberto no
          // servidor; o fechamento só faz sentido depois delas.
          await syncPendingCashOpen(tenantId);
          await Promise.all([
            syncPendingSales(tenantId),
            syncPendingCashMovements(tenantId),
          ]);
          await syncPendingCashClose(tenantId);
        })(),
      ]);
    } catch {
      // uma falha de rede aqui é esperada (ex.: sinal instável); a próxima
      // tentativa periódica ou manual cobre o que não sincronizou agora.
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!online || !user?.tenant.id) {
      return;
    }
    const tenantId = user.tenant.id;
    void (async () => {
      await runSync(tenantId);
    })();
    // Nova tentativa periódica: uma falha de rede durante a sincronização
    // (ex.: sinal instável) interrompe a fila sem esperar o navegador
    // reportar "offline" de verdade, então sem isso os itens pendentes
    // ficariam parados até a próxima recarga da página.
    const interval = window.setInterval(() => void runSync(tenantId), 120_000);
    return () => window.clearInterval(interval);
  }, [online, user?.tenant.id, runSync]);

  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.permission || can(item.permission)) &&
      (!item.platformAdminOnly || user?.platformAdmin === true),
  );

  useHotkeys(
    Object.fromEntries(
      visibleNavItems.slice(0, 9).map((item, index) => [
        String(index + 1),
        (event: KeyboardEvent) => {
          if (event.altKey) {
            event.preventDefault();
            navigate(item.to);
          }
        },
      ]),
    ),
  );

  const current =
    visibleNavItems.find((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to),
    ) ?? visibleNavItems[0];

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (kiosk) {
    return (
      <div className="h-screen overflow-hidden bg-slate-100">
        <main className="h-full overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
        <button
          type="button"
          onClick={() => void exitKiosk()}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-slate-800"
        >
          <Minimize2 className="h-4 w-4" />
          Sair da tela cheia
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-slate-900 text-slate-300 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-slate-900">
            P
          </div>
          <span className="text-lg font-semibold text-white">PDV</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium text-white">
              {user?.tenant.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user?.store?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user?.name} · {user ? roleLabels[user.role] : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900">
                {current.label}
              </h1>
              <p className="truncate text-xs text-slate-500">
                Bem-vindo de volta, {user?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canInstall && (
              <button
                type="button"
                onClick={() => void install()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                Instalar app
              </button>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                {pendingCount} pendente(s)
                {online && (
                  <button
                    type="button"
                    onClick={() => user?.tenant.id && void runSync(user.tenant.id)}
                    disabled={syncing}
                    title="Sincronizar agora"
                    className="text-sky-700 transition hover:text-sky-900 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
                    />
                  </button>
                )}
              </span>
            )}
            {!online && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                Offline
              </span>
            )}
            <a
              href="/ajuda"
              target="_blank"
              rel="noreferrer"
              title="Central de Ajuda"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <HelpCircle className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              title="Alterar senha"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {user ? roleLabels[user.role] : ''}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {user ? initials(user.name) : ''}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
      <UpdateBanner />
    </div>
  );
}
