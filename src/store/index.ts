import { create } from 'zustand';
import type {
  User,
  Session,
  Profile,
  Notification,
  Conversation,
  AuthState,
  NotificationState,
  ChatState,
} from '@/types';

// ──────────────────────────────────────────────
// Auth Slice
// ──────────────────────────────────────────────

interface AuthActions {
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setRequiresTOTP: (requiresTOTP: boolean) => void;
  clearAuth: () => void;
}

type AuthSlice = AuthState & AuthActions;

// ──────────────────────────────────────────────
// Notifications Slice
// ──────────────────────────────────────────────

interface NotificationActions {
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

type NotificationSlice = NotificationState & NotificationActions;

// ──────────────────────────────────────────────
// Chat Slice
// ──────────────────────────────────────────────

interface ChatActions {
  setActiveConversation: (userId: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  cacheSharedSecret: (userId: string, key: CryptoKey) => void;
  getSharedSecret: (userId: string) => CryptoKey | undefined;
}

type ChatSlice = ChatState & ChatActions;

// ──────────────────────────────────────────────
// Unified Store
// ──────────────────────────────────────────────

type StoreState = AuthSlice & NotificationSlice & ChatSlice;

export const useStore = create<StoreState>((set, get) => ({
  // ── Auth initial state ──
  user: null,
  profile: null,
  session: null,
  loading: true,
  requiresTOTP: false,

  // ── Auth actions ──
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setRequiresTOTP: (requiresTOTP) => set({ requiresTOTP }),
  clearAuth: () =>
    set({
      user: null,
      profile: null,
      session: null,
      requiresTOTP: false,
      loading: false,
    }),

  // ── Notifications initial state ──
  unreadCount: 0,
  notifications: [],

  // ── Notifications actions ──
  setNotifications: (notifications) => {
    const unreadCount = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount });
  },
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(
        0,
        state.notifications.find((n) => n.id === id && !n.read)
          ? state.unreadCount - 1
          : state.unreadCount
      ),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),

  // ── Chat initial state ──
  activeConversation: null,
  conversations: [],
  sharedSecrets: new Map<string, CryptoKey>(),

  // ── Chat actions ──
  setActiveConversation: (userId) => set({ activeConversation: userId }),
  setConversations: (conversations) => set({ conversations }),
  cacheSharedSecret: (userId, key) =>
    set((state) => {
      const newMap = new Map(state.sharedSecrets);
      newMap.set(userId, key);
      return { sharedSecrets: newMap };
    }),
  getSharedSecret: (userId) => get().sharedSecrets.get(userId),
}));
