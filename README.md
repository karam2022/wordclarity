# WordClarity

A browser writing workspace for seeing the shape of a draft: word counts, reading level, speaking time and phrases worth another look. Write solo, or join a timed writing sprint through a compatible Polkadot host.

Built with React, TypeScript, Vite and the Polkadot Product SDK. The current interface calls itself **Word Counter**.

## What it does

| Tool | What you get |
| --- | --- |
| Live counts | Words, characters with and without spaces, sentences, paragraphs and the longest word |
| Reading and speaking time | Estimates at 200 words per minute for reading and 130 for speaking |
| Clarity checks | An approximate Flesch-Kincaid reading grade, repeated keywords and a fixed list of phrase flags |
| Autosave | A saved draft through the host's key-value store, or browser local storage when host storage isn't available |
| Shared writing sprints | Room codes, a shared countdown and a leaderboard based on words written during the sprint |

The clarity checks run in the app. There's no language-model API behind the phrase flags, and they can't establish whether a person or AI wrote a text. Reading-grade and phrase rules are English-oriented; they're not validated readability measures for Arabic or other languages. Counts and timing are estimates.

## Browser mode and Polkadot mode

**In an ordinary browser**, you can write, view statistics and save a draft locally. You don't need a wallet for those features. Shared sprints need a compatible Polkadot host and a connected product account.

**Inside a Polkadot host**, the app attempts to connect to its product account and use host storage. Sprint rooms use the Product SDK's Statement Store. Review host permission prompts before approving them. See [CLAUDE.md](CLAUDE.md) for the host integration and account model.

## Where your data goes

| Feature | Data handling |
| --- | --- |
| Text analysis | Counts and clarity calculations happen in the frontend |
| Browser fallback storage | The draft is saved in this site's `localStorage`, under `wordcounter:text`. It persists across refreshes until cleared or site data is removed |
| Host storage | The draft is handed to the host's key-value storage API. Storage and protection depend on that host |
| Sprint rooms | Heartbeats share the account address, display handle, current and starting word counts, timestamps and room timing through the Statement Store. The sprint payload doesn't include the document text |

Treat a sprint room code as a way to find a room, not as a private invitation or encryption key. Don't assume its metadata is confidential. The interface's “Nothing leaves this device” footer doesn't describe host storage or networked sprint metadata.

This is a prototype, not a confidential-document vault. Avoid putting passwords, recovery phrases or sensitive documents into it. Clearing the editor removes its saved draft from the active store; clearing local site data doesn't establish deletion from host storage or network recipients.

## Run locally

Use a current supported Node.js release with npm. CI uses Node 22; check the installed Vite package's Node engine requirement when choosing a version.

```bash
git clone https://github.com/karam2022/wordclarity.git
cd wordclarity
./setup.sh
npm run dev
```

Open the local URL printed by Vite. A normal browser is enough to try the editor and its statistics. Host account access and multi-person sprints need separate testing in a compatible Polkadot host.

Before running setup, review [setup.sh](setup.sh). It installs npm dependencies if `node_modules` is absent and fetches Product SDK agent skills into this checkout's `.claude/skills/` if that directory is empty. `./setup.sh --refresh` replaces those project-local skills. It doesn't configure a global assistant installation.

## Development checks

```bash
npm run typecheck
npm run build
npm run preview
```

The first two commands match the PR checks in [CI](.github/workflows/ci.yml). Preview serves the production build locally. There's no dedicated automated test suite configured in `package.json`.

## Find your way around

| File | Responsibility |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Editor, text statistics, clarity heuristics and sprint interface |
| [src/pdk.tsx](src/pdk.tsx) | Host storage, local fallback and account badge |
| [src/room.tsx](src/room.tsx) | Sprint rooms, heartbeat payloads, timer and leaderboard |
| [src/utils.ts](src/utils.ts) | Product-account and host resource integration |
| [src/App.css](src/App.css) | Application styles |

AI coding assistants should follow [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md), including the required setup step. Deployment notes in [DEPLOYMENT.md](DEPLOYMENT.md) and [DEPLOY_SUMMIT.md](DEPLOY_SUMMIT.md) are inherited from the Playground starter. They aren't proof of a live WordClarity deployment. Review their domains and configuration before deploying.

## License

See [LICENSE](LICENSE) for the repository's license terms.
