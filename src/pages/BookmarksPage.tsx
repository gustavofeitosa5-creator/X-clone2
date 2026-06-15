import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import PostCard from '@/components/PostCard';
import type { Post } from '@/types';

function PostSkeleton() {
  return (
    <div className="border-b border-gray-800 px-4 py-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-800 rounded w-32" />
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  const myUser = useStore((s) => s.user);
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    if (!myUser) { navigate('/auth'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('bookmarks')
        .select('post_id, posts(*, profiles(*))')
        .eq('user_id', myUser.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const bookmarkedPosts = ((data ?? []) as unknown as { posts: Post }[])
        .map((item) => item.posts)
        .filter(Boolean) as Post[];

      // Mark as bookmarked and check likes
      const postIds = bookmarkedPosts.map((p) => p.id);
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', myUser.id)
        .in('post_id', postIds);

      const likedSet = new Set(((likesData ?? []) as { post_id: string }[]).map((l) => l.post_id));

      const enriched = bookmarkedPosts.map((p) => ({
        ...p,
        bookmarked_by_me: true,
        liked_by_me: likedSet.has(p.id),
      }));

      setPosts(enriched);
    } catch (err) {
      console.error('[BookmarksPage] Erro ao buscar bookmarks:', err);
      setError('Não foi possível carregar os posts salvos.');
    } finally {
      setLoading(false);
    }
  }, [myUser, navigate]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-20 px-4 py-3">
        <h1 className="text-xl font-bold text-white">Posts salvos</h1>
        <p className="text-gray-500 text-sm mt-0.5">@{useStore.getState().profile?.username}</p>
      </div>

      {error && (
        <div className="m-4 p-4 rounded-lg bg-red-900/40 border border-red-700">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={fetchBookmarks} className="text-blue-500 text-sm mt-2 hover:underline">
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <div>{Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)}</div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="text-5xl mb-4">🔖</div>
          <p className="text-white text-2xl font-bold mb-2">Nenhum post salvo ainda</p>
          <p className="text-gray-500">
            Salve posts para acessá-los facilmente mais tarde.
          </p>
        </div>
      )}

      {!loading && posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
        />
      ))}
    </div>
  );
}
