import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import PostCard from '@/components/PostCard';
import type { Post } from '@/types';

type FeedTab = 'for-you' | 'following';

const COMMON_EMOJIS = [
  '😀','😂','🥰','😍','🤔','😎','🙃','😅','🥳','😭',
  '❤️','🔥','✨','💯','👍','🙌','💪','👀','🎉','🤣',
  '😊','😘','🥺','😢','😡','🤩','😴','🤝','👏','🫶',
];

interface PostEntry {
  content: string;
  mediaFiles: File[];
  mediaPreviews: string[];
}

function PostSkeleton() {
  return (
    <div className="border-b border-gray-800 px-4 py-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-800 rounded w-32" />
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="flex gap-8 mt-3">
            <div className="h-4 bg-gray-800 rounded w-8" />
            <div className="h-4 bg-gray-800 rounded w-8" />
            <div className="h-4 bg-gray-800 rounded w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function enrichPosts(rawPosts: Post[], userId?: string): Promise<Post[]> {
  if (!rawPosts.length) return [];

  const postIds = rawPosts.map((p) => p.id);
  const userIds = [...new Set(rawPosts.map((p) => p.user_id))];

  const [profilesRes, likesRes, bookmarksRes, repliesRes, repostsRes] = await Promise.all([
    supabase.from('profiles').select('*').in('id', userIds),
    userId
      ? supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    userId
      ? supabase.from('bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    supabase.from('posts').select('parent_id').in('parent_id', postIds),
    supabase.from('posts').select('repost_id').in('repost_id', postIds),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p: Post['profiles']) => [p!.id, p])
  );

  const likedSet = new Set(
    ((likesRes as { data: { post_id: string }[] | null }).data ?? []).map((l) => l.post_id)
  );
  const bookmarkedSet = new Set(
    ((bookmarksRes as { data: { post_id: string }[] | null }).data ?? []).map((b) => b.post_id)
  );

  const repliesCountMap = new Map<string, number>();
  for (const r of repliesRes.data ?? []) {
    const key = (r as { parent_id: string }).parent_id;
    repliesCountMap.set(key, (repliesCountMap.get(key) ?? 0) + 1);
  }

  const repostsCountMap = new Map<string, number>();
  for (const r of repostsRes.data ?? []) {
    const key = (r as { repost_id: string }).repost_id;
    repostsCountMap.set(key, (repostsCountMap.get(key) ?? 0) + 1);
  }

  // Fetch like counts
  const likeCountsRes = await Promise.all(
    postIds.map((id) =>
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', id)
    )
  );
  const likeCountMap = new Map(postIds.map((id, i) => [id, likeCountsRes[i].count ?? 0]));

  return rawPosts.map((post) => ({
    ...post,
    profiles: profileMap.get(post.user_id) ?? null,
    liked_by_me: likedSet.has(post.id),
    bookmarked_by_me: bookmarkedSet.has(post.id),
    _count: {
      likes: likeCountMap.get(post.id) ?? 0,
      reposts: repostsCountMap.get(post.id) ?? 0,
      replies: repliesCountMap.get(post.id) ?? 0,
      bookmarks: 0,
    },
  }));
}

export default function FeedPage() {
  const user = useStore((s) => s.user);
  const profile = useStore((s) => s.profile);
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [entries, setEntries] = useState<PostEntry[]>([{ content: '', mediaFiles: [], mediaPreviews: [] }]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);

  // Quote post from navigation state
  const quotePost = (location.state as { quotePost?: Post } | null)?.quotePost ?? null;
  const [quoteContent, setQuoteContent] = useState('');

  const fetchForYou = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const enriched = await enrichPosts((data ?? []) as Post[], user?.id);
      setPosts(enriched);
    } catch (err) {
      console.error('[FeedPage] Erro ao carregar feed Para Você:', err);
      setError('Não foi possível carregar o feed. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchFollowing = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError) throw followsError;

      const followingIds = (followsData ?? []).map((f: { following_id: string }) => f.following_id);

      if (followingIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const { data, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', followingIds)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      const enriched = await enrichPosts((data ?? []) as Post[], user.id);
      setPosts(enriched);
    } catch (err) {
      console.error('[FeedPage] Erro ao carregar feed Seguindo:', err);
      setError('Não foi possível carregar o feed. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'for-you') {
      fetchForYou();
    } else {
      fetchFollowing();
    }
  }, [activeTab, fetchForYou, fetchFollowing]);

  // Realtime: new posts subscription
  useEffect(() => {
    const channel = supabase
      .channel('feed-new-posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const newPost = payload.new as Post;
          if (newPost.parent_id) return; // Skip replies in main feed
          try {
            const enriched = await enrichPosts([newPost], user?.id);
            setPosts((prev) => [enriched[0], ...prev]);
          } catch (err) {
            console.error('[FeedPage] Erro ao enriquecer novo post realtime:', err);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  function updateEntry(index: number, field: keyof PostEntry, value: string | File[] | string[]) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }

  function addThreadEntry() {
    setEntries((prev) => [...prev, { content: '', mediaFiles: [], mediaPreviews: [] }]);
    setActiveEntryIndex(entries.length);
  }

  function removeThreadEntry(index: number) {
    if (entries.length === 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setActiveEntryIndex(Math.max(0, index - 1));
  }

  function handleFileChange(index: number, files: FileList | null) {
    if (!files) return;
    const fileArray = Array.from(files).slice(0, 4);
    const previews = fileArray.map((f) => URL.createObjectURL(f));
    updateEntry(index, 'mediaFiles', fileArray);
    updateEntry(index, 'mediaPreviews', previews);
  }

  function insertEmoji(index: number, emoji: string) {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === index ? { ...e, content: e.content + emoji } : e
      )
    );
    setShowEmojiPicker(null);
  }

  async function uploadMedia(files: File[], userId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('post-media').getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  }

  async function handleSubmit() {
    if (!profile) return;
    const validEntries = entries.filter((e) => e.content.trim());
    if (!validEntries.length) return;

    setSubmitting(true);
    setComposeError(null);

    try {
      let parentId: string | null = null;

      if (quotePost && quoteContent.trim()) {
        // Submit quote post
      const { data: quoteData, error: insertError } = await supabase.from('posts').insert({
        user_id: profile.id,
        content: quoteContent.trim(),
        repost_id: quotePost.id,
      }).select().single();

      if (insertError) throw insertError;
      const enriched = await enrichPosts([quoteData as Post], user?.id);
        setPosts((prev) => [enriched[0], ...prev]);
      } else {
        // Submit thread
        for (const entry of validEntries) {
          let mediaUrls: string[] = [];
          if (entry.mediaFiles.length > 0) {
            mediaUrls = await uploadMedia(entry.mediaFiles, profile.id);
          }

          const { data: threadData, error: insertError } = await supabase.from('posts').insert({
            user_id: profile.id,
            content: entry.content.trim(),
            media_urls: mediaUrls,
            parent_id: parentId,
          }).select().single() as { data: Post | null; error: unknown };

          if (insertError) throw insertError;
          if (!threadData) throw new Error('Resposta vazia ao criar post');
          parentId = threadData.id;

          if (entries.indexOf(entry) === 0) {
            const enriched = await enrichPosts([threadData], user?.id);
            setPosts((prev) => [enriched[0], ...prev]);
          }
        }
      }

      setEntries([{ content: '', mediaFiles: [], mediaPreviews: [] }]);
      setQuoteContent('');
      setActiveEntryIndex(0);
    } catch (err) {
      console.error('[FeedPage] Erro ao publicar post:', err);
      setComposeError('Erro ao publicar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCharCount = entries[activeEntryIndex]?.content.length ?? 0;
  const isOverLimit = totalCharCount > 280;
  const charColor = totalCharCount > 260 ? 'text-red-500' : totalCharCount > 240 ? 'text-yellow-500' : 'text-gray-500';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-30">
        <h1 className="text-xl font-bold text-white px-4 pt-4 pb-0">Início</h1>
        <div className="flex">
          <button
            onClick={() => setActiveTab('for-you')}
            className={`flex-1 py-4 text-sm font-medium transition-colors hover:bg-gray-900 relative ${
              activeTab === 'for-you' ? 'text-white' : 'text-gray-500'
            }`}
          >
            Para você
            {activeTab === 'for-you' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-blue-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-4 text-sm font-medium transition-colors hover:bg-gray-900 relative ${
              activeTab === 'following' ? 'text-white' : 'text-gray-500'
            }`}
          >
            Seguindo
            {activeTab === 'following' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-blue-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Composer */}
      {profile && (
        <div className="border-b border-gray-800 px-4 py-3">
          {/* Quote mode */}
          {quotePost ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <textarea
                    value={quoteContent}
                    onChange={(e) => setQuoteContent(e.target.value)}
                    placeholder="Adicione um comentário..."
                    maxLength={280}
                    rows={3}
                    className="w-full bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none text-base"
                  />
                  <div className="border border-gray-700 rounded-2xl overflow-hidden mt-2 opacity-75">
                    <PostCard post={quotePost} compact />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 rounded-full border border-gray-700 text-white text-sm hover:bg-gray-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !quoteContent.trim()}
                  className="px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          ) : (
            /* Thread composer */
            <div className="space-y-0">
              {entries.map((entry, index) => (
                <div key={index} className="flex gap-3 relative">
                  {/* Thread line */}
                  {entries.length > 1 && index < entries.length - 1 && (
                    <div className="absolute left-5 top-14 bottom-0 w-0.5 bg-gray-700" />
                  )}

                  <div className="flex-shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pb-3">
                    <textarea
                      value={entry.content}
                      onChange={(e) => updateEntry(index, 'content', e.target.value)}
                      onFocus={() => setActiveEntryIndex(index)}
                      placeholder={index === 0 ? 'O que está acontecendo?!' : 'Continue o fio...'}
                      rows={index === activeEntryIndex ? 3 : 1}
                      className="w-full bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none text-xl pt-2"
                    />

                    {/* Media previews */}
                    {entry.mediaPreviews.length > 0 && (
                      <div className={`grid gap-1 mt-2 rounded-2xl overflow-hidden ${
                        entry.mediaPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                      }`}>
                        {entry.mediaPreviews.map((preview, pi) => (
                          <div key={pi} className="relative group">
                            <img src={preview} alt="" className="w-full h-40 object-cover rounded" />
                            <button
                              onClick={() => {
                                const newFiles = entry.mediaFiles.filter((_, fi) => fi !== pi);
                                const newPreviews = entry.mediaPreviews.filter((_, fi) => fi !== pi);
                                updateEntry(index, 'mediaFiles', newFiles);
                                updateEntry(index, 'mediaPreviews', newPreviews);
                              }}
                              className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        {/* Media upload */}
                        <button
                          onClick={() => { setActiveEntryIndex(index); fileInputRef.current?.click(); }}
                          className="p-2 rounded-full text-blue-500 hover:bg-blue-500/10 transition-colors"
                          title="Adicionar imagem/vídeo"
                        >
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 17.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-1.086zM9.75 7C8.783 7 8 7.783 8 8.75s.783 1.75 1.75 1.75 1.75-.783 1.75-1.75S10.717 7 9.75 7z" />
                          </svg>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileChange(activeEntryIndex, e.target.files)}
                        />

                        {/* Emoji picker */}
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(showEmojiPicker === index ? null : index)}
                            className="p-2 rounded-full text-blue-500 hover:bg-blue-500/10 transition-colors"
                            title="Emoji"
                          >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                              <path d="M8 9.5C8 8.119 8.672 7 9.5 7S11 8.119 11 9.5 10.328 12 9.5 12 8 10.881 8 9.5zm6.5 0c0-1.381.672-2.5 1.5-2.5s1.5 1.119 1.5 2.5-.672 2.5-1.5 2.5-1.5-1.119-1.5-2.5zM12 16c-2.224 0-3.021-1.5-3.094-1.621L7.28 15.15c.197.36 1.329 2.85 4.72 2.85s4.523-2.49 4.72-2.85l-1.626-.771C15.021 14.5 14.224 16 12 16zm-.002-14C6.477 2 2 6.477 2 12s4.477 10 9.998 10C17.523 22 22 17.523 22 12S17.523 2 11.998 2zM12 20c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z" />
                            </svg>
                          </button>
                          {showEmojiPicker === index && (
                            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-2xl p-3 z-50 grid grid-cols-10 gap-1 shadow-2xl">
                              {COMMON_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => insertEmoji(index, emoji)}
                                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800 transition-colors text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Char counter */}
                        {index === activeEntryIndex && entry.content.length > 0 && (
                          <span className={`text-xs font-medium ${charColor}`}>
                            {280 - totalCharCount}
                          </span>
                        )}

                        {/* Remove thread entry */}
                        {entries.length > 1 && (
                          <button
                            onClick={() => removeThreadEntry(index)}
                            className="text-gray-500 hover:text-red-500 transition-colors text-sm px-2"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Composer footer */}
              {composeError && (
                <div className="rounded-lg bg-red-900/40 border border-red-700 p-3 mt-2">
                  <p className="text-red-300 text-sm">{composeError}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-800 mt-2">
                <button
                  onClick={addThreadEntry}
                  className="text-blue-500 hover:text-blue-400 text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
                  </svg>
                  Adicionar post
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    isOverLimit ||
                    entries.every((e) => !e.content.trim())
                  }
                  className="px-5 py-2 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Publicando...' : entries.length > 1 ? 'Publicar tudo' : 'Postar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {loading && (
        <div>
          {Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}
        </div>
      )}

      {error && !loading && (
        <div className="p-6 text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={() => activeTab === 'for-you' ? fetchForYou() : fetchFollowing()}
            className="text-blue-500 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          {activeTab === 'following' ? (
            <>
              <p className="text-3xl font-extrabold text-white mb-2">Siga pessoas para ver seus posts</p>
              <p className="text-gray-500">
                Quando você seguir alguém, os posts delas aparecerão aqui.
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-extrabold text-white mb-2">Nenhum post ainda</p>
              <p className="text-gray-500">
                Seja o primeiro a postar algo!
              </p>
            </>
          )}
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
