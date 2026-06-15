import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import PostCard from '@/components/PostCard';
import type { Post, Profile } from '@/types';

type SearchTab = 'posts' | 'users';

function SearchSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 bg-gray-800 rounded w-32" />
            <div className="h-3 bg-gray-800 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface UserCardProps {
  profile: Profile;
  isFollowing: boolean;
  onFollowToggle: (profileId: string, currentlyFollowing: boolean) => void;
}

function UserCard({ profile, isFollowing, onFollowToggle }: UserCardProps) {
  const navigate = useNavigate();
  const myUser = useStore((s) => s.user);
  const [toggling, setToggling] = useState(false);

  async function handleFollow() {
    if (!myUser) { navigate('/auth'); return; }
    setToggling(true);
    try {
      onFollowToggle(profile.id, isFollowing);
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', myUser.id).eq('following_id', profile.id);
      } else {
        await supabase.from('follows').insert({ follower_id: myUser.id, following_id: profile.id });
      }
    } catch (err) {
      console.error('[UserCard] Erro ao seguir/deixar de seguir:', err);
      onFollowToggle(profile.id, !isFollowing);
    } finally {
      setToggling(false);
    }
  }

  const isOwnProfile = myUser?.id === profile.id;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 hover:bg-gray-950/50 transition-colors">
      <button onClick={() => navigate(`/profile/${profile.username}`)} className="flex-shrink-0">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name ?? profile.username}
            className="w-12 h-12 rounded-full object-cover hover:opacity-90 transition-opacity"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </button>

      <button
        className="flex-1 min-w-0 text-left"
        onClick={() => navigate(`/profile/${profile.username}`)}
      >
        <p className="text-white font-bold truncate hover:underline">
          {profile.display_name ?? profile.username}
        </p>
        <p className="text-gray-500 text-sm truncate">@{profile.username}</p>
        {profile.bio && (
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{profile.bio}</p>
        )}
      </button>

      {!isOwnProfile && (
        <button
          onClick={handleFollow}
          disabled={toggling}
          className={`flex-shrink-0 font-bold px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
            isFollowing
              ? 'border border-gray-600 text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
              : 'bg-white text-black hover:bg-gray-200'
          }`}
        >
          {toggling ? '...' : isFollowing ? 'Seguindo' : 'Seguir'}
        </button>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const myUser = useStore((s) => s.user);

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [activeTab, setActiveTab] = useState<SearchTab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPosts = useCallback(async (q: string) => {
    if (!q.trim()) { setPosts([]); return; }
    try {
      const cleanQ = q.startsWith('#') ? q.slice(1) : q;
      const { data, error: rpcError } = await supabase.rpc('search_posts', { query: cleanQ });
      if (rpcError) throw rpcError;

      const rawPosts = (data ?? []) as Post[];
      if (rawPosts.length === 0) { setPosts([]); return; }

      // Enrich with profiles
      const userIds = [...new Set(rawPosts.map((p) => p.user_id))];
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds);
      const profileMap = new Map(((profilesData ?? []) as Profile[]).map((p) => [p.id, p]));

      const enriched = rawPosts.map((post) => ({
        ...post,
        profiles: profileMap.get(post.user_id) ?? null,
        liked_by_me: false,
        bookmarked_by_me: false,
        _count: { likes: 0, reposts: 0, replies: 0, bookmarks: 0 },
      }));

      setPosts(enriched as Post[]);
    } catch (err) {
      console.error('[SearchPage] Erro ao buscar posts:', err);
      setError('Erro ao buscar posts.');
    }
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setUsers([]); return; }
    try {
      const cleanQ = q.startsWith('@') ? q.slice(1) : q;
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`)
        .limit(20);

      if (fetchError) throw fetchError;
      const foundUsers = (data ?? []) as Profile[];
      setUsers(foundUsers);

      // Check which ones current user follows
      if (myUser && foundUsers.length > 0) {
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', myUser.id)
          .in('following_id', foundUsers.map((u) => u.id));

        const followedSet = new Set(
          ((followsData ?? []) as { following_id: string }[]).map((f) => f.following_id)
        );
        const newMap = new Map<string, boolean>();
        foundUsers.forEach((u) => newMap.set(u.id, followedSet.has(u.id)));
        setFollowingMap(newMap);
      }
    } catch (err) {
      console.error('[SearchPage] Erro ao buscar usuários:', err);
      setError('Erro ao buscar usuários.');
    }
  }, [myUser]);

  const performSearch = useCallback(
    async (q: string, tab: SearchTab) => {
      if (!q.trim()) {
        setPosts([]);
        setUsers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (tab === 'posts') {
          await searchPosts(q);
        } else {
          await searchUsers(q);
        }
      } finally {
        setLoading(false);
      }
    },
    [searchPosts, searchUsers]
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearchParams(value ? { q: value } : {});

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(value, activeTab);
    }, 400);
  }

  function handleTabChange(tab: SearchTab) {
    setActiveTab(tab);
    if (query.trim()) {
      performSearch(query, tab);
    }
  }

  // Initial search from URL param
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
      performSearch(urlQuery, activeTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleFollowToggle(profileId: string, currentlyFollowing: boolean) {
    setFollowingMap((prev) => {
      const next = new Map(prev);
      next.set(profileId, !currentlyFollowing);
      return next;
    });
  }

  return (
    <div className="min-h-screen">
      {/* Header + Search input */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-20">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 bg-gray-900 rounded-full px-4 py-2.5 border border-gray-800 focus-within:border-blue-500 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-gray-500 flex-shrink-0">
              <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.814 5.262l4.276 4.276-1.414 1.414-4.276-4.276A8.463 8.463 0 0110.25 18.75c-4.694 0-8.5-3.806-8.5-8.5z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Buscar posts, usuários, #hashtags..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
              autoFocus
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSearchParams({}); setPosts([]); setUsers([]); }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(['posts', 'users'] as SearchTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors hover:bg-gray-900 relative capitalize ${
                activeTab === tab ? 'text-white' : 'text-gray-500'
              }`}
            >
              {tab === 'posts' ? 'Posts' : 'Usuários'}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="m-4 p-4 rounded-lg bg-red-900/40 border border-red-700">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && <SearchSkeleton />}

      {/* Empty query state */}
      {!loading && !query && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-white text-2xl font-bold mb-2">Busque no X</p>
          <p className="text-gray-500">
            Encontre posts, pessoas e hashtags.
          </p>
        </div>
      )}

      {/* Posts tab */}
      {!loading && query && activeTab === 'posts' && (
        <>
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <p className="text-white text-2xl font-bold mb-2">Nenhum resultado encontrado</p>
              <p className="text-gray-500 text-sm">
                Tente buscar por outros termos ou #hashtags.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))
          )}
        </>
      )}

      {/* Users tab */}
      {!loading && query && activeTab === 'users' && (
        <>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <p className="text-white text-2xl font-bold mb-2">Nenhum usuário encontrado</p>
              <p className="text-gray-500 text-sm">
                Tente outro nome de usuário ou nome completo.
              </p>
            </div>
          ) : (
            users.map((user) => (
              <UserCard
                key={user.id}
                profile={user}
                isFollowing={followingMap.get(user.id) ?? false}
                onFollowToggle={handleFollowToggle}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
