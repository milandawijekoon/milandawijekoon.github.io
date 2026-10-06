---
title: "Events and Listeners Explained: Decouple Your Code with Real Examples in JavaScript and Laravel"
category: Engineering
excerpt: >-
  An event says "this happened". Listeners decide what to do about it. See how
  the pattern works in the browser, Node.js and Laravel, the mistakes that
  cause crashes and leaks, and a checklist for using it well. A 10-minute read.
---

A customer places an order. Your code must save it, charge the card, send a receipt, update stock, and tell the warehouse. Six months later someone asks for a loyalty-points update and a Slack alert too. The `placeOrder()` function now has 200 lines, knows about every team's needs, and nobody dares touch it.

Events and listeners solve exactly this. The order code announces **"an order was placed"** and stops caring. Anyone who needs to react subscribes on their own.

In this article you will learn:

- what events and listeners are, and how they work,
- real examples in the browser, Node.js and Laravel,
- the mistakes that cause crashes, leaks and lost data,
- a checklist for using the pattern well.

Reading time: about 10 minutes.

---

## The core idea in one minute

An **event** is a message that says something already happened: `OrderPlaced`, `UserRegistered`, `click`. A **listener** (also called a handler or subscriber) is a function that runs when that event occurs. The code that announces the event is the **emitter** (or dispatcher). It does not know who is listening, or whether anyone is.

Think of a fire alarm. The alarm does not call the fire brigade, unlock the doors and turn on the sprinklers itself. It just rings. Each system that cares is wired to listen.

This is the **Observer pattern**, described in the 1994 book *Design Patterns* by the "Gang of Four". The names change by language, but the shape stays the same:

1. Someone **registers** a listener for an event name or type.
2. Something **emits** the event, usually with some data.
3. The system **calls each listener** with that data.

The big win is **decoupling**: the code that causes something and the code that reacts to it no longer depend on each other.

---

## Example 1: Events in the browser

You already use events every day:

```js
const button = document.querySelector("#pay");

function onPay(event) {
  console.log("Paying...", event.type);
}

button.addEventListener("click", onPay);   // register
// the browser emits "click" when the user clicks

button.removeEventListener("click", onPay); // unregister when no longer needed
```

You can also create your own events. This lets separate parts of a page talk without importing each other:

```js
// The cart announces a change. It knows nothing about the header badge.
document.dispatchEvent(
  new CustomEvent("cart:updated", { detail: { items: 3 } })
);

// Elsewhere, the header badge reacts.
document.addEventListener("cart:updated", (e) => {
  badge.textContent = e.detail.items;
});
```

Note `removeEventListener`. It only works with the **same function reference** you passed to `addEventListener`, which is why `onPay` is a named function above and not an inline arrow.

---

## Example 2: Events in Node.js

Node.js ships with `EventEmitter`, and much of its core (streams, HTTP servers) is built on it.

```js
import { EventEmitter } from "node:events";

const orders = new EventEmitter();

orders.on("placed", (order) => console.log("Email receipt for", order.id));
orders.on("placed", (order) => console.log("Update stock for", order.id));

orders.emit("placed", { id: 42 });
```

Two facts from the Node.js documentation matter in practice:

- **Listeners run synchronously**, in the order they were registered. `emit()` does not return until every listener has finished. A slow listener slows the emitter.
- **Adding more than 10 listeners to one event prints a `MaxListenersExceededWarning`** by default. It is a hint that you may be leaking listeners (more on that below).

---

## Example 3: Events and listeners in Laravel

Laravel gives the pattern a structure. You write an event class, then one or more listener classes.

```php
// app/Events/OrderPlaced.php
class OrderPlaced
{
    public function __construct(public Order $order) {}
}
```

```php
// app/Listeners/SendReceipt.php
class SendReceipt
{
    public function handle(OrderPlaced $event): void
    {
        Mail::to($event->order->customer)->send(new Receipt($event->order));
    }
}
```

```php
// In your controller or service
OrderPlaced::dispatch($order);
```

Laravel's documentation says it **automatically discovers listeners** by scanning your `Listeners` directory. Any class method named `handle` or `__invoke` is registered for the event type-hinted in its signature. In this example, no registration code is needed.

Now the part that matters most. By default a Laravel listener runs **synchronously, inside the request**. To move slow work to a background worker, add the `ShouldQueue` interface:

```php
use Illuminate\Contracts\Queue\ShouldQueue;

class SendReceipt implements ShouldQueue
{
    public function handle(OrderPlaced $event): void { /* ... */ }
}
```

Now the user gets their response right away, and a queue worker sends the email. You can even stop later listeners by returning `false` from `handle`.

---

## Benefits

- **Decoupling.** The order code does not import the email, stock, or analytics code.
- **Easy to extend.** New behaviour is a new listener. You do not edit the original function.
- **Easier testing.** Test the emitter by checking the event fired. Test each listener alone.
- **Natural fit for async work.** Queued listeners move slow tasks out of the request.

## Drawbacks

- **Hidden control flow.** Reading `OrderPlaced::dispatch($order)` does not tell you what will happen next. You must search for listeners.
- **Harder debugging.** A bug may live in a listener far from the code you are looking at.
- **Ordering surprises.** Listener order may matter, but it is easy to forget that.
- **Overuse.** Not every function call needs to be an event.

---

## Common mistakes and how to avoid them

### Mistake 1: An unhandled `error` event crashes Node.js

`error` is special in `EventEmitter`. According to the Node.js docs, if an `error` event is emitted and there is **no listener for it**, the error is thrown, a stack trace is printed, and the **process exits**.

```js
const emitter = new EventEmitter();
emitter.emit("error", new Error("whoops")); // crashes the process
```

**Fix:** always attach an `error` listener on emitters you create or receive, especially streams and sockets.

```js
emitter.on("error", (err) => log.error(err));
```

### Mistake 2: Listener leaks

Every `on()` or `addEventListener()` keeps a reference to your function, and to everything that function can reach. If you add listeners repeatedly (inside a component that mounts many times, or inside a request handler) and never remove them, memory grows and the same code runs many times for one event.

```js
// BAD: adds a new listener on every request
app.get("/", (req, res) => {
  bus.on("done", () => res.send("ok"));
});
```

**Fixes:**

- Remove listeners when the owner goes away (`removeEventListener`, `off`, or an `AbortSignal` in the browser).
- Use `once()` for one-time reactions.
- Treat the Node.js `MaxListenersExceededWarning` as a real signal, not noise to silence.

```js
button.addEventListener("click", onPay, { once: true });
```

### Mistake 3: Slow or failing synchronous listeners

Because listeners run one after another, a slow listener delays the response, and a listener that throws can stop the ones after it from running.

**Fix:** keep listeners small, queue slow work (`ShouldQueue` in Laravel, a job queue in Node.js), and catch errors inside listeners that must not block others.

### Mistake 4: Queued listeners that run before the data is saved

This one bites Laravel apps. You dispatch an event **inside a database transaction**, a queue worker picks up the listener immediately, and it looks for a record that has not been committed yet. The record is missing, or the listener sees old data.

Laravel's documentation covers this. If your queue connection's `after_commit` option is `false`, you can still make a listener wait for open transactions to commit by implementing `ShouldQueueAfterCommit`:

```php
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;

class SendReceipt implements ShouldQueueAfterCommit
{
    public function handle(OrderPlaced $event): void { /* ... */ }
}
```

### Mistake 5: Using events when you need a guarantee

Events tell others that something happened. They do not guarantee the reaction succeeds. If a queued listener fails, the order is already saved, and the customer has no receipt.

**Fix:** for work that must not be lost, make failures visible: use a failed-jobs table, retries, alerts, and idempotent listeners (running twice must be safe). For steps that truly must succeed together, call them directly inside a transaction instead of using events.

---

## When to use events, and when not to

| Use events when | Use a direct call when |
|---|---|
| Several unrelated parts react to one thing | Exactly one thing must happen next |
| Reactions are side effects (email, logs, analytics) | The step is part of the core business rule |
| You want to add behaviour without editing old code | You need a return value or a guaranteed result |
| Work can run later, in the background | The order and success of steps must be certain |

A good test: **"If this listener is removed, does the main action still make sense?"** If yes, an event fits. If no, it is probably part of the main flow.

---

## Best practices checklist

- Name events in the **past tense** (`OrderPlaced`, not `PlaceOrder`). They describe facts.
- Put **only the data listeners need** in the event, and keep it simple.
- Keep each listener to **one job**.
- Queue slow listeners; keep fast, essential ones synchronous.
- Make listeners **idempotent**, so a retry cannot double-charge or double-email.
- Always handle the Node.js `error` event.
- **Remove listeners** you no longer need.
- Dispatch events **after** the data is committed, not before.
- Document important events so the hidden flow is easy to find.
- Test that the event is dispatched, and test each listener separately.

---

## Key takeaways

- An **event** announces that something happened; a **listener** reacts. The emitter does not know who listens.
- The pattern **decouples** code and makes it easy to extend, at the cost of less obvious control flow.
- In Node.js, `emit()` runs listeners **synchronously**, and an unhandled `error` event **crashes** the process.
- In Laravel, listeners run in the request unless you add `ShouldQueue`. Wait for commits with `ShouldQueueAfterCommit` when needed.
- Remove listeners you add, or you will leak memory and run code twice.
- Do not use events for steps that must succeed together. Call those directly.

Pick one function in your codebase that does too many things. Ask which parts are really side effects of the main action, and move the first one into a listener this week. Small steps keep the pattern useful and the flow readable.
