---
title: "Hexagonal Architecture Explained with a Real-World Use Case"
category: Architecture
excerpt: >-
  Hexagonal Architecture (Ports & Adapters) in plain terms: the hexagon,
  ports vs adapters, and one real feature — registering a user — built the
  hexagonal way in Node.js. A 10–15 minute read.
---

Hexagonal Architecture — also called **Ports & Adapters** — was coined by Alistair Cockburn in 2005 to answer one question: *how do you build an application that a user, a test, or a script can all drive the same way, without the database or the web framework leaking into your business logic?*

This note strips it to the essentials: the hexagon shape, ports vs. adapters, and one real feature — registering a user in a small API — built the hexagonal way in Node.js. It reads in about 10–15 minutes.

---

## The one-sentence definition

**Hexagonal Architecture puts your business logic in the center, talking only to interfaces (ports) it defines — while everything that touches the outside world (HTTP, a database, email, a CLI) is an adapter plugged into those ports from the edges.**

Everything below is a consequence of that sentence.

---

## Why a hexagon?

The shape isn't special — it's just a hexagon so there's visual room to draw several sides, each one representing a different way something can plug into the application. Some sides are **driving** (things that call your app: HTTP requests, CLI commands, a message queue consumer). Others are **driven** (things your app calls out to: a database, an email provider, a payment API).

<figure>
<svg viewBox="0 0 710 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A hexagon labeled Application Core in the middle. Driving adapters on the left — REST controller and CLI command — connect in through ports. Driven adapters on the right — Postgres repository and email sender — are called out through ports the core defines.">
  <style>
    .lbl{font:600 14px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .sub{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .k{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .pk{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#1d4ed8;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
    .port{fill:#eff6ff;stroke:#93c5fd;stroke-width:1.5;stroke-dasharray:4 3;}
    .core{fill:#dbeafe;stroke:#3b82f6;stroke-width:2;}
    .arw{stroke-width:2;}
  </style>

  <polygon points="350,50 425,130 425,340 350,420 275,340 275,130" class="core"/>
  <text class="lbl" x="308" y="220" fill="#1d4ed8">Application</text>
  <text class="lbl" x="328" y="240" fill="#1d4ed8">Core</text>
  <text class="sub" x="293" y="263">entities + use cases</text>

  <text class="sub" x="155" y="25">driving side (left)</text>
  <text class="sub" x="450" y="25">driven side (right)</text>

  <rect class="bx" x="5" y="108" width="135" height="44" rx="8"/>
  <text class="k" x="13" y="134">REST Controller</text>
  <path d="M141 130 H147" class="arw" stroke="#94a3b8"/>
  <polygon points="155,130 147,125 147,135" fill="#94a3b8"/>
  <rect class="port" x="155" y="110" width="105" height="40" rx="8"/>
  <text class="pk" x="165" y="134">RegisterUser</text>
  <path d="M261 130 H267" class="arw" stroke="#3b82f6"/>
  <polygon points="275,130 267,125 267,135" fill="#3b82f6"/>

  <rect class="bx" x="5" y="318" width="135" height="44" rx="8"/>
  <text class="k" x="30" y="344">CLI Command</text>
  <path d="M141 340 H147" class="arw" stroke="#94a3b8"/>
  <polygon points="155,340 147,335 147,345" fill="#94a3b8"/>
  <rect class="port" x="155" y="320" width="105" height="40" rx="8"/>
  <text class="pk" x="165" y="344">RegisterUser</text>
  <path d="M261 340 H267" class="arw" stroke="#3b82f6"/>
  <polygon points="275,340 267,335 267,345" fill="#3b82f6"/>

  <path d="M426 130 H432" class="arw" stroke="#3b82f6"/>
  <polygon points="440,130 432,125 432,135" fill="#3b82f6"/>
  <rect class="port" x="440" y="110" width="115" height="40" rx="8"/>
  <text class="pk" x="450" y="134">UserRepository</text>
  <path d="M556 130 H562" class="arw" stroke="#94a3b8"/>
  <polygon points="570,130 562,125 562,135" fill="#94a3b8"/>
  <rect class="bx" x="570" y="108" width="135" height="44" rx="8"/>
  <text class="k" x="578" y="134">Postgres Adapter</text>

  <path d="M426 340 H432" class="arw" stroke="#3b82f6"/>
  <polygon points="440,340 432,335 432,345" fill="#3b82f6"/>
  <rect class="port" x="440" y="320" width="115" height="40" rx="8"/>
  <text class="pk" x="471" y="344">Notifier</text>
  <path d="M556 340 H562" class="arw" stroke="#94a3b8"/>
  <polygon points="570,340 562,335 562,345" fill="#94a3b8"/>
  <rect class="bx" x="570" y="318" width="135" height="44" rx="8"/>
  <text class="k" x="591" y="344">Email Adapter</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Left = driving adapters call the core. Right = driven adapters are called by the core. The core never imports Express, pg, or nodemailer.</figcaption>
</figure>

| Term | Meaning | Example |
| --- | --- | --- |
| **Core (domain + application)** | Entities and use cases. Pure logic, no I/O libraries imported. | `User` entity, `RegisterUser` use case |
| **Port** | An interface the core defines — either "how I can be called" (driving) or "what I need" (driven). | `RegisterUser` interface, `UserRepository` interface |
| **Driving adapter** | Something that calls into the core through a port. | Express controller, CLI command, cron job |
| **Driven adapter** | Something the core calls out to, implementing a port. | PostgreSQL repository, SendGrid email sender |

If this reminds you of Clean Architecture's concentric circles — it should. Hexagonal, Clean, and Onion Architecture are siblings: same Dependency Rule ("dependencies point inward, the core never imports a framework"), different diagrams. Hexagonal is usually the easiest to explain because "ports and adapters" maps directly to real code: one interface, one or more classes that implement it.

---

## Real-world use case: "Register a user"

A client submits an email and password. The system must: check the email isn't taken, hash the password, save the user, and send a welcome email. We'll build it in Node.js, from the inside out.

### 1. The domain — no framework in sight

```js
// domain/user.js
class User {
  constructor(id, email, passwordHash) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
  }

  static register(id, email, passwordHash) {
    if (!email.includes('@')) {
      throw new Error('Invalid email address');
    }
    return new User(id, email, passwordHash);
  }
}

module.exports = { User };
```

`User` has no idea it will end up in Postgres or arrive as JSON over HTTP. It only knows what a user *is* and what makes registering one valid.

### 2. Ports — interfaces the use case defines

```js
// application/ports.js

// Driven port: what the use case needs from storage.
// (Node has no interfaces, so the "port" is a documented shape —
//  any object with these async methods satisfies it.)
//   UserRepository: { findByEmail(email), save(user) }
//   Notifier:       { welcome(user) }
//   Hasher:         { hash(plainPassword) }

module.exports = {}; // ports are documented shapes, not enforced classes
```

These are phrased in domain terms — `findByEmail`, `save`, `welcome` — never `SELECT * FROM users` or `transporter.sendMail()`.

### 3. The use case — the application core

```js
// application/registerUser.js
const { randomUUID } = require('crypto');
const { User } = require('../domain/user');

class EmailAlreadyTaken extends Error {}

class RegisterUser {
  // Dependencies are injected as ports: repo, hasher, notifier.
  constructor({ userRepository, hasher, notifier }) {
    this.userRepository = userRepository;
    this.hasher = hasher;
    this.notifier = notifier;
  }

  async handle({ email, password }) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyTaken(email);
    }

    const passwordHash = await this.hasher.hash(password);
    const user = User.register(randomUUID(), email, passwordHash);

    await this.userRepository.save(user);
    await this.notifier.welcome(user);

    return user;
  }
}

module.exports = { RegisterUser, EmailAlreadyTaken };
```

Read it top to bottom: it's the registration process in plain terms. No `req`, no `res`, no `pg.Pool`, no `nodemailer`. Swap Postgres for MongoDB, or SendGrid for a queue-based notifier — this class does not change.

<figure>
<svg viewBox="0 0 680 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow: Express route builds input and calls RegisterUser. RegisterUser talks to three ports: UserRepository, Hasher, Notifier. Concrete adapters implement each port using Postgres, bcrypt, and Nodemailer.">
  <style>
    .k{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
    .ap{fill:#eff6ff;stroke:#bfdbfe;stroke-width:1.5;}
    .uc{fill:#dbeafe;stroke:#60a5fa;stroke-width:1.5;}
  </style>
  <rect class="bx" x="1" y="90" width="120" height="46" rx="8"/>
  <text class="k" x="18" y="110">Express</text>
  <text class="n" x="18" y="127">route</text>

  <rect class="uc" x="165" y="84" width="140" height="58" rx="8"/>
  <text class="k" x="180" y="108">RegisterUser</text>
  <text class="n" x="180" y="126">use case</text>

  <path d="M121 113 H162" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="165,113 156,108 156,118" fill="#94a3b8"/>

  <rect class="ap" x="350" y="10" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="362" y="34">UserRepository</text>
  <rect class="ap" x="350" y="66" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="392" y="90">Hasher</text>
  <rect class="ap" x="350" y="122" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="386" y="146">Notifier</text>

  <path d="M305 100 L348 29 M305 108 L348 85 M305 116 L348 141" fill="none" stroke="#94a3b8" stroke-width="1.2"/>

  <rect class="bx" x="530" y="10" width="140" height="38" rx="8"/>
  <text class="k" x="540" y="34">PgUserRepo</text>
  <rect class="bx" x="530" y="66" width="140" height="38" rx="8"/>
  <text class="k" x="548" y="90">BcryptHasher</text>
  <rect class="bx" x="530" y="122" width="140" height="38" rx="8"/>
  <text class="k" x="540" y="146">MailNotifier</text>

  <path d="M530 29 H504 M530 85 H504 M530 141 H504" fill="none" stroke="#15803d" stroke-width="1.3"/>
  <polygon points="502,29 511,24 511,34" fill="#15803d"/>
  <polygon points="502,85 511,80 511,90" fill="#15803d"/>
  <polygon points="502,141 511,136 511,146" fill="#15803d"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The use case only depends on the dashed ports. Green arrows are adapters implementing them — pointing inward.</figcaption>
</figure>

### 4. Driven adapters — implement the ports

**Repository** (Postgres, using the [`pg`](https://node-postgres.com/) package):

```js
// adapters/driven/pgUserRepository.js
class PgUserRepository {
  constructor(pool) {
    this.pool = pool; // node-postgres Pool
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, email: row.email, passwordHash: row.password_hash };
  }

  async save(user) {
    await this.pool.query(
      `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = $2, password_hash = $3`,
      [user.id, user.email, user.passwordHash],
    );
  }
}

module.exports = { PgUserRepository };
```

**Hasher** (bcrypt):

```js
// adapters/driven/bcryptHasher.js
const bcrypt = require('bcrypt');

class BcryptHasher {
  async hash(plainPassword) {
    return bcrypt.hash(plainPassword, 12);
  }
}

module.exports = { BcryptHasher };
```

**Notifier** (nodemailer):

```js
// adapters/driven/mailNotifier.js
class MailNotifier {
  constructor(transporter) {
    this.transporter = transporter; // nodemailer transport
  }

  async welcome(user) {
    await this.transporter.sendMail({
      to: user.email,
      from: 'hello@example.com',
      subject: 'Welcome!',
      text: `Hi ${user.email}, your account is ready.`,
    });
  }
}

module.exports = { MailNotifier };
```

Each adapter is small, boring, and disposable — exactly what you want for the code that talks to the outside world.

### 5. Driving adapter — an Express route

```js
// adapters/driving/httpRoutes.js
const express = require('express');
const { EmailAlreadyTaken } = require('../../application/registerUser');

function buildRouter(registerUser) {
  const router = express.Router();

  router.post('/users', async (req, res) => {
    try {
      const user = await registerUser.handle({
        email: req.body.email,
        password: req.body.password,
      });
      res.status(201).json({ id: user.id, email: user.email });
    } catch (err) {
      if (err instanceof EmailAlreadyTaken) {
        return res.status(409).json({ error: 'Email already taken' });
      }
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { buildRouter };
```

The route turns HTTP into a plain object, calls the use case, and turns the result back into HTTP. That is *all* it does — same job as the Express route, a CLI command, or a test would each do differently while calling the exact same `RegisterUser.handle()`.

### 6. Wiring — the composition root

```js
// index.js
const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const { RegisterUser } = require('./application/registerUser');
const { PgUserRepository } = require('./adapters/driven/pgUserRepository');
const { BcryptHasher } = require('./adapters/driven/bcryptHasher');
const { MailNotifier } = require('./adapters/driven/mailNotifier');
const { buildRouter } = require('./adapters/driving/httpRoutes');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const transporter = nodemailer.createTransport({ /* smtp config */ });

const registerUser = new RegisterUser({
  userRepository: new PgUserRepository(pool),
  hasher: new BcryptHasher(),
  notifier: new MailNotifier(transporter),
});

const app = express();
app.use(express.json());
app.use(buildRouter(registerUser));

app.listen(3000, () => console.log('Listening on :3000'));
```

This is the only file that knows about Express, `pg`, and `nodemailer` *and* about the domain at the same time. Everywhere else, one side or the other is invisible.

---

## Why this pays off: testing without a database

Because `RegisterUser` only depends on port shapes, a test can hand it plain in-memory fakes — no Express, no Postgres, no network:

```js
// test/registerUser.test.js
const { RegisterUser, EmailAlreadyTaken } = require('../application/registerUser');

function fakeRepo(existingUsers = []) {
  const store = [...existingUsers];
  return {
    async findByEmail(email) {
      return store.find((u) => u.email === email) || null;
    },
    async save(user) {
      store.push(user);
    },
  };
}

test('rejects a duplicate email', async () => {
  const registerUser = new RegisterUser({
    userRepository: fakeRepo([{ email: 'a@b.com' }]),
    hasher: { hash: async (p) => `hashed:${p}` },
    notifier: { welcome: async () => {} },
  });

  await expect(
    registerUser.handle({ email: 'a@b.com', password: 'secret' }),
  ).rejects.toBeInstanceOf(EmailAlreadyTaken);
});
```

This test runs in milliseconds and never touches a real database — because the use case never asked for one, only for a `UserRepository`-shaped object.

---

## The traps

<div markdown="1">

| Mistake | Why it hurts |
| --- | --- |
| **Importing `express`, `pg`, or `nodemailer` inside the use case** | The core is now coupled to those libraries. Testing needs them running; swapping them means editing business logic. |
| **Passing `req`/`res` into the use case** | Ties application logic to HTTP. Can't reuse it from a CLI or a queue worker without faking the web layer. |
| **A repository that returns raw SQL rows to the domain** | Leaks storage shape into the core. Map rows to domain objects inside the adapter, not outside. |
| **One giant adapter that does routing, validation, and persistence** | Defeats the point — adapters should be thin translators, not a second home for logic. |
| **Applying this to a five-endpoint prototype** | Extra ports and adapters are overhead you don't need yet. Use it where the payoff (testability, swappable I/O) actually matters. |

</div>

---

## When to reach for it

Hexagonal Architecture is an investment: more files, more interfaces, more indirection. It earns that cost when:

- the **business rules are non-trivial** and will outlive today's database or framework choice;
- you have **multiple entry points** to the same logic (HTTP API, CLI, scheduled job, message consumer);
- **fast, database-free tests** matter to your team;
- you expect to **swap infrastructure** — a different database, a different email provider — without touching the rules.

For a small CRUD script, skip it. For the core of a service you'll run and evolve for years, the ports are worth the extra files.

---

## A five-point checklist

1. **Keep the domain and use cases free of library imports.** No `express`, no `pg`, no SDK classes inside the core.
2. **Name ports in domain language.** `UserRepository.findByEmail`, not `runQuery(sql)`.
3. **Let the core own the port; adapters implement it.** The interface lives with the consumer, not the infrastructure.
4. **Make each adapter thin.** Translate in, call the use case, translate out — nothing more.
5. **Wire everything in one place** (your `index.js` / composition root) and nowhere else.

---

## Conclusion

Hexagonal Architecture is one idea wearing a six-sided diagram: **the core defines what it needs, and adapters on every side plug in to satisfy it.** In Node.js this costs you nothing exotic — a few plain classes, dependency injection through a constructor, and the discipline to keep `require('express')` out of your business logic.

The payoff is a core you can test in milliseconds, an infrastructure layer you can swap without fear, and a codebase where "how do I register a user" has one obvious, framework-free answer.
