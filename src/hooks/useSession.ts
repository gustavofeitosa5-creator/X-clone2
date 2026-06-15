import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import type { Profile } from '@/types';

export function useSession(): void {
  const { setUser, setProfile, setSession, setLoading, clearAuth } = useStore();

  useEffect(() => {
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        // Load profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }: { data: Profile | null }) => {
            if (data) setProfile(data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }).catch((err: unknown) => {
      console.error('[useSession] Erro ao obter sessão inicial:', err);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setSession(session);
          setUser(session.user);
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (profileData) {
              setProfile(profileData as Profile);
            }
          } catch (error) {
            console.error('[useSession] Erro ao carregar profile após login:', error);
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
}
