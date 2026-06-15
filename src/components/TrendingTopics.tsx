import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { TrendingHashtag } from '@/types';

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M posts`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k posts`;
  return `${count} post${count !== 1 ? 's' : ''}`;
}

function TrendingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-3 bg-gray-800 rounded w-16" />
          <div className="h-4 bg-gray-800 rounded w-28" />
          <div className="h-3 bg-gray-800 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function TrendingTopics() {
  const [trending, setTrending] = useState<TrendingHashtag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTrending = useCallback(async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_trending_hashtags');
      if (rpcError) {
        console.error('[TrendingTopics] Erro ao buscar trending:', rpcError);
        setError('Não foi possível carregar os trending topics.');
        return;
      }
      setTrending((data as TrendingHashtag[]) ?? []);
      setError(null);
    } catch (err) {
      console.error('[TrendingTopics] Erro inesperado:', err);
      setError('Erro ao carregar trending topics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    const intervalId = setInterval(fetchTrending, POLLING_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchTrending]);

  function handleHashtagClick(tag: string) {
    navigate(`/explore?q=${encodeURIComponent('#' + tag)}`);
  }

  return (
    <div className="mt-4">
      {/* Search box */}
      <div className="mb-4">
        <div
          className="flex items-center gap-3 bg-gray-900 rounded-full px-4 py-2 cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => navigate('/explore')}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-gray-500 flex-shrink-0">
            <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.814 5.262l4.276 4.276-1.414 1.414-4.276-4.276A8.463 8.463 0 0110.25 18.75c-4.694 0-8.5-3.806-8.5-8.5z" />
          </svg>
          <span className="text-gray-500 text-sm">Buscar</span>
        </div>
      </div>

      {/* Trending box */}
      <div className="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800">
        <h2 className="text-xl font-extrabold text-white px-4 py-3">
          Assuntos do momento
        </h2>

        {loading && (
          <div className="px-4 py-3">
            <TrendingSkeleton />
          </div>
        )}

        {error && !loading && (
          <div className="px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchTrending}
              className="text-blue-500 text-sm mt-2 hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && trending.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-gray-500 text-sm">
              Nenhum assunto em destaque nas últimas 24 horas.
            </p>
          </div>
        )}

        {!loading && trending.length > 0 && (
          <ul>
            {trending.map((item, index) => (
              <li key={item.tag}>
                <button
                  onClick={() => handleHashtagClick(item.tag)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-900 transition-colors border-t border-gray-800 first:border-t-0"
                >
                  <p className="text-gray-500 text-xs">
                    {index + 1} · Em destaque
                  </p>
                  <p className="text-white font-bold text-sm mt-0.5">
                    #{item.tag}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {formatCount(item.count)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => navigate('/explore')}
          className="w-full text-left px-4 py-4 text-blue-500 hover:bg-gray-900 transition-colors text-sm border-t border-gray-800"
        >
          Mostrar mais
        </button>
      </div>

      {/* Footer links */}
      <div className="mt-4 px-2">
        <p className="text-gray-600 text-xs leading-relaxed">
          Termos de Serviço · Política de Privacidade · Política de Cookies · Acessibilidade · Informações de anúncios
        </p>
      </div>
    </div>
  );
}
