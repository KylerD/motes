# Mote — Daily Evolution Cron

This file is the entry point for mote's daily autonomous evolution. It runs on a mac mini via Claude Code's `/loop` command, giving the AI agent full access to the codebase, build tools, and screenshot verification.

## Schedule

Run twice daily. The agent pulls latest, evolves, commits, and pushes.

## Invocation

From the mote repo root on the mac mini:

```bash
claude -p "$(cat cron.md)"
```

Or via `/loop` for recurring execution:

```
/loop 12h claude -p "$(cat cron.md)"
```

## What To Do

You are the creative director of a living artwork. Your job is to make mote more mesmerizing, more emotionally compelling, and more technically ambitious with every session.

### 1. Sync and orient

```bash
git pull --rebase origin main
npm ci
```

Read the full daily evolution guide:

```bash
cat .claude/daily-evolve.md
```

**Follow that guide exactly.** It contains the creative mandate, workflow steps, quality analysis, screenshot verification, and evolution log format. The guide is the source of truth — this cron.md is just the trigger.

### 2. Execute the daily-evolve workflow

The `.claude/daily-evolve.md` guide walks you through:

1. Reading the evolution log to understand trajectory
2. Reading quality standards
3. Checking recent git history
4. Running BEFORE quality analysis and screenshots
5. **Visually examining** BEFORE screenshots (critical — do not skip)
6. Identifying the biggest experience gap
7. Picking a coherent change direction
8. Implementing the change
9. Verifying the build (`npx tsc --noEmit && npx vite build`)
10. Running AFTER quality analysis and screenshots
11. **Visually examining** AFTER screenshots and comparing (critical — do not skip)
12. Updating the evolution log
13. Committing with `evolve: [description]` prefix

### 3. Push

```bash
git push origin main
```

### 4. Clean up

Remove capture artifacts so they don't accumulate:

```bash
rm -rf captures/before captures/after quality-report-before.json quality-report-after.json
```

## Rules

- **Never skip visual verification.** If you can't see an improvement in the AFTER screenshots, the change didn't work. Iterate or revert.
- **Never break the build.** `tsc --noEmit` and `vite build` must both pass before committing.
- **Never flatten the cycle arc.** The 6-phase structure (genesis through silence) is sacred.
- **Deterministic.** Same cycle number must produce the same world for all viewers.
- **Zero npm runtime deps.** Browser APIs (Canvas, WebGL, Web Audio) are encouraged.
- **256x144 canvas, 5-minute cycles.** Sacred. Do not change.
- **Evolution log entries must be concise.** See `.claude/daily-evolve.md` step 14 for strict format rules.
- **One coherent direction per session.** Deep and impactful, not scattered and shallow.
- **Commit message format:** `evolve: [short description]`

## Context Files

- `.claude/daily-evolve.md` — Full creative mandate and workflow (THE guide)
- `.claude/quality-standards.md` — Minimum quality bars
- `public/evolution-log.json` — Project history and trajectory
- `CLAUDE.md` — Architecture and source layout
- `docs/superpowers/specs/` — Design specs for planned features
