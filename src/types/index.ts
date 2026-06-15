import type { Session, User } from '@supabase/supabase-js';

export type { Session, User };

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  public_key: string | null;
  totp_secret: string | null;
  totp_enabled: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  parent_id: string | null;
  repost_id: string | null;
  created_at: string;
  profiles?: Profile | null;
  _count?: {
    likes: number;
    reposts: number;
    replies: number;
    bookmarks: number;
  };
  liked_by_me?: boolean;
  bookmarked_by_me?: boolean;
  reposted_by_me?: boolean;
  parent_post?: Post | null;
  repost_post?: Post | null;
  reposted_by?: Profile | null;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Like {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Bookmark {
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  decrypted_content?: string;
  sender?: Profile | null;
  receiver?: Profile | null;
}

export interface Conversation {
  partner: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'follow' | 'like' | 'mention' | 'repost';
  post_id: string | null;
  read: boolean;
  created_at: string;
  actor?: Profile | null;
  post?: Post | null;
}

export interface TrendingHashtag {
  tag: string;
  count: number;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  requiresTOTP: boolean;
}

export interface NotificationState {
  unreadCount: number;
  notifications: Notification[];
}

export interface ChatState {
  activeConversation: string | null;
  conversations: Conversation[];
  sharedSecrets: Map<string, CryptoKey>;
}
