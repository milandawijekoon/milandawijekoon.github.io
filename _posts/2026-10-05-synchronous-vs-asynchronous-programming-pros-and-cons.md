---
title: "Wait or Move On? Synchronous vs Asynchronous Programming Explained, with Benefits, Drawbacks and Real Failures"
category: Engineering
excerpt: >-
  Synchronous code waits. Asynchronous code keeps working while it waits. See
  how each model works under the hood, the strengths and weaknesses of both, the real
  failures that hurt teams, and how to choose. A 10-minute read.
---

You click "Pay". The spinner turns. Behind it, your server calls a payment provider, writes to a database, and sends a confirmation email. If the server does those three things one after another and waits on each, every other customer waits too.

That single choice, **wait or keep working**, is the difference between synchronous and asynchronous programming. It decides how many users one server can handle, how fast your app feels, and how painful your bugs are to find.

In this article you will learn:

- how synchronous and asynchronous code actually run,
- the benefits and drawbacks of each model,
- four real-world stories where the choice mattered,
- how to pick the right model and avoid the common async mistakes.

Reading time: about 10 minutes.

---

## The core idea in one minute

**Synchronous** code runs one step at a time. Each step must finish before the next one starts. While a step waits for a file, a database, or a network call, the whole thread does nothing.

**Asynchronous** code starts a slow step, then moves on to other work. When the slow step finishes, the result is picked up and handled.

A coffee shop makes it concrete:

- **Synchronous barista:** takes your order, makes your coffee, hands it over, and only then greets the next person. The queue grows.
- **Asynchronous barista:** takes your order, starts the machine, and greets the next person while it brews. When the machine beeps, they hand over your coffee.

Same barista, same machine. The asynchronous one simply doesn't stand and stare at the machine.

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Timeline comparison: synchronous code handles three requests one after another, each waiting on I/O. Asynchronous code starts all three waits together and finishes sooner">
  <style>
    .t{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .w{font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#92400e;}
    .k{font:600 11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1e3a8a;}
  </style>
  <text class="t" x="0" y="18">Synchronous: one request at a time</text>
  <rect x="0" y="30" width="30" height="26" rx="4" fill="#bfdbfe"/>
  <rect x="30" y="30" width="150" height="26" rx="4" fill="#fde68a"/>
  <rect x="180" y="30" width="30" height="26" rx="4" fill="#bfdbfe"/>
  <rect x="210" y="30" width="150" height="26" rx="4" fill="#fde68a"/>
  <rect x="360" y="30" width="30" height="26" rx="4" fill="#bfdbfe"/>
  <rect x="390" y="30" width="150" height="26" rx="4" fill="#fde68a"/>
  <text class="d" x="0" y="74">Request A</text>
  <text class="d" x="180" y="74">Request B</text>
  <text class="d" x="360" y="74">Request C</text>
  <text class="d" x="545" y="48">done at ~540</text>

  <text class="t" x="0" y="124">Asynchronous: waits overlap</text>
  <rect x="0" y="136" width="30" height="26" rx="4" fill="#bfdbfe"/>
  <rect x="30" y="136" width="30" height="26" rx="4" fill="#bfdbfe"/>
  <rect x="60" y="136" width="30" height="26" rx="4" fill="#bfdbfe"/>
  <rect x="30" y="170" width="150" height="14" rx="4" fill="#fde68a"/>
  <rect x="60" y="188" width="150" height="14" rx="4" fill="#fde68a"/>
  <rect x="90" y="206" width="150" height="14" rx="4" fill="#fde68a"/>
  <text class="d" x="248" y="217">done at ~240</text>

  <rect x="400" y="140" width="14" height="14" rx="3" fill="#bfdbfe"/>
  <text class="k" x="422" y="152">CPU work (your code)</text>
  <rect x="400" y="162" width="14" height="14" rx="3" fill="#fde68a"/>
  <text class="w" x="422" y="174">Waiting on I/O (database, network, disk)</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The code itself is quick. Most of the time is spent waiting. Async overlaps the waiting.</figcaption>
</figure>

The diagram is simplified, but the lesson holds: **waiting is the expensive part, not computing.** A CPU can run millions of instructions in the time one network call takes to return.

---

## How they work under the hood

**Synchronous (blocking):** when your code asks the operating system to read a file or call a network, the thread is put to sleep until the answer comes back. It cannot run anything else in the meantime. To serve ten users at once, you need ten threads or processes.

**Asynchronous (non-blocking):** your code hands the slow operation to the operating system and gets control back immediately. A loop, often called the **event loop**, keeps track of pending operations. When one finishes, the loop runs the code you attached to it (a callback, or the rest of an `async` function).

```js
console.log("1. start");

setTimeout(() => console.log("3. timer finished"), 100); // scheduled, not awaited

console.log("2. keep working");
// Output order: 1, 2, 3
```

The timer does not stop line 2 from running. This is the heart of async: **starting work and finishing work are two separate moments.**

One important detail: async is not the same as "many things running at the same moment". In Node.js your JavaScript still runs on a single thread. What overlaps is the *waiting*, not the *computing*. Keep this in mind, because it explains most of the failures later in this article.

---

## Synchronous programming

### How it works

```php
<?php
// Each line blocks until it is finished.
$user    = $db->findUser($id);          // wait for the database
$balance = $bank->getBalance($user);    // wait for an HTTP call
$mailer->send($user, "Balance: $balance"); // wait for the mail server

echo "Done";
```

The order is obvious. If you read the code top to bottom, you know exactly what happens and when.

### Benefits

- **Easy to read and reason about.** Execution follows the order of the lines.
- **Easy to debug.** Stack traces point to the real cause, and a debugger steps through naturally.
- **Simple error handling.** A plain `try/catch` around the code works.
- **No shared-state surprises.** Nothing else runs in the middle of your function.

### Drawbacks

- **Wasted time.** The thread sits idle while it waits.
- **Poor concurrency per thread.** To serve more users at the same time, you need more threads or processes, and each one costs memory.
- **One slow dependency slows everyone behind it.** If the payment provider takes 10 seconds, your workers are stuck for 10 seconds.

Many traditional web stacks use this model on purpose. A classic PHP-FPM setup gives each request its own worker process. That is simple and robust, and it scales by adding workers. The cost is that a worker is "busy" even while it only waits.

---

## Asynchronous programming

### How it works

Async code starts an operation and gives back something to check later: a **callback**, a **promise**, or an **async/await** result. In JavaScript:

```js
// Start three slow operations together, then wait for all of them.
const [user, orders, recommendations] = await Promise.all([
  db.findUser(id),
  db.findOrders(id),
  api.getRecommendations(id),
]);

res.json({ user, orders, recommendations });
```

`await` looks synchronous, but it does not block the thread. While this function waits, the runtime is free to run other requests. When the data arrives, the function continues from where it paused.

### Benefits

- **Better use of one thread.** One thread can juggle thousands of waiting connections.
- **Faster responses when work is independent.** Three 100 ms calls started together take about 100 ms, not 300 ms.
- **Responsive UIs.** The browser can keep scrolling and clicking while it fetches data.
- **Efficient for I/O-heavy servers.** Chat, streaming, APIs, and gateways spend most of their time waiting on the network.

### Drawbacks

- **Harder to reason about.** Order of completion is no longer order of code.
- **Harder to debug.** Stack traces can lose context across `await` boundaries.
- **New bug types.** Race conditions, forgotten `await`, and unhandled errors.
- **No help for heavy computation.** If the work is CPU-bound, async does not make it faster.

---

## Real-world failure #1: The C10K problem (1999)

In 1999, engineer Dan Kegel wrote about the "C10K problem": could one server handle **ten thousand concurrent connections**? The answer for typical servers of the day was no.

The reason was the model. The common design used one thread or process per connection. Ten thousand connections meant ten thousand threads, each with its own stack memory, and the operating system spent more and more time just switching between them. Most of those threads were doing nothing but waiting for the network.

The fix was event-driven, non-blocking I/O: let one thread watch many connections and wake only when one is ready. That idea is behind servers like Nginx and runtimes like Node.js.

> **Lesson:** a synchronous, thread-per-request model is not wrong, but it makes waiting expensive. At large scale, the cost of waiting becomes the bottleneck.

---

## Real-world story #2: PayPal moves a page to Node.js (2013)

PayPal engineers wrote publicly about rebuilding their account overview page, one of their most-visited pages, in Node.js alongside the existing Java version. They reported that the Node.js version handled **about double the requests per second** and had a **35% lower average response time**, roughly 200 ms faster for the same page.

Be careful with this story. It was a rewrite by a team that had already built the first version, so not all of the gain can be credited to async alone. But the result fits the pattern: a page that spends most of its time calling other services benefits from not blocking while it waits.

> **Lesson:** async pays off most for I/O-bound work, such as pages that fan out to many services. It is not magic, and a rewrite adds its own effects.

---

## Real-world failure #3: Blocking the event loop (a pattern, not one incident)

Node.js runs your JavaScript callbacks on **one main thread** called the event loop. The official Node.js guide says it plainly: if a thread is busy with a long task, it cannot serve any other client.

```js
// Looks async, but this loop is pure CPU work on the main thread.
app.get("/report", (req, res) => {
  let total = 0;
  for (let i = 0; i < 5_000_000_000; i++) total += i; // blocks everyone
  res.json({ total });
});
```

While this loop runs, every other request to the server freezes: health checks, logins, everything. To an engineer watching dashboards, the server looks "up" yet nobody gets a response.

The same problem appears with `fs.readFileSync`, large `JSON.parse` calls, heavy regexes, and image processing inside request handlers.

**Fixes:**
- Use the async versions (`fs.promises.readFile`, not `readFileSync`).
- Move heavy computation to a **worker thread** or a **background queue**.
- Keep each callback small.

> **Lesson:** async does not protect you from slow synchronous code. It only helps while the code is actually waiting.

---

## Real-world failure #4: The forgotten `await` and the swallowed error

This is another common pattern, and it hides well.

```js
async function chargeCustomer(order) {
  // BUG: no await. The function returns before the charge finishes,
  // and a failure here is not caught by the try/catch below.
  try {
    paymentApi.charge(order);          // returns a promise
  } catch (err) {
    log.error(err);                    // never runs for async failures
  }
  return { status: "ok" };             // reports success too early
}
```

The caller sees `"ok"`, but the payment may still be running, or may fail later. A related trap: a promise that rejects with no handler. Since **Node.js 15**, an unhandled promise rejection is thrown as an uncaught exception by default, which can crash the process. Before that it only printed a warning, so many apps had silent failures for years.

**Fix:**

```js
async function chargeCustomer(order) {
  try {
    await paymentApi.charge(order);    // wait, so errors are caught here
    return { status: "ok" };
  } catch (err) {
    log.error(err);
    return { status: "failed" };
  }
}
```

> **Lesson:** every promise needs an owner. Either `await` it, return it, or handle its error explicitly.

---

## Common async mistakes (and quick fixes)

| Mistake | What goes wrong | Fix |
|---|---|---|
| `await` inside a loop for independent calls | 100 calls run one at a time | Use `Promise.all` (with a concurrency limit) |
| Forgetting `await` | Code continues early, errors escape | Lint with `no-floating-promises` |
| `Promise.all` when one failure is acceptable | One rejection fails the whole batch | Use `Promise.allSettled` |
| Unbounded parallelism | 10,000 simultaneous calls overload the database | Limit concurrency (a pool or `p-limit`) |
| Shared state mutated across `await` | Two requests interleave and corrupt data | Keep state local, or use locks and transactions |
| Heavy CPU work on the main thread | Whole server freezes | Worker threads or a job queue |

Here is the first mistake in code:

```js
// Slow: each call waits for the previous one.
for (const id of ids) {
  results.push(await fetchUser(id));
}

// Faster: start them together (limit the batch size in real code).
const results = await Promise.all(ids.map(fetchUser));
```

---

## So which one should you use?

Do not pick by fashion. Pick by where your time goes.

| Your situation | Better fit |
|---|---|
| Waiting on databases, APIs, files, or the network | **Async** |
| Many concurrent connections (chat, streaming, gateways) | **Async** |
| UI that must stay responsive | **Async** |
| Heavy computation (video, ML, big data transforms) | **Parallelism** (threads, workers, processes), not just async |
| Short script, one-off job, or a step where order matters strictly | **Sync** is fine |
| A team new to async, with modest traffic | **Sync** first, and measure before changing |

A useful rule: **async is for waiting, parallelism is for computing.** They solve different problems, and many systems need both.

### Do not forget background jobs

Not everything needs to happen while the user waits. In a Laravel app, sending the confirmation email can move to a queue:

```php
// The request returns right away; a worker sends the email later.
SendOrderConfirmation::dispatch($order);
return response()->json(['status' => 'accepted']);
```

This is asynchronous design at the system level. The user gets a fast response, and slow or failing work is retried outside the request.

---

## Checklist before you ship async code

1. Is this work I/O-bound? If it is CPU-bound, async alone will not help.
2. Does every promise get an `await`, a `return`, or an error handler?
3. Are independent calls running together instead of one by one?
4. Is concurrency limited so one burst cannot overload a database or API?
5. Are timeouts set on every network call?
6. Could two requests interleave and touch the same data?
7. Is there any synchronous or CPU-heavy call on the main thread?
8. Do failures get logged with enough context, such as a request ID?
9. Have I measured before and after? Never assume it got faster.

---

## Key takeaways

- **Wait or move on** is the whole difference. Starting work and finishing work are separate moments in async code.
- **Synchronous** code waits at each step. It is simple and predictable, but it wastes time while waiting.
- **Asynchronous** code starts slow work and keeps going. It uses one thread well for I/O-heavy tasks, but it adds complexity.
- **Async helps with waiting, not with computing.** Heavy CPU work needs workers, threads, or queues.
- **Real systems show both sides:** the C10K problem pushed servers toward non-blocking I/O, while blocked event loops and forgotten `await`s show how async fails.
- **Every promise needs an owner,** and every network call needs a timeout.
- **Measure first.** The right model is the one that fits where your time actually goes.

You do not need to rewrite anything today. Pick one slow endpoint, find where it waits, and ask: do these waits have to happen one after another? Often the answer is no, and that is the easiest speed-up you will ever make.
