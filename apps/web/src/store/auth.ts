'use client';

import { create } from 'zustand';
import { api, apiGet, apiPost, setAccessToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  avatarUrl?: string | null;
  totpEnabled?: boolean;
  credits?: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<'ok' | 'totp'>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setFromToken: (accessToken: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  async login(email, password, totpCode) {
    const res = await apiPost<{ accessToken?: string; user?: AuthUser; requiresTotp?: boolean }>(
      '/auth/login',
      { email, password, totpCode },
    );
    if (res.requiresTotp) return 'totp';
    setAccessToken(res.accessToken!);
    set({ user: res.user ?? null });
    return 'ok';
  },

  async register(name, email, password) {
    const res = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/register', {
      name,
      email,
      password,
    });
    setAccessToken(res.accessToken);
    set({ user: res.user });
  },

  async logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    set({ user: null });
  },

  async hydrate() {
    try {
      const res = await apiGet<{ user: AuthUser }>('/auth/me');
      set({ user: res.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  async setFromToken(accessToken: string) {
    setAccessToken(accessToken);
    const res = await apiGet<{ user: AuthUser }>('/auth/me');
    set({ user: res.user, loading: false });
  },
}));
