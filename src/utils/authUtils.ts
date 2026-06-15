import { supabase } from '@/lib/supabase';
import { generateKeyPair, deletePrivateKeyFromIDB } from './cryptoUtils';
import type { Session } from '@supabase/supabase-js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ──────────────────────────────────────────────
// Sign Up
// ──────────────────────────────────────────────

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
): Promise<{ session: Session | null; error: string | null }> {
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (signUpError) {
      return { session: null, error: signUpError.message };
    }

    if (!signUpData.user) {
      return { session: null, error: 'Usuário não criado. Verifique seu e-mail.' };
    }

    // Update profile with chosen username
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username: username.toLowerCase().trim() })
      .eq('id', signUpData.user.id);

    if (profileError) {
      console.error('[authUtils] Erro ao atualizar username:', profileError);
    }

    // Generate E2EE key pair
    try {
      const { publicKeyJwk } = await generateKeyPair(signUpData.user.id);
      const { error: keyError } = await supabase
        .from('profiles')
        .update({ public_key: publicKeyJwk })
        .eq('id', signUpData.user.id);

      if (keyError) {
        console.error('[authUtils] Erro ao salvar chave pública:', keyError);
      }
    } catch (cryptoError) {
      console.error('[authUtils] Erro ao gerar par de chaves E2EE:', cryptoError);
    }

    return { session: signUpData.session, error: null };
  } catch (error) {
    console.error('[authUtils] Erro inesperado no signUp:', error);
    return {
      session: null,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao criar conta',
    };
  }
}

// ──────────────────────────────────────────────
// Sign In
// ──────────────────────────────────────────────

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ session: Session | null; requiresTOTP: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { session: null, requiresTOTP: false, error: error.message };
    }

    if (!data.user || !data.session) {
      return { session: null, requiresTOTP: false, error: 'Credenciais inválidas' };
    }

    // Check TOTP
    const { data: profileData } = await supabase
      .from('profiles')
      .select('totp_enabled')
      .eq('id', data.user.id)
      .single();

    const requiresTOTP = profileData?.totp_enabled ?? false;

    return { session: data.session, requiresTOTP, error: null };
  } catch (error) {
    console.error('[authUtils] Erro inesperado no signIn:', error);
    return {
      session: null,
      requiresTOTP: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao fazer login',
    };
  }
}

// ──────────────────────────────────────────────
// OAuth Sign In
// ──────────────────────────────────────────────

export async function signInWithOAuth(
  provider: 'google' | 'github'
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('[authUtils] Erro no OAuth signIn:', error);
    return {
      error: error instanceof Error ? error.message : 'Erro ao autenticar com provedor externo',
    };
  }
}

// ──────────────────────────────────────────────
// TOTP Verification
// ──────────────────────────────────────────────

export async function verifyTOTP(
  token: string,
  accessToken: string
): Promise<{ verified: boolean; error: string | null }> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/2fa/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      return { verified: false, error: body.error ?? 'Erro ao verificar TOTP' };
    }

    const result = (await response.json()) as { verified: boolean };
    return { verified: result.verified, error: null };
  } catch (error) {
    console.error('[authUtils] Erro ao verificar TOTP:', error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Erro de conexão com o servidor',
    };
  }
}

// ──────────────────────────────────────────────
// Setup 2FA
// ──────────────────────────────────────────────

export async function setup2FA(
  accessToken: string
): Promise<{ otpauthUrl: string; secret: string; error: string | null }> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/2fa/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      return { otpauthUrl: '', secret: '', error: body.error ?? 'Erro ao configurar 2FA' };
    }

    const result = (await response.json()) as { otpauthUrl: string; secret: string };
    return { otpauthUrl: result.otpauthUrl, secret: result.secret, error: null };
  } catch (error) {
    console.error('[authUtils] Erro ao configurar 2FA:', error);
    return {
      otpauthUrl: '',
      secret: '',
      error: error instanceof Error ? error.message : 'Erro de conexão com o servidor',
    };
  }
}

export async function verify2FASetup(
  token: string,
  accessToken: string
): Promise<{ verified: boolean; error: string | null }> {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/2fa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      return { verified: false, error: body.error ?? 'Erro ao verificar token 2FA' };
    }

    const result = (await response.json()) as { verified: boolean };
    return { verified: result.verified, error: null };
  } catch (error) {
    console.error('[authUtils] Erro ao verificar setup 2FA:', error);
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Erro de conexão com o servidor',
    };
  }
}

// ──────────────────────────────────────────────
// Sign Out
// ──────────────────────────────────────────────

export async function signOut(userId: string): Promise<{ error: string | null }> {
  try {
    await deletePrivateKeyFromIDB(userId);
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (error) {
    console.error('[authUtils] Erro ao fazer signOut:', error);
    return {
      error: error instanceof Error ? error.message : 'Erro ao sair da conta',
    };
  }
}
