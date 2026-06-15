export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          public_key?: string | null;
          totp_secret?: string | null;
          totp_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          public_key?: string | null;
          totp_secret?: string | null;
          totp_enabled?: boolean;
          created_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          media_urls: string[];
          parent_id: string | null;
          repost_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          media_urls?: string[];
          parent_id?: string | null;
          repost_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          media_urls?: string[];
          parent_id?: string | null;
          repost_id?: string | null;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      likes: {
        Row: {
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
      };
      bookmarks: {
        Row: {
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          encrypted_content: string;
          iv: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          encrypted_content: string;
          iv: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          encrypted_content?: string;
          iv?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          type: 'follow' | 'like' | 'mention' | 'repost';
          post_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          type: 'follow' | 'like' | 'mention' | 'repost';
          post_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string;
          type?: 'follow' | 'like' | 'mention' | 'repost';
          post_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
      };
      hashtags: {
        Row: {
          id: string;
          tag: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tag: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tag?: string;
          created_at?: string;
        };
      };
      post_hashtags: {
        Row: {
          post_id: string;
          hashtag_id: string;
        };
        Insert: {
          post_id: string;
          hashtag_id: string;
        };
        Update: {
          post_id?: string;
          hashtag_id?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_posts: {
        Args: { query: string };
        Returns: Database['public']['Tables']['posts']['Row'][];
      };
      get_trending_hashtags: {
        Args: Record<string, never>;
        Returns: { tag: string; count: number }[];
      };
      get_feed_for_you: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          user_id: string;
          content: string;
          media_urls: string[];
          parent_id: string | null;
          repost_id: string | null;
          created_at: string;
          likes_count: number;
          reposts_count: number;
          replies_count: number;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
