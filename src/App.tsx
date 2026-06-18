import { useEffect, useMemo, useRef, useState } from "react";
import { AccountBadge, useStore } from "./pdk";
import { generateRoomCode, useSprint, type Participant } from "./room";

const STORAGE_KEY = "text";
const WORDS_PER_MINUTE = 200;

interface Stats {
    words: number;
    characters: number;
    charactersNoSpaces: number;
    sentences: number;
    paragraphs: number;
    readingSeconds: number;
    longestWord: string;
}

function analyze(text: string): Stats {
    const trimmed = text.trim();

    // Words: split on any run of whitespace.
    const wordList = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
    const words = wordList.length;

    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;

    // Sentences: runs of text terminated by . ! ? (handles "?!", "...", etc.).
    const sentenceMatches = trimmed.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
    const sentences =
        trimmed.length === 0
            ? 0
            : sentenceMatches
              ? sentenceMatches.filter((s) => s.trim().length > 0).length
              : 1;

    // Paragraphs: blocks separated by one or more blank lines.
    const paragraphs =
        trimmed.length === 0
            ? 0
            : trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;

    const readingSeconds = Math.round((words / WORDS_PER_MINUTE) * 60);

    // Longest word, stripped of surrounding punctuation.
    let longestWord = "";
    for (const raw of wordList) {
        const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
        if (w.length > longestWord.length) longestWord = w;
    }

    return {
        words,
        characters,
        charactersNoSpaces,
        sentences,
        paragraphs,
        readingSeconds,
        longestWord,
    };
}

function formatReadingTime(seconds: number): string {
    if (seconds <= 0) return "0 sec";
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    if (rem === 0) return `${minutes} min`;
    return `${minutes} min ${rem} sec`;
}

/* ---- Clarity upgrade: speaking time, readability, keywords, AI-slop ---- */
const SPEAKING_WPM = 130;

const STOP_WORDS = new Set(
    "the a an and or but of to in on for with is are was were be been being it this that these those as at by from into out up down i you he she we they me my your his her our their not no do does did have has had will would can could should may might if then than so such own same other more most very just also about over after before".split(
        " ",
    ),
);

// "Dead AI language" tells, from a writer's anti-AI-slop list.
const SLOP_TERMS = [
    "delve", "tapestry", "leverage", "utilize", "seamless", "robust",
    "landscape", "realm", "furthermore", "moreover", "additionally",
    "comprehensive", "meticulous", "navigate", "foster", "underscore",
    "testament", "bustling", "intricate", "vibrant", "profound", "crucial",
    "pivotal", "elevate", "unlock", "harness", "showcase", "myriad",
    "cornerstone", "embark", "game-changer", "cutting-edge",
    "in today's", "it's worth noting", "it is worth noting",
    "in order to", "when it comes to", "needless to say",
];

interface Clarity {
    speakingSeconds: number;
    grade: number;
    topWords: { word: string; count: number }[];
    flags: { term: string; count: number }[];
    flagTotal: number;
}

function countSyllables(word: string): number {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length === 0) return 0;
    if (w.length <= 3) return 1;
    const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    const groups = trimmed.match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clarity(text: string): Clarity {
    const trimmed = text.trim();
    const wordList = trimmed.length === 0 ? [] : trimmed.split(/\s+/);
    const words = wordList.length;
    const speakingSeconds = Math.round((words / SPEAKING_WPM) * 60);

    // Flesch–Kincaid grade level.
    const sentences = Math.max(1, (trimmed.match(/[.!?]+/g) || []).length);
    const syllables = wordList.reduce((s, w) => s + countSyllables(w), 0);
    const grade =
        words === 0
            ? 0
            : 0.39 * (words / sentences) +
              11.8 * (syllables / Math.max(1, words)) -
              15.59;

    // Keyword density (minus stop words).
    const freq = new Map<string, number>();
    for (const raw of wordList) {
        const w = raw
            .toLowerCase()
            .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
        if (w.length < 3 || STOP_WORDS.has(w)) continue;
        freq.set(w, (freq.get(w) || 0) + 1);
    }
    const topWords = [...freq.entries()]
        .filter(([, c]) => c > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

    // AI-slop tells.
    const lower = text.toLowerCase();
    const flags: { term: string; count: number }[] = [];
    for (const term of SLOP_TERMS) {
        const re = new RegExp(`\\b${escapeRe(term)}\\b`, "g");
        const n = (lower.match(re) || []).length;
        if (n > 0) flags.push({ term, count: n });
    }
    const dashes = (text.match(/—/g) || []).length;
    if (dashes > 0) flags.push({ term: "— (em-dash)", count: dashes });
    flags.sort((a, b) => b.count - a.count);
    const flagTotal = flags.reduce((s, f) => s + f.count, 0);

    return { speakingSeconds, grade, topWords, flags, flagTotal };
}

function formatGrade(g: number): string {
    if (g <= 0) return "—";
    const r = Math.round(g);
    if (r <= 1) return "very easy";
    if (r >= 16) return "grad+";
    return `grade ${r}`;
}

interface CardProps {
    label: string;
    value: string;
    hint?: string;
    wide?: boolean;
}

function StatCard({ label, value, hint, wide }: CardProps) {
    return (
        <div className={`stat-card${wide ? " stat-card--wide" : ""}`}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
            {hint && <div className="stat-hint">{hint}</div>}
        </div>
    );
}

function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

const TIMER_PRESETS = [5, 15, 25] as const;

function LeaderboardRow({ p, rank }: { p: Participant; rank: number }) {
    return (
        <li className={`sprint-row${p.isMe ? " sprint-row--me" : ""}`}>
            <span className="sprint-rank">{rank}</span>
            <span className="sprint-name">
                {p.handle}
                {p.isHost && <span className="sprint-tag">host</span>}
                {p.isMe && <span className="sprint-tag sprint-tag--me">you</span>}
            </span>
            <span className="sprint-words">{p.delta.toLocaleString()}</span>
        </li>
    );
}

function SprintPanel({ words }: { words: number }) {
    const sprint = useSprint();
    const [codeInput, setCodeInput] = useState("");
    const [timer, setTimer] = useState<number>(15);

    // Continuously report our live word count to the room while connected.
    useEffect(() => {
        if (sprint.status === "connected") sprint.report(words);
    }, [words, sprint.status, sprint]);

    function handleCreate() {
        sprint.join(generateRoomCode(), timer);
    }

    function handleJoin() {
        const code = codeInput.trim();
        if (code) sprint.join(code);
    }

    if (sprint.status === "connected" || sprint.status === "connecting") {
        return (
            <section className="sprint-pane sprint-pane--live">
                <div className="sprint-head">
                    <div className="sprint-room">
                        <span className="sprint-room-label">Sprint room</span>
                        <span className="sprint-code">{sprint.code}</span>
                    </div>
                    {sprint.endsAt != null && (
                        <div
                            className={`sprint-clock${sprint.finished ? " sprint-clock--done" : ""}`}
                        >
                            {sprint.finished
                                ? "Time!"
                                : formatCountdown(sprint.secondsLeft)}
                        </div>
                    )}
                    <button
                        type="button"
                        className="clear-btn"
                        onClick={sprint.leave}
                    >
                        Leave
                    </button>
                </div>

                {sprint.status === "connecting" ? (
                    <p className="sprint-hint">Joining room…</p>
                ) : sprint.participants.length === 0 ? (
                    <p className="sprint-hint">
                        Waiting for writers… share code{" "}
                        <strong>{sprint.code}</strong>.
                    </p>
                ) : (
                    <ol className="sprint-board">
                        {sprint.participants.map((p, i) => (
                            <LeaderboardRow key={p.addr} p={p} rank={i + 1} />
                        ))}
                    </ol>
                )}
                <p className="sprint-foot">
                    Live race — only your word count is shared, never your text.
                </p>
            </section>
        );
    }

    return (
        <section className="sprint-pane">
            <div className="sprint-head">
                <h2 className="sprint-title">Writing sprint</h2>
            </div>

            {sprint.status === "unavailable" ? (
                <p className="sprint-hint">
                    {sprint.message ??
                        "Open in a Polkadot host to sprint with others"}
                </p>
            ) : (
                <>
                    {sprint.status === "error" && sprint.message && (
                        <p className="sprint-error">{sprint.message}</p>
                    )}
                    <div className="sprint-timer-row">
                        <span className="sprint-room-label">Timer</span>
                        <div className="sprint-presets">
                            {TIMER_PRESETS.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    className={`sprint-preset${timer === m ? " sprint-preset--on" : ""}`}
                                    onClick={() => setTimer(m)}
                                >
                                    {m}m
                                </button>
                            ))}
                            <button
                                type="button"
                                className={`sprint-preset${timer === 0 ? " sprint-preset--on" : ""}`}
                                onClick={() => setTimer(0)}
                            >
                                none
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="sprint-create"
                        onClick={handleCreate}
                    >
                        Create a sprint room
                    </button>
                    <div className="sprint-divider">or join</div>
                    <div className="sprint-join">
                        <input
                            className="sprint-input"
                            value={codeInput}
                            onChange={(e) =>
                                setCodeInput(e.target.value.toUpperCase())
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleJoin();
                            }}
                            placeholder="ROOM CODE"
                            maxLength={5}
                            spellCheck={false}
                        />
                        <button
                            type="button"
                            className="clear-btn"
                            onClick={handleJoin}
                            disabled={!codeInput.trim()}
                        >
                            Join
                        </button>
                    </div>
                    <p className="sprint-foot">
                        Race others in real time. Only your word count is shared,
                        never your text.
                    </p>
                </>
            )}
        </section>
    );
}

export default function App() {
    const store = useStore("wordcounter");
    const [text, setText] = useState<string>("");
    const [loaded, setLoaded] = useState(false);

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load persisted text once, when the store becomes available.
    useEffect(() => {
        if (!store || loaded) return;
        let live = true;
        store.get(STORAGE_KEY).then((saved) => {
            if (!live) return;
            if (saved != null) setText(saved);
            setLoaded(true);
        });
        return () => {
            live = false;
        };
    }, [store, loaded]);

    // Debounced autosave — only after the initial load has completed.
    useEffect(() => {
        if (!store || !loaded) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            void store.set(STORAGE_KEY, text);
        }, 250);
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        };
    }, [text, store, loaded]);

    const stats = useMemo(() => analyze(text), [text]);
    const clar = useMemo(() => clarity(text), [text]);

    const fmt = (n: number) => n.toLocaleString();

    function handleClear() {
        setText("");
        if (store) void store.remove(STORAGE_KEY);
    }

    return (
        <div className="app">
            <header className="app-header">
                <div className="app-header-top">
                    <h1>
                        <span className="logo-dot" aria-hidden="true" />
                        Word Counter
                    </h1>
                    <AccountBadge />
                </div>
                <p className="subtitle">
                    Live text stats plus a clarity check: readability, speaking
                    time, keyword density, and AI-slop flags.
                </p>
            </header>

            <main className="layout">
                <section className="editor-pane">
                    <div className="editor-toolbar">
                        <span className="editor-status">
                            {text.length > 0 ? "Autosaved" : "Start typing…"}
                        </span>
                        <button
                            type="button"
                            className="clear-btn"
                            onClick={handleClear}
                            disabled={text.length === 0}
                        >
                            Clear
                        </button>
                    </div>
                    <textarea
                        className="editor"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste or write your text here. Your stats update instantly and your text is saved automatically."
                        spellCheck={true}
                        autoFocus
                    />
                </section>

                <section className="stats-pane">
                    <div className="stats-grid">
                        <StatCard label="Words" value={fmt(stats.words)} />
                        <StatCard
                            label="Characters"
                            value={fmt(stats.characters)}
                            hint={`${fmt(stats.charactersNoSpaces)} without spaces`}
                        />
                        <StatCard
                            label="Sentences"
                            value={fmt(stats.sentences)}
                        />
                        <StatCard
                            label="Paragraphs"
                            value={fmt(stats.paragraphs)}
                        />
                        <StatCard
                            label="Reading time"
                            value={formatReadingTime(stats.readingSeconds)}
                            hint="~200 wpm"
                            wide
                        />
                        <StatCard
                            label="Longest word"
                            value={stats.longestWord || "—"}
                            hint={
                                stats.longestWord
                                    ? `${stats.longestWord.length} letters`
                                    : undefined
                            }
                            wide
                        />
                        <StatCard
                            label="Speaking time"
                            value={formatReadingTime(clar.speakingSeconds)}
                            hint="~130 wpm"
                        />
                        <StatCard
                            label="Reading level"
                            value={formatGrade(clar.grade)}
                            hint="Flesch-Kincaid"
                        />
                        <StatCard
                            label="AI-slop flags"
                            value={fmt(clar.flagTotal)}
                            hint={clar.flagTotal > 0 ? "see them below" : "clean"}
                            wide
                        />
                    </div>
                    {(clar.flags.length > 0 || clar.topWords.length > 0) && (
                        <section className="sprint-pane">
                            {clar.flags.length > 0 && (
                                <>
                                    <div className="sprint-head">
                                        <h2 className="sprint-title">
                                            ⚑ AI-slop and weak phrases
                                        </h2>
                                    </div>
                                    <ol className="sprint-board">
                                        {clar.flags.map((f) => (
                                            <li
                                                key={f.term}
                                                className="sprint-row"
                                            >
                                                <span className="sprint-name">
                                                    {f.term}
                                                </span>
                                                <span className="sprint-words">
                                                    {f.count}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </>
                            )}
                            {clar.topWords.length > 0 && (
                                <>
                                    <div className="sprint-head">
                                        <h2 className="sprint-title">
                                            Top keywords
                                        </h2>
                                    </div>
                                    <ol className="sprint-board">
                                        {clar.topWords.map((w) => (
                                            <li
                                                key={w.word}
                                                className="sprint-row"
                                            >
                                                <span className="sprint-name">
                                                    {w.word}
                                                </span>
                                                <span className="sprint-words">
                                                    {w.count}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </>
                            )}
                        </section>
                    )}
                    <SprintPanel words={stats.words} />
                </section>
            </main>

            <footer className="app-footer">
                Saved locally in your browser. Nothing leaves this device.
            </footer>
        </div>
    );
}
