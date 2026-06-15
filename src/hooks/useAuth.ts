import { useCallback } from 'react';
import { useStore } from '@/store';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithOAuth,
  verifyTOTP,
  signOut as authSignOut,
} from '@/utils/authUtils';
import type { User, Session, Profile } from '@/types';

interface UseAuthReturn {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  requiresTOTP: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; requiresTOTP?: boolean }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithGithub: () => Promise<{ error: string | null }>;
  verifyTOTPCode: (token: string) => Promise<{ verified: boolean; error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

export function useAuth(): UseAuthReturn {
  const {
    user,
    profile,
    session,
    loading,
    requiresTOTP,
    setLoading,
    setRequiresTOTP,
    clearAuth,
  } = useStore();

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const result = await signInWithEmail(email, password);
        if (result.requiresTOTP) {
          setRequiresTOTP(true);
        }
        return { error: result.error, requiresTOTP: result.requiresTOTP };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setRequiresTOTP]
  );

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      setLoading(true);
      try {
        const result = await signUpWithEmail(email, password, username);
        return { error: result.error };
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  const signInWithGoogle = useCallback(async () => {
    return signInWithOAuth('google');
  }, []);

  const signInWithGithub = useCallback(async () => {
    return signInWithOAuth('github');
  }, []);

  const verifyTOTPCode = useCallback(
    async (token: string) => {
      if (!session?.access_token) {
        return { verified: false, error: 'Sessão inválida' };
      }
      const result = await verifyTOTP(token, session.access_token);
      if (result.verified) {
        setRequiresTOTP(false);
      }
      return result;
    },
    [session, setRequiresTOTP]
  );

  const signOut = useCallback(async () => {
    const userId = user?.id ?? '';
    const result = await authSignOut(userId);
    clearAuth();
    return result;
  }, [user, clearAuth]);

  return {
    user,
    profile,
    session,
    loading,
    requiresTOTP,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGithub,
    verifyTOTPCode,
    signOut,
  };
}
