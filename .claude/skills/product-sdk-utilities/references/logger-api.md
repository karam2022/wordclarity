# Logger API Reference

Package: `@parity/product-sdk-logger`

## configure

```ts
function configure(config: LoggerConfig): void
```

Set global logging configuration. Affects all existing and future logger instances.

```ts
interface LoggerConfig {
  level?: LogLevel;
  namespaces?: string[];
  handler?: LogHandler;
}
```

## createLogger

```ts
function createLogger(namespace: string): Logger
```

Create a namespaced logger instance.

```ts
interface Logger {
  error(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
}
```

## Types

### LogLevel

```ts
type LogLevel = "error" | "warn" | "info" | "debug";
```

### LogEntry

```ts
interface LogEntry {
  level: LogLevel;
  namespace: string;
  message: string;
  data?: unknown;
  timestamp: number;
}
```

### LogHandler

```ts
type LogHandler = (entry: LogEntry) => void;
```

## Namespace Filtering

When `namespaces` is configured:
- Listed namespaces use the configured level
- Other namespaces fall back to default (`"warn"`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POLKADOT_APPS_LOG` | Initial log level |
| `POLKADOT_APPS_LOG_NS` | Comma-separated namespace filter |

## Defaults

- **Level:** `"warn"`
- **Handler:** `undefined` (console output)
- **Namespaces:** `undefined` (no filter)
