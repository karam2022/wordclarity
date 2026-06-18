# Address API Reference

Package: `@parity/product-sdk-address`

## SS58 Functions

### isValidSs58

```ts
function isValidSs58(address: string): boolean
```

### ss58Decode

```ts
function ss58Decode(address: string): { publicKey: Uint8Array; prefix: number }
```

### ss58Encode

```ts
function ss58Encode(publicKey: Uint8Array, prefix?: number): SS58String
```

### normalizeSs58

```ts
function normalizeSs58(address: string, prefix?: number): SS58String | null
```

### toGenericSs58

```ts
function toGenericSs58(address: string): SS58String | null
```

### toPolkadotSs58

```ts
function toPolkadotSs58(address: string): SS58String | null
```

---

## H160 Functions

### ss58ToH160

```ts
function ss58ToH160(address: string): `0x${string}`
```

### h160ToSs58

```ts
function h160ToSs58(evmAddress: string, prefix?: number): SS58String
```

### toH160

```ts
function toH160(address: string): `0x${string}`
```

### isValidH160

```ts
function isValidH160(address: string): boolean
```

---

## Display Functions

### truncateAddress

```ts
function truncateAddress(address: string, startChars?: number, endChars?: number): string
```

### addressesEqual

```ts
function addressesEqual(a: string, b: string): boolean
```

---

## Types

```ts
export type { SS58String, HexString } from "@polkadot-api/substrate-bindings";
```
