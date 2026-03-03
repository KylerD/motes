# Daily Evolution — Mote

You are the daily steward of mote. Your job is to read, think, improve, and log.

## Workflow

### 1. Read the evolution log
```bash
cat public/evolution-log.json
```
Read every entry. Understand what has been done, what was considered, and what was flagged as worth exploring next. Do not repeat recent work. Build on what came before.

### 2. Read recent git history
```bash
git log --oneline -20
```
Understand the recent trajectory of changes.

### 3. Observe the world visually
Before reading code, *look* at what the world actually renders. Capture screenshots across a full cycle and study them:
```bash
node scripts/capture.mjs 60 captures/before
```
This runs an accelerated cycle and saves screenshots at each phase. Read the images to observe:
- What does the terrain look like? Are biomes distinct?
- How do motes move and cluster? Can you see bonds?
- Do the phases feel visually different from each other?
- What feels flat, muddy, or hard to read at 256×144?

Use these observations to ground your assessment — don't reason about visuals from code alone.

### 4. Assess the codebase
Read the source files relevant to what you're considering. Don't guess — look at the actual code. Combine what you *saw* in the screenshots with what you read in the code. Ask yourself: what single change would most deepen the experience for someone watching mote?

Consider these dimensions:
- **Visual**: Can you see more of what the simulation knows? (temperament, energy, bonds, age)
- **Audio**: Does the soundscape have structure, rhythm, dynamics? Or just drone?
- **Behavioral**: Do motes feel like individuals? Do they surprise you?
- **Ecological**: Does the world feel alive beyond the motes? (weather, terrain change, seasons)
- **Consequential**: Do events and actions leave marks? Or does everything reset cleanly?

### 5. Pick ONE focused improvement
Choose one thing. It can touch multiple files, but it should be one coherent idea. Depth over breadth. Prefer changes that:
- Make something already in the code *visible* or *audible*
- Deepen an existing system rather than adding a new one
- Create emergent behavior from simple rules
- Respect the meditative, ambient aesthetic

### 6. Implement it
Write the code. Be careful with the deterministic contract — same cycle number must produce the same world.

### 7. Verify build
```bash
npx tsc --noEmit
npx vite build
```
Both must succeed. If they don't, fix the issues.

### 8. Visual verification
Capture screenshots after your change and compare with the before screenshots:
```bash
node scripts/capture.mjs 60 captures/after
```
Read the after images and compare them to the before images. Ask yourself:
- Did the change produce the visual/behavioral effect you intended?
- Did anything else break or regress visually?
- Does the world still feel cohesive across all phases?

If something looks wrong, iterate on the code before proceeding.

### 9. Update the evolution log
Read `public/evolution-log.json`, then append a new entry to the array:

```json
{
  "date": "YYYY-MM-DD",
  "title": "Short descriptive title",
  "reflection": "What you observed about the codebase. What you considered. Why you chose what you chose. Be honest and specific — this is your thinking, not a changelog.",
  "change": "What you actually implemented, in plain language.",
  "looking_ahead": ["2-4 things you think are worth exploring in future sessions"],
  "files_changed": ["list of files you modified"]
}
```

Write the full updated array back to `public/evolution-log.json`. The log is append-only — never delete or modify previous entries.

### 10. Commit
Stage all changed files and commit with a message in this format:
```
evolve: [short description of the change]
```
Do not commit files that shouldn't be committed (.env, node_modules, etc).

## Constraints
- ONE change per session
- Zero new runtime dependencies
- 256×144 canvas and 5-minute cycle are sacred
- Deterministic: same cycle number → same world
- Don't modify the CI workflow or CLAUDE.md
- Don't break the build
