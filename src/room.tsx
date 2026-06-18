import { useCallback, useEffect, useRef, useState } from "react";
import {
    StatementStoreClient,
    ChannelStore,
} from "@parity/product-sdk-statement-store";
import { signerManager } from "./utils";

/**
 * Real-time "writing sprint" rooms over the Polkadot Statement Store.
 *
 * This module wraps {@link StatementStoreClient} into a small, reusable hook
 * (`useSprint`) that:
 *
 *  - joins (or creates) a sprint room by a short room code (used as `topic2`),
 *  - publishes a tiny per-member heartbeat into a last-write-wins ChannelStore
 *    keyed by the member (so each participant has exactly one live entry that
 *    late joiners / refreshes immediately resync),
 *  - re-publishes that heartbeat on an interval (statements are ephemeral,
 *    ~30s TTL), so an idle-but-present writer doesn't disappear,
 *  - times members out after ~35s of silence,
 *  - lets the room creator embed a shared sprint end-time in their heartbeat so
 *    every member can render the same countdown, and
 *  - degrades gracefully when NOT inside a Polkadot host: it reports
 *    `status: "unavailable"` instead of throwing, so the app still builds and
 *    runs in preview / a plain browser tab.
 *
 * PRIVACY: only the word COUNT is ever shared, never the document text.
 *
 * Nothing here throws to the caller: every Statement Store error is caught and
 * surfaced as state, so sprint failures never take down the rest of the app.
 */

const APP_NAME = "wordcounter";
/** How often we re-publish our heartbeat so it survives the ~30s TTL. */
const HEARTBEAT_MS = 8000;
/** Drop a member from the leaderboard after this much silence. */
const MEMBER_TIMEOUT_MS = 35000;
/** How often we re-evaluate stale members / countdown. */
const TICK_MS = 1000;

export type SprintStatus =
    | "idle" // no room joined yet
    | "unavailable" // not inside a host — sprinting with others not possible
    | "connecting" // joining a room
    | "connected" // live in a room
    | "error"; // something went wrong

/**
 * One member's heartbeat — intentionally tiny, far under MAX_STATEMENT_SIZE
 * (512 bytes). Only the word count is shared, never the text.
 */
export interface Heartbeat {
    /** Display handle (account name or truncated address). */
    handle: string;
    /** ss58 address of this member (identity / channel key). */
    addr: string;
    /** Words written in their document right now. */
    words: number;
    /** Baseline word count captured when the sprint started (for "delta"). */
    start: number;
    /** Unix ms of this heartbeat (used for last-write-wins + liveness). */
    ts: number;
    /**
     * Sprint end-time (Unix ms) set by the room creator, mirrored by everyone
     * who can see it. null when the room has no timer.
     */
    endsAt: number | null;
    /** ss58 of the room creator (so members agree on whose timer wins). */
    host: string;
    /**
     * Last-write-wins ordering key used by ChannelStore (added automatically on
     * write if omitted). We carry `ts` for our own liveness checks.
     */
    timestamp?: number;
}

/** A leaderboard row derived from a live heartbeat. */
export interface Participant {
    addr: string;
    handle: string;
    /** Words written this sprint (current - start, floored at 0). */
    delta: number;
    /** Absolute current word count. */
    words: number;
    /** Whether this row is the local user. */
    isMe: boolean;
    /** Whether this member is the room creator. */
    isHost: boolean;
    /** Last heartbeat timestamp. */
    ts: number;
}

export interface Sprint {
    status: SprintStatus;
    /** Reason string when status is "unavailable" or "error". */
    message: string | null;
    /** The room code currently joined (uppercased), or null. */
    code: string | null;
    /** This member's ss58 address, or null when not connected. */
    me: string | null;
    /** True if we created this room. */
    isHost: boolean;
    /** Live leaderboard, sorted by words written this sprint (desc). */
    participants: Participant[];
    /** Shared sprint end-time (Unix ms), or null if no timer. */
    endsAt: number | null;
    /** Seconds remaining until endsAt (0 when elapsed / no timer). */
    secondsLeft: number;
    /** True once the timer has elapsed. */
    finished: boolean;
    /**
     * Join (or create) a sprint room by code. `timerMinutes` is only honoured
     * for the creator of a fresh room (others adopt the host's end-time).
     */
    join: (code: string, timerMinutes?: number) => void;
    /** Leave the current room and tear down the client. */
    leave: () => void;
    /** Report this member's current word count (cheap; only publishes deltas). */
    report: (words: number) => void;
}

/** Generate a short, human-friendly room code (no ambiguous chars). */
export function generateRoomCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 5; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

/** Read the connected product account's address + display name, if any. */
function currentIdentity(): { addr: string; handle: string } | null {
    const acct = signerManager.getState().selectedAccount;
    if (!acct) return null;
    const handle = acct.name ?? shortAddr(acct.address);
    return { addr: acct.address, handle };
}

function shortAddr(addr: string): string {
    return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/** Per-member channel key in the ChannelStore (last-write-wins per member). */
function memberChannel(addr: string): string {
    return `m/${addr}`;
}

export function useSprint(): Sprint {
    const [status, setStatus] = useState<SprintStatus>("idle");
    const [message, setMessage] = useState<string | null>(null);
    const [code, setCode] = useState<string | null>(null);
    const [me, setMe] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [endsAt, setEndsAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());

    const clientRef = useRef<StatementStoreClient | null>(null);
    const channelsRef = useRef<ChannelStore<Heartbeat> | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Mutable refs for values needed inside callbacks/intervals.
    const meRef = useRef<{ addr: string; handle: string } | null>(null);
    const startWordsRef = useRef<number>(0);
    const lastWordsRef = useRef<number>(0);
    const endsAtRef = useRef<number | null>(null);
    const hostRef = useRef<string | null>(null);

    const teardown = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
        }
        try {
            channelsRef.current?.destroy();
        } catch {
            /* ignore */
        }
        try {
            clientRef.current?.destroy();
        } catch {
            /* ignore */
        }
        channelsRef.current = null;
        clientRef.current = null;
    }, []);

    /** Recompute the leaderboard from the channel store, dropping stale members. */
    const recompute = useCallback(() => {
        const ch = channelsRef.current;
        const mine = meRef.current;
        if (!ch || !mine) return;

        const t = Date.now();
        const rows: Participant[] = [];
        let adoptedEnd: number | null = null;
        let adoptedHost: string | null = hostRef.current;

        for (const hb of ch.readAll().values()) {
            if (!hb || typeof hb.addr !== "string") continue;
            if (t - hb.ts > MEMBER_TIMEOUT_MS) continue; // timed out
            const delta = Math.max(0, hb.words - hb.start);
            rows.push({
                addr: hb.addr,
                handle: hb.handle || shortAddr(hb.addr),
                delta,
                words: hb.words,
                isMe: hb.addr === mine.addr,
                isHost: hb.host === hb.addr,
                ts: hb.ts,
            });
            // The creator's heartbeat carries the authoritative end-time.
            if (hb.host === hb.addr) {
                adoptedHost = hb.addr;
                adoptedEnd = hb.endsAt ?? null;
            }
        }

        rows.sort((a, b) => b.delta - a.delta || a.handle.localeCompare(b.handle));
        setParticipants(rows);

        // Adopt the host's shared end-time (so non-hosts show the same countdown).
        if (adoptedHost && adoptedHost !== mine.addr) {
            endsAtRef.current = adoptedEnd;
            setEndsAt(adoptedEnd);
        }
    }, []);

    /** Publish (last-write-wins) our own heartbeat into our member channel. */
    const publishHeartbeat = useCallback(() => {
        const ch = channelsRef.current;
        const mine = meRef.current;
        if (!ch || !mine) return;
        const hb: Heartbeat = {
            handle: mine.handle,
            addr: mine.addr,
            words: lastWordsRef.current,
            start: startWordsRef.current,
            ts: Date.now(),
            endsAt: endsAtRef.current,
            host: hostRef.current ?? mine.addr,
        };
        try {
            void ch.write(memberChannel(mine.addr), hb);
        } catch {
            /* swallow — next heartbeat will retry */
        }
    }, []);

    const join = useCallback(
        (rawCode: string, timerMinutes?: number) => {
            const roomCode = rawCode.trim().toUpperCase();
            if (!roomCode) return;

            // Tear down any prior room first.
            teardown();
            setParticipants([]);
            setEndsAt(null);
            endsAtRef.current = null;
            hostRef.current = null;

            const identity = currentIdentity();
            if (!identity) {
                setStatus("unavailable");
                setMessage("Open in a Polkadot host to sprint with others");
                setCode(null);
                setIsHost(false);
                setMe(null);
                return;
            }

            setStatus("connecting");
            setMessage(null);
            setCode(roomCode);
            setMe(identity.addr);
            meRef.current = identity;
            // Capture the starting word count as the sprint baseline.
            startWordsRef.current = lastWordsRef.current;

            let cancelled = false;

            (async () => {
                try {
                    const client = new StatementStoreClient({
                        appName: APP_NAME,
                    });
                    await client.connect({
                        mode: "host",
                        accountId: [identity.addr, 42],
                    });
                    if (cancelled) {
                        client.destroy();
                        return;
                    }
                    clientRef.current = client;

                    const channels = new ChannelStore<Heartbeat>(client, {
                        topic2: roomCode,
                    });
                    channelsRef.current = channels;

                    // Resync from existing members (late joiners / refresh).
                    let existingHost: string | null = null;
                    let existingEnd: number | null = null;
                    for (const hb of channels.readAll().values()) {
                        if (hb && hb.host === hb.addr) {
                            existingHost = hb.addr;
                            existingEnd = hb.endsAt ?? null;
                        }
                    }

                    if (existingHost && existingHost !== identity.addr) {
                        // Room already exists — we're a joiner. Adopt its host
                        // and shared end-time; do not start our own timer.
                        hostRef.current = existingHost;
                        endsAtRef.current = existingEnd;
                        setEndsAt(existingEnd);
                        setIsHost(false);
                    } else {
                        // Fresh room (or we created it) — we're the host.
                        hostRef.current = identity.addr;
                        const computedEnd =
                            existingEnd ??
                            (timerMinutes && timerMinutes > 0
                                ? Date.now() + timerMinutes * 60_000
                                : null);
                        endsAtRef.current = computedEnd;
                        setEndsAt(computedEnd);
                        setIsHost(true);
                    }

                    // Live updates: any member channel change recomputes the board.
                    channels.onChange(() => recompute());

                    setStatus("connected");

                    // Publish our first heartbeat immediately, then on interval.
                    publishHeartbeat();
                    recompute();
                    heartbeatRef.current = setInterval(
                        publishHeartbeat,
                        HEARTBEAT_MS,
                    );
                    // Tick to expire stale members + drive the countdown.
                    tickRef.current = setInterval(() => {
                        setNow(Date.now());
                        recompute();
                    }, TICK_MS);
                } catch (cause) {
                    if (cancelled) return;
                    teardown();
                    setStatus("error");
                    setMessage(
                        cause instanceof Error
                            ? cause.message
                            : "Could not connect to the Statement Store",
                    );
                }
            })();

            return () => {
                cancelled = true;
            };
        },
        [teardown, recompute, publishHeartbeat],
    );

    const leave = useCallback(() => {
        teardown();
        setStatus("idle");
        setMessage(null);
        setCode(null);
        setIsHost(false);
        setMe(null);
        setParticipants([]);
        setEndsAt(null);
        endsAtRef.current = null;
        hostRef.current = null;
        meRef.current = null;
    }, [teardown]);

    const report = useCallback(
        (words: number) => {
            lastWordsRef.current = words;
            // Cheap path: only push to the network when actually connected.
            if (channelsRef.current && meRef.current) publishHeartbeat();
        },
        [publishHeartbeat],
    );

    // Tear down on unmount.
    useEffect(() => teardown, [teardown]);

    const secondsLeft =
        endsAt != null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
    const finished = endsAt != null && now >= endsAt;

    return {
        status,
        message,
        code,
        me,
        isHost,
        participants,
        endsAt,
        secondsLeft,
        finished,
        join,
        leave,
        report,
    };
}
