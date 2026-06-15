import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store';
import { supabase } from '@/lib/supabase';
import Layout from '@/layouts/Layout';
import AuthPage from '@/pages/AuthPage';
import FeedPage from '@/pages/FeedPage';
import ProfilePage from '@/pages/ProfilePage';
import NotificationsPanel from '@/pages/NotificationsPanel';
import ChatLive from '@/pages/ChatLive';
import SearchPage from '@/pages/SearchPage';
import BookmarksPage from '@/pages/BookmarksPage';
import PostDetailPage from '@/pages/PostDetailPage';
import SettingsPage from '@/pages/SettingsPage';
import type { Profile } from '@/types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-12 h-12 text-white fill-current animate-pulse">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AuthCallback() {
  const { setUser, setProfile, setSession, setLoading } = useStore();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (data) setProfile(data as Profile);
        } catch (err) {
          console.error('[AuthCallback] Erro ao carregar perfil:', err);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[AuthCallback] Erro ao obter sessão:', err);
      setLoading(false);
    });
  }, [setUser, setProfile, setSession, setLoading]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg viewBox="0 0 24 24" className="w-12 h-12 text-white fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Autenticando...</p>
      </div>
    </div>
  );
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, setProfile, setSession, setLoading, clearAuth } = useStore();

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (data) setProfile(data as Profile);
        } catch (err) {
          console.error('[AppInitializer] Erro ao carregar profile inicial:', err);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[AppInitializer] Erro ao obter sessão:', err);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setSession(session);
          setUser(session.user);
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (data) setProfile(data as Profile);
          } catch (err) {
            console.error('[AppInitializer] Erro ao carregar profile após login:', err);
          }
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          clearAuth();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setProfile, setSession, setLoading, clearAuth]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/home" replace />} />

          {/* Protected routes with Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<FeedPage />} />
            <Route path="/explore" element={<SearchPage />} />
            <Route path="/notifications" element={<NotificationsPanel />} />
            <Route path="/messages" element={<ChatLive />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/post/:postId" element={<PostDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
