import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, tokenStore, type RegisterPayload, type UserInfo } from './api';
import { applyBrandColor } from './brand';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  login: (
    tenantSlug: string,
    email: string,
    password: string,
    totp?: string,
  ) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  refresh: () => Promise<UserInfo>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    applyBrandColor(user?.tenant.settings?.brandColor);
  }, [user?.tenant.settings?.brandColor]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (tenantSlug, email, password, totp) => {
        const response = await api.login({ tenantSlug, email, password, totp });
        tokenStore.save(response.accessToken, response.refreshToken);
        setUser(response.user);
      },
      register: async (payload) => {
        const response = await api.register(payload);
        tokenStore.save(response.accessToken, response.refreshToken);
        setUser(response.user);
      },
      refresh: async () => {
        const userInfo = await api.me();
        setUser(userInfo);
        return userInfo;
      },
      logout: () => {
        api.logout().catch(() => undefined);
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
