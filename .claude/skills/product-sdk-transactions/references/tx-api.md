# @parity/product-sdk-tx API Reference

## Functions

### submitAndWatch

Submit a transaction and watch its lifecycle through signing, broadcasting, block inclusion, and (optionally) finalization.

```ts
function submitAndWatch(
  tx: SubmittableTransaction,
  signer: PolkadotSigner,
  options?: SubmitOptions,
): Promise<TxResult>
```

**Parameters:**
- `tx` - A transaction object with `signSubmitAndWatch`. Works with raw PAPI transactions and Ink SDK `AsyncTransaction` wrappers.
- `signer` - The `PolkadotSigner` to use.
- `options` - Optional `SubmitOptions`.

**Throws:**
- `TxTimeoutError` - If the transaction does not reach the target state within `timeoutMs`.
- `TxDispatchError` - If the on-chain dispatch fails.
- `TxSigningRejectedError` - If the user rejects signing.

---

### batchSubmitAndWatch

Batch multiple transactions into a single Substrate Utility batch.

```ts
function batchSubmitAndWatch(
  calls: BatchableCall[],
  api: BatchApi,
  signer: PolkadotSigner,
  options?: BatchSubmitOptions,
): Promise<TxResult>
```

**Parameters:**
- `calls` - Array of transactions or raw decoded calls.
- `api` - A typed API with `tx.Utility.batch_all/batch/force_batch`.
- `signer` - The `PolkadotSigner` to use.
- `options` - Optional `BatchSubmitOptions`.

---

### createDevSigner

Create a `PolkadotSigner` for a standard Substrate dev account.

```ts
function createDevSigner(name: DevAccountName): PolkadotSigner
```

**Parameters:**
- `name` - Dev account name: `"Alice"` | `"Bob"` | `"Charlie"` | `"Dave"` | `"Eve"` | `"Ferdie"`

> **WARNING: Only for local development and testing. Never use in production.**

---

### extractTransaction

Validate an Ink SDK dry-run result and extract the submittable transaction.

```ts
function extractTransaction(result: {
  success: boolean;
  value?: unknown;
  error?: unknown;
}): SubmittableTransaction
```

**Throws:** `TxDryRunError` if the dry run failed.

---

### applyWeightBuffer

Apply a safety buffer to weight estimates from a dry-run result.

```ts
function applyWeightBuffer(weight: Weight, options?: { percent?: number }): Weight
```

Default buffer: 25%.

---

### withRetry

Wrap an async function with retry logic and exponential backoff.

```ts
function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>
```

Only retries transient errors. Does NOT retry:
- `TxBatchError`, `TxDispatchError`, `TxSigningRejectedError`, `TxTimeoutError`

---

### ensureAccountMapped

Ensure an account's SS58 address is mapped to its H160 EVM address on-chain.

```ts
function ensureAccountMapped(
  address: string,
  signer: PolkadotSigner,
  checker: MappingChecker,
  api: ReviveApi,
  options?: EnsureAccountMappedOptions,
): Promise<TxResult | null>
```

Required before EVM contract interactions on Asset Hub. Idempotent.

---

## Error Classes

### TxError (base)

```ts
class TxError extends Error
```

### TxTimeoutError

```ts
class TxTimeoutError extends TxError {
  readonly timeoutMs: number;
}
```

### TxDispatchError

```ts
class TxDispatchError extends TxError {
  readonly dispatchError: unknown;
  readonly formatted: string;
}
```

### TxSigningRejectedError

```ts
class TxSigningRejectedError extends TxError
```

### TxDryRunError

```ts
class TxDryRunError extends TxError {
  readonly raw: unknown;
  readonly formatted: string;
  readonly revertReason?: string;
}
```

### TxBatchError

```ts
class TxBatchError extends TxError
```

---

## Types

### TxStatus

```ts
type TxStatus = "signing" | "broadcasting" | "in-block" | "finalized" | "error";
```

### TxResult

```ts
interface TxResult {
  txHash: string;
  ok: boolean;
  block: { hash: string; number: number; index: number };
  events: unknown[];
  dispatchError?: unknown;
}
```

### SubmitOptions

```ts
interface SubmitOptions {
  waitFor?: "best-block" | "finalized";
  timeoutMs?: number;
  mortalityPeriod?: number;
  onStatus?: (status: TxStatus) => void;
}
```

### BatchMode

```ts
type BatchMode = "batch_all" | "batch" | "force_batch";
```

### DevAccountName

```ts
type DevAccountName = "Alice" | "Bob" | "Charlie" | "Dave" | "Eve" | "Ferdie";
```
