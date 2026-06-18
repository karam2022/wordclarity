# Utils API Reference

Package: `@parity/product-sdk-utils`

## Encoding

```ts
function bytesToHex(bytes: Uint8Array): string  // No 0x prefix
function hexToBytes(hex: string): Uint8Array    // No 0x prefix expected
function utf8ToBytes(str: string): Uint8Array
function concatBytes(...arrays: Uint8Array[]): Uint8Array
```

## Hashing

All return 32-byte `Uint8Array`:

```ts
function blake2b256(data: Uint8Array): Uint8Array  // Polkadot default
function sha256(data: Uint8Array): Uint8Array      // bulletin-deploy
function keccak256(data: Uint8Array): Uint8Array   // Ethereum compat
```

## Token Formatting

### formatPlanck

```ts
function formatPlanck(planck: bigint, decimals?: number): string
```

Convert planck to decimal string. Default decimals: 10 (DOT).

### parseToPlanck

```ts
function parseToPlanck(amount: string, decimals?: number): bigint
```

Parse decimal string to planck. Truncates excess decimals.

### formatBalance

```ts
function formatBalance(planck: bigint, options?: FormatBalanceOptions): string
```

Locale-aware display formatting with thousand separators and optional symbol.

```ts
interface FormatBalanceOptions {
  decimals?: number;     // Default: 10
  maxDecimals?: number;  // Default: 4
  symbol?: string;       // e.g., "DOT"
  locale?: string;       // BCP 47 locale
}
```

## Balance Querying

```ts
function getBalance(api: BalanceApi, address: string): Promise<AccountBalance>

interface AccountBalance {
  free: bigint;
  reserved: bigint;
  frozen: bigint;
}
```
