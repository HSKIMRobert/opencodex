# 100.40 — Responses Lite and Websockets

## Questions

- What is `use_responses_lite`?
- What is `supports_websockets`?
- Can opencodex gain speed by setting `supports_websockets = true` even though most upstreams are
  Chat Completions?

## Codex RS Behavior: `use_responses_lite`

`use_responses_lite` is model metadata. It defaults to false.

When true, Codex changes outgoing Responses behavior:

- strips image `detail` fields;
- sets reasoning `context = all_turns`;
- disables `parallel_tool_calls`;
- sends `x-openai-internal-codex-responses-lite: true` on HTTP/compact paths;
- sends websocket client metadata `responses_lite = true` on WS paths;
- suppresses hosted Responses tools and exposes standalone image-generation / web-search tools.

Relevant upstream paths:

```text
/tmp/opencodex-codex-src/codex-rs/protocol/src/openai_models.rs:408
/tmp/opencodex-codex-src/codex-rs/models-manager/src/model_info.rs:68
/tmp/opencodex-codex-src/codex-rs/core/src/client_common.rs:52
/tmp/opencodex-codex-src/codex-rs/core/src/client.rs:700
/tmp/opencodex-codex-src/codex-rs/core/src/client.rs:759
/tmp/opencodex-codex-src/codex-rs/core/src/client.rs:811
/tmp/opencodex-codex-src/codex-rs/core/src/client.rs:840
/tmp/opencodex-codex-src/codex-rs/core/src/client.rs:1644
/tmp/opencodex-codex-src/codex-rs/core/src/client.rs:1746
/tmp/opencodex-codex-src/codex-rs/core/src/tools/spec_plan.rs:291
/tmp/opencodex-codex-src/codex-rs/core/src/tools/spec_plan.rs:397
/tmp/opencodex-codex-src/codex-rs/core/src/tools/spec_plan.rs:618
```

## Codex RS Behavior: `supports_websockets`

`supports_websockets` is provider metadata. It defaults to false. Codex chooses the websocket path
only when all of these are true:

- `wire_api == Responses`
- provider `supports_websockets == true`
- no active fallback flag prevents websocket use

The built-in OpenAI provider sets `supports_websockets = true`.

Relevant upstream paths:

```text
/tmp/opencodex-codex-src/codex-rs/model-provider-info/src/lib.rs:134
/tmp/opencodex-codex-src/codex-rs/model-provider-info/src/lib.rs:324
/tmp/opencodex-codex-src/codex-rs/codex-api/src/endpoint/responses_websocket.rs:334
```

## Current opencodex Behavior

opencodex currently injects a Responses provider, but it does not inject
`supports_websockets = true`.

That means Codex should stay on the HTTP/SSE Responses path for opencodex.

For routed non-OpenAI providers, opencodex usually translates Codex Responses requests into
provider-specific HTTP APIs, frequently OpenAI-compatible Chat Completions streaming. There is no
end-to-end Responses websocket proxy today.

## Gap

If routed catalog entries inherit `use_responses_lite = true` from a future native template, Codex
could change request semantics in ways opencodex did not deliberately implement:

- altered image detail handling;
- altered reasoning context;
- disabled parallel tool calls;
- standalone hosted-tool assumptions.

If opencodex sets `supports_websockets = true` without implementing the protocol, Codex may attempt
WS and incur fallback overhead or fail with a protocol mismatch.

## Speed Assessment

Setting `supports_websockets = true` is not expected to materially improve speed for most routed
models today. The upstream provider path is still HTTP/SSE Chat Completions or another HTTP stream,
so a Codex-to-opencodex websocket would only change the first hop while opencodex still waits on the
same provider stream.

A real speed benefit is only plausible for:

1. native OpenAI Responses passthrough with an end-to-end Responses websocket proxy; or
2. providers that themselves expose a low-latency websocket protocol opencodex can bridge without
   converting back to HTTP/SSE internally.

## Phase 100 Recommendation

1. Do not set `supports_websockets = true` for opencodex until the server implements the Codex
   Responses websocket protocol.
2. Strip or explicitly set `use_responses_lite = false` for routed non-OpenAI models unless
   opencodex implements the related request-shape differences.
3. Preserve `use_responses_lite` only for native OpenAI passthrough models if Codex's native template
   requires it.
4. Add a regression test that routed entries cannot inherit `use_responses_lite` silently.
