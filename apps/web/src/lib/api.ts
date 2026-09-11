export interface TenantSettings {
  receiptWidth?: '58mm' | '80mm';
  autoPrint?: boolean;
  defaultPaymentMethod?: 'CASH' | 'PIX' | 'CREDIT' | 'DEBIT';
  allowNegativeStock?: boolean;
  maxDiscount?: number;
  requireCustomer?: boolean;
  receiptFooter?: string;
  brandColor?: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  settings: TenantSettings;
  plan: string;
  status: string;
}

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  platformAdmin: boolean;
  twoFactorEnabled: boolean;
  permissions: string[];
  tenant: TenantInfo;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface RegisterPayload {
  tenantName: string;
  tenantSlug: string;
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

export interface LoginPayload {
  tenantSlug: string;
  email: string;
  password: string;
  totp?: string;
}

const ACCESS_KEY = 'pdv.accessToken';
const REFRESH_KEY = 'pdv.refreshToken';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  save(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  auth?: boolean;
  retry?: boolean;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { auth = true, retry = true }: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const access = tokenStore.access;
    if (access) {
      headers.set('Authorization', `Bearer ${access}`);
    }
  }

  const response = await fetch(`${API_BASE}/api${path}`, { ...init, headers });

  if (response.status === 401 && auth && retry && tokenStore.refresh) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, init, { auth, retry: false });
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

async function extractError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }
    if (data.message) {
      return data.message;
    }
  } catch {
    // resposta sem corpo JSON
  }
  return response.statusText || 'Erro inesperado';
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) {
    return false;
  }
  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    tokenStore.clear();
    return false;
  }
  const data = (await response.json()) as AuthResponse;
  tokenStore.save(data.accessToken, data.refreshToken);
  return true;
}

export const api = {
  register: (payload: RegisterPayload) =>
    request<AuthResponse>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      { auth: false },
    ),
  login: (payload: LoginPayload) =>
    request<AuthResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      { auth: false },
    ),
  me: () => request<UserInfo>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  forgotPassword: (tenantSlug: string, email: string) =>
    request<{ ok: boolean }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ tenantSlug, email }) },
      { auth: false },
    ),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ token, password }) },
      { auth: false },
    ),
  setupTwoFactor: () =>
    request<{ secret: string; otpauth: string; qrDataUrl: string }>(
      '/auth/2fa/setup',
      { method: 'POST' },
    ),
  enableTwoFactor: (code: string) =>
    request<{ enabled: boolean }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  disableTwoFactor: (code: string) =>
    request<{ enabled: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ id: string }>('/auth/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
