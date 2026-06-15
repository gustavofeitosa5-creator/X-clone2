import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onPostDeleted?: (postId: string) => void;
  compact?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function AvatarPlaceholder({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-bold">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

interface ReplyComposerProps {
  parentPost: Post;
  onReplied: () => void;
  onCancel: () => void;
}

function ReplyComposer({ parentPost, onReplied, onCancel }: ReplyComposerProps) {
  const profile = useStore((s) => s.profile);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleReply() {
    if (!profile || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: profile.id,
        content: content.trim(),
        parent_id: parentPost.id,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setContent('');
      onReplied();
    } catch (err) {
      console.error('[ReplyComposer] Erro ao responder:', err);
      setError('Erro ao enviar resposta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-3 border-t border-gray-800">
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      <div className="flex gap-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <AvatarPlaceholder name={profile?.display_name ?? profile?.username ?? '?'} />
        )}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Respondendo a @${parentPost.profiles?.username ?? ''}...`}
            maxLength={280}
            rows={2}
            className="w-full bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none text-base"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${content.length > 260 ? 'text-red-500' : 'text-gray-500'}`}>
              {280 - content.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-1.5 rounded-full border border-gray-700 text-white text-sm hover:bg-gray-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleReply}
                disabled={submitting || !content.trim() || content.length > 280}
                className="px-4 py-1.5 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Enviando...' : 'Responder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PostCard({ post: initialPost, onPostDeleted, compact = false }: PostCardProps) {
  const user = useStore((s) => s.user);
  const profile = useStore((s) => s.profile);
  const navigate = useNavigate();

  const [post, setPost] = useState<Post>(initialPost);
  const [liked, setLiked] = useState(initialPost.liked_by_me ?? false);
  const [likesCount, setLikesCount] = useState(initialPost._count?.likes ?? 0);
  const [bookmarked, setBookmarked] = useState(initialPost.bookmarked_by_me ?? false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [repostsCount, setRepostsCount] = useState(initialPost._count?.reposts ?? 0);
  const [repliesCount, setRepliesCount] = useState(initialPost._count?.replies ?? 0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const repostMenuRef = useRef<HTMLDivElement>(null);

  // Sync with parent post changes
  useEffect(() => {
    setPost(initialPost);
    setLiked(initialPost.liked_by_me ?? false);
    setLikesCount(initialPost._count?.likes ?? 0);
    setBookmarked(initialPost.bookmarked_by_me ?? false);
    setRepostsCount(initialPost._count?.reposts ?? 0);
    setRepliesCount(initialPost._count?.replies ?? 0);
  }, [initialPost]);

  // Close repost menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (repostMenuRef.current && !repostMenuRef.current.contains(e.target as Node)) {
        setShowRepostMenu(false);
      }
    }
    if (showRepostMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRepostMenu]);

  // Supabase Realtime subscription for this post
  useEffect(() => {
    const channel = supabase
      .channel(`post-updates-${post.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${post.id}` },
        (payload) => {
          setPost((prev) => ({ ...prev, ...(payload.new as Partial<Post>) }));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [post.id]);

  const handleLike = useCallback(async () => {
    if (!user) { navigate('/auth'); return; }

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => wasLiked ? c - 1 : c + 1);

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: user.id, post_id: post.id });
        if (error) throw error;
      }
    } catch (err) {
      console.error('[PostCard] Erro ao curtir:', err);
      setLiked(wasLiked);
      setLikesCount((c) => wasLiked ? c + 1 : c - 1);
    }
  }, [user, liked, post.id, navigate]);

  const handleBookmark = useCallback(async () => {
    if (!user) { navigate('/auth'); return; }

    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);

    try {
      if (wasBookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ user_id: user.id, post_id: post.id });
        if (error) throw error;
      }
    } catch (err) {
      console.error('[PostCard] Erro ao salvar:', err);
      setBookmarked(wasBookmarked);
    }
  }, [user, bookmarked, post.id, navigate]);

  const handleRepost = useCallback(async () => {
    if (!profile) { navigate('/auth'); return; }
    setShowRepostMenu(false);
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: profile.id,
        content: post.content,
        repost_id: post.id,
      });
      if (error) throw error;
      setRepostsCount((c) => c + 1);
    } catch (err) {
      console.error('[PostCard] Erro ao repostar:', err);
    }
  }, [profile, post, navigate]);

  const handleQuotePost = useCallback(() => {
    setShowRepostMenu(false);
    navigate('/home', { state: { quotePost: post } });
  }, [post, navigate]);

  const handleDelete = useCallback(async () => {
    if (!user || user.id !== post.user_id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      onPostDeleted?.(post.id);
    } catch (err) {
      console.error('[PostCard] Erro ao deletar post:', err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [user, post.id, post.user_id, onPostDeleted]);

  const authorProfile = post.profiles;
  const authorName = authorProfile?.display_name ?? authorProfile?.username ?? 'Usuário';
  const authorUsername = authorProfile?.username ?? '';

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) return;
    navigate(`/post/${post.id}`);
  }

  return (
    <article
      className={`border-b border-gray-800 hover:bg-gray-950/50 transition-colors cursor-pointer ${compact ? 'px-3 py-2' : ''}`}
      onClick={handleCardClick}
    >
      {/* Repost header */}
      {post.repost_id && post.reposted_by && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-gray-500 text-sm">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
          </svg>
          <span>
            <Link
              to={`/profile/${post.reposted_by.username}`}
              className="font-bold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {post.reposted_by.display_name ?? post.reposted_by.username}
            </Link>{' '}
            repostou
          </span>
        </div>
      )}

      <div className="flex gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Link to={`/profile/${authorUsername}`} onClick={(e) => e.stopPropagation()}>
            {authorProfile?.avatar_url ? (
              <img
                src={authorProfile.avatar_url}
                alt={authorName}
                className="w-10 h-10 rounded-full object-cover hover:opacity-90 transition-opacity"
              />
            ) : (
              <AvatarPlaceholder name={authorName} />
            )}
          </Link>
        </div>

        <div className="flex-1 min-w-0">
          {/* Author info */}
          <div className="flex items-center gap-1 flex-wrap">
            <Link
              to={`/profile/${authorUsername}`}
              className="font-bold text-white hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {authorName}
            </Link>
            <span className="text-gray-500 truncate">@{authorUsername}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 text-sm flex-shrink-0">
              {formatRelativeTime(post.created_at)}
            </span>

            {/* Delete button for own posts */}
            {user?.id === post.user_id && !compact && (
              <div className="ml-auto relative">
                {!showDeleteConfirm ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                    className="text-gray-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-900/20"
                    title="Deletar post"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M3 6h18v2H3V6zm2 3h14l-1.5 13.5h-11L5 9zm5 2v8h2v-8h-2zm4 0v8h2v-8h-2zM9 4V2h6v2H9z" />
                    </svg>
                  </button>
                ) : (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs text-red-500 hover:text-red-400 font-bold px-2 py-1"
                    >
                      {deleting ? '...' : 'Deletar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reply indicator */}
          {post.parent_id && post.parent_post?.profiles && (
            <p className="text-gray-500 text-sm mb-1">
              Respondendo a{' '}
              <Link
                to={`/profile/${post.parent_post.profiles.username}`}
                className="text-blue-500 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                @{post.parent_post.profiles.username}
              </Link>
            </p>
          )}

          {/* Content */}
          <p className="text-white text-base whitespace-pre-wrap break-words leading-relaxed">
            {post.content.split(/(\s+)/).map((word, i) => {
              if (word.startsWith('#') && word.length > 1) {
                return (
                  <Link
                    key={i}
                    to={`/explore?q=${encodeURIComponent(word)}`}
                    className="text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {word}
                  </Link>
                );
              }
              if (word.startsWith('@') && word.length > 1) {
                const username = word.slice(1).replace(/[^a-zA-Z0-9_]/g, '');
                return (
                  <Link
                    key={i}
                    to={`/profile/${username}`}
                    className="text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {word}
                  </Link>
                );
              }
              return word;
            })}
          </p>

          {/* Media */}
          {post.media_urls.length > 0 && (
            <div className={`mt-3 grid gap-1 rounded-2xl overflow-hidden ${
              post.media_urls.length === 1 ? 'grid-cols-1' :
              post.media_urls.length === 2 ? 'grid-cols-2' :
              post.media_urls.length === 3 ? 'grid-cols-2' : 'grid-cols-2'
            }`}>
              {post.media_urls.map((url, i) => {
                const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
                return isVideo ? (
                  <video
                    key={i}
                    src={url}
                    controls
                    className="w-full rounded object-cover max-h-96"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <img
                    key={i}
                    src={url}
                    alt={`Mídia ${i + 1}`}
                    className={`w-full object-cover rounded ${
                      post.media_urls.length === 3 && i === 0 ? 'row-span-2' : ''
                    } max-h-96`}
                    onClick={(e) => e.stopPropagation()}
                  />
                );
              })}
            </div>
          )}

          {/* Quoted post */}
          {post.repost_post && !compact && (
            <div
              className="mt-3 border border-gray-700 rounded-2xl overflow-hidden hover:bg-gray-900/50 transition-colors"
              onClick={(e) => { e.stopPropagation(); navigate(`/post/${post.repost_post!.id}`); }}
            >
              <PostCard post={post.repost_post} compact />
            </div>
          )}

          {/* Actions */}
          {!compact && (
            <div className="flex items-center justify-between mt-3 max-w-xs text-gray-500">
              {/* Reply */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowReplyComposer(!showReplyComposer); }}
                className="flex items-center gap-1.5 group hover:text-blue-500 transition-colors"
              >
                <span className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z" />
                  </svg>
                </span>
                <span className="text-sm">{repliesCount > 0 ? repliesCount : ''}</span>
              </button>

              {/* Repost */}
              <div className="relative" ref={repostMenuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRepostMenu(!showRepostMenu); }}
                  className={`flex items-center gap-1.5 group transition-colors ${post.reposted_by_me ? 'text-green-500' : 'hover:text-green-500'}`}
                >
                  <span className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                    </svg>
                  </span>
                  <span className="text-sm">{repostsCount > 0 ? repostsCount : ''}</span>
                </button>
                {showRepostMenu && (
                  <div className="absolute bottom-full left-0 mb-1 bg-black border border-gray-700 rounded-2xl shadow-2xl py-1 z-50 w-48">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRepost(); }}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-900 text-white text-sm font-bold transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                      </svg>
                      Repostar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQuotePost(); }}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-900 text-white text-sm font-bold transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2z" />
                      </svg>
                      Citar
                    </button>
                  </div>
                )}
              </div>

              {/* Like */}
              <button
                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                className={`flex items-center gap-1.5 group transition-colors ${liked ? 'text-pink-600' : 'hover:text-pink-600'}`}
              >
                <span className="p-2 rounded-full group-hover:bg-pink-600/10 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    {liked
                      ? <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                      : <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.86 1.149 2.111 3.895 4.271 8.063 6.461 4.167-2.189 6.912-4.349 8.063-6.461 1.112-2.08 1.03-3.74.477-4.86-.561-1.13-1.666-1.84-2.909-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
                    }
                  </svg>
                </span>
                <span className="text-sm">{likesCount > 0 ? likesCount : ''}</span>
              </button>

              {/* Bookmark */}
              <button
                onClick={(e) => { e.stopPropagation(); handleBookmark(); }}
                className={`flex items-center gap-1.5 group transition-colors ${bookmarked ? 'text-blue-500' : 'hover:text-blue-500'}`}
              >
                <span className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    {bookmarked
                      ? <path d="M4 4.5C4 3.119 5.119 2 6.5 2h11C18.881 2 20 3.119 20 4.5v18.793l-8-3.784-8 3.784V4.5z" />
                      : <path d="M4 4.5C4 3.119 5.119 2 6.5 2h11C18.881 2 20 3.119 20 4.5v18.793l-8-3.784-8 3.784V4.5zM6.5 4a.5.5 0 00-.5.5V19.21l6-2.838 6 2.838V4.5a.5.5 0 00-.5-.5h-11z" />
                    }
                  </svg>
                </span>
              </button>

              {/* Share */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`).catch(console.error);
                }}
                className="flex items-center gap-1.5 group hover:text-blue-500 transition-colors"
                title="Copiar link"
              >
                <span className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" />
                  </svg>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reply composer */}
      {showReplyComposer && !compact && (
        <ReplyComposer
          parentPost={post}
          onReplied={() => {
            setShowReplyComposer(false);
            setRepliesCount((c) => c + 1);
          }}
          onCancel={() => setShowReplyComposer(false)}
        />
      )}
    </article>
  );
}
