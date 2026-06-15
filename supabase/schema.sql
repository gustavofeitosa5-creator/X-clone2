-- ============================================================
-- X CLONE — SCHEMA COMPLETO
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABELA: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  banner_url      TEXT,
  public_key      TEXT,
  totp_secret     TEXT,
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 280),
  media_urls  TEXT[] NOT NULL DEFAULT '{}',
  parent_id   UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  repost_id   UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tsv         TSVECTOR GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED
);

-- ============================================================
-- TABELA: follows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- ============================================================
-- TABELA: likes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.likes (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================
-- TABELA: bookmarks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================
-- TABELA: messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  iv                TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('follow', 'like', 'mention', 'repost')),
  post_id     UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: hashtags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hashtags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag         TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: post_hashtags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id  UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_tsv ON public.posts USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_parent_id ON public.posts (parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (sender_id, receiver_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags  ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- posts policies
CREATE POLICY "posts_select_public"
  ON public.posts FOR SELECT USING (true);

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- follows policies
CREATE POLICY "follows_select_public"
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- likes policies
CREATE POLICY "likes_select_public"
  ON public.likes FOR SELECT USING (true);

CREATE POLICY "likes_insert_own"
  ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete_own"
  ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- bookmarks policies
CREATE POLICY "bookmarks_select_own"
  ON public.bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_insert_own"
  ON public.bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_delete_own"
  ON public.bookmarks FOR DELETE USING (auth.uid() = user_id);

-- messages policies
CREATE POLICY "messages_select_participants"
  ON public.messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "messages_insert_sender"
  ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- notifications policies
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- hashtags policies
CREATE POLICY "hashtags_select_public"
  ON public.hashtags FOR SELECT USING (true);

CREATE POLICY "hashtags_insert_authenticated"
  ON public.hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- post_hashtags policies
CREATE POLICY "post_hashtags_select_public"
  ON public.post_hashtags FOR SELECT USING (true);

CREATE POLICY "post_hashtags_insert_authenticated"
  ON public.post_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- TRIGGER: on_auth_user_created
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suggested_username TEXT;
  provided_username TEXT;
BEGIN
  -- Tenta obter o username fornecido pelo usuário
  provided_username := LOWER(TRIM(NEW.raw_user_meta_data->>'username'));
  
  IF provided_username IS NOT NULL AND provided_username != '' THEN
    -- Verifica se o username é válido (apenas letras, números e underscore)
    IF provided_username ~ '^[a-z0-9_]+$' THEN
      suggested_username := provided_username;
      -- Garante unicidade adicionando sufixo numérico se necessário
      WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = suggested_username) LOOP
        suggested_username := suggested_username || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
      END LOOP;
    ELSE
      -- Username inválido, gera baseado no email
      suggested_username := LOWER(
        REGEXP_REPLACE(
          SPLIT_PART(NEW.email, '@', 1),
          '[^a-z0-9_]', '_', 'g'
        )
      );
      WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = suggested_username) LOOP
        suggested_username := suggested_username || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
      END LOOP;
    END IF;
  ELSE
    -- Nenhum username fornecido, gera baseado no email
    suggested_username := LOWER(
      REGEXP_REPLACE(
        SPLIT_PART(NEW.email, '@', 1),
        '[^a-z0-9_]', '_', 'g'
      )
    );
    -- Garante unicidade adicionando sufixo numérico se necessário
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = suggested_username) LOOP
      suggested_username := suggested_username || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    suggested_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: on_post_insert_extract_hashtags
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_post_hashtags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hashtag_match TEXT;
  hashtag_id    UUID;
BEGIN
  FOR hashtag_match IN
    SELECT LOWER(m[1])
    FROM REGEXP_MATCHES(NEW.content, '#([A-Za-z0-9_]+)', 'g') AS m
  LOOP
    INSERT INTO public.hashtags (tag)
    VALUES (hashtag_match)
    ON CONFLICT (tag) DO NOTHING;

    SELECT id INTO hashtag_id FROM public.hashtags WHERE tag = hashtag_match;

    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, hashtag_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_insert_extract_hashtags ON public.posts;
CREATE TRIGGER on_post_insert_extract_hashtags
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_hashtags();

-- ============================================================
-- TRIGGER: on_follow_insert_notify
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_insert_notify ON public.follows;
CREATE TRIGGER on_follow_insert_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_notification();

-- ============================================================
-- TRIGGER: on_like_insert_notify
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id UUID;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;

  IF post_owner_id IS NOT NULL AND post_owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (post_owner_id, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_like_insert_notify ON public.likes;
CREATE TRIGGER on_like_insert_notify
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_like_notification();

-- ============================================================
-- TRIGGER: on_post_mention_notify
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_username TEXT;
  mentioned_user_id UUID;
BEGIN
  FOR mention_username IN
    SELECT LOWER(m[1])
    FROM REGEXP_MATCHES(NEW.content, '@([A-Za-z0-9_]+)', 'g') AS m
  LOOP
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE username = mention_username;

    IF mentioned_user_id IS NOT NULL AND mentioned_user_id <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, post_id)
      VALUES (mentioned_user_id, NEW.user_id, 'mention', NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_mention_notify ON public.posts;
CREATE TRIGGER on_post_mention_notify
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_mention_notification();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('post-media', 'post-media', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: avatars
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies: post-media
CREATE POLICY "post_media_select_public"
  ON storage.objects FOR SELECT USING (bucket_id = 'post-media');

CREATE POLICY "post_media_insert_authenticated"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'post-media'
    AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- RPC: search_posts
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_posts(query text)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.posts
  WHERE tsv @@ plainto_tsquery('portuguese', query)
  ORDER BY ts_rank(tsv, plainto_tsquery('portuguese', query)) DESC
  LIMIT 20;
$$;

-- ============================================================
-- RPC: get_trending_hashtags
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_trending_hashtags()
RETURNS TABLE(tag TEXT, count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT h.tag, COUNT(ph.post_id) AS count
  FROM public.post_hashtags ph
  JOIN public.hashtags h ON ph.hashtag_id = h.id
  JOIN public.posts p ON ph.post_id = p.id
  WHERE p.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY h.tag
  ORDER BY count DESC
  LIMIT 10;
$$;

-- ============================================================
-- RPC: get_feed_for_you (score-based)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_feed_for_you()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  content TEXT,
  media_urls TEXT[],
  parent_id UUID,
  repost_id UUID,
  created_at TIMESTAMPTZ,
  tsv TSVECTOR,
  likes_count BIGINT,
  reposts_count BIGINT,
  replies_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.user_id,
    p.content,
    p.media_urls,
    p.parent_id,
    p.repost_id,
    p.created_at,
    p.tsv,
    COUNT(DISTINCT l.user_id) AS likes_count,
    COUNT(DISTINCT r.id) AS reposts_count,
    COUNT(DISTINCT rp.id) AS replies_count
  FROM public.posts p
  LEFT JOIN public.likes l ON l.post_id = p.id
  LEFT JOIN public.posts r ON r.repost_id = p.id
  LEFT JOIN public.posts rp ON rp.parent_id = p.id
  WHERE p.created_at > NOW() - INTERVAL '7 days'
    AND p.parent_id IS NULL
  GROUP BY p.id
  ORDER BY (COUNT(DISTINCT l.user_id) * 2 + COUNT(DISTINCT r.id) * 3) DESC, p.created_at DESC
  LIMIT 50;
$$;
