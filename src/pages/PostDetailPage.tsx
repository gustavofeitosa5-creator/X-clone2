import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import PostCard from '@/components/PostCard';
import type { Post, Profile } from '@/types';

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

async function enrichPost(post: Post, userId?: string): Promise<Post> {
  const [profileRes, likeCountRes, replyCountRes, repostCountRes, likedRes, bookmarkedRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', post.user_id).single(),
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('parent_id', post.id),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('repost_id', post.id),
      userId
        ? supabase.from('likes').select('post_id').eq('user_id', userId).eq('post_id', post.id).single()
        : Promise.resolve({ data: null }),
      userId
        ? supabase.from('bookmarks').select('post_id').eq('user_id', userId).eq('post_id', post.id).single()
        : Promise.resolve({ data: null }),
    ]);

  return {
    ...post,
    profiles: profileRes.data as Profile | null,
    liked_by_me: !!likedRes.data,
    bookmarked_by_me: !!bookmarkedRes.data,
    _count: {
      likes: likeCountRes.count ?? 0,
      replies: replyCountRes.count ?? 0,
      reposts: repostCountRes.count ?? 0,
      bookmarks: 0,
    },
  };
}

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const myUser = useStore((s) => s.user);

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (fetchError || !data) {
        setError('Post não encontrado.');
        setLoading(false);
        return;
      }

      const enriched = await enrichPost(data as Post, myUser?.id);
      setPost(enriched);

      // Fetch replies
      const { data: repliesData, error: repliesError } = await supabase
        .from('posts')
        .select('*')
        .eq('parent_id', postId)
        .order('created_at', { ascending: true });

      if (repliesError) throw repliesError;

      const rawReplies = (repliesData ?? []) as Post[];
      const enrichedReplies = await Promise.all(
        rawReplies.map((r) => enrichPost(r, myUser?.id))
      );
      setReplies(enrichedReplies);
    } catch (err) {
      console.error('[PostDetailPage] Erro ao carregar post:', err);
      setError('Erro ao carregar post.');
    } finally {
      setLoading(false);
    }
  }, [postId, myUser?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Realtime subscription for new replies
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`post-replies-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `parent_id=eq.${postId}`,
        },
        async (payload) => {
          const newReply = payload.new as Post;
          try {
            const enriched = await enrichPost(newReply, myUser?.id);
            setReplies((prev) => [...prev, enriched]);
          } catch (err) {
            console.error('[PostDetailPage] Erro ao enriquecer reply realtime:', err);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [postId, myUser?.id]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-20 flex items-center gap-4 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-900 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
            <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Post</h1>
      </div>

      {loading && (
        <div>
          <PostSkeleton />
          <div className="border-t border-gray-800 pt-4">
            {Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <p className="text-white text-2xl font-bold mb-2">{error}</p>
          <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline mt-4">
            Voltar
          </button>
        </div>
      )}

      {!loading && post && (
        <>
          <PostCard
            post={post}
            onPostDeleted={() => navigate(-1)}
          />

          {/* Replies */}
          {replies.length > 0 && (
            <div>
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-gray-500 text-sm font-medium">
                  {replies.length} {replies.length === 1 ? 'resposta' : 'respostas'}
                </p>
              </div>
              {replies.map((reply) => (
                <PostCard
                  key={reply.id}
                  post={reply}
                  onPostDeleted={(id) => setReplies((prev) => prev.filter((r) => r.id !== id))}
                />
              ))}
            </div>
          )}

          {replies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-500">Nenhuma resposta ainda. Seja o primeiro!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
