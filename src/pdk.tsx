import { useEffect, useState } from "react";
import { truncateAddress } from "@parity/product-sdk-address";
import { createKvStore, type KvStore } from "@parity/product-sdk-storage";
import { signerManager, useSignerState } from "./utils";

/** localStorage-backed KvStore used outside a Polkadot host (e.g. preview). */
function localFallback(prefix: string): KvStore {
    const p = prefix ? prefix + ":" : "";
    return {
        async get(key: string) {
            return localStorage.getItem(p + key);
        },
        async set(key: string, value: string) {
            localStorage.setItem(p + key, value);
        },
        async getJSON<T>(key: string): Promise<T | null> {
            const v = localStorage.getItem(p + key);
            return v ? (JSON.parse(v) as T) : null;
        },
        async setJSON(key: string, value: unknown) {
            localStorage.setItem(p + key, JSON.stringify(value));
        },
        async remove(key: string) {
            localStorage.removeItem(p + key);
        },
    };
}

/**
 * Open a product-sdk host KV store (data persists through the Polkadot host).
 * Falls back to localStorage when not running inside a host, so the app
 * still works in preview and in a plain browser.
 */
export async function openStore(prefix: string): Promise<KvStore> {
    try {
        const store = await createKvStore({ prefix });
        await store.get("__probe__"); // verify host ops actually work
        return store;
    } catch {
        return localFallback(prefix);
    }
}

/** React hook — resolves to the KvStore once ready (null while opening). */
export function useStore(prefix: string): KvStore | null {
    const [store, setStore] = useState<KvStore | null>(null);
    useEffect(() => {
        let live = true;
        openStore(prefix).then(s => {
            if (live) setStore(s);
        });
        return () => {
            live = false;
        };
    }, [prefix]);
    return store;
}

/**
 * Connects to the Polkadot host signer on mount and shows the active account.
 * Drop <AccountBadge/> into your app header.
 */
export function AccountBadge() {
    const { selectedAccount } = useSignerState();
    useEffect(() => {
        signerManager.connect().then(result => {
            if (result.ok && result.value.length > 0) {
                signerManager.selectAccount(result.value[0].address);
            }
        });
    }, []);
    return (
        <span
            className={`pdk-account${selectedAccount ? "" : " pdk-account-off"}`}
            title={
                selectedAccount
                    ? selectedAccount.address
                    : "Open this app in a Polkadot host to connect your account"
            }
        >
            <span className="pdk-dot" aria-hidden />
            {selectedAccount
                ? (selectedAccount.name ?? truncateAddress(selectedAccount.address))
                : "Connect in Polkadot"}
        </span>
    );
}
