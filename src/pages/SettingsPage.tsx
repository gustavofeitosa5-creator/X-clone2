import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store';

export default function SettingsPage() {
  const { signOut } = useAuth();
  const profile = useStore((s) => s.profile);
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      const result = await signOut();
      if (result.error) {
        setError(result.error);
        return;
      }
      navigate('/auth');
    } catch (err) {
      console.error('[SettingsPage] Erro ao sair:', err);
      setError('Erro ao sair da conta.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-20 flex items-center gap-4 px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-900 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
            <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
      </div>

      {error && (
        <div className="m-4 p-4 rounded-lg bg-red-900/40 border border-red-700">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Account section */}
      <div className="border-b border-gray-800">
        <div className="px-4 py-5">
          <h2 className="text-white font-bold text-lg mb-1">Sua conta</h2>
          {profile && (
            <p className="text-gray-500 text-sm">
              Logado como <span className="text-white">@{profile.username}</span>
            </p>
          )}
        </div>
      </div>

      {/* Settings items */}
      <div className="divide-y divide-gray-800">
        <button
          onClick={() => navigate(`/profile/${profile?.username ?? ''}`)}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-900 transition-colors text-left"
        >
          <div>
            <p className="text-white font-medium">Editar perfil</p>
            <p className="text-gray-500 text-sm mt-0.5">Altere seu nome, bio e foto</p>
          </div>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-gray-500">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </svg>
        </button>

        <button
          onClick={() => navigate(`/profile/${profile?.username ?? ''}#security`)}
          className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-900 transition-colors text-left"
        >
          <div>
            <p className="text-white font-medium">Segurança da conta</p>
            <p className="text-gray-500 text-sm mt-0.5">
              {profile?.totp_enabled
                ? '✅ Verificação em duas etapas ativa'
                : 'Ative a verificação em duas etapas'}
            </p>
          </div>
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-gray-500">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </svg>
        </button>

        <div className="px-4 py-4">
          <p className="text-white font-medium mb-1">Criptografia de mensagens</p>
          <p className="text-gray-500 text-sm">
            🔒 Todas as mensagens privadas são criptografadas com E2EE via Web Crypto API.
            Chaves privadas armazenadas exclusivamente neste dispositivo.
          </p>
        </div>

        <div className="px-4 py-4">
          <p className="text-white font-medium mb-1">Sobre o X Clone</p>
          <p className="text-gray-500 text-sm">
            Versão 1.0.0 · Stack: React + Supabase + E2EE
          </p>
        </div>
      </div>

      {/* Sign out */}
      <div className="p-4 mt-4">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full border border-red-800 text-red-500 font-bold py-3 rounded-full hover:bg-red-900/20 disabled:opacity-50 transition-colors"
        >
          {signingOut ? 'Saindo...' : 'Sair da conta'}
        </button>
      </div>
    </div>
  );
}
