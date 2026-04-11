# SessionStart Git-Context Search & Backlinks Index — Design Spec

**Date:** 2026-04-11
**Feedback source:** Field reports from RCCS agent (items #7, #8)

---

## #7 — Git-Context Boost in SessionStart Ranking

### Problem

SessionStart ranks notes by project match, tag overlap, and recency. It doesn't consider git context (branch name, recent work), so the top 20 notes can miss relevant content. The agent can't search until the user sends a message.

### Design

Extend `scoreNote()` in `core/relevance.js` with a git-context scoring component.

**Git signals extracted in SessionStart hook:**
1. Branch name — `git branch --show-current`, split on `/`, `-`, `_` to get keywords
2. Recent commit subjects — `git log --oneline -5 --format=%s`, split into words

**Keyword extraction:** Filter to words 5+ chars, lowercase, deduplicate. Reuse the same tokenization logic as UserPromptSubmit's `scoreMatch`.

**Scoring in `scoreNote()`:**
- Each git keyword matching a note's title word (5+ chars, case-insensitive) or tag: **+2 points**
- Cap at **+10 points** to prevent git context from dominating project/tag relevance

**Signature changes:**
- `scoreNote(note, currentProject, currentTags, gitKeywords = [])` — new optional 4th param
- `rankNotes(index, currentProject, currentTags, gitKeywords = [])` — passes through to scoreNote

**SessionStart hook changes:**
- Extract git keywords using `execFileSync('git', [...])` from `node:child_process`
- Pass keywords to `rankNotes()`
- Wrap in try/catch — if git commands fail (not a git repo, git not installed), fall back to empty keywords

**New function in `hooks/session-start.runner.js`:**
```
function extractGitKeywords(cwd) {
  // Returns string[] of lowercase keywords from branch name + recent commits
}
```

Lives in the hook runner (not core/) to keep core modules free of subprocess calls. Uses `execFileSync` from `node:child_process` (builtin). Returns empty array on failure.

**Testing:**
- `extractGitKeywords` returns keywords from branch name
- `extractGitKeywords` returns keywords from recent commits
- `extractGitKeywords` returns empty array when not a git repo
- `scoreNote` boosts score when git keywords match title/tags
- Git keyword boost is capped at 10 points
- `rankNotes` with git keywords reorders results

---

## #8 — Backlinks Index in buildIndex()

### Problem

Discovering "what links to this note" requires grepping the vault. vault-gardener, vault-link, and vault-reviewer all need this information but have no efficient way to get it.

### Design

Extend `buildIndex()` in `core/relevance.js` to produce a backlinks map alongside the existing index.

**During the vault walk, for each note:**
1. Extract `[[wikilinks]]` from the body via `/\[\[([^\]]+)\]\]/g`, handling `[[target|alias]]` by taking the part before `|`
2. Extract `links-to` array from frontmatter
3. Store outbound links per note

**After the walk, invert into a backlinks map:**
```
for each note:
  for each outbound link title (lowercased):
    backlinks[lowercased_title].push(note.title)
```

**Return value:** `buildIndex()` changes from `{ index, warnings }` to `{ index, warnings, backlinks }`.

`backlinks` is a plain object: `{ [lowercasedTitle: string]: string[] }`. Keys are lowercased target titles, values are arrays of source note titles (original case).

**Cache integration:** SessionStart caches `{ project, index, backlinks }`. UserPromptSubmit ignores the backlinks field (it only reads `project` and `index`).

**Consumer updates (instruction-level, not code):**
- vault-gardener agent: "Read backlinks from the SessionStart cache. A note with zero backlinks and no project index entry is an orphan."
- vault-link skill: "Check backlinks to see what already links to a note before adding new links."
- vault-reviewer agent: "Verify that notes with many backlinks are high-quality — they're load-bearing."

**Testing:**
- buildIndex returns backlinks map
- Body `[[wikilinks]]` are captured as backlinks
- `links-to` frontmatter entries are captured as backlinks
- Aliased wikilinks `[[target|alias]]` resolve to the target
- Backlinks are case-insensitive (keys lowercased)
- Notes with no inbound links have no entry in backlinks
- Empty vault returns empty backlinks object

---

## Non-Goals

- Interactive vault-search during SessionStart (hooks can't receive agent input)
- Persisting backlinks to a separate file (index cache is sufficient)
- Changing UserPromptSubmit to use backlinks (no use case yet)
- Full-text search beyond keyword matching

## Dependencies

These are independent. #8 (backlinks) enriches the index that #7 (git-context) scores against, but neither requires the other to function. They can be implemented in either order.
