---
title: Why Payment Gateway Abstraction Matters
category: Payments
excerpt: >-
  Hard-coding a single PSP into your codebase feels fine until client #2
  needs a different one. Notes on building a gateway layer that doesn't
  fight you later.
---

The first payment gateway integration always feels simple. You read the docs, wire up a checkout flow, and ship it. The trouble starts with the second gateway — and the third, and the client who insists on the one you haven't used yet.

## The problem with direct integration

When gateway-specific logic leaks into your application code, every new provider means touching business logic that has nothing to do with payments. Refund flows, webhook handling, and currency formatting all start to fork by provider, and the codebase gets harder to reason about with each addition.

## What a middleware layer buys you

A unified middleware layer normalizes the request and response shape across providers, so the rest of the application only ever talks to one interface. The gateway becomes a configuration choice per client, not a code change.

- One consistent transaction model, regardless of provider
- Gateway switching without touching business logic
- Centralized retry, logging, and reconciliation behavior

> The goal isn't to predict every gateway you'll ever need — it's to make adding the next one a config change, not a rewrite.

## Where to draw the abstraction line

Not everything needs to be abstracted on day one. Start with the operations every provider shares — charge, refund, and status lookup — and let provider-specific features surface through clearly scoped extension points instead of forcing them into the shared interface.
