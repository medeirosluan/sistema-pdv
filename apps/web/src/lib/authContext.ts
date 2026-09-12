import { createContext } from 'react';
import type { RegisterPayload, UserInfo } from './api';

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
