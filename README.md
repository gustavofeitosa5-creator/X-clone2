# X Clone — Full-Stack

Clone de alta fidelidade da rede social X (Twitter) com E2EE para mensagens diretas.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Tailwind CSS v4, Vite, React Router v6, Zustand
- **Backend:** Node.js + Express (para 2FA e uploads administrativos)
- **Banco de dados:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Criptografia:** Web Crypto API nativa (ECDH P-256 + AES-GCM 256-bit)

## Funcionalidades

- ✅ Feed "Para você" e "Seguindo"
- ✅ Composer de posts com threads, emojis, upload de mídia
- ✅ Respostas inline, reposts, citar posts
- ✅ Curtidas e bookmarks com estado otimista
- ✅ Perfis com banner, avatar, bio, seguidores/seguindo
- ✅ Mensagens diretas E2EE (criptografia de ponta a ponta)
- ✅ Notificações em tempo real via Supabase Realtime
- ✅ Busca full-text de posts e usuários
- ✅ Trending hashtags
- ✅ Autenticação 2FA (TOTP) via Google Authenticator
- ✅ OAuth (Google, GitHub)

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute o script `supabase/schema.sql` no SQL Editor do Supabase
3. Ative o Realtime para as tabelas: `posts`, `notifications`, `messages`
4. Configure os provedores OAuth em Authentication > Providers

### 2. Variáveis de Ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais do Supabase
```

### 3. Frontend

```bash
npm install
npm run dev
```

### 4. Backend (opcional, necessário para 2FA)

```bash
cd backend
npm install
npm run dev
```

## Arquitetura E2EE

As mensagens diretas são criptografadas no cliente usando:

1. **Geração de chaves:** ECDH P-256 — par de chaves por usuário
2. **Armazenamento:** Chave privada no IndexedDB (`extractable: false`)
3. **Chave pública:** Armazenada no Supabase (campo `profiles.public_key`)
4. **Troca de segredo:** ECDH → AES-GCM 256-bit (deriveKey)
5. **Criptografia:** AES-GCM com IV aleatório de 12 bytes por mensagem

O servidor **nunca** vê texto puro ou chaves privadas.

## Estrutura do Projeto

```
src/
├── components/      # PostCard, Sidebar, TrendingTopics
├── hooks/           # useAuth, useSession
├── layouts/         # Layout (3 colunas)
├── lib/             # supabase client, database types
├── pages/           # FeedPage, ProfilePage, ChatLive, etc.
├── store/           # Zustand store (auth, notifications, chat)
├── types/           # TypeScript types
└── utils/           # cryptoUtils, authUtils

supabase/
└── schema.sql       # Schema completo com RLS, triggers, funções
```
