---
name: vault-graph
description: Summarize an archived graphify knowledge-graph report — cross-cluster bridges, hyperedges, knowledge gaps — and surface Claudian actions. Use when asked about the shape of the vault, ambient connections, or synthesis candidates.
---

# vault-graph

Render a Claudian-flavored summary of a graphify `GRAPH_REPORT.md` archived under `<vault>/reports/graph-<YYYY-MM-DD>/`. Claudian does not build the graph — graphify does (`pipx install graphifyy`, then `/graphify <vault>` in its own session). This skill reads the archive and translates it into suggested `vault-write` / `vault-link` actions.

## When to Use

- User asks "what's the shape of the vault?" or "any ambient connections I'm missing?"
- After a fresh graphify run has dropped outputs under `<vault>/reports/graph-*/`
- Before a synthesis writing session, to surface bridge candidates

## Locating the Report

Default: most recent `<vault>/reports/graph-*/GRAPH_REPORT.md` (sort dirs by name; convention is `graph-YYYY-MM-DD`).

With arg: `/vault-graph <path>` — path may be a `graph-YYYY-MM-DD/` directory or a direct `GRAPH_REPORT.md`.

If nothing matches, see **No Graph Found**.

## Steps

### 1. Read only the sections you need

`GRAPH_REPORT.md` can be ~300 lines. Read with offset/limit — pull only:

- `## Summary` (counts + extraction mix)
- `## Surprising Connections` (cross-cluster INFERRED bridges)
- `## Hyperedges` (multi-node pattern families)
- `## Knowledge Gaps` (isolated nodes + thin communities)
- `## Suggested Questions` (graph-derived prompts)

Skip `## Communities` — dozens of entries, hundreds of lines, low signal for a summary pass.

### 2. Render the summary

```
VAULT-GRAPH — graph-<YYYY-MM-DD>
<N> nodes · <M> edges · <K> communities · <X>% EXTRACTED / <Y>% INFERRED

TOP CROSS-CLUSTER BRIDGES  (synthesis candidates)
  1. <Node A>  ⟷  <Node B>  [INFERRED · conf <c>]
     <a-source-path>  →  <b-source-path>
  2. …
  (up to 5)

TOP HYPEREDGES  (latent pattern families)
  1. <label> — <n> nodes  [EXTRACTED|INFERRED · conf]
  2. …
  (up to 5)

KNOWLEDGE GAPS
  <N> isolated nodes (≤1 connection). Examples: <first 3 labels>
  <T> thin communities (<3 nodes) — consider pruning or enriching

CLAUDIAN ACTIONS
  - Synthesis candidates: run /vault-write on bridge #1 and #3 — no cross-link exists today.
  - Orphan hygiene: /vault-link on <isolated-node-X>.
  - Hyperedge #2 is a real pattern — one /vault-write with links-to for each member.
```

Populate with real data from the report. If a section has fewer than 5 entries, show what's there; don't invent.

### 3. Offer a follow-up

Pick the single most interesting bridge — the one that crosses the most distant clusters or has the highest INFERRED confidence — and ask:

> "Bridge **<A>** ⟷ **<B>** looks like the strongest synthesis candidate. Want me to draft a `/vault-write` for it?"

If yes, proceed with `vault-write`. If no, stop.

## No Graph Found

If no `<vault>/reports/graph-*/GRAPH_REPORT.md` exists, print:

```
No graphify report archived in this vault.

To produce one:
  1. pipx install graphifyy
  2. graphify claude install   (installs graphify's own Claude Code skill)
  3. In a Claude Code session: /graphify <vault-path>
  4. After it finishes (~4–5 min, Claude-orchestrated with token cost),
     move graphify-out/ into <vault>/reports/graph-<YYYY-MM-DD>/.
  5. Re-run /vault-graph.

graphify: https://github.com/safishamsi/graphify
```

Do not try to invoke graphify from this skill. Graphify's pipeline is multi-turn LLM orchestration (detect → parallel subagent extraction → cluster → label → export); it lives in graphify's own skill, not wrapped inside Claudian.
