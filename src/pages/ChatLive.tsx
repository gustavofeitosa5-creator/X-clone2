import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import {
  importPublicKey,
  loadPrivateKeyFromIDB,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from '@/utils/cryptoUtils';
import type { Message, Profile } from '@/types';

interface ConversationPartner {
  profile: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

interface DecryptedMessage extends Message {
  decrypted_content: string;
  decryptionError?: boolean;
}

function ConversationSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-gray-800 flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-4 bg-gray-800 rounded w-28" />
        <div className="h-3 bg-gray-800 rounded w-44" />
      </div>
    </div>
  );
}

function MessageBubble({ message, isMine }: { message: DecryptedMessage; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-2xl ${
          isMine
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-gray-800 text-white rounded-bl-sm'
        }`}
      >
        <p className="text-sm leading-relaxed break-words">
          {message.decryptionError ? (
            <span className="text-gray-300 italic">🔒 Não foi possível descriptografar esta mensagem</span>
          ) : (
            message.decrypted_content
          )}
        </p>
        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs opacity-60">
            {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs opacity-60" title="Criptografia de ponta a ponta">🔒</span>
        </div>
      </div>
    </div>
  );
}

export default function ChatLive() {
  const myUser = useStore((s) => s.user);
  const myProfile = useStore((s) => s.profile);
  const { cacheSharedSecret, getSharedSecret, setActiveConversation } = useStore();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState<ConversationPartner[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [newConversationUsername, setNewConversationUsername] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle ?user= query param for starting a conversation
  useEffect(() => {
    const targetUsername = searchParams.get('user');
    if (targetUsername && myUser) {
      supabase
        .from('profiles')
        .select('*')
        .eq('username', targetUsername)
        .single()
        .then(({ data }: { data: Profile | null }) => {
          if (data) openConversation(data.id);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, myUser]);

  const fetchConversations = useCallback(async () => {
    if (!myUser) { setLoadingConversations(false); return; }
    setLoadingConversations(true);
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myUser.id},receiver_id.eq.${myUser.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      const msgs = (messagesData ?? []) as Message[];
      // Group by conversation partner
      const partnerMap = new Map<string, Message>();
      for (const msg of msgs) {
        const partnerId = msg.sender_id === myUser.id ? msg.receiver_id : msg.sender_id;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, msg);
        }
      }

      const partnerIds = Array.from(partnerMap.keys());
      if (partnerIds.length === 0) {
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', partnerIds);

      const profileMap = new Map(
        ((profilesData ?? []) as Profile[]).map((p) => [p.id, p])
      );

      const convs: ConversationPartner[] = partnerIds
        .map((id) => ({
          profile: profileMap.get(id)!,
          lastMessage: partnerMap.get(id) ?? null,
          unreadCount: 0,
        }))
        .filter((c) => c.profile != null);

      setConversations(convs);
    } catch (err) {
      console.error('[ChatLive] Erro ao buscar conversas:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [myUser]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const getOrDeriveSharedSecret = useCallback(
    async (partnerId: string, partnerPublicKeyJwk: string): Promise<CryptoKey | null> => {
      const cached = getSharedSecret(partnerId);
      if (cached) return cached;

      if (!myUser) return null;

      try {
        const myPrivateKey = await loadPrivateKeyFromIDB(myUser.id);
        if (!myPrivateKey) {
          setCryptoError('Chave privada não encontrada neste dispositivo. O histórico de mensagens não pode ser descriptografado aqui.');
          return null;
        }

        const theirPublicKey = await importPublicKey(partnerPublicKeyJwk);
        const sharedSecret = await deriveSharedSecret(myPrivateKey, theirPublicKey);
        cacheSharedSecret(partnerId, sharedSecret);
        return sharedSecret;
      } catch (err) {
        console.error('[ChatLive] Erro ao derivar segredo compartilhado:', err);
        setCryptoError('Erro criptográfico ao estabelecer canal seguro.');
        return null;
      }
    },
    [myUser, getSharedSecret, cacheSharedSecret]
  );

  const decryptMessages = useCallback(
    async (msgs: Message[], sharedSecret: CryptoKey): Promise<DecryptedMessage[]> => {
      return Promise.all(
        msgs.map(async (msg) => {
          try {
            const decrypted = await decryptMessage(sharedSecret, msg.encrypted_content, msg.iv);
            return { ...msg, decrypted_content: decrypted, decryptionError: false };
          } catch (err) {
            console.error('[ChatLive] Erro ao descriptografar mensagem:', err);
            return { ...msg, decrypted_content: '', decryptionError: true };
          }
        })
      );
    },
    []
  );

  const openConversation = useCallback(
    async (partnerId: string) => {
      if (!myUser) return;
      setActivePartnerId(partnerId);
      setActiveConversation(partnerId);
      setMessages([]);
      setCryptoError(null);
      setLoadingMessages(true);

      try {
        // Fetch partner profile
        const { data: partnerData, error: partnerError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', partnerId)
          .single();

        if (partnerError || !partnerData) throw new Error('Parceiro não encontrado');
        const partner = partnerData as Profile;
        setActivePartner(partner);

        // Add to conversations if not already there
        setConversations((prev) => {
          if (!prev.some((c) => c.profile.id === partnerId)) {
            return [{ profile: partner, lastMessage: null, unreadCount: 0 }, ...prev];
          }
          return prev;
        });

        // Fetch messages
        const { data: msgsData, error: msgsError } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${myUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myUser.id})`
          )
          .order('created_at', { ascending: true });

        if (msgsError) throw msgsError;

        const rawMessages = (msgsData ?? []) as Message[];

        if (rawMessages.length === 0 || !partner.public_key) {
          setMessages([]);
          setLoadingMessages(false);
          return;
        }

        const sharedSecret = await getOrDeriveSharedSecret(partnerId, partner.public_key);
        if (!sharedSecret) { setLoadingMessages(false); return; }

        const decrypted = await decryptMessages(rawMessages, sharedSecret);
        setMessages(decrypted);
      } catch (err) {
        console.error('[ChatLive] Erro ao abrir conversa:', err);
        setCryptoError('Erro ao carregar mensagens.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [myUser, getOrDeriveSharedSecret, decryptMessages, setActiveConversation]
  );

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!myUser || !activePartnerId) return;

    const channel = supabase
      .channel(`chat-${myUser.id}-${activePartnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${myUser.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id !== activePartnerId) return;

          const sharedSecret = getSharedSecret(activePartnerId);
          if (!sharedSecret) {
            setMessages((prev) => [
              ...prev,
              { ...newMsg, decrypted_content: '', decryptionError: true },
            ]);
            return;
          }

          try {
            const decryptedText = await decryptMessage(sharedSecret, newMsg.encrypted_content, newMsg.iv);
            setMessages((prev) => [
              ...prev,
              { ...newMsg, decrypted_content: decryptedText, decryptionError: false },
            ]);
          } catch (err) {
            console.error('[ChatLive] Erro ao descriptografar mensagem recebida:', err);
            setMessages((prev) => [
              ...prev,
              { ...newMsg, decrypted_content: '', decryptionError: true },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [myUser, activePartnerId, getSharedSecret]);

  async function handleSendMessage() {
    if (!myUser || !myProfile || !activePartnerId || !activePartner || !newMessage.trim()) return;
    if (!activePartner.public_key) {
      setSendError('Este usuário não possui chave pública configurada. E2EE não disponível.');
      return;
    }

    setSendingMessage(true);
    setSendError(null);

    try {
      const sharedSecret = await getOrDeriveSharedSecret(activePartnerId, activePartner.public_key);
      if (!sharedSecret) {
        setSendError('Não foi possível estabelecer canal seguro.');
        return;
      }

      const { encryptedBase64, ivBase64 } = await encryptMessage(sharedSecret, newMessage.trim());

      const { data: sentMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: myUser.id,
          receiver_id: activePartnerId,
          encrypted_content: encryptedBase64,
          iv: ivBase64,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add decrypted version locally for immediate display
      setMessages((prev) => [
        ...prev,
        {
          ...(sentMsg as Message),
          decrypted_content: newMessage.trim(),
          decryptionError: false,
        },
      ]);

      setNewMessage('');
      textareaRef.current?.focus();

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.profile.id === activePartnerId
            ? { ...c, lastMessage: sentMsg as Message }
            : c
        )
      );
    } catch (err) {
      console.error('[ChatLive] Erro ao enviar mensagem:', err);
      setSendError('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSearchAndStart() {
    if (!newConversationUsername.trim() || !myUser) return;
    setSearchingUser(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', newConversationUsername.trim().toLowerCase())
        .single();
      if (error || !data) {
        setCryptoError('Usuário não encontrado.');
        setSearchingUser(false);
        return;
      }
      const partner = data as Profile;
      if (partner.id === myUser.id) {
        setCryptoError('Você não pode enviar mensagens para si mesmo.');
        setSearchingUser(false);
        return;
      }
      setNewConversationUsername('');
      await openConversation(partner.id);
    } catch (err) {
      console.error('[ChatLive] Erro ao buscar usuário:', err);
    } finally {
      setSearchingUser(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Conversations Panel */}
      <div className={`flex flex-col border-r border-gray-800 ${activePartnerId ? 'hidden md:flex md:w-80 lg:w-96' : 'flex flex-1 md:flex md:w-80 lg:w-96'}`}>
        <div className="sticky top-0 bg-black border-b border-gray-800 px-4 py-3 z-10">
          <h1 className="text-xl font-bold text-white mb-3">Mensagens</h1>
          {/* New conversation search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newConversationUsername}
              onChange={(e) => setNewConversationUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchAndStart()}
              placeholder="Buscar por @username..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleSearchAndStart}
              disabled={!newConversationUsername.trim() || searchingUser}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2 rounded-full text-sm disabled:opacity-50 transition-colors"
            >
              {searchingUser ? '...' : 'Ir'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations && (
            <div>{Array.from({ length: 5 }).map((_, i) => <ConversationSkeleton key={i} />)}</div>
          )}

          {!loadingConversations && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-white font-bold text-xl mb-2">Nenhuma mensagem ainda</p>
              <p className="text-gray-500 text-sm">
                Inicie uma conversa buscando pelo @username acima.
              </p>
            </div>
          )}

          {!loadingConversations && conversations.map((conv) => (
            <button
              key={conv.profile.id}
              onClick={() => openConversation(conv.profile.id)}
              className={`w-full flex gap-3 px-4 py-3 hover:bg-gray-900 transition-colors text-left border-b border-gray-800 ${
                activePartnerId === conv.profile.id ? 'bg-gray-900' : ''
              }`}
            >
              {conv.profile.avatar_url ? (
                <img
                  src={conv.profile.avatar_url}
                  alt={conv.profile.display_name ?? conv.profile.username}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {(conv.profile.display_name ?? conv.profile.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-white font-bold text-sm truncate">
                    {conv.profile.display_name ?? conv.profile.username}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-gray-500 text-xs flex-shrink-0 ml-2">
                      {new Date(conv.lastMessage.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  )}
                </div>
                <p className="text-gray-500 text-sm truncate">@{conv.profile.username}</p>
                {conv.lastMessage && (
                  <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                    <span>🔒</span>
                    <span>Mensagem criptografada</span>
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Panel */}
      <div className={`flex flex-col flex-1 ${activePartnerId ? 'flex' : 'hidden md:flex'}`}>
        {!activePartnerId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-white text-2xl font-bold mb-2">Suas mensagens</p>
            <p className="text-gray-500 mb-6">
              Todas as mensagens são criptografadas de ponta a ponta com E2EE.
            </p>
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <span>🔒</span>
              <span>Criptografia AES-GCM 256-bit · ECDH P-256</span>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="sticky top-0 bg-black border-b border-gray-800 px-4 py-3 flex items-center gap-3 z-10">
              <button
                onClick={() => { setActivePartnerId(null); setActivePartner(null); setActiveConversation(null); }}
                className="md:hidden p-2 rounded-full hover:bg-gray-900 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" />
                </svg>
              </button>

              {activePartner && (
                <Link to={`/profile/${activePartner.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  {activePartner.avatar_url ? (
                    <img src={activePartner.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {(activePartner.display_name ?? activePartner.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{activePartner.display_name ?? activePartner.username}</p>
                    <p className="text-gray-500 text-xs">@{activePartner.username}</p>
                  </div>
                </Link>
              )}

              <div className="ml-auto flex items-center gap-1 text-green-500 text-xs">
                <span>🔒</span>
                <span className="hidden sm:block">E2EE</span>
              </div>
            </div>

            {/* Crypto error */}
            {cryptoError && (
              <div className="mx-4 mt-4 p-3 rounded-lg bg-red-900/40 border border-red-700">
                <p className="text-red-300 text-sm">{cryptoError}</p>
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMessages && (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loadingMessages && messages.length === 0 && !cryptoError && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-500">
                    Nenhuma mensagem ainda. Inicie a conversa!
                  </p>
                  <p className="text-green-500 text-xs mt-2 flex items-center gap-1">
                    <span>🔒</span>
                    <span>As mensagens são criptografadas de ponta a ponta</span>
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.sender_id === myUser?.id}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-gray-800 px-4 py-3">
              {sendError && (
                <p className="text-red-400 text-sm mb-2">{sendError}</p>
              )}
              <div className="flex gap-3 items-end">
                <div className="flex-1 bg-gray-900 rounded-2xl px-4 py-3 border border-gray-700 focus-within:border-blue-500 transition-colors">
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escreva uma mensagem..."
                    rows={1}
                    className="w-full bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none text-sm"
                    style={{ maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="flex-shrink-0 bg-blue-500 hover:bg-blue-400 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50 transition-colors"
                >
                  {sendingMessage ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-gray-600 text-xs mt-2 flex items-center gap-1">
                <span>🔒</span>
                <span>Criptografia de ponta a ponta · Enter para enviar</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
