# Vault Maintenance Improvements — Design Spec

**Date:** 2026-04-11
**Feedback source:** Field reports from OSRPS and RCCS agents (items #4, #6, #9)

---

## #4 — links-to Validation

### Problem

`links-to` frontmatter accepts any string with no validation. Agents silently create dangling references — ironic given the vault has a note about the dangling wikilink anti-pattern.

### Design

New function `validateLinksTo(linksTo, index, plannedLinks)` in `core/frontmatter.js`.

**Input:**
- `linksTo` — array of note title strings from frontmatter
- `index` — vault index (array of `{ title, ... }` objects from `buildIndex()`)
- `plannedLinks` — array of planned note titles extracted from the project index (wikilinks that don't match existing notes but have descriptions)

**Output:**
```js
{ valid: ['Existing Note', 'Planned Note'], dangling: ['Nonexistent Note'] }
```

**Logic:**
1. Build a Set of existing titles (case-insensitive) from the vault index
2. Build a Set of planned titles (case-insensitive) from planned links
3. For each links-to entry: if it's in either set, it's valid. Otherwise, it's dangling.

**Integration:** The function lives in `core/frontmatter.js` (alongside existing validation). The quality gate (`core/quality-gate.js`) calls it — this extends the gate with link integrity checking. The gate needs the vault index and project index as new parameters.

**Behavior:** Dangling links-to entries produce warnings, not errors. The note is still written. Warnings are surfaced to the agent so it can fix or acknowledge them.

**Testing:**
- Existing title passes validation
- Planned link (in project index but not yet created) passes validation
- Truly dangling title (neither existing nor planned) is flagged
- Case-insensitive matching
- Empty links-to array passes with no warnings
- Missing links-to field passes with no warnings

---

## #6 — vault-seed Checkpoint/Resume

### Problem

vault-seed sessions interrupted mid-write lose user decisions (yes/not now/skip all). The planned wikilinks pattern provides implicit state, but there's no way to distinguish "not yet offered" from "user said not now" on resume.

### Design

**Manifest file:** `{vault}/projects/{project}/seed-manifest.json`

Written at the start of Phase 3 (after user approves the note list), updated after each note decision.

**Schema:**
```json
{
  "created": "2026-04-11",
  "project": "claudian",
  "notes": [
    { "title": "System Architecture", "status": "created", "path": "architecture/system-architecture.md" },
    { "title": "Module Map", "status": "deferred", "path": null },
    { "title": "Hook Lifecycle", "status": "skipped", "path": null },
    { "title": "Quality Gate Criteria", "status": "pending", "path": null }
  ]
}
```

**Statuses:** `pending` (not yet offered), `created` (written successfully), `deferred` (user said "not now"), `skipped` (user said "skip all" — remaining notes get this).

**Flow:**
1. Phase 3 Step 1: Write manifest with all approved notes as `pending`
2. Before offering each note: read manifest, skip `created`/`skipped` notes
3. After each user decision: update manifest with new status and path (if created)
4. On resume (subsequent vault-seed run): detect existing manifest, show status summary ("3 created, 2 deferred, 1 pending"), offer to continue
5. Cleanup: delete manifest when all notes are `created` or `skipped` (no pending/deferred remaining)

**SessionStart integration:** If a seed-manifest.json exists for the current project with pending or deferred notes, add to session context:

> "vault-seed has N unfinished notes for {project}. Run /vault-seed to resume."

**Where changes go:**
- `skills/vault-seed/SKILL.md` — manifest read/write instructions in Phase 3
- `hooks/session-start.runner.js` — manifest detection and nudge

**Testing:**
- Manifest is written with correct initial state
- Resume detects existing manifest and skips created notes
- SessionStart nudges when manifest has pending/deferred notes
- SessionStart does not nudge when no manifest exists
- Manifest is cleaned up when all notes are resolved

---

## #9 — Agent Triggers

### Problem

vault-gardener and vault-reviewer exist but have no automatic triggers. They're manual-only, so they never get run.

### Design

**Post-write auto-review (vault-reviewer):**

vault-write skill gains a final step: "Dispatch vault-reviewer as a background subagent to review the note you just wrote."

The agent dispatches the reviewer via the Agent tool with `run_in_background: true`. The reviewer checks frontmatter completeness, content quality, wikilink validity, and file placement. Results surface as a background notification.

vault-seed Phase 4 already dispatches the reviewer — no change needed there.

**SessionStart gardener nudge:**

SessionStart hook checks for a timestamp file at `{vault}/.claudian/gardener-last-run`. Logic:

1. If file doesn't exist → nudge ("Vault maintenance has never run")
2. If file exists and is older than 7 days → nudge ("Vault maintenance hasn't run in N days")
3. If file exists and is recent → no nudge

Nudge text: "Vault maintenance hasn't run in N days. Consider running /vault-gardener."

vault-gardener agent instructions are updated to write/update the timestamp file on completion.

**Where changes go:**
- `skills/vault-write/SKILL.md` — add final step for background reviewer dispatch
- `hooks/session-start.runner.js` — add gardener staleness check
- `agents/vault-gardener.md` — add timestamp write instruction

**Testing:**
- SessionStart nudges when timestamp is missing
- SessionStart nudges when timestamp is older than 7 days
- SessionStart does not nudge when timestamp is recent
- Timestamp file is written correctly (ISO date string)

---

## Non-Goals

- Blocking writes on dangling links-to (warn only)
- Automatic gardener runs via cron (nudge is sufficient for now)
- Backlinks index (separate concern, not addressed here)
- Changing vault-stub behavior (it already handles planned links correctly)

## Dependencies Between Items

These three items are independent and can be implemented in any order. The only shared touchpoint is `session-start.runner.js`, which gets additions from both #6 (manifest nudge) and #9 (gardener nudge). These are additive — no conflicts.
