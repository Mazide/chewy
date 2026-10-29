/* Browser-only encryption for the existing CHEWYKEY1 local importer. */
(function (root) {
  'use strict';
  const SAFE_ERROR = 'Secure key transfer is unavailable.';

  function binary(bytes) {
    return String.fromCharCode(...bytes);
  }

  function base64url(value) {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomBytes(source, length) {
    const bytes = new Uint8Array(length);
    try {
      if (source.getRandomValues(bytes) !== bytes) throw new Error(SAFE_ERROR);
      return bytes;
    } catch {
      bytes.fill(0);
      throw new Error(SAFE_ERROR);
    }
  }

  function validNativeKey(key) {
    const algorithm = key && key.algorithm;
    const exponent = algorithm && algorithm.publicExponent;
    return algorithm && algorithm.name === 'RSA-OAEP' &&
      algorithm.modulusLength === 3072 && algorithm.hash.name === 'SHA-256' &&
      exponent && exponent.length === 3 && exponent[0] === 1 &&
      exponent[1] === 0 && exponent[2] === 1;
  }

  async function createEncryptor(manifest, options = {}) {
    try {
      if (!manifest || typeof manifest.id !== 'string' || !/^[a-f0-9]{32}$/.test(manifest.id) ||
          typeof manifest.publicKeySpki !== 'string' ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(manifest.publicKeySpki) ||
          manifest.publicKeySpki.length > 4096) throw new Error(SAFE_ERROR);
      const id = manifest.id;
      const derBinary = atob(manifest.publicKeySpki);
      const source = options.crypto === undefined ? root.crypto : options.crypto;
      const forge = options.forge === undefined ? root.forge : options.forge;
      if (!source || typeof source.getRandomValues !== 'function') throw new Error(SAFE_ERROR);
      // Prove that this surface permits secure randomness before enabling input.
      const probe = randomBytes(source, 1);
      probe.fill(0);
      let key;
      let mode = 'portable';
      if (!options.forcePortable && source.subtle) {
        try {
          key = await source.subtle.importKey('spki',
            Uint8Array.from(derBinary, char => char.charCodeAt(0)),
            {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt']);
          if (!validNativeKey(key)) throw new Error(SAFE_ERROR);
          mode = 'native';
        } catch {
          key = undefined;
        }
      }
      if (!key) {
        if (!forge) throw new Error(SAFE_ERROR);
        key = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(derBinary, {
          strict: true, parseAllBytes: true, maxDepth: 16
        }));
        if (key.n.bitLength() !== 3072 || key.e.toString(10) !== '65537') {
          throw new Error(SAFE_ERROR);
        }
      }
      const aad = 'chewy-runway-transfer-v1:' + id;
      return Object.freeze({
        mode,
        async encrypt(secret) {
          let plainBytes;
          let aesBytes;
          let iv;
          let seed;
          let aesBinary = '';
          let seedBinary = '';
          try {
            if (typeof secret !== 'string' || !/^[\x21-\x7e]{8,2048}$/.test(secret)) {
              throw new Error(SAFE_ERROR);
            }
            plainBytes = Uint8Array.from(secret, char => char.charCodeAt(0));
            secret = '';
            aesBytes = randomBytes(source, 32);
            iv = randomBytes(source, 12);
            let wrappedKey;
            let ciphertext;
            if (mode === 'native') {
              const aesKey = await source.subtle.importKey('raw', aesBytes,
                {name: 'AES-GCM'}, false, ['encrypt']);
              wrappedKey = binary(new Uint8Array(await source.subtle.encrypt(
                {name: 'RSA-OAEP'}, key, aesBytes)));
              ciphertext = binary(new Uint8Array(await source.subtle.encrypt({
                name: 'AES-GCM', iv, tagLength: 128,
                additionalData: Uint8Array.from(aad, char => char.charCodeAt(0))
              }, aesKey, plainBytes)));
            } else {
              seed = randomBytes(source, 32);
              aesBinary = binary(aesBytes);
              seedBinary = binary(seed);
              wrappedKey = key.encrypt(aesBinary, 'RSA-OAEP', {
                md: forge.md.sha256.create(),
                mgf1: {md: forge.md.sha256.create()},
                seed: seedBinary
              });
              const cipher = forge.cipher.createCipher('AES-GCM', aesBinary);
              cipher.start({iv: binary(iv), additionalData: aad, tagLength: 128});
              cipher.update(forge.util.createBuffer(binary(plainBytes)));
              if (!cipher.finish()) throw new Error(SAFE_ERROR);
              ciphertext = cipher.output.getBytes() + cipher.mode.tag.getBytes();
            }
            const envelope = {v: 1, id, ek: base64url(wrappedKey),
              iv: base64url(binary(iv)), ct: base64url(ciphertext)};
            return 'CHEWYKEY1.' + base64url(JSON.stringify(envelope));
          } catch {
            throw new Error(SAFE_ERROR);
          } finally {
            secret = '';
            aesBinary = '';
            seedBinary = '';
            for (const bytes of [plainBytes, aesBytes, iv, seed]) {
              if (bytes) bytes.fill(0);
            }
          }
        }
      });
    } catch {
      throw new Error(SAFE_ERROR);
    }
  }

  root.ChewyKeyTransfer = Object.freeze({createEncryptor});
  if (typeof module === 'object' && module.exports) module.exports = root.ChewyKeyTransfer;
})(typeof window === 'undefined' ? globalThis : window);
