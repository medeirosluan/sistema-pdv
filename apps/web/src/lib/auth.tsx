import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore, type UserInfo } from './api';
import { applyBrandColor } from './brand';
import { AuthContext, type AuthContextValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        setUser(await api.me());
      } catch {
        tokenStore.clear();
      } finally {
        setLoading(false);
      }
    }
    void run();
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
