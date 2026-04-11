# Hook Noise Reduction — Design Spec

**Date:** 2026-04-11
**Feedback source:** Field reports from OSRPS and RCCS agents (see vault: Field Feedback — April 2026)

## Problem

UserPromptSubmit hook fires vault note suggestions on nearly every message, regardless of relevance. Two independent agents confirmed they've learned to mentally skip the suggestions, which means genuinely relevant ones get missed too.

Root cause: `matchKeywords()` in `user-prompt-submit.runner.js` uses substring matching with a 3-char minimum word length. Any note with a common title word (e.g., "design", "pattern", "plugin", "system") matches casual messages. No scoring, no threshold — a single generic word triggers the suggestion.

## Design

### Change 1: Short message bypass

Messages under 20 characters return empty output immediately. Handles "yes", "do it", "go ahead", "push", etc.

### Change 2: Replace `matchKeywords()` with `scoreMatch()`

New exported function `scoreMatch(message, note)` returns a numeric relevance score:

- **Title word matching:** Split title on word boundaries (`/[\s\-_]+/`), require 5+ chars (up from 3), whole-word match via Set lookup instead of substring. Each match = **2 points**.
- **Tag matching:** Each tag found in message words = **3 points**. Tags are intentionally specific, so they get higher weight.
- Message is split into word tokens via `/[\s\-_.,;:!?()\[\]"']+/`.

Minimum score threshold: **4 points**. This requires at least:
- 2 title word matches (2+2=4), or
- 1 tag + 1 title word (3+2=5), or
- 2 tag matches (3+3=6)

A single generic word can never trigger a suggestion.

### Change 3: Sort by score, reduce cap

- Sort matched notes by score descending.
- Reduce cap from 5 to 3 suggestions per message.

### Change 4: Export `scoreMatch` for testing

Replace `matchKeywords` export with `scoreMatch`. Update test file to use the new function.

## Files Changed

| File | Change |
|------|--------|
| `hooks/user-prompt-submit.runner.js` | Replace `matchKeywords()` with scored matching, add short message bypass |
| `tests/hooks/user-prompt-submit.test.js` | Rewrite tests for new scoring behavior |

## Test Cases

1. Short messages ("yes", "do it") return no suggestions
2. Messages with one generic word (e.g., "check the pattern") below threshold return no suggestions
3. Messages with 2+ specific words matching a note return that note
4. Tag matches score higher than title matches
5. Results are sorted by score descending
6. Maximum 3 results returned
7. Existing visibility filtering still works (project-only, cross-project, relevant-to)
8. Empty message returns no suggestions
9. Edge case: message contains tag as substring of a larger word — should NOT match (whole-word only)

## Non-Goals

- Changing SessionStart hook behavior (it surfaces a one-time table, not per-message)
- Adding a stopword list (5-char minimum + whole-word matching handles most cases; can add later if needed)
- Changing the note index format or caching strategy
