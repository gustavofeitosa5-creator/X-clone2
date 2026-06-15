// ============================================================
// CRYPTO UTILS — E2EE via Web Crypto API (window.crypto.subtle)
// Toda a criptografia ocorre exclusivamente no cliente (browser).
// Chaves privadas armazenadas no IndexedDB com extractable: false.
// O servidor NUNCA tem acesso ao texto puro ou chaves privadas.
// ============================================================

const IDB_DB_NAME = 'e2ee-store';
const IDB_STORE_NAME = 'keys';
const IDB_VERSION = 1;

// ──────────────────────────────────────────────
// IndexedDB helpers
// ──────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function storePrivateKeyInIDB(
  key: CryptoKey,
  userId: string
): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.put(key, `privateKey_${userId}`);

    request.onsuccess = () => resolve();
    request.onerror = (event) =>
      reject((event.target as IDBRequest).error);
  });
}

export async function loadPrivateKeyFromIDB(
  userId: string
): Promise<CryptoKey | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.get(`privateKey_${userId}`);

      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result as CryptoKey | undefined;
        resolve(result ?? null);
      };
      request.onerror = (event) =>
        reject((event.target as IDBRequest).error);
    });
  } catch (error) {
    console.error('[cryptoUtils] Erro ao carregar chave privada do IndexedDB:', error);
    return null;
  }
}

export async function deletePrivateKeyFromIDB(userId: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.delete(`privateKey_${userId}`);

      request.onsuccess = () => resolve();
      request.onerror = (event) =>
        reject((event.target as IDBRequest).error);
    });
  } catch (error) {
    console.error('[cryptoUtils] Erro ao deletar chave privada do IndexedDB:', error);
  }
}

// ──────────────────────────────────────────────
// Key generation & export/import
// ──────────────────────────────────────────────

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function generateKeyPair(
  userId: string
): Promise<{ publicKeyJwk: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // privateKey não exportável
    ['deriveKey']
  );

  const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
  await storePrivateKeyInIDB(keyPair.privateKey, userId);

  return { publicKeyJwk };
}

// ──────────────────────────────────────────────
// Shared secret derivation
// ──────────────────────────────────────────────

export async function deriveSharedSecret(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ──────────────────────────────────────────────
// Encrypt / Decrypt
// ──────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptMessage(
  sharedSecret: CryptoKey,
  plaintext: string
): Promise<{ encryptedBase64: string; ivBase64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedSecret,
    encodedText
  );

  return {
    encryptedBase64: bufferToBase64(encrypted),
    ivBase64: bufferToBase64(iv.buffer),
  };
}

export async function decryptMessage(
  sharedSecret: CryptoKey,
  encryptedBase64: string,
  ivBase64: string
): Promise<string> {
  const encryptedBuffer = base64ToBuffer(encryptedBase64);
  const iv = new Uint8Array(base64ToBuffer(ivBase64));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedSecret,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
