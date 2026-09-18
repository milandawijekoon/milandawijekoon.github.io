---
title: "Fintech Basics for Software Engineers: Finance, Payments, Laws, and Risk in 15 Minutes"
category: Fintech
excerpt: >-
  A short, diagram-heavy primer on the finance and payment concepts every
  fintech engineer needs — money movement, the payment lifecycle, double-entry
  ledgers, the laws that shape your architecture, and the risks that bite
  engineers who skip this. A 10–15 minute read.
---

Most engineers learn fintech the expensive way — by shipping something that "works" in a demo and then discovering it double-charged a customer, or that "refund" isn't just "undo the charge." This note is the shortcut: the core vocabulary, how money actually moves, the laws that constrain your design, and the risks you must build against — condensed into one sitting, with diagrams for people who think visually.

---

## Why this is different from normal backend work

In a typical CRUD app, a bug means bad data. In a fintech app, a bug means **money that doesn't exist moved between people who didn't agree to it** — and regulators, banks, and customers all expect you to explain exactly what happened, in order, forever. Three rules follow from that, and they shape everything below:

1. **Never delete or overwrite a financial record.** Correct it with a new, opposite entry.
2. **Never trust "the API said success" to mean "the money moved."** Those are different moments in time.
3. **Never use floating-point numbers for money.** `0.1 + 0.2 !== 0.3` in IEEE 754 — store cents as integers, not dollars as floats.

---

## 1. The vocabulary of money

| Term | What it actually means |
| --- | --- |
| **Account** | A record money is associated with — a customer wallet, a merchant, or your own internal "clearing" account. |
| **Available balance** | What the customer can spend *right now*, including pending holds. |
| **Ledger / booked balance** | What has actually cleared and settled. The gap between the two is where holds and float live. |
| **Transaction** | An event that moves or records value — not all transactions touch the ledger immediately. |
| **Settlement** | The point money actually transfers between institutions, usually in batches, T+1 or T+2 days later. |
| **Interchange / processing fees** | What card networks and processors charge to move the money — business-critical, not an afterthought. |
| **Currency minor unit** | The smallest unit a currency is stored in — cents for USD, but 0 decimals for JPY, 3 for KWD. Get this wrong and every amount is off by a factor of 10, 100, or 1000. |

<figure>
<svg id="dg-balance-gap" viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A horizontal bar showing the ledger balance as a solid segment and the available balance extending further left, with the gap between them labeled as pending holds and authorizations.">
  <style>
    #dg-balance-gap .lbl{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    #dg-balance-gap .sub{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
  </style>
  <text class="lbl" x="20" y="30">Ledger (booked) balance — $500</text>
  <rect x="20" y="42" width="330" height="34" rx="6" fill="#3b82f6"/>
  <text class="lbl" x="20" y="110">Available balance — $420</text>
  <rect x="20" y="122" width="277" height="34" rx="6" fill="#93c5fd"/>
  <rect x="297" y="122" width="53" height="34" rx="6" fill="#fecaca" stroke="#ef4444" stroke-dasharray="4 3"/>
  <text class="sub" x="300" y="178">↑ $80 held on a pending card authorization — spendable in neither balance yet</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Two balances, one account. Model both, or customers either see money they can't spend, or spend money they don't have.</figcaption>
</figure>

---

## 2. How a card payment actually moves

An API call returning "success" almost always means **authorization** succeeded — not that money has moved. Four distinct events happen over the life of one payment, each with different timing and different reversibility:

<figure>
<svg id="dg-lifecycle" viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A left to right flow: Authorization hold placed, then Capture, then Settlement batch, then Payout to merchant. A void or reversal branches off before settlement with no money moved. A refund branches off after settlement as a new transaction moving money back.">
  <style>
    #dg-lifecycle .lbl{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    #dg-lifecycle .sub{font:10px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
  </style>
  <defs>
    <marker id="a1" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#1d4ed8"/></marker>
  </defs>

  <rect x="10" y="20" width="150" height="60" rx="8" fill="#dbeafe" stroke="#60a5fa"/>
  <text class="lbl" x="85" y="45" text-anchor="middle">Authorization</text>
  <text class="sub" x="85" y="62" text-anchor="middle">hold placed, no $ moved</text>

  <path d="M160 50 H195" stroke="#1d4ed8" stroke-width="2" marker-end="url(#a1)"/>
  <rect x="195" y="20" width="130" height="60" rx="8" fill="#bfdbfe" stroke="#3b82f6"/>
  <text class="lbl" x="260" y="45" text-anchor="middle">Capture</text>
  <text class="sub" x="260" y="62" text-anchor="middle">merchant confirms</text>

  <path d="M325 50 H360" stroke="#1d4ed8" stroke-width="2" marker-end="url(#a1)"/>
  <rect x="360" y="20" width="150" height="60" rx="8" fill="#93c5fd" stroke="#3b82f6"/>
  <text class="lbl" x="435" y="45" text-anchor="middle">Settlement batch</text>
  <text class="sub" x="435" y="62" text-anchor="middle">T+1 / T+2 days</text>

  <path d="M510 50 H545" stroke="#1d4ed8" stroke-width="2" marker-end="url(#a1)"/>
  <rect x="545" y="20" width="145" height="60" rx="8" fill="#3b82f6" stroke="#1d4ed8"/>
  <text class="lbl" x="617" y="45" text-anchor="middle" fill="#fff">Payout</text>
  <text class="sub" x="617" y="62" text-anchor="middle" fill="#e0e7ff">funds reach merchant</text>

  <path d="M260 82 V120 H435 V82" fill="none" stroke="#ef4444" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text class="sub" x="347" y="136" text-anchor="middle" fill="#b91c1c">Void / reversal — before settlement, no money ever moved (cheap, fast)</text>

  <path d="M435 82 V165 H150 V82" fill="none" stroke="#16a34a" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text class="sub" x="292" y="182" text-anchor="middle" fill="#15803d">Refund — after settlement, a brand new transaction moving money back</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">A "refund" is never an undo — it's a new, opposite transaction. Model it that way from day one.</figcaption>
</figure>

A **chargeback** is the adversarial version of a refund: the cardholder's bank forcibly reverses a settled transaction, the merchant can contest it with evidence, and it carries a fee either way.

---

## 3. Why the ledger is double-entry, not a number in a column

The oldest trick in accounting is also the best bug-detector available to you: every transaction touches **at least two accounts**, one debited, one credited, and the two always sum to zero. If they don't, you have a bug or fraud — and you find out immediately instead of during an audit six months later.

<figure>
<svg id="dg-double-entry" viewBox="0 0 640 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A customer pays 100 dollars. Debit Cash account increases by 100. Credit Customer Liability account increases by 100. The two entries sum to zero.">
  <style>
    #dg-double-entry .lbl{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    #dg-double-entry .sub{font:10.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
    #dg-double-entry .amt{font:700 13px ui-monospace,Menlo,monospace;fill:#0f172a;}
  </style>
  <text class="lbl" x="320" y="26" text-anchor="middle">Journal entry: "Customer pays $100"</text>

  <rect x="30" y="46" width="270" height="90" rx="8" fill="#dcfce7" stroke="#22c55e"/>
  <text class="lbl" x="165" y="70" text-anchor="middle">DEBIT — Cash (asset)</text>
  <text class="sub" x="165" y="88" text-anchor="middle">asset account increases</text>
  <text class="amt" x="165" y="112" text-anchor="middle">+$100</text>

  <rect x="340" y="46" width="270" height="90" rx="8" fill="#fee2e2" stroke="#ef4444"/>
  <text class="lbl" x="475" y="70" text-anchor="middle">CREDIT — Customer Liability</text>
  <text class="sub" x="475" y="88" text-anchor="middle">you now owe the customer this</text>
  <text class="amt" x="475" y="112" text-anchor="middle">+$100</text>

  <text class="sub" x="320" y="162" text-anchor="middle">+100 − 100 = 0 — the entry balances. Nothing was created or destroyed, only recorded twice.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">"Debit" and "credit" describe account type, not good/bad — that trips up almost every engineer coming from everyday intuition.</figcaption>
</figure>

In a real ledger table, rows are **append-only**. A mistake isn't edited — it's corrected by a new, reversing entry, exactly like a refund. The customer-facing "balance: $500" you show in the UI is just the sum of all postings for that account, computed on read (or cached and always reconcilable back to that sum).

---

## 4. Real-world use case: checkout to payout, end to end

Take an ordinary online store checkout and follow the money through every layer discussed above.

1. Customer clicks "Pay $49.99." Your server sends an **idempotency key** with the charge request — a UUID generated once per checkout attempt — so that if the network times out and the client retries, the customer is charged once, not twice.
2. The gateway authorizes the card. Issuer places a **hold** on the customer's available balance. Your system marks the order `pending`, not `paid` — no ledger posting yet.
3. On shipment, you **capture**. The gateway confirms, and *now* you post a ledger entry: debit "clearing," credit "merchant revenue," minus a fee entry to "processing fees."
4. A **webhook** arrives telling you the capture succeeded. You verify its HMAC signature, deduplicate by event ID (webhooks are at-least-once, never exactly-once), and update the order to `paid` — all as one idempotent operation, because the same webhook might arrive twice.
5. T+1 or T+2 days later, a **settlement file** lands from the processor. A reconciliation job matches every line to an internal transaction by ID, amount, and timestamp, and flags anything that doesn't match — a network blip, a processor bug, or genuine fraud, caught before it becomes a customer complaint.
6. Funds move to your platform's account, then out again as a **payout** to the merchant — one more pair of ledger postings, debiting the clearing account, crediting the merchant's payable balance.

```
Client → Charge (idempotency-key: abc123)
      → Auth hold placed (no $ moved)         [order: pending]
      → Capture on shipment                   [ledger: debit clearing, credit revenue]
      → Webhook: payment.captured (verified, deduped)   [order: paid]
      → T+1: settlement file reconciled against ledger
      → Payout: clearing → merchant payable
```

If a customer disputes it three weeks later, a chargeback reverses the settled entry, and a *new* reversing posting — not a deleted row — is what proves to an auditor exactly what happened, in order.

---

## 5. The laws that shape your architecture (not an afterthought)

Regulation isn't paperwork bolted on after the system is built — for a fintech engineer it's an **input to the design**, the same way a latency budget is.

| Rule / regulation | What it forces you to build |
| --- | --- |
| **PCI-DSS** | Card data security standard. Your best lever is **tokenization** — never let raw card numbers touch your own servers — which drops you into a much lighter compliance tier. |
| **PSD2 / SCA (EU, UK)** | Legally requires step-up authentication (3-D Secure) on card-not-present transactions above a threshold. Skipping it isn't just riskier, it's non-compliant. |
| **KYC (Know Your Customer)** | Identity verification before onboarding anyone to a financial product — ID checks, liveness checks. |
| **AML (Anti-Money Laundering)** | Ongoing transaction monitoring for suspicious patterns, with a legal duty to file reports on what you find. |
| **Open Banking (PSD2 in EU, CDR in Australia)** | Customers grant third-party apps scoped access to their bank data via OAuth — you may be the third party, or the bank exposing the API. |
| **Data protection (GDPR, CCPA)** | "Right to erasure" collides with "must retain financial records for years" — this tension needs a deliberate legal/technical answer, never a blanket delete. |
| **Record retention & audit** | Immutable, reconstructable audit trails aren't a nice-to-have — regulators can and will ask "show me why this balance is what it is," and the answer must come from stored data alone. |

---

## 6. Risks engineers introduce — and how to design against them

<figure>
<svg id="dg-risks" viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four risk categories arranged as cards: duplicate charges from retries, mitigated by idempotency keys; out of order or lost webhooks, mitigated by signature verification and reconciliation; floating point rounding errors, mitigated by integer minor units; race conditions on concurrent debits, mitigated by row level locking.">
  <style>
    #dg-risks .t{font:700 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#7f1d1d;}
    #dg-risks .b{font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#166534;}
    #dg-risks .s{font:10px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
  </style>
  <g>
    <rect x="20" y="20" width="300" height="110" rx="8" fill="#fef2f2" stroke="#fca5a5"/>
    <text class="t" x="36" y="42">Risk: Duplicate charges</text>
    <text class="s" x="36" y="60">Client retries after a timeout — server</text>
    <text class="s" x="36" y="74">already processed the first request.</text>
    <text class="b" x="36" y="100">Fix: idempotency key + DB unique</text>
    <text class="b" x="36" y="114">constraint, not an in-memory cache.</text>
  </g>
  <g>
    <rect x="360" y="20" width="300" height="110" rx="8" fill="#fef2f2" stroke="#fca5a5"/>
    <text class="t" x="376" y="42">Risk: Lost/duplicate webhooks</text>
    <text class="s" x="376" y="60">Delivery is at-least-once, never</text>
    <text class="s" x="376" y="74">exactly-once, and can arrive out of order.</text>
    <text class="b" x="376" y="100">Fix: verify signature, dedupe by event</text>
    <text class="b" x="376" y="114">ID, and reconcile as a fallback net.</text>
  </g>
  <g>
    <rect x="20" y="160" width="300" height="110" rx="8" fill="#fef2f2" stroke="#fca5a5"/>
    <text class="t" x="36" y="182">Risk: Float rounding errors</text>
    <text class="s" x="36" y="200">0.1 + 0.2 !== 0.3 in IEEE 754 —</text>
    <text class="s" x="36" y="214">a rounding bug is a compliance issue.</text>
    <text class="b" x="36" y="240">Fix: store amounts as integer minor</text>
    <text class="b" x="36" y="254">units (cents), never as floats.</text>
  </g>
  <g>
    <rect x="360" y="160" width="300" height="110" rx="8" fill="#fef2f2" stroke="#fca5a5"/>
    <text class="t" x="376" y="182">Risk: Concurrent debit race</text>
    <text class="s" x="376" y="200">Two simultaneous debits on one account,</text>
    <text class="s" x="376" y="214">only one of which can actually be covered.</text>
    <text class="b" x="376" y="240">Fix: row-level locking or serializable</text>
    <text class="b" x="376" y="254">isolation on the balance record.</text>
  </g>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">All four are ordinary engineering mistakes that become financial incidents purely because the domain is money.</figcaption>
</figure>

A few more that don't fit neatly into a box: **timeouts** on every external bank/processor call (an unbounded wait is a classic cascading-failure trigger), **circuit breakers** around fraud/processor dependencies, and — the most underrated one — a **freeze/pause capability** on the affected money flow during an incident, which buys you time to investigate without letting the financial drift get worse.

---

## Quick-reference checklist

Before you consider a payment feature done, it should be true that:

- Every money-moving request carries an idempotency key enforced at the database layer.
- Amounts are integers in minor units (or a fixed-point `Decimal`), always paired with an explicit currency.
- State only moves forward through an explicit state machine (`pending → authorized → captured → settled`) — invalid transitions are rejected, not silently allowed.
- Webhook handlers verify signatures, deduplicate by event ID, and don't assume ordering.
- A reconciliation job independently checks your ledger against the processor's settlement files — it isn't optional insurance, it's the thing that catches everything else missed.
- No raw card numbers or secrets ever appear in logs, and tokenization keeps them off your servers entirely.
- Every posting is traceable back to who/what triggered it and why — because eventually, an auditor or a customer will ask.

None of this is exotic engineering. It's ordinary distributed-systems discipline — idempotency, immutability, explicit state machines — applied to a domain where the cost of skipping it is measured in dollars, not just downtime.
