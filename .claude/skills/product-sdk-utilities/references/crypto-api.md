# Crypto API Reference

Package: `@parity/product-sdk-crypto`

## AES-256-GCM

```ts
function aesGcmEncrypt(data: Uint8Array, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array }
function aesGcmDecrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array
function aesGcmEncryptText(plaintext: string, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array }
function aesGcmDecryptText(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): string
function aesGcmEncryptPacked(data: Uint8Array, key: Uint8Array): Uint8Array
function aesGcmDecryptPacked(packed: Uint8Array, key: Uint8Array): Uint8Array
```

## ChaCha20-Poly1305

```ts
function chachaEncrypt(data: Uint8Array, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array }
function chachaDecrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array
function chachaEncryptText(plaintext: string, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array }
function chachaDecryptText(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): string
```

## XChaCha20-Poly1305 (Recommended)

```ts
function xchachaEncrypt(data: Uint8Array, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array }
function xchachaDecrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array
function xchachaEncryptText(plaintext: string, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array }
function xchachaDecryptText(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): string
function xchachaEncryptPacked(data: Uint8Array, key: Uint8Array): Uint8Array
function xchachaDecryptPacked(packed: Uint8Array, key: Uint8Array): Uint8Array
```

## HKDF Key Derivation

```ts
function deriveKey(ikm: Uint8Array, salt: Uint8Array | string, info: Uint8Array | string): Uint8Array
```

Returns a 32-byte derived key using HKDF-SHA256.

## NaCl Asymmetric Encryption

```ts
function sealedBoxEncrypt(message: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array
function sealedBoxDecrypt(sealed: Uint8Array, recipientSecretKey: Uint8Array): Uint8Array
function boxEncrypt(message: Uint8Array, recipientPublicKey: Uint8Array, senderSecretKey: Uint8Array): Uint8Array
function boxDecrypt(packed: Uint8Array, senderPublicKey: Uint8Array, recipientSecretKey: Uint8Array): Uint8Array
```

## Utilities

```ts
function randomBytes(length: number): Uint8Array
```

## Re-exports

```ts
export { default as nacl } from "tweetnacl";
export { hkdf, extract, expand } from "@noble/hashes/hkdf.js";
```
