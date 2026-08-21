import { create } from 'zustand';
import * as authService from '../services/auth';
import { Session } from '../services/auth';

interface AuthState {
  user: Session | null;
  ready: boolean;
  hasUsers: boolean;
  locked: boolean;
  restore: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  loginWithPin: (pin: string) => Promise<void>;
  register: (username: string, displayName: string, password: string, pin?: string) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  hasUsers: false,
  locked: false,

  restore: async () => {
    const hasUsers = await authService.hasAnyUser();
    const session = await authService.getSession();
    set({ user: session, hasUsers, ready: true });
  },

  login: async (username, password) => {
    const user = await authService.login(username, password);
    set({
      user: { userId: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin },
      locked: false,
    });
  },

  loginWithPin: async (pin) => {
    const user = await authService.loginWithPin(pin);
    set({
      user: { userId: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin },
      locked: false,
    });
  },

  register: async (username, displayName, password, pin) => {
    const user = await authService.registerUser(username, displayName, password, pin);
    set({
      user: { userId: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin },
      hasUsers: true,
      locked: false,
    });
  },

  logout: async () => {
    await authService.logout();
    set({ user: null });
  },

  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));
