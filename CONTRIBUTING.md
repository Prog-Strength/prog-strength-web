# Contributing to prog-strength-web

This guide applies to human and AI contributors alike. For repo orientation (architecture,
conventions, gotchas), read [AGENTS.md](AGENTS.md) first; for setup and environment, the
[README](README.md).

## TL;DR

1. Branch from `main`: `type/short-description` (e.g. `feat/quick-add-modal`).
2. Make the change; co-locate tests with the code they cover.
3. Commit in [Conventional Commits](https://www.conventionalcommits.org/) format — hooks enforce it.
4. Push and open a PR against `main` with a conventional-format title.
5. CI must be green to merge. PRs are squash-merged; the PR title becomes the commit on `main`.

## Branches

Branch names follow `type/short-kebab-description`, where `type` matches the commit type the work
will land as: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `ci/`. Branch from an
up-to-date `main`; there are no long-lived release branches.

## Commit messages

Every commit must be a valid [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/),
validated by commitlint (`@commitlint/config-conventional`) in a Husky `commit-msg` hook locally
and again in CI:

```
type(scope): subject

optional body explaining why, wrapped at ~100 chars
```

- **Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore`, `revert`.
- **Scope** is optional but encouraged — use the page or module touched: `feat(nutrition): …`,
  `fix(chat): …`, `ci: …`.
- **Subject** in lower case, imperative mood, no trailing period: `add quick-add modal`, not
  `Added quick-add modal.`
- **Breaking changes** get a `!` (`feat(api)!: …`) or a `BREAKING CHANGE:` footer.

Why this matters: the repo may adopt [semantic-release](https://semantic-release.gitbook.io/)
later, which computes versions and changelogs from commit history. Because PRs squash-merge, the
**PR title** is what actually lands on `main` — so PR titles follow the same format and are
checked in CI.

## Local checks (Husky)

Hooks install automatically via the `prepare` script on `npm ci` / `npm install`. They are the
first line of defense; CI repeats the same checks.

| Hook         | Runs                                                                         | Catches                              |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------ |
| `pre-commit` | lint-staged (ESLint `--fix` + Prettier on staged files), then `tsc --noEmit` | lint errors, formatting, type errors |
| `commit-msg` | `commitlint --edit`                                                          | malformed commit messages            |

Do not bypass hooks with `--no-verify` or `HUSKY=0`. If a hook fails, fix the underlying problem —
a bypassed failure resurfaces as a red PR check anyway.

## CI (PR status checks)

`.github/workflows/ci.yml` runs on every PR and every push to `main`:

| Job                  | Steps                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| checks               | `npm run lint` → `npm run format:check` → `npm run typecheck` → `npm run test` → `npm run build` |
| conventional commits | commitlint over every PR commit, plus the PR title (PRs only)                                    |

All checks must pass before merge. Vercel also creates a preview deploy per PR — use it to sanity-
check UI changes in a real browser.

## Pull requests

- Keep each PR to **one concern**. A feature PR should not also reformat unrelated files or fold in
  drive-by refactors.
- PR title in conventional format (it becomes the squash-merge commit subject on `main`).
- The description should say what changed and why, plus how it was verified. Screenshots or a short
  clip for anything visual.
- Update docs in the same PR when behavior they describe changes (README, AGENTS.md, this file).

## Tests

- Vitest + Testing Library, jsdom environment. Tests co-locate with the code: `lib/api.test.ts`
  next to `lib/api.ts`, `page.test.tsx` next to `page.tsx`.
- New logic should come with tests; pure styling tweaks don't need them.
- `npm run test` runs the suite once; `npx vitest` watches.

## Notes for AI agents

Everything above applies, plus:

- **Verify before declaring done.** Run `npm run typecheck && npm run lint && npm run test`
  yourself and report the actual output. "Should work" is not verification.
- **Read the vendored Next.js docs** (`node_modules/next/dist/docs/`) before using a Next API from
  memory — this is Next 16 and your training data is likely stale (see AGENTS.md).
- **Stay on-pattern.** Reuse the existing 401-redirect, toast, and modal patterns from neighboring
  pages instead of inventing new ones.
- **Touch only what the task needs.** Don't reformat, rename, or "improve" code outside the scope
  of the change; it bloats the diff and the review.
- A failing hook or CI check is a signal to fix the work, never to bypass the check.
