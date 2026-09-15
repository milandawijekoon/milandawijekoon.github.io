---
title: "Onion Architecture Explained with a Real-World Use Case"
category: Architecture
excerpt: >-
  Onion Architecture in plain terms: the rings, the dependency rule, and one
  real feature — placing an order — built the onion way in Node.js. A
  10–15 minute read.
---

Onion Architecture was coined by Jeffrey Palermo in 2008 to solve a problem he kept seeing: layered ("N-tier") applications where the domain model quietly depended on the database layer, so you couldn't change one without breaking the other.

This note strips it to the essentials: the rings, the one rule that holds them together, and one real feature — placing an order in a small API — built the onion way in Node.js. It reads in about 10–15 minutes.

---

## The one-sentence definition

**Onion Architecture arranges code in concentric rings around a domain model at the center, where every dependency points inward — outer rings (UI, database, frameworks) may depend on inner rings, but an inner ring never depends on an outer one.**

Everything below is a consequence of that sentence.

---

## Why rings?

Peel an onion and you always reach the same core, no matter which layer you cut through. That's the metaphor: no matter how many layers surround it, the **domain model** at the center stays untouched by the outside world.

<figure>
<svg viewBox="0 0 640 460" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four concentric rings. Center: Domain Model (entities). Next ring: Domain Services. Next ring: Application Services, which defines interfaces. Outer ring: Infrastructure and UI, containing Express, Postgres and email adapters that implement those interfaces. An arrow shows all dependencies point inward toward the center.">
  <style>
    .lbl{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .sub{font:10.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
    .k{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .note{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>

  <circle cx="320" cy="220" r="200" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1.5"/>
  <circle cx="320" cy="220" r="150" fill="#dbeafe" stroke="#93c5fd" stroke-width="1.5"/>
  <circle cx="320" cy="220" r="95" fill="#bfdbfe" stroke="#60a5fa" stroke-width="1.5"/>
  <circle cx="320" cy="220" r="45" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/>

  <text class="lbl" x="320" y="216" fill="#ffffff" text-anchor="middle">Domain</text>
  <text class="lbl" x="320" y="232" fill="#ffffff" text-anchor="middle">Model</text>

  <text class="lbl" x="320" y="140" fill="#0f172a" text-anchor="middle">Domain Services</text>
  <text class="sub" x="320" y="155" text-anchor="middle">rules across entities</text>

  <text class="lbl" x="320" y="88" fill="#0f172a" text-anchor="middle">Application Services</text>
  <text class="sub" x="320" y="103" text-anchor="middle">use cases + interfaces (ports)</text>

  <text class="lbl" x="320" y="36" fill="#0f172a" text-anchor="middle">Infrastructure &amp; UI</text>
  <text class="sub" x="320" y="50" text-anchor="middle">Express, Postgres, email — implements interfaces</text>

  <path d="M320 400 A180 180 0 0 1 460 340" fill="none" stroke="#1d4ed8" stroke-width="2.5" marker-end="url(#arrow)"/>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#1d4ed8"/>
    </marker>
  </defs>
  <text class="note" x="470" y="345">dependencies point inward</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Every arrow points toward the center. The Domain Model imports nothing from the rings around it.</figcaption>
</figure>

| Ring (center → edge) | Contains | Depends on |
| --- | --- | --- |
| **Domain Model** | Entities, value objects — pure data and invariants. | Nothing. |
| **Domain Services** | Business rules that span more than one entity. | Domain Model only. |
| **Application Services** | Use cases, and the **interfaces** (ports) those use cases need from the outside. | Domain layers only — never a concrete database or framework. |
| **Infrastructure & UI** | Express routes, Postgres repositories, email senders — everything that implements an interface or talks to the world. | Everything inward. This is the only ring allowed to `require('express')` or `require('pg')`. |

If this sounds like Hexagonal or Clean Architecture — it should. Onion, Hexagonal, and Clean Architecture are siblings sharing the same **Dependency Rule**: source code dependencies point inward, and the innermost layer knows nothing about the outermost. Onion's distinguishing feature is naming the inward layers explicitly as rings (Domain Model → Domain Services → Application Services) rather than just "core vs. adapters."

---

## Real-world use case: "Place an order"

A customer submits a cart. The system must: verify every product is in stock, calculate the total with any discount, save the order, and send a confirmation email. We'll build it in Node.js, ring by ring, from the center out.

### 1. Domain Model — entities and invariants, nothing else

```js
// domain/model/order.js
class Order {
  constructor(id, customerId, items) {
    if (items.length === 0) {
      throw new Error('An order must have at least one item');
    }
    this.id = id;
    this.customerId = customerId;
    this.items = items; // [{ productId, quantity, unitPrice }]
    this.status = 'PENDING';
  }

  total() {
    return this.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  }

  confirm() {
    this.status = 'CONFIRMED';
  }
}

module.exports = { Order };
```

`Order` knows what makes an order valid and how to total itself. It has never heard of Postgres, Express, or JSON.

### 2. Domain Services — rules that span more than one entity

```js
// domain/services/pricing.js

// A domain service belongs here — not on Order itself — because
// discounting needs the Customer entity too, not just the Order.
function applyLoyaltyDiscount(order, customer) {
  const discountRate = customer.loyaltyTier === 'GOLD' ? 0.1 : 0;
  return order.total() * (1 - discountRate);
}

module.exports = { applyLoyaltyDiscount };
```

Still no I/O. `applyLoyaltyDiscount` is pure: same inputs, same output, every time.

### 3. Application Services — the use case, and the ports it needs

```js
// application/ports.js

// Ports are documented shapes (Node has no interfaces) that the
// use case depends on. Infrastructure adapters implement them.
//   ProductCatalog: { checkStock(items) }
//   OrderRepository: { save(order) }
//   Notifier:        { orderConfirmed(order) }

module.exports = {}; // shapes only, not enforced classes
```

```js
// application/placeOrder.js
const { randomUUID } = require('crypto');
const { Order } = require('../domain/model/order');
const { applyLoyaltyDiscount } = require('../domain/services/pricing');

class OutOfStock extends Error {}

class PlaceOrder {
  // Dependencies arrive as ports: catalog, repository, notifier.
  constructor({ productCatalog, orderRepository, notifier }) {
    this.productCatalog = productCatalog;
    this.orderRepository = orderRepository;
    this.notifier = notifier;
  }

  async handle({ customerId, items, customer }) {
    const inStock = await this.productCatalog.checkStock(items);
    if (!inStock) {
      throw new OutOfStock('One or more items are unavailable');
    }

    const order = new Order(randomUUID(), customerId, items);
    order.finalTotal = applyLoyaltyDiscount(order, customer);
    order.confirm();

    await this.orderRepository.save(order);
    await this.notifier.orderConfirmed(order);

    return order;
  }
}

module.exports = { PlaceOrder, OutOfStock };
```

Read `handle()` top to bottom and it *is* the business process: check stock, price it, confirm it, save it, notify. No `req`, no SQL, no SMTP client. Swap Postgres for MongoDB or SendGrid for a queue — this class does not change.

<figure>
<svg viewBox="0 0 680 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow: Express route calls PlaceOrder. PlaceOrder depends on three ports defined in the application layer: ProductCatalog, OrderRepository, Notifier. Concrete infrastructure classes implement each port using Postgres, an inventory API and Nodemailer.">
  <style>
    .k{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
    .ap{fill:#eff6ff;stroke:#bfdbfe;stroke-width:1.5;}
    .uc{fill:#dbeafe;stroke:#60a5fa;stroke-width:1.5;}
  </style>
  <rect class="bx" x="1" y="80" width="120" height="46" rx="8"/>
  <text class="k" x="24" y="100">Express</text>
  <text class="n" x="24" y="117">route</text>

  <rect class="uc" x="165" y="74" width="140" height="58" rx="8"/>
  <text class="k" x="182" y="98">PlaceOrder</text>
  <text class="n" x="182" y="116">use case</text>

  <path d="M121 103 H162" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="165,103 156,98 156,108" fill="#94a3b8"/>

  <rect class="ap" x="350" y="4" width="160" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="360" y="28">ProductCatalog</text>
  <rect class="ap" x="350" y="60" width="160" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="366" y="84">OrderRepository</text>
  <rect class="ap" x="350" y="116" width="160" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="392" y="140">Notifier</text>

  <path d="M305 90 L348 23 M305 100 L348 79 M305 110 L348 135" fill="none" stroke="#94a3b8" stroke-width="1.2"/>

  <rect class="bx" x="540" y="4" width="140" height="38" rx="8"/>
  <text class="k" x="548" y="28">InventoryApi</text>
  <rect class="bx" x="540" y="60" width="140" height="38" rx="8"/>
  <text class="k" x="552" y="84">PgOrderRepo</text>
  <rect class="bx" x="540" y="116" width="140" height="38" rx="8"/>
  <text class="k" x="550" y="140">MailNotifier</text>

  <path d="M540 23 H514 M540 79 H514 M540 135 H514" fill="none" stroke="#15803d" stroke-width="1.3"/>
  <polygon points="512,23 521,18 521,28" fill="#15803d"/>
  <polygon points="512,79 521,74 521,84" fill="#15803d"/>
  <polygon points="512,135 521,130 521,140" fill="#15803d"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The use case only depends on the dashed ports it defines. Green arrows are infrastructure classes implementing them — pointing inward.</figcaption>
</figure>

### 4. Infrastructure — implement the ports

**Product catalog** (calls an internal inventory service):

```js
// infrastructure/inventoryApiCatalog.js
class InventoryApiCatalog {
  constructor(httpClient) {
    this.httpClient = httpClient; // e.g. axios instance
  }

  async checkStock(items) {
    const { data } = await this.httpClient.post('/inventory/check', { items });
    return data.allInStock;
  }
}

module.exports = { InventoryApiCatalog };
```

**Order repository** (Postgres, using [`pg`](https://node-postgres.com/)):

```js
// infrastructure/pgOrderRepository.js
class PgOrderRepository {
  constructor(pool) {
    this.pool = pool; // node-postgres Pool
  }

  async save(order) {
    await this.pool.query(
      `INSERT INTO orders (id, customer_id, total, status)
       VALUES ($1, $2, $3, $4)`,
      [order.id, order.customerId, order.finalTotal, order.status],
    );
  }
}

module.exports = { PgOrderRepository };
```

**Notifier** (nodemailer):

```js
// infrastructure/mailNotifier.js
class MailNotifier {
  constructor(transporter) {
    this.transporter = transporter; // nodemailer transport
  }

  async orderConfirmed(order) {
    await this.transporter.sendMail({
      to: order.customerId,
      from: 'orders@example.com',
      subject: 'Order confirmed',
      text: `Your order ${order.id} totals ${order.finalTotal}.`,
    });
  }
}

module.exports = { MailNotifier };
```

Each class is small and replaceable — exactly what you want for the outermost ring.

### 5. UI — an Express route

```js
// infrastructure/httpRoutes.js
const express = require('express');
const { OutOfStock } = require('../application/placeOrder');

function buildRouter(placeOrder) {
  const router = express.Router();

  router.post('/orders', async (req, res) => {
    try {
      const order = await placeOrder.handle({
        customerId: req.body.customerId,
        items: req.body.items,
        customer: req.body.customer,
      });
      res.status(201).json({ id: order.id, total: order.finalTotal });
    } catch (err) {
      if (err instanceof OutOfStock) {
        return res.status(409).json({ error: err.message });
      }
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { buildRouter };
```

The route turns HTTP into a plain object, calls the use case, turns the result back into HTTP — same job a CLI command or a test would each do differently while calling the exact same `PlaceOrder.handle()`.

### 6. Wiring — the composition root

```js
// index.js
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const { PlaceOrder } = require('./application/placeOrder');
const { InventoryApiCatalog } = require('./infrastructure/inventoryApiCatalog');
const { PgOrderRepository } = require('./infrastructure/pgOrderRepository');
const { MailNotifier } = require('./infrastructure/mailNotifier');
const { buildRouter } = require('./infrastructure/httpRoutes');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const httpClient = axios.create({ baseURL: process.env.INVENTORY_URL });
const transporter = nodemailer.createTransport({ /* smtp config */ });

const placeOrder = new PlaceOrder({
  productCatalog: new InventoryApiCatalog(httpClient),
  orderRepository: new PgOrderRepository(pool),
  notifier: new MailNotifier(transporter),
});

const app = express();
app.use(express.json());
app.use(buildRouter(placeOrder));

app.listen(3000, () => console.log('Listening on :3000'));
```

This is the only file that knows about Express, `pg`, `axios`, and `nodemailer` *and* about the domain at the same time. Every ring inward from here is invisible to it.

---

## Why this pays off: testing without a database

Because `PlaceOrder` only depends on port shapes, a test hands it plain in-memory fakes — no Express, no Postgres, no network:

```js
// test/placeOrder.test.js
const { PlaceOrder, OutOfStock } = require('../application/placeOrder');

test('rejects an order when stock is unavailable', async () => {
  const placeOrder = new PlaceOrder({
    productCatalog: { checkStock: async () => false },
    orderRepository: { save: async () => {} },
    notifier: { orderConfirmed: async () => {} },
  });

  await expect(
    placeOrder.handle({
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }],
      customer: { loyaltyTier: 'STANDARD' },
    }),
  ).rejects.toBeInstanceOf(OutOfStock);
});
```

This runs in milliseconds and never touches a real database — the use case never asked for one, only for a `ProductCatalog`-shaped object.

---

## The traps

<div markdown="1">

| Mistake | Why it hurts |
| --- | --- |
| **Putting an ORM entity (e.g. a Sequelize model) at the center as the "domain model"** | Now the innermost ring depends on the ORM. Changing the ORM means rewriting entities. |
| **Reaching from Domain Services into `req`, `res`, or environment variables** | Breaks the inward-only rule silently — the ring boundary exists on paper but not in the code. |
| **Application Services importing a concrete adapter directly (`require('../infrastructure/pgOrderRepository')`)** | Defeats the point of defining a port — the use case is now locked to Postgres. |
| **One "services" folder mixing domain services and application services** | Blurs which rules are pure business logic and which are orchestration — makes the dependency rule hard to audit later. |
| **Applying this to a five-endpoint prototype** | Four rings and several interfaces is overhead you don't need yet. |

</div>

---

## When to reach for it

Onion Architecture is an investment: more files, more interfaces, more indirection. It earns that cost when:

- the **domain rules are the most valuable, longest-lived part** of the system — outlasting today's database or framework;
- you need **fast, database-free tests** for that domain logic;
- you expect to **swap infrastructure** — database, message broker, email provider — without touching business rules;
- more than one **domain service or use case shares the same entities**, so a clear inward dependency rule keeps them from becoming tangled.

For a small CRUD script, skip it. For the core of a service you'll run and evolve for years, the rings are worth the extra files.

---

## A five-point checklist

1. **Keep the Domain Model free of library imports.** No ORM base classes, no `express`, no SDK types inside entities.
2. **Push cross-entity rules into Domain Services, not into a controller.** They stay pure, no I/O.
3. **Define ports in the Application layer, next to the use case that needs them.** The interface lives with the consumer, not the infrastructure.
4. **Let Infrastructure implement ports, never the reverse.** An inner ring must never `require()` an outer one.
5. **Wire everything in one composition root** (`index.js`) and nowhere else.

---

## Conclusion

Onion Architecture is one idea drawn as rings: **the Domain Model sits untouched at the center, and every ring around it may depend inward but never outward.** In Node.js this costs nothing exotic — plain classes for entities, constructor injection for use cases, and the discipline to keep `require('pg')` and `require('express')` out of the inner rings.

The payoff is a domain you can test in milliseconds, infrastructure you can swap without fear, and a codebase where "what does placing an order actually do" has one obvious, framework-free answer.
