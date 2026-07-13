# Charel Refactoring Plan

Status: implemented on the `refactor` branch.

## Scope

The refactor simplifies the main character and relationship graph application. Zustand remains the live graph model, Supabase synchronizes authenticated sessions, browser persistence restores normal local sessions, and Tauri keeps a secondary recovery snapshot.

Chat and VTT are intentionally outside this scope. Their source may remain in the repository, but they must not be routed, imported by the active application shell, subscribed to, or expanded until the main app work is complete.

## 1. Stabilize the application shell and runtime boundaries

Commit: `4656c22`

- Moved authentication and theme ownership into focused providers.
- Reduced `App.tsx` to application orchestration and moved updater setup to the entry point.
- Removed chat routes, navigation, queries, stores, and subscriptions from the active runtime.
- Kept generated database types tracked as a schema contract while excluding them from formatting.

## 2. Simplify graph state, synchronization, and recovery

Commit: `0a02d1f`

- Replaced repeated CRUD implementations with one rollback-safe optimistic mutation helper.
- Made Zustand the canonical graph state for online and offline use.
- Added explicit initialization and sync states instead of a single ambiguous loading flag.
- Applied realtime events directly with pure reducers, including relationship key changes.
- Excluded synchronization changes from undo history.
- Kept Zustand persistence for normal restarts and added a debounced Tauri recovery snapshot.
- Added explicit restore/import validation; failed synchronization never overwrites local state automatically.

## 3. Remove redundant effects and simplify core UI

Commit: `1a27fcc`

- Replaced effect-driven mobile state with `useSyncExternalStore`.
- Reset modal drafts through conditional mounting instead of prop-to-state effects.
- Made theme fields controlled or initialized them when their popovers open.
- Extracted SVG pan/zoom behavior from `CharacterGraph`.
- Consolidated duplicated selected-character route components.

## 4. Bound Pixi resources and decouple theme presets

Commits: `c7c2001`, `69c6933`

- Extracted avatar texture loading into a bounded cache that destroys evicted textures.
- Kept the shared Pixi application while explicitly cleaning scene roots, listeners, observers, frames, and timers.
- Separated the React graph overlay from the Pixi engine component.
- Moved preset theme variables into `theme-presets.css`.
- Made the theme editor parse only the preset stylesheet instead of the complete application stylesheet.
- Combined custom-theme hydration and filesystem watching into one lifecycle effect.

## Deferred work

- Chat and VTT reactivation, data models, subscriptions, UI, and tests.
- Further `NetworkGraph` renderer splitting unless a concrete renderer change needs it.
- Bundle-size optimization beyond the current lazy route boundaries.
- New persistence abstractions, SQLite, or repository layers without a demonstrated need.

## Verification

Each numbered milestone is independently committed. The final baseline is verified with:

```text
bun run lint
bun run test
bun run build
```
