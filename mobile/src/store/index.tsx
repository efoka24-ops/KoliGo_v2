import React, { createContext, useContext, useState } from 'react';
import { create } from 'zustand';

// ── Auth store ────────────────────────────────────────────────────────────────
interface AuthState {
  userId: string | null;
  phone: string | null;
  activeRole: 'VENDOR' | 'DELIVERER' | null;
  isAuthenticated: boolean;
  setAuth: (userId: string, phone: string, role: 'VENDOR' | 'DELIVERER') => void;
  setRole: (role: 'VENDOR' | 'DELIVERER') => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  phone: null,
  activeRole: null,
  isAuthenticated: false,
  setAuth: (userId, phone, activeRole) => set({ userId, phone, activeRole, isAuthenticated: true }),
  setRole: (activeRole) => set({ activeRole }),
  clear: () => set({ userId: null, phone: null, activeRole: null, isAuthenticated: false }),
}));

// ── Deliverer presence store ──────────────────────────────────────────────────
interface PresenceState { online: boolean; setOnline: (v: boolean) => void }
export const usePresenceStore = create<PresenceState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));

// ── Legacy context (kept for backward compat with existing screens) ────────────
const AppContext = createContext<{
  role: 'vendor' | 'deliverer';
  setRole: (r: 'vendor' | 'deliverer') => void;
  online: boolean;
  setOnline: (v: boolean) => void;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<'vendor' | 'deliverer'>('vendor');
  const [online, setOnline] = useState(true);
  return (
    <AppContext.Provider value={{ role, setRole, online, setOnline }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};
