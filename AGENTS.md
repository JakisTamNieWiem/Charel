# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the React + TypeScript frontend. Keep reusable UI in `src/components/ui`, feature components in `src/components`, hooks in `src/hooks`, shared helpers in `src/lib`, Zustand stores in `src/store`, and type definitions in `src/types`. Static app data lives in `src/data`. Desktop runtime code, capabilities, and packaging assets live in `src-tauri/`. Supabase configuration is under `supabase/`, and production web output is generated into `dist/`.

## Build, Test, and Development Commands
Use Bun for workspace commands.

- `bun install` installs frontend dependencies.
- `bun run dev` starts the Vite dev server for the web UI.
- `bun run tauri dev` runs the desktop app with the Tauri shell.
- `bun run build` type-checks and builds the production frontend bundle.
- `bun run lint` runs `tsc --noEmit` and `biome check`.
- `bun run types` regenerates `src/types/database.types.ts` from Supabase.

## Coding Style & Naming Conventions
Biome is the formatter/linter (`biome.json`). Use tabs for indentation and double quotes in TypeScript/TSX. Follow existing naming patterns: PascalCase for React components (`ChatWindow.tsx`), camelCase for utilities (`chat-utils.ts`), and `useX` for hooks (`use-sendMessage.ts`). Prefer the `@/` path alias for imports from `src/`. Do not hand-edit generated or vendor-style files excluded from Biome checks, such as `src/components/ui` unless the change is intentional.

## Testing Guidelines
There is no dedicated test runner configured yet. Treat `bun run lint` and `bun run build` as the minimum pre-PR verification. When adding tests, place them next to the feature as `*.test.ts` or `*.test.tsx` and favor lightweight component or hook coverage over broad integration scaffolding.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Added custom theme support` and `Fixed networkGraph UI scaling bug`. Keep commits focused and descriptive. For pull requests, include a concise summary, note any schema/config changes, link the related issue, and attach screenshots or recordings for UI changes. Call out any required environment variables or Supabase/Tauri setup needed for review.

## Security & Configuration Tips
Keep secrets in local environment files such as `.env.local`; never commit keys. CI release builds depend on Tauri signing and `VITE_*` secrets defined in GitHub Actions, so document any new secret before merging.
