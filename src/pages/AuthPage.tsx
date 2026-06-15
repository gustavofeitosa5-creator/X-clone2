import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'signin' | 'signup' | 'totp';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, signInWithGithub, verifyTOTPCode, loading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.requiresTOTP) {
          setMode('totp');
          return;
        }
        navigate('/home');
      } else if (mode === 'signup') {
        if (username.trim().length < 3) {
          setError('O nome de usuário deve ter pelo menos 3 caracteres.');
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
          setError('Nome de usuário pode conter apenas letras, números e underscore.');
          return;
        }
        const result = await signUp(email, password, username.trim().toLowerCase());
        if (result.error) {
          setError(result.error);
          return;
        }
        setSuccessMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
        setMode('signin');
      } else if (mode === 'totp') {
        const result = await verifyTOTPCode(totpToken);
        if (!result.verified || result.error) {
          setError(result.error ?? 'Código inválido. Tente novamente.');
          return;
        }
        navigate('/home');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'github'): Promise<void> {
    setError(null);
    const result = provider === 'google'
      ? await signInWithGoogle()
      : await signInWithGithub();
    if (result.error) {
      setError(result.error);
    }
  }

  const isLoading = loading || submitting;

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center bg-black">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-72 h-72 text-white fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-10 h-10 text-white fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.261 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          </div>

          <div>
            <h2 className="text-4xl font-extrabold text-white">
              {mode === 'signin' && 'Entrar no X'}
              {mode === 'signup' && 'Criar sua conta'}
              {mode === 'totp' && 'Verificação em duas etapas'}
            </h2>
            {mode === 'totp' && (
              <p className="mt-2 text-gray-400 text-sm">
                Digite o código gerado pelo seu aplicativo autenticador.
              </p>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 p-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Success banner */}
          {successMsg && (
            <div className="rounded-lg bg-green-900/40 border border-green-700 p-4">
              <p className="text-green-300 text-sm">{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode !== 'totp' && (
              <>
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                      Nome de usuário
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        minLength={3}
                        maxLength={30}
                        pattern="[a-zA-Z0-9_]+"
                        placeholder="seunome"
                        className="w-full bg-transparent border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </>
            )}

            {mode === 'totp' && (
              <div>
                <label htmlFor="totpToken" className="block text-sm font-medium text-gray-300 mb-1">
                  Código de verificação (6 dígitos)
                </label>
                <input
                  id="totpToken"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="000000"
                  className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-center text-2xl tracking-widest"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading
                ? 'Aguarde...'
                : mode === 'signin'
                ? 'Entrar'
                : mode === 'signup'
                ? 'Criar conta'
                : 'Verificar'}
            </button>
          </form>

          {mode !== 'totp' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-black px-4 text-gray-500">ou</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleOAuth('google')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 border border-gray-700 rounded-full py-3 text-white font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continuar com Google
                </button>

                <button
                  onClick={() => handleOAuth('github')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 border border-gray-700 rounded-full py-3 text-white font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Continuar com GitHub
                </button>
              </div>

              <p className="text-center text-gray-500 text-sm">
                {mode === 'signin' ? (
                  <>
                    Não tem uma conta?{' '}
                    <button
                      onClick={() => { setMode('signup'); setError(null); }}
                      className="text-blue-500 hover:underline font-medium"
                    >
                      Criar conta
                    </button>
                  </>
                ) : (
                  <>
                    Já tem uma conta?{' '}
                    <button
                      onClick={() => { setMode('signin'); setError(null); }}
                      className="text-blue-500 hover:underline font-medium"
                    >
                      Entrar
                    </button>
                  </>
                )}
              </p>
            </>
          )}

          {mode === 'totp' && (
            <button
              onClick={() => { setMode('signin'); setError(null); setTotpToken(''); }}
              className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              ← Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
