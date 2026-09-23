---
title: "Idempotency in Payment Systems: How to Stop Double Charges Caused by Retries and Network Failures"
category: Payments
excerpt: >-
  A short, diagram-led deep-dive on why duplicate transactions happen, how
  timeouts and retries turn one payment into two, and how to design
  idempotency keys properly — with real failure scenarios and Laravel code
  you can copy. Readable in about 10–15 minutes.
---

{% raw %}
A customer taps **Pay**. The spinner turns for eight seconds. Nothing happens, so they tap again. Two minutes later their bank app shows **two** charges of LKR 5,000, and your support inbox gets an angry email.

Nobody wrote a bug that says "charge twice". The duplicate came from something ordinary: a slow network, a retry, an impatient thumb. Any system that moves money over a network **will** see the same request more than once. The question is whether it charges more than once.

The fix is **idempotency**. This note explains why duplicates happen, walks through real failure scenarios, and then builds an idempotency layer step by step in Laravel.

If you are new to how online payments flow, read [Payment Gateways Explained](/blog/payment-gateways-explained-laravel/) first.

---

## What "idempotent" means

An operation is **idempotent** if doing it once or doing it many times gives the same result.

- Pressing a lift's call button five times still calls the lift once. That's idempotent.
- `SET balance = balance - 100` takes more money every time it runs. **Not** idempotent.

HTTP `GET`, `PUT` and `DELETE` are supposed to be idempotent. `POST` is not, and `POST /payments` is where the money moves. So we have to **make** it idempotent ourselves.

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparison. Without idempotency, three POST /pay requests create three charges. With the same idempotency key on all three, only the first creates a charge and the other two replay the saved result.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <defs>
    <marker id="i1r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f87171"/></marker>
    <marker id="i1g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4ade80"/></marker>
    <marker id="i1s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"/></marker>
  </defs>

  <rect x="1" y="1" width="329" height="248" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="16" y="26" fill="#b91c1c">✗  Without idempotency</text>
  <g>
    <rect x="20" y="44" width="120" height="40" rx="7" fill="#fff" stroke="#fca5a5"/>
    <text class="m" x="80" y="61" text-anchor="middle">POST /pay</text>
    <text class="n" x="80" y="77" text-anchor="middle">no key</text>
    <rect x="20" y="94" width="120" height="40" rx="7" fill="#fff" stroke="#fca5a5"/>
    <text class="m" x="80" y="111" text-anchor="middle">POST /pay</text>
    <text class="n" x="80" y="127" text-anchor="middle">retry</text>
    <rect x="20" y="144" width="120" height="40" rx="7" fill="#fff" stroke="#fca5a5"/>
    <text class="m" x="80" y="161" text-anchor="middle">POST /pay</text>
    <text class="n" x="80" y="177" text-anchor="middle">retry</text>
    <path d="M140 64 H186 M140 114 H186 M140 164 H186" stroke="#f87171" stroke-width="1.5" marker-end="url(#i1r)"/>
    <rect x="190" y="44" width="120" height="40" rx="7" fill="#fee2e2" stroke="#fca5a5"/>
    <text class="t" x="250" y="69" text-anchor="middle">Charge 5,000</text>
    <rect x="190" y="94" width="120" height="40" rx="7" fill="#fee2e2" stroke="#fca5a5"/>
    <text class="t" x="250" y="119" text-anchor="middle">Charge 5,000</text>
    <rect x="190" y="144" width="120" height="40" rx="7" fill="#fee2e2" stroke="#fca5a5"/>
    <text class="t" x="250" y="169" text-anchor="middle">Charge 5,000</text>
  </g>
  <text class="h" x="16" y="214" fill="#b91c1c">3 requests → 3 charges</text>
  <text class="n" x="16" y="234">The customer pays LKR 15,000.</text>

  <rect x="350" y="1" width="329" height="248" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="366" y="26" fill="#15803d">✓  With an idempotency key</text>
  <g>
    <rect x="370" y="44" width="120" height="40" rx="7" fill="#fff" stroke="#86efac"/>
    <text class="m" x="430" y="61" text-anchor="middle">POST /pay</text>
    <text class="n" x="430" y="77" text-anchor="middle">key: 7c9e…</text>
    <rect x="370" y="94" width="120" height="40" rx="7" fill="#fff" stroke="#86efac"/>
    <text class="m" x="430" y="111" text-anchor="middle">POST /pay</text>
    <text class="n" x="430" y="127" text-anchor="middle">key: 7c9e…</text>
    <rect x="370" y="144" width="120" height="40" rx="7" fill="#fff" stroke="#86efac"/>
    <text class="m" x="430" y="161" text-anchor="middle">POST /pay</text>
    <text class="n" x="430" y="177" text-anchor="middle">key: 7c9e…</text>
    <path d="M490 64 H536" stroke="#4ade80" stroke-width="1.5" marker-end="url(#i1g)"/>
    <path d="M490 114 H536 M490 164 H536" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#i1s)"/>
    <rect x="540" y="44" width="125" height="40" rx="7" fill="#dcfce7" stroke="#86efac"/>
    <text class="t" x="602" y="69" text-anchor="middle">Charge 5,000</text>
    <rect x="540" y="94" width="125" height="40" rx="7" fill="#fff" stroke="#cbd5e1" stroke-dasharray="4 3"/>
    <text class="s" x="602" y="119" text-anchor="middle">Replay saved result</text>
    <rect x="540" y="144" width="125" height="40" rx="7" fill="#fff" stroke="#cbd5e1" stroke-dasharray="4 3"/>
    <text class="s" x="602" y="169" text-anchor="middle">Replay saved result</text>
  </g>
  <text class="h" x="366" y="214" fill="#15803d">3 requests → 1 charge</text>
  <text class="n" x="366" y="234">Retries get the first answer back.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The retries still arrive. The difference is that the server recognises them by their key and doesn't charge again.</figcaption>
</figure>

The goal is **not** to stop retries. Retries are how systems recover from failure, so you want them. The goal is to make a retry **safe**.

---

## Why duplicates happen: the ambiguous timeout

Every network call ends in one of three ways:

<div markdown="1">

| Outcome | What the caller knows | Safe to retry blindly? |
| --- | --- | --- |
| **Success** response received | It worked | No need |
| **Failure** response received (e.g. card declined) | It didn't work | Yes, as a *new* attempt |
| **No response** (timeout, dropped connection, crash) | **Nothing.** It might have worked | **No.** This is where double charges come from |

</div>

The third row causes the trouble. A timeout means "I don't know", not "it failed". The request might have died on the way to the server, or the server might have finished the job and the reply was lost on the way back. From the client's side those two cases look **exactly the same**.

<figure>
<svg viewBox="0 0 680 362" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sequence diagram. The app sends POST /pay, the server charges the gateway and money moves, the gateway returns 200 OK, but the server's response to the app is lost. The app retries, the server charges again, and the customer is charged twice.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <defs>
    <marker id="i2k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker>
  </defs>
  <rect x="35" y="10" width="150" height="34" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="110" y="32" text-anchor="middle">Customer App</text>
  <rect x="265" y="10" width="150" height="34" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="340" y="32" text-anchor="middle">Your Server</text>
  <rect x="495" y="10" width="150" height="34" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="570" y="32" text-anchor="middle">Payment Gateway</text>
  <path d="M110 44 V352 M340 44 V352 M570 44 V352" stroke="#cbd5e1" stroke-dasharray="4 4"/>

  <text class="s" x="225" y="73" text-anchor="middle">1  POST /pay  (LKR 5,000)</text>
  <path d="M110 80 H338" stroke="#475569" stroke-width="1.5" marker-end="url(#i2k)"/>
  <text class="s" x="455" y="108" text-anchor="middle">2  charge</text>
  <path d="M340 115 H568" stroke="#475569" stroke-width="1.5" marker-end="url(#i2k)"/>
  <rect x="505" y="126" width="130" height="26" rx="6" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="570" y="144" text-anchor="middle">✓ Money moved</text>
  <text class="s" x="455" y="173" text-anchor="middle">3  200 OK (succeeded)</text>
  <path d="M570 180 H342" stroke="#475569" stroke-width="1.5" marker-end="url(#i2k)"/>
  <text class="s" x="225" y="208" text-anchor="middle" fill="#b91c1c">4  Wi-Fi drops, reply never arrives</text>
  <path d="M340 215 H150" stroke="#f87171" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text class="h" x="136" y="220" fill="#dc2626">✗</text>
  <rect x="35" y="232" width="150" height="26" rx="6" fill="#fef9c3" stroke="#fde047"/>
  <text class="s" x="110" y="249" text-anchor="middle">"Did it fail?" → retry</text>
  <text class="s" x="225" y="280" text-anchor="middle">5  POST /pay  (retry)</text>
  <path d="M110 287 H338" stroke="#475569" stroke-width="1.5" marker-end="url(#i2k)"/>
  <text class="s" x="455" y="310" text-anchor="middle">6  charge again</text>
  <path d="M340 317 H568" stroke="#475569" stroke-width="1.5" marker-end="url(#i2k)"/>
  <rect x="505" y="326" width="130" height="26" rx="6" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="570" y="344" text-anchor="middle" fill="#b91c1c">✗ Charged twice</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The server did everything right the first time. The duplicate comes from the retry, and the server can't tell the retry apart from a brand-new payment.</figcaption>
</figure>

There is no network setting that fixes this. Distributed systems can give you **at-most-once** delivery (never retry, so some payments are lost) or **at-least-once** delivery (retry, so some payments arrive twice). "Exactly once" doesn't exist on the wire. What you can build is **exactly-once processing**: at-least-once delivery combined with an idempotent receiver.

---

## Real-world failure scenarios

These are the duplicate-charge causes that show up again and again in production payment systems.

<div markdown="1">

| # | Scenario | What actually happens | Where the duplicate comes from |
| --- | --- | --- | --- |
| 1 | **The double tap** | A slow spinner, so the user taps Pay again or presses Enter twice | Two separate HTTP requests from the browser |
| 2 | **Mobile network drop** | The charge succeeds, then the phone switches from Wi-Fi to 4G and the reply is lost | The app's retry logic |
| 3 | **Refresh / back button** | The user refreshes the "processing" page and the browser re-POSTs the form | The browser |
| 4 | **Auto-retrying HTTP client** | Your server's HTTP client times out at 30s, the gateway answers at 35s, and the client retries | Your own infrastructure (SDKs, proxies, load balancers) |
| 5 | **Queue redelivery** | A worker charges the card and then crashes before acknowledging the job | The queue, because at-least-once delivery runs the job again |
| 6 | **Webhook redelivery** | The gateway sends `payment.succeeded` twice because your 200 reply was slow | The gateway, and the order ships twice |
| 7 | **Blind failover** | Gateway A times out, so the router retries on gateway B, but A had already charged | Your failover logic, and now the duplicate is on two different providers |

</div>

Scenario 7 is the nastiest. Gateway B can't know about A's charge, so the duplicate can't be detected downstream. The only safe rule is: **never fail over on a timeout**. Treat a timeout as `pending` and find out what happened.

Only scenario 1 is "the user's fault". Disabling the button fixes that one and none of the others. **Idempotency has to live on the server.**

---

## The idea: an idempotency key

The client attaches a unique ID to the payment attempt and sends the **same ID on every retry**:

```http
POST /api/payments HTTP/1.1
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
Content-Type: application/json

{ "order_id": 1042, "payment_method_id": "pm_card_visa" }
```

The server stores each key with the result it produced. When a key it has already seen arrives, it returns the **stored result** and doesn't run the payment again.

<figure>
<svg viewBox="0 0 680 398" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sequence diagram with an idempotency key. The app sends POST /pay with key 7c9e. The server saves the key as processing, charges the gateway with the same key, saves the response as completed, but the reply is lost. The app retries with the same key; the server finds the completed key and returns the same 200 OK without calling the gateway.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <defs>
    <marker id="i3k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker>
    <marker id="i3g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#16a34a"/></marker>
  </defs>
  <rect x="35" y="10" width="150" height="34" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="110" y="32" text-anchor="middle">Customer App</text>
  <rect x="265" y="10" width="150" height="34" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="340" y="32" text-anchor="middle">Your Server</text>
  <rect x="495" y="10" width="150" height="34" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="570" y="32" text-anchor="middle">Payment Gateway</text>
  <path d="M110 44 V388 M340 44 V388 M570 44 V388" stroke="#cbd5e1" stroke-dasharray="4 4"/>

  <text class="s" x="225" y="73" text-anchor="middle">1  POST /pay · key 7c9e</text>
  <path d="M110 80 H338" stroke="#475569" stroke-width="1.5" marker-end="url(#i3k)"/>
  <rect x="262" y="90" width="156" height="26" rx="6" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="s" x="340" y="107" text-anchor="middle">save key → processing</text>
  <text class="s" x="455" y="133" text-anchor="middle">2  charge · key 7c9e</text>
  <path d="M340 140 H568" stroke="#475569" stroke-width="1.5" marker-end="url(#i3k)"/>
  <rect x="505" y="150" width="130" height="26" rx="6" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="570" y="168" text-anchor="middle">✓ Money moved</text>
  <text class="s" x="455" y="193" text-anchor="middle">3  200 OK</text>
  <path d="M570 200 H342" stroke="#475569" stroke-width="1.5" marker-end="url(#i3k)"/>
  <rect x="252" y="210" width="176" height="26" rx="6" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="s" x="340" y="227" text-anchor="middle">save response → completed</text>
  <text class="s" x="225" y="255" text-anchor="middle" fill="#b91c1c">4  reply lost</text>
  <path d="M340 262 H150" stroke="#f87171" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text class="h" x="136" y="267" fill="#dc2626">✗</text>
  <text class="s" x="225" y="293" text-anchor="middle">5  retry · same key 7c9e</text>
  <path d="M110 300 H338" stroke="#475569" stroke-width="1.5" marker-end="url(#i3k)"/>
  <rect x="252" y="310" width="176" height="26" rx="6" fill="#dcfce7" stroke="#86efac"/>
  <text class="s" x="340" y="327" text-anchor="middle">key found, already completed</text>
  <text class="n" x="570" y="327" text-anchor="middle">(not called again)</text>
  <text class="s" x="225" y="355" text-anchor="middle" fill="#15803d">6  same 200 OK (replayed)</text>
  <path d="M340 362 H112" stroke="#16a34a" stroke-width="1.5" marker-end="url(#i3g)"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Same failure as before, with a key this time. The retry gets the original answer and the gateway is called only once. The key is also passed on to the gateway (step 2).</figcaption>
</figure>

---

## Designing idempotency keys correctly

The concept is simple. Most real bugs come from getting the details of the key wrong. Here are seven rules.

**1. One key per payment *intent*, not per HTTP request.** The key stands for "the customer's attempt to pay order #1042 with this card". Every retry of that attempt uses the same key. If you generate a new key inside your retry loop, you have switched the protection off.

**2. The client generates it, before the first try.** Only the caller knows that two requests are "the same attempt". Create the key when the checkout starts and keep it (in component state or `sessionStorage`) so it survives retries and even a page refresh.

**3. Make it unique and unguessable.** Use a UUID (v4, or v7 if you like time-ordered IDs). Timestamps collide, and auto-increment numbers can be guessed, which would let an attacker replay someone else's result.

**4. Scope it to the owner.** Store it as `(user_id, key)` or `(merchant_id, key)`, not just `key`, so two customers can never collide and nobody can read another user's saved response.

**5. Bind it to the request body.** Store a hash of the payload. If the same key comes back with a **different** amount or card, that's a client bug, and you should reject it (`422`) rather than silently replaying the old result.

**6. Give it a lifetime.** Keep keys at least as long as any client might still retry. 24 hours is a common choice (Stripe keeps keys for at least that long), and then a scheduled job prunes them.

**7. Pass it downstream.** Send the same key (or a key derived from it) to the payment gateway. If your server crashes between charging and saving, the gateway itself will de-duplicate your retry.

### What about just using the order ID?

It's tempting, but `order_id` alone is **too coarse**. If the first card is declined, the customer must be able to try a different card for the same order, and that's a new intent. Good options:

<div markdown="1">

| Key | Verdict |
| --- | --- |
| `crypto.randomUUID()` created at checkout start | ✅ Best default for user-initiated payments |
| `order:1042:attempt:2` | ✅ Fine if you track attempts on the server |
| `renewal:sub_88:2026-10` | ✅ Great for **server-side** jobs: deterministic, so a re-run of the job produces the same key |
| `order:1042` | ⚠️ Blocks a legitimate retry with a different card |
| `Date.now()` or a new UUID per HTTP call | ❌ Every retry looks new, so there's no protection |
| `user:17` | ❌ Collides across every payment the user makes |

</div>

The renewal example is worth remembering. For scheduled work there's no client, so **derive** the key from the business fact ("subscription 88, October billing"). If the cron job runs twice, both runs produce the same key.

---

## The server-side flow

Every request with a key goes through the same decision tree:

<figure>
<svg viewBox="0 0 720 388" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flowchart. Request arrives. If no Idempotency-Key, return 400. Otherwise insert the key with status processing. If inserted, run payment logic, save the response as completed, return it. If duplicate, load the existing record; if the request hash differs return 422; if not completed return 409; otherwise replay the saved response.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <defs>
    <marker id="i4k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker>
  </defs>
  <g stroke="#64748b" stroke-width="1.4" fill="none" marker-end="url(#i4k)">
    <path d="M170 44 V64"/>
    <path d="M280 84 H358"/>
    <path d="M170 102 V124"/>
    <path d="M290 144 H358"/>
    <path d="M170 162 V184"/>
    <path d="M450 162 V184"/>
    <path d="M540 204 H573"/>
    <path d="M170 222 V244"/>
    <path d="M450 222 V244"/>
    <path d="M540 264 H573"/>
    <path d="M170 282 V304"/>
    <path d="M450 282 V304"/>
  </g>

  <rect x="100" y="12" width="140" height="32" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="170" y="33" text-anchor="middle">Request arrives</text>

  <rect x="60" y="66" width="220" height="36" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="170" y="89" text-anchor="middle">Idempotency-Key present?</text>
  <text class="n" x="319" y="78" text-anchor="middle">no</text>
  <rect x="360" y="66" width="180" height="36" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="450" y="89" text-anchor="middle">400 Bad Request</text>
  <text class="n" x="180" y="118">yes</text>

  <rect x="50" y="126" width="240" height="36" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="170" y="149" text-anchor="middle">INSERT key, status = processing</text>
  <text class="n" x="325" y="138" text-anchor="middle">duplicate</text>
  <rect x="360" y="126" width="180" height="36" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="450" y="149" text-anchor="middle">Load existing record</text>
  <text class="n" x="180" y="178">inserted</text>

  <rect x="50" y="186" width="240" height="36" rx="8" fill="#fff" stroke="#cbd5e1"/>
  <text class="t" x="170" y="209" text-anchor="middle">Run payment logic</text>
  <rect x="360" y="186" width="180" height="36" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="450" y="209" text-anchor="middle">Same request hash?</text>
  <text class="n" x="557" y="198" text-anchor="middle">no</text>
  <rect x="575" y="186" width="140" height="36" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="645" y="209" text-anchor="middle">422 Key reused</text>
  <text class="n" x="460" y="238">yes</text>

  <rect x="50" y="246" width="240" height="36" rx="8" fill="#fff" stroke="#cbd5e1"/>
  <text class="t" x="170" y="269" text-anchor="middle">Save response, status = completed</text>
  <rect x="360" y="246" width="180" height="36" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="450" y="269" text-anchor="middle">Already completed?</text>
  <text class="n" x="557" y="258" text-anchor="middle">no</text>
  <rect x="575" y="246" width="140" height="36" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="645" y="269" text-anchor="middle">409 In progress</text>
  <text class="n" x="460" y="298">yes</text>

  <rect x="80" y="306" width="180" height="36" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="170" y="329" text-anchor="middle">Return response</text>
  <rect x="360" y="306" width="180" height="36" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="450" y="329" text-anchor="middle">Replay saved response</text>

  <text class="n" x="360" y="376" text-anchor="middle">The UNIQUE (user_id, key) index makes the INSERT step safe when two requests arrive at the same moment.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Left: the first time a key is seen. Right: every repeat. The status codes follow the IETF <code>Idempotency-Key</code> header draft (400 missing, 422 reused with a different body, 409 still in progress).</figcaption>
</figure>

### The race condition you must avoid

The obvious version is **wrong**:

```php
// ❌ Check-then-act: two parallel requests can both pass the check
if (! IdempotencyKey::where('key', $key)->exists()) {
    IdempotencyKey::create(['key' => $key]);
    $this->charge(...);   // both requests reach this line
}
```

A double tap sends two requests about 50ms apart. Both run the `SELECT`, both see nothing, and both charge. The fix is to let the **database** decide: attempt the `INSERT` against a `UNIQUE` index. Exactly one request can win that insert, however many arrive at once.

---

## Code: building it in Laravel

### Step 1 — The table

```php
Schema::create('idempotency_keys', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained();
    $table->uuid('key');
    $table->char('request_hash', 64);             // sha256 of method + path + body
    $table->string('status', 20);                 // processing | completed
    $table->unsignedSmallInteger('response_code')->nullable();
    $table->longText('response_body')->nullable();
    $table->timestamps();

    $table->unique(['user_id', 'key']);           // ← this index is the lock
});
```

### Step 2 — The middleware

```php
namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureIdempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');

        if (! $key || ! Str::isUuid($key)) {
            return response()->json(['error' => 'A UUID Idempotency-Key header is required.'], 400);
        }

        $hash = hash('sha256', $request->method().$request->path().$request->getContent());

        try {
            // Atomic claim: exactly one request can insert this (user_id, key) pair.
            $record = IdempotencyKey::create([
                'user_id'      => $request->user()->id,
                'key'          => $key,
                'request_hash' => $hash,
                'status'       => 'processing',
            ]);
        } catch (UniqueConstraintViolationException) {
            return $this->handleRepeat($request, $key, $hash);
        }

        $response = $next($request);

        if ($response->getStatusCode() >= 500) {
            // Our own code failed before any money moved (see Step 3), so allow a clean retry.
            $record->delete();
            return $response;
        }

        $record->update([
            'status'        => 'completed',
            'response_code' => $response->getStatusCode(),
            'response_body' => $response->getContent(),
        ]);

        return $response;
    }

    private function handleRepeat(Request $request, string $key, string $hash): Response
    {
        $record = IdempotencyKey::where('user_id', $request->user()->id)
            ->where('key', $key)
            ->firstOrFail();

        if (! hash_equals($record->request_hash, $hash)) {
            return response()->json(['error' => 'This key was already used with a different request.'], 422);
        }

        if ($record->status !== 'completed') {
            return response()->json(['error' => 'The original request is still processing.'], 409)
                ->header('Retry-After', '2');
        }

        return response($record->response_body, $record->response_code)
            ->header('Content-Type', 'application/json')
            ->header('Idempotent-Replayed', 'true');
    }
}
```

```php
// routes/api.php
Route::post('/payments', [PaymentController::class, 'store'])
    ->middleware(['auth:sanctum', EnsureIdempotency::class]);
```

Things to notice:

- **Declines are stored too.** A `402 card declined` is a *final* answer, so a retry with the same key gets the same decline. To try another card, the client sends a **new** key.
- **`5xx` releases the key**, but only because Step 3 guarantees a `5xx` means "nothing happened". If your code can't promise that, leave the key locked and reconcile (see "Stuck in processing" below).

### Step 3 — The controller: pass the key on, and treat timeouts as *pending*

```php
public function store(PayRequest $request, StripeClient $stripe): JsonResponse
{
    $order = $request->user()->orders()->findOrFail($request->order_id);
    $key   = $request->header('Idempotency-Key');

    $payment = $order->payments()->create([
        'amount_minor'    => $order->total_minor,     // integers, never floats
        'currency'        => $order->currency,
        'status'          => 'pending',
        'idempotency_key' => $key,                    // UNIQUE column: a second safety net
    ]);

    try {
        $intent = $stripe->paymentIntents->create([
            'amount'         => $order->total_minor,
            'currency'       => strtolower($order->currency),
            'payment_method' => $request->payment_method_id,
            'confirm'        => true,
            'metadata'       => ['payment_id' => $payment->id],
        ], [
            'idempotency_key' => $key,                // ← the gateway de-duplicates too
        ]);
    } catch (\Stripe\Exception\CardException $e) {
        $payment->update(['status' => 'failed', 'failure_reason' => $e->getDeclineCode()]);
        return response()->json(['id' => $payment->id, 'status' => 'failed'], 402);
    } catch (\Stripe\Exception\ApiConnectionException) {
        // Timeout or dropped connection: the charge MAY have happened.
        // Do not retry here and do not fail over. The webhook or a status check will settle it.
        return response()->json(['id' => $payment->id, 'status' => 'pending'], 202);
    }

    $payment->update([
        'status'            => $intent->status === 'succeeded' ? 'succeeded' : 'pending',
        'gateway_reference' => $intent->id,
    ]);

    return response()->json(['id' => $payment->id, 'status' => $payment->status], 201);
}
```

The `catch (ApiConnectionException)` block is the most important part of the whole article. It turns an ambiguous failure into an honest `pending` state instead of guessing "failed" and letting someone retry into a double charge.

### Step 4 — The client: retry with the **same** key

<figure>
<svg viewBox="0 0 680 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Timeline of four attempts all sharing Idempotency-Key 7c9e. Attempt 1 times out, attempt 2 hits a network error after about 1 second wait, attempt 3 gets 409 in progress after about 2 seconds, attempt 4 gets 200 OK replayed after about 4 seconds plus jitter.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <text class="m" x="340" y="18" text-anchor="middle">Idempotency-Key: 7c9e…  (identical on every attempt)</text>
  <path d="M40 90 H650" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="60" cy="90" r="7" fill="#fca5a5"/>
  <circle cx="144" cy="90" r="7" fill="#fca5a5"/>
  <circle cx="277" cy="90" r="7" fill="#fde047"/>
  <circle cx="536" cy="90" r="7" fill="#4ade80"/>
  <text class="t" x="60" y="48" text-anchor="middle">Attempt 1</text>
  <text class="n" x="60" y="66" text-anchor="middle">timeout</text>
  <text class="t" x="144" y="48" text-anchor="middle">Attempt 2</text>
  <text class="n" x="144" y="66" text-anchor="middle">network error</text>
  <text class="t" x="277" y="48" text-anchor="middle">Attempt 3</text>
  <text class="n" x="277" y="66" text-anchor="middle">409 in progress</text>
  <text class="t" x="536" y="48" text-anchor="middle">Attempt 4</text>
  <text class="n" x="536" y="66" text-anchor="middle" fill="#15803d">200 OK (replayed) ✓</text>
  <text class="s" x="102" y="116" text-anchor="middle">wait ~1s</text>
  <text class="s" x="210" y="116" text-anchor="middle">wait ~2s</text>
  <text class="s" x="406" y="116" text-anchor="middle">wait ~4s (+ random jitter)</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Exponential backoff spaces the retries out. Jitter stops thousands of clients from retrying at the same moment after an outage. The key never changes.</figcaption>
</figure>

```js
// Created ONCE when checkout starts — not inside the retry loop.
let idempotencyKey = crypto.randomUUID();

async function pay(payload, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      });

      if (res.status === 409 || res.status >= 500) throw new Error('retryable');

      const result = await res.json();
      if (res.status === 402) idempotencyKey = crypto.randomUUID(); // declined → next try is a NEW intent
      return result;                                                // 201 succeeded, 202 pending, 402 failed
    } catch {
      const backoff = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise(r => setTimeout(r, backoff * (0.5 + Math.random() / 2)));
    }
  }
  return { status: 'unknown' }; // show "checking your payment…" and poll the order — never "failed"
}
```

### Step 5 — Webhooks and queue jobs: de-duplicate by event ID

Gateways deliver webhooks **at least once**, and queue workers can run the same job twice. The receiver needs two guards: *have I seen this event?* and *is this state change still valid?*

```php
public function __invoke(Request $request): Response
{
    $event = $this->verifier->verify($request);           // signature check first, always

    DB::transaction(function () use ($event) {
        // Guard 1: record the event ID. 0 rows inserted = we've handled this delivery before.
        $isNew = DB::table('processed_webhook_events')->insertOrIgnore([
            'event_id'    => $event->id,                  // UNIQUE column
            'received_at' => now(),
        ]);
        if ($isNew === 0) {
            return;
        }

        // Guard 2: conditional state transition. Only pending → succeeded is allowed.
        $updated = Payment::where('gateway_reference', $event->data->object->id)
            ->where('status', 'pending')
            ->update(['status' => 'succeeded']);

        if ($updated === 1) {
            FulfilOrder::dispatch($event->data->object->metadata->payment_id)->afterCommit();
        }
    });

    return response()->noContent();                       // fast 2xx, so the gateway stops retrying
}
```

Guard 2 matters even with guard 1. A gateway can send **two different events** (two different IDs) about the same payment, for example `charge.succeeded` and `payment_intent.succeeded`. The `WHERE status = 'pending'` makes the transition itself idempotent: whichever event arrives second updates 0 rows and fulfils nothing.

---

## Defence in depth

No single layer catches everything, so a solid payment system stacks several of them:

<figure>
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Five layers of duplicate protection: client, API middleware, database, gateway, and webhooks and jobs, each with its specific technique.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <rect x="10" y="8" width="180" height="50" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="100" y="38" text-anchor="middle">1  Client</text>
  <rect x="200" y="8" width="470" height="50" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text class="s" x="214" y="29">One key per payment attempt, created before the first try.</text>
  <text class="s" x="214" y="46">Retry with the same key, backoff + jitter. Disable the button.</text>

  <rect x="10" y="66" width="180" height="50" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="100" y="96" text-anchor="middle">2  API middleware</text>
  <rect x="200" y="66" width="470" height="50" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text class="s" x="214" y="87">Store key + request hash. Replay completed responses.</text>
  <text class="s" x="214" y="104">409 while in progress, 422 when a key is reused with a new body.</text>

  <rect x="10" y="124" width="180" height="50" rx="8" fill="#ede9fe" stroke="#c4b5fd"/>
  <text class="t" x="100" y="154" text-anchor="middle">3  Database</text>
  <rect x="200" y="124" width="470" height="50" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text class="s" x="214" y="145">UNIQUE indexes on keys, gateway references and event IDs.</text>
  <text class="s" x="214" y="162">State changes only through WHERE status = 'pending'.</text>

  <rect x="10" y="182" width="180" height="50" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="100" y="212" text-anchor="middle">4  Gateway</text>
  <rect x="200" y="182" width="470" height="50" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text class="s" x="214" y="203">Forward the same key so the provider de-duplicates too.</text>
  <text class="s" x="214" y="220">Never fail over to another gateway after a timeout.</text>

  <rect x="10" y="240" width="180" height="50" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="100" y="270" text-anchor="middle">5  Webhooks &amp; jobs</text>
  <rect x="200" y="240" width="470" height="50" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text class="s" x="214" y="261">Record processed event IDs. Assume every delivery may be a repeat.</text>
  <text class="s" x="214" y="278">Scheduled jobs use deterministic keys (renewal:sub_88:2026-10).</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">If one layer misses a duplicate, the next one catches it. The database constraints are the last line and the one you can trust most.</figcaption>
</figure>

### Stuck in "processing"?

If the server crashes after claiming a key but before saving the response, the key stays `processing` and every retry gets `409`. Add a sweeper: for keys stuck longer than a minute or two, **ask the gateway** what happened, using your stored reference or the same idempotency key, and record the real outcome. Don't delete the key and hope. Deleting it is exactly how double charges come back.

---

## Common pitfalls

<div markdown="1">

| Pitfall | Why it hurts | Fix |
| --- | --- | --- |
| **New key per retry** | Every retry looks like a new payment | Generate the key once per attempt, outside the retry loop |
| **Check-then-insert** | Parallel requests both pass the check | Rely on a `UNIQUE` index and catch the violation |
| **Treating timeout as failure** | The user retries and gets charged twice | Return `pending` and settle via webhook or status query |
| **Failing over on timeout** | Duplicate charge on two gateways | Fail over only on "definitely not received" errors |
| **Key not bound to payload** | Same key + different amount returns a stale result | Store a request hash and return `422` on mismatch |
| **Key not sent to the gateway** | A crash between charge and save means a retry charges again | Forward the key in the gateway's idempotency header |
| **Webhook handler not idempotent** | The order ships twice, the wallet is credited twice | Event-ID table + conditional `UPDATE … WHERE status = 'pending'` |

</div>

---

## A five-point summary

1. **Retries are unavoidable and timeouts are ambiguous.** A missing response means "unknown", not "failed".
2. **An idempotency key identifies one payment intent.** The client creates it once and sends it on every retry.
3. **The server claims the key atomically** with a `UNIQUE` index, stores the response, and replays it for repeats (`409` in progress, `422` on mismatch).
4. **Pass the key to the gateway and never fail over on a timeout.** Mark the payment `pending` and let the webhook or a status check settle it.
5. **Make every consumer idempotent too.** Webhooks and jobs de-duplicate by event ID and only change state through guarded `WHERE status = …` updates.

---

## Conclusion

Double charges rarely come from bad arithmetic. They come from the gap between "the server did the work" and "the client heard about it". You can't close that gap, because networks will always drop replies. You **can** make it harmless. Give each payment intent a key, claim it atomically, remember the answer, pass the key downstream, and treat "I don't know" as `pending` rather than `failed`. With that in place, a retry just returns the answer the server already gave.
{% endraw %}
