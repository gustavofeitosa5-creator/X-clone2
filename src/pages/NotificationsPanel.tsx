import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import type { Notification, Profile, Post } from '@/types';

interface EnrichedNotification extends Notification {
  actor: Profile | null;
  post: Post | null;
}

function NotificationSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-4 border-b border-gray-800 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-800 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-800 rounded w-3/4" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
      </div>
    </div>
  );
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'follow':
      return (
        <div className="bg-blue-500/20 rounded-full p-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-500">
            <path d="M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44zM12 2C9.791 2 8 3.791 8 6s1.791 4 4 4 4-1.791 4-4-1.791-4-4-4z" />
          </svg>
        </div>
      );
    case 'like':
      return (
        <div className="bg-pink-600/20 rounded-full p-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-pink-600">
            <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z" />
          </svg>
        </div>
      );
    case 'repost':
      return (
        <div className="bg-green-500/20 rounded-full p-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-500">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
          </svg>
        </div>
      );
    case 'mention':
      return (
        <div className="bg-blue-400/20 rounded-full p-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-400">
            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-13h-2v2H9v2h2v2h2v-2h2v-2h-2V7zm-1 6a3 3 0 100 6 3 3 0 000-6z" />
          </svg>
        </div>
      );
  }
}

function NotificationItem({
  notification,
  onMarkRead,
  onFollowBack,
}: {
  notification: EnrichedNotification;
  onMarkRead: (id: string) => void;
  onFollowBack: (actorId: string) => void;
}) {
  const navigate = useNavigate();
  const myUser = useStore((s) => s.user);
  const [followingBack, setFollowingBack] = useState(false);

  const actorName = notification.actor?.display_name ?? notification.actor?.username ?? 'Alguém';
  const actorUsername = notification.actor?.username ?? '';

  async function handleFollowBack() {
    if (!myUser || !notification.actor_id) return;
    setFollowingBack(true);
    try {
      await supabase.from('follows').insert({
        follower_id: myUser.id,
        following_id: notification.actor_id,
      });
      onFollowBack(notification.actor_id);
    } catch (err) {
      console.error('[NotificationItem] Erro ao seguir de volta:', err);
    } finally {
      setFollowingBack(false);
    }
  }

  function handleClick() {
    onMarkRead(notification.id);
    if (notification.type === 'follow') {
      navigate(`/profile/${actorUsername}`);
    } else if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`flex gap-3 px-4 py-4 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-950/50 ${
        !notification.read ? 'bg-blue-500/5' : ''
      }`}
    >
      {!notification.read && (
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2 -ml-0.5" />
      )}

      <NotificationIcon type={notification.type} />

      <div className="flex-1 min-w-0">
        {/* Actor avatar */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link
            to={`/profile/${actorUsername}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            {notification.actor?.avatar_url ? (
              <img
                src={notification.actor.avatar_url}
                alt={actorName}
                className="w-10 h-10 rounded-full object-cover hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{actorName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </Link>

          {notification.type === 'follow' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleFollowBack(); }}
              disabled={followingBack}
              className="border border-gray-600 text-white font-bold px-4 py-1 rounded-full text-sm hover:bg-gray-900 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {followingBack ? '...' : 'Seguir de volta'}
            </button>
          )}
        </div>

        {/* Message */}
        <p className="text-white text-sm leading-relaxed">
          <Link
            to={`/profile/${actorUsername}`}
            onClick={(e) => e.stopPropagation()}
            className="font-bold hover:underline"
          >
            {actorName}
          </Link>{' '}
          {notification.type === 'follow' && 'começou a seguir você.'}
          {notification.type === 'like' && 'curtiu seu post.'}
          {notification.type === 'repost' && 'repostou seu post.'}
          {notification.type === 'mention' && 'mencionou você em um post.'}
        </p>

        {/* Post preview */}
        {notification.post && notification.type !== 'follow' && (
          <p className="text-gray-500 text-sm mt-1 truncate">
            {notification.post.content}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-gray-600 text-xs mt-1">
          {new Date(notification.created_at).toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

export default function NotificationsPanel() {
  const myUser = useStore((s) => s.user);
  const { setNotifications, markAsRead, markAllAsRead, addNotification } = useStore();

  const [notifications, setLocalNotifications] = useState<EnrichedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());

  const enrichNotification = useCallback(
    async (notif: Notification): Promise<EnrichedNotification> => {
      const [actorRes, postRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', notif.actor_id).single(),
        notif.post_id
          ? supabase.from('posts').select('*').eq('id', notif.post_id).single()
          : Promise.resolve({ data: null }),
      ]);
      return {
        ...notif,
        actor: actorRes.data as Profile | null,
        post: postRes.data as Post | null,
      };
    },
    []
  );

  const fetchNotifications = useCallback(async () => {
    if (!myUser) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', myUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const raw = (data ?? []) as Notification[];
      const enriched = await Promise.all(raw.map(enrichNotification));
      setLocalNotifications(enriched);
      setNotifications(raw);
    } catch (err) {
      console.error('[NotificationsPanel] Erro ao buscar notificações:', err);
      setError('Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }, [myUser, enrichNotification, setNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!myUser) return;

    const channel = supabase
      .channel(`notifications-${myUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${myUser.id}`,
        },
        async (payload) => {
          const newNotif = payload.new as Notification;
          try {
            const enriched = await enrichNotification(newNotif);
            setLocalNotifications((prev) => [enriched, ...prev]);
            addNotification(newNotif);
          } catch (err) {
            console.error('[NotificationsPanel] Erro ao enriquecer notificação realtime:', err);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [myUser, enrichNotification, addNotification]);

  async function handleMarkRead(id: string) {
    markAsRead(id);
    setLocalNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    } catch (err) {
      console.error('[NotificationsPanel] Erro ao marcar como lida:', err);
    }
  }

  async function handleMarkAllRead() {
    if (!myUser) return;
    markAllAsRead();
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', myUser.id)
        .eq('read', false);
    } catch (err) {
      console.error('[NotificationsPanel] Erro ao marcar todas como lidas:', err);
    }
  }

  function handleFollowBack(actorId: string) {
    setFollowedBack((prev) => new Set(prev).add(actorId));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-20 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Notificações</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-blue-500 hover:underline text-sm font-medium"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="m-4 p-4 rounded-lg bg-red-900/40 border border-red-700">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={fetchNotifications} className="text-blue-500 text-sm mt-2 hover:underline">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div>
          {Array.from({ length: 8 }).map((_, i) => <NotificationSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-white text-2xl font-bold mb-2">Nenhuma notificação</p>
          <p className="text-gray-500">
            Quando alguém interagir com você, as notificações aparecerão aqui.
          </p>
        </div>
      )}

      {/* Notifications list */}
      {!loading && notifications.map((notif) => {
        const isFollowedBack = notif.type === 'follow' && followedBack.has(notif.actor_id);
        return (
          <NotificationItem
            key={notif.id}
            notification={isFollowedBack ? { ...notif, type: 'follow' } : notif}
            onMarkRead={handleMarkRead}
            onFollowBack={handleFollowBack}
          />
        );
      })}
    </div>
  );
}
