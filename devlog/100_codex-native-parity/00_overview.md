# 100 — Codex Native Parity Plan

Date: 2026-06-20

## Goal

Phase 90 proved that opencodex can make Codex CLI/App treat the proxy as a native Codex
provider by injecting the right provider config and model catalog. Phase 100 is the next
parity pass: audit every Codex-native catalog/runtime selector that opencodex currently
inherits from a template, then decide which fields should be preserved, rewritten, or stripped
for routed non-OpenAI models.

This is planning only. No runtime code is changed in this phase log.

## Research Split

The investigation was split lexicographically by decade:

| File | Topic |
| --- | --- |
| `10_search-and-tool-discovery.md` | `supports_search_tool`, `web_search_tool_type`, hosted vs deferred search fallback |
| `20_personality-model-messages.md` | `model_messages`, `supports_personality`, prompt identity/personality support |
| `30_tool-mode-multi-agent.md` | `tool_mode`, `multi_agent_version`, code-mode and subagent selector behavior |
| `40_responses-lite-websockets.md` | `use_responses_lite`, `supports_websockets`, HTTP/SSE vs WS viability |
| `50_streaming-thinking-context.md` | intermediate text, thinking blocks, token usage, context window metadata |
| `90_phase-plan.md` | implementation order and verification gates |

## Primary Finding

opencodex intentionally clones a native Codex model template so Codex's strict catalog parser and
App/TUI picker recognize routed model entries. That was necessary for Phase 90, but it means routed
models can also inherit native-only runtime selectors:

- hosted/deferred search capabilities;
- `model_messages` identity/personality templates;
- code-mode tool exposure;
- multi-agent V1/V2/disabled selection;
- responses-lite behavior;
- context-window and token accounting defaults;
- websocket capability hints.

For routed models, every inherited field should be considered unsafe until opencodex either proves
it is provider-neutral or normalizes it deliberately.

## Recommended Principle

Use native Codex metadata only as a structural template. For routed entries:

1. Preserve fields that are purely parser/picker compatibility.
2. Rewrite fields that mention model identity, provider identity, reasoning semantics, context size,
   tool exposure, or runtime transport.
3. Strip fields that advertise native OpenAI-only capability unless opencodex implements an
   equivalent bridge.

## Highest Priority Fixes

1. Rewrite or strip `model_messages` for routed models so GPT/Codex/OpenAI identity does not leak
   through `instructions_template`.
2. Normalize `tool_mode`, `multi_agent_version`, and `use_responses_lite` instead of inheriting them
   silently from the native template.
3. Do not set `supports_websockets = true` until opencodex has an end-to-end Responses websocket
   proxy; the current routed path is still mostly HTTP/SSE Chat Completions upstream.
4. Add provider/model-specific context-window metadata instead of inheriting native GPT limits.
5. Extend usage/reasoning streaming parity so Codex receives cached/reasoning token details and the
   correct reasoning channel shape.

## Source Baseline

The upstream Codex source inspected for this planning pass was cloned at:

```text
/tmp/opencodex-codex-src
```

The inspected commit was:

```text
c83618ab2098525d343df2160d98b2449dca6d5d
```

The main opencodex implementation surfaces referenced by the plan are:

```text
/Users/jun/Developer/new/700_projects/opencodex/src/codex-catalog.ts
/Users/jun/Developer/new/700_projects/opencodex/src/server.ts
/Users/jun/Developer/new/700_projects/opencodex/src/bridge.ts
/Users/jun/Developer/new/700_projects/opencodex/src/responses/parser.ts
/Users/jun/Developer/new/700_projects/opencodex/src/types.ts
```
