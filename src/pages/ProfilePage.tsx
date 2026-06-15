import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import { setup2FA, verify2FASetup } from '@/utils/authUtils';
import PostCard from '@/components/PostCard';
import type { Post, Profile } from '@/types';

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes' | 'bookmarks';

function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-48 bg-gray-800" />
      <div className="px-4 pb-4">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <div className="w-24 h-24 rounded-full bg-gray-700 border-4 border-black" />
          <div className="h-9 w-24 bg-gray-800 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-gray-800 rounded w-32" />
          <div className="h-4 bg-gray-800 rounded w-24" />
          <div className="h-4 bg-gray-800 rounded w-full mt-2" />
          <div className="flex gap-4 mt-3">
            <div className="h-4 bg-gray-800 rounded w-20" />
            <div className="h-4 bg-gray-800 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSaved: (updated: Partial<Profile>) => void;
}

function EditProfileModal({ profile, onClose, onSaved }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      onSaved({ display_name: displayName.trim() || null, bio: bio.trim() || null });
      onClose();
    } catch (err) {
      console.error('[EditProfileModal] Erro ao salvar:', err);
      setError('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-black border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
          <button onClick={onClose} className="text-white hover:bg-gray-900 rounded-full p-2 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
            </svg>
          </button>
          <h2 className="text-white font-bold text-xl">Editar perfil</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto bg-white text-black font-bold px-4 py-1.5 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-900/40 border border-red-700">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-gray-500 text-sm mb-1">Nome</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-gray-500 text-sm mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <p className="text-gray-600 text-xs text-right mt-1">{160 - bio.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TwoFASetupProps {
  accessToken: string;
  onClose: () => void;
  onEnabled: () => void;
}

function TwoFASetup({ accessToken, onClose, onEnabled }: TwoFASetupProps) {
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setup2FA(accessToken).then(({ otpauthUrl: url, secret: s, error: e }) => {
      if (e) { setError(e); } else { setOtpauthUrl(url); setSecret(s); }
      setLoading(false);
    }).catch((err: unknown) => {
      console.error('[TwoFASetup] Erro:', err);
      setError('Erro ao configurar 2FA');
      setLoading(false);
    });
  }, [accessToken]);

  async function handleVerify() {
    setVerifying(true);
    setError(null);
    const { verified: ok, error: e } = await verify2FASetup(token, accessToken);
    setVerifying(false);
    if (!ok || e) { setError(e ?? 'Código inválido'); return; }
    setVerified(true);
    onEnabled();
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-black border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
          <button onClick={onClose} className="text-white hover:bg-gray-900 rounded-full p-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z" />
            </svg>
          </button>
          <h2 className="text-white font-bold text-xl">Ativar 2FA</h2>
        </div>

        <div className="p-6 space-y-6">
          {loading && <p className="text-gray-400 text-center">Gerando configuração...</p>}

          {!loading && error && !verified && (
            <div className="p-3 rounded-lg bg-red-900/40 border border-red-700">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {!loading && otpauthUrl && !verified && (
            <>
              <div>
                <p className="text-white font-bold mb-2">1. Escaneie o QR Code</p>
                <p className="text-gray-500 text-sm mb-3">
                  Use um app autenticador (Google Authenticator, Authy, etc.)
                </p>
                <div className="flex justify-center bg-white p-4 rounded-2xl">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`}
                    alt="QR Code para 2FA"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <div>
                <p className="text-white font-bold mb-1">Ou insira manualmente:</p>
                <code className="text-blue-400 text-xs break-all bg-gray-900 p-2 rounded block">
                  {secret}
                </code>
              </div>

              <div>
                <p className="text-white font-bold mb-2">2. Insira o código de verificação</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying || token.length !== 6}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 rounded-full disabled:opacity-50 transition-colors"
              >
                {verifying ? 'Verificando...' : 'Ativar 2FA'}
              </button>
            </>
          )}

          {verified && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-white font-bold text-xl">2FA ativado com sucesso!</p>
              <p className="text-gray-500 text-sm">
                Sua conta agora está protegida com autenticação em dois fatores.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const myUser = useStore((s) => s.user);
  const myProfile = useStore((s) => s.profile);
  const session = useStore((s) => s.session);
  const { setProfile: setStoreProfile } = useStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const isOwnProfile = myProfile?.username === username;

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (fetchError || !data) {
        setError('Perfil não encontrado.');
        setLoading(false);
        return;
      }

      const profileData = data as Profile;
      setProfile(profileData);

      // Fetch counts in parallel
      const [followersRes, followingRes, followingMeRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileData.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileData.id),
        myUser
          ? supabase.from('follows').select('*').eq('follower_id', myUser.id).eq('following_id', profileData.id).single()
          : Promise.resolve({ data: null }),
      ]);

      setFollowersCount(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
      setIsFollowing(!!followingMeRes.data);
    } catch (err) {
      console.error('[ProfilePage] Erro ao buscar perfil:', err);
      setError('Erro ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  }, [username, myUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchTabPosts = useCallback(async (tab: ProfileTab) => {
    if (!profile) return;
    setPostsLoading(true);
    try {
      let query;
      switch (tab) {
        case 'posts':
          query = supabase.from('posts').select('*, profiles(*)').eq('user_id', profile.id).is('parent_id', null).order('created_at', { ascending: false }).limit(50);
          break;
        case 'replies':
          query = supabase.from('posts').select('*, profiles(*)').eq('user_id', profile.id).not('parent_id', 'is', null).order('created_at', { ascending: false }).limit(50);
          break;
        case 'media':
          query = supabase.from('posts').select('*, profiles(*)').eq('user_id', profile.id).contains('media_urls', []).not('media_urls', 'eq', '{}').order('created_at', { ascending: false }).limit(50);
          break;
        case 'likes':
          query = supabase.from('likes').select('post_id, posts(*, profiles(*))').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50);
          break;
        case 'bookmarks':
          if (!isOwnProfile) { setPosts([]); setPostsLoading(false); return; }
          query = supabase.from('bookmarks').select('post_id, posts(*, profiles(*))').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50);
          break;
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let postsData: Post[];
      if (tab === 'likes' || tab === 'bookmarks') {
        postsData = (data ?? []).map((item: { posts: unknown }) => item.posts as Post).filter(Boolean) as Post[];
      } else {
        postsData = (data ?? []) as Post[];
      }

      // Mark likes and bookmarks
      if (myUser) {
        const postIds = postsData.map((p) => p.id);
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', myUser.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', myUser.id).in('post_id', postIds),
        ]);
        const likedSet = new Set((likesRes.data ?? []).map((l: { post_id: string }) => l.post_id));
        const bookmarkedSet = new Set((bookmarksRes.data ?? []).map((b: { post_id: string }) => b.post_id));
        postsData = postsData.map((p) => ({
          ...p,
          liked_by_me: likedSet.has(p.id),
          bookmarked_by_me: bookmarkedSet.has(p.id),
        }));
      }

      setPosts(postsData);
    } catch (err) {
      console.error('[ProfilePage] Erro ao buscar posts da aba:', err);
    } finally {
      setPostsLoading(false);
    }
  }, [profile, myUser, isOwnProfile]);

  useEffect(() => {
    if (profile) {
      fetchTabPosts(activeTab);
    }
  }, [profile, activeTab, fetchTabPosts]);

  const handleFollow = useCallback(async () => {
    if (!myUser || !profile) { navigate('/auth'); return; }
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount((c) => wasFollowing ? c - 1 : c + 1);

    try {
      if (wasFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', myUser.id).eq('following_id', profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: myUser.id, following_id: profile.id });
        if (error) throw error;
      }
    } catch (err) {
      console.error('[ProfilePage] Erro ao seguir/deixar de seguir:', err);
      setIsFollowing(wasFollowing);
      setFollowersCount((c) => wasFollowing ? c + 1 : c - 1);
    } finally {
      setFollowLoading(false);
    }
  }, [myUser, profile, isFollowing, navigate]);

  async function handleAvatarUpload(file: File) {
    if (!myProfile) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${myProfile.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', myProfile.id);
      if (updateError) throw updateError;
      setProfile((prev) => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev);
      setStoreProfile({ ...myProfile, avatar_url: urlData.publicUrl });
    } catch (err) {
      console.error('[ProfilePage] Erro ao fazer upload do avatar:', err);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBannerUpload(file: File) {
    if (!myProfile) return;
    setUploadingBanner(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${myProfile.id}/banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.from('profiles').update({ banner_url: urlData.publicUrl }).eq('id', myProfile.id);
      if (updateError) throw updateError;
      setProfile((prev) => prev ? { ...prev, banner_url: urlData.publicUrl } : prev);
      setStoreProfile({ ...myProfile, banner_url: urlData.publicUrl });
    } catch (err) {
      console.error('[ProfilePage] Erro ao fazer upload do banner:', err);
    } finally {
      setUploadingBanner(false);
    }
  }

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'posts', label: 'Posts' },
    { id: 'replies', label: 'Respostas' },
    { id: 'media', label: 'Mídia' },
    { id: 'likes', label: 'Curtidas' },
    ...(isOwnProfile ? [{ id: 'bookmarks' as ProfileTab, label: 'Salvos' }] : []),
  ];

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-8">
        <p className="text-white text-2xl font-bold mb-2">{error ?? 'Perfil não encontrado'}</p>
        <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline mt-4">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Modals */}
      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setProfile((prev) => prev ? { ...prev, ...updated } : prev);
            if (myProfile) setStoreProfile({ ...myProfile, ...updated });
          }}
        />
      )}
      {show2FASetup && session && (
        <TwoFASetup
          accessToken={session.access_token}
          onClose={() => setShow2FASetup(false)}
          onEnabled={() => setProfile((prev) => prev ? { ...prev, totp_enabled: true } : prev)}
        />
      )}

      {/* Header back button */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm z-20 flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-900 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
            <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
          </svg>
        </button>
        <div>
          <h1 className="text-white font-bold text-xl">{profile.display_name ?? profile.username}</h1>
          <p className="text-gray-500 text-sm">{posts.length > 0 ? `${posts.length} posts` : ''}</p>
        </div>
      </div>

      {/* Banner */}
      <div
        className="h-48 bg-gray-800 relative group cursor-pointer"
        onClick={() => isOwnProfile && bannerInputRef.current?.click()}
      >
        {profile.banner_url && (
          <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
        )}
        {isOwnProfile && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingBanner ? (
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                <path d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13z" />
              </svg>
            )}
          </div>
        )}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleBannerUpload(e.target.files[0]); }}
        />
      </div>

      {/* Avatar + Actions */}
      <div className="px-4 pb-4">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <div
            className="relative group cursor-pointer"
            onClick={() => isOwnProfile && avatarInputRef.current?.click()}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? profile.username}
                className="w-24 h-24 rounded-full object-cover border-4 border-black"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-700 border-4 border-black flex items-center justify-center">
                <span className="text-white font-bold text-3xl">
                  {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {isOwnProfile && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                    <path d="M14.536 21.686a.5.5 0 0 0 .036-.509l-7-14A.5.5 0 0 0 7 7.045V17a.5.5 0 0 0 .724.447l4.764-2.382 1.09 3.452a.5.5 0 0 0 .958-.83z" />
                  </svg>
                )}
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }}
            />
          </div>

          <div className="flex gap-2">
            {isOwnProfile ? (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="border border-gray-600 text-white font-bold px-4 py-1.5 rounded-full hover:bg-gray-900 transition-colors text-sm"
                >
                  Editar perfil
                </button>
                {!profile.totp_enabled && (
                  <button
                    onClick={() => setShow2FASetup(true)}
                    className="border border-gray-600 text-white font-bold px-4 py-1.5 rounded-full hover:bg-gray-900 transition-colors text-sm"
                  >
                    Ativar 2FA
                  </button>
                )}
                {profile.totp_enabled && (
                  <span className="flex items-center gap-1 text-green-500 text-sm font-medium">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    2FA ativo
                  </span>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate(`/messages?user=${profile.username}`)}
                  className="border border-gray-600 text-white font-bold p-2 rounded-full hover:bg-gray-900 transition-colors"
                  title="Enviar mensagem"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5a.5.5 0 00-.5.5l9 6 9-6a.5.5 0 00-.5-.5h-17z" />
                  </svg>
                </button>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`font-bold px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50 ${
                    isFollowing
                      ? 'border border-gray-600 text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {followLoading ? '...' : isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profile info */}
        <div className="space-y-3">
          <div>
            <h2 className="text-white font-extrabold text-xl">{profile.display_name ?? profile.username}</h2>
            <p className="text-gray-500">@{profile.username}</p>
          </div>

          {profile.bio && <p className="text-white whitespace-pre-wrap">{profile.bio}</p>}

          <p className="text-gray-500 text-sm">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current inline mr-1">
              <path d="M7 4V2H5v2H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-2V2h-2v2H7zm-2 4h14v12H5V8zm2 2v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z" />
            </svg>
            Entrou em {new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>

          <div className="flex gap-5">
            <button
              onClick={() => navigate(`/profile/${profile.username}/following`)}
              className="text-sm hover:underline"
            >
              <span className="text-white font-bold">{followingCount}</span>
              <span className="text-gray-500 ml-1">Seguindo</span>
            </button>
            <button
              onClick={() => navigate(`/profile/${profile.username}/followers`)}
              className="text-sm hover:underline"
            >
              <span className="text-white font-bold">{followersCount}</span>
              <span className="text-gray-500 ml-1">Seguidores</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-4 text-sm font-medium whitespace-nowrap transition-colors hover:bg-gray-900 relative min-w-0 ${
              activeTab === tab.id ? 'text-white' : 'text-gray-500'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {postsLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!postsLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <p className="text-white text-2xl font-bold mb-2">
            {activeTab === 'posts' && 'Nenhum post ainda'}
            {activeTab === 'replies' && 'Nenhuma resposta ainda'}
            {activeTab === 'media' && 'Nenhuma mídia ainda'}
            {activeTab === 'likes' && 'Nenhuma curtida ainda'}
            {activeTab === 'bookmarks' && 'Nenhum post salvo ainda'}
          </p>
          <p className="text-gray-500 text-sm">
            {activeTab === 'bookmarks' && 'Posts salvos aparecerão aqui.'}
          </p>
        </div>
      )}

      {!postsLoading && posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
        />
      ))}
    </div>
  );
}
