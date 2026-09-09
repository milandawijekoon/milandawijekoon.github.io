---
title: "Clean Architecture"
category: Architecture
excerpt: >-
---

Clean Architecture is not a framework, a folder layout you copy, or a library you install. It is one idea about **which direction your code is allowed to depend**, drawn as a set of concentric circles by Robert C. Martin in 2012.

This note strips it to the essentials: the circles, the single rule that makes them work, and one real feature — placing an order in a small e-commerce app — built the Clean way in PHP. It reads in about 10–15 minutes. By the end you should be able to explain where a piece of code belongs and why.

---

## The one-sentence definition

**Clean Architecture organises code into layers so that business rules do not depend on frameworks, databases, or the web — those details depend on the business rules, never the other way around.**

Everything below is a consequence of that sentence.

---

## The circles

<figure>
<svg viewBox="0 0 680 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four concentric circles: Entities at the core, then Use Cases, then Interface Adapters, then Frameworks and Drivers on the outside. An arrow shows dependencies pointing inward only.">
  <style>
    .ring{stroke-width:2;}
    .lbl{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .sub{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .core{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1d4ed8;}
  </style>
  <circle cx="240" cy="170" r="150" fill="#eff6ff" class="ring" stroke="#bfdbfe"/>
  <circle cx="240" cy="170" r="112" fill="#dbeafe" class="ring" stroke="#93c5fd"/>
  <circle cx="240" cy="170" r="72" fill="#bfdbfe" class="ring" stroke="#60a5fa"/>
  <circle cx="240" cy="170" r="34" fill="#93c5fd" class="ring" stroke="#3b82f6"/>

  <text class="core" x="204" y="174">Entities</text>
  <text class="lbl" x="188" y="118">Use Cases</text>
  <text class="lbl" x="150" y="78">Interface Adapters</text>
  <text class="lbl" x="118" y="40">Frameworks &amp; Drivers</text>

  <text class="sub" x="430" y="70">Frameworks &amp; Drivers</text>
  <text class="sub" x="430" y="88">Laravel, HTTP, MySQL, Stripe SDK</text>
  <text class="sub" x="430" y="128">Interface Adapters</text>
  <text class="sub" x="430" y="146">Controllers, Presenters, Repositories</text>
  <text class="sub" x="430" y="186">Use Cases</text>
  <text class="sub" x="430" y="204">Application-specific business rules</text>
  <text class="sub" x="430" y="244">Entities</text>
  <text class="sub" x="430" y="262">Enterprise-wide business rules</text>

  <path d="M430 300 H590" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="430,300 440,295 440,305" fill="#94a3b8"/>
  <text class="sub" x="452" y="322">dependencies point inward only</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Four layers. The further in you go, the more stable and the less framework-aware the code is.</figcaption>
</figure>

| Layer | What lives here | Knows about |
| --- | --- | --- |
| **Entities** | Core domain objects and rules true for the whole business (an `Order`, a `Money` value object, "an order total is the sum of its lines"). | Nothing external. Plain language objects. |
| **Use Cases** | One class per application action (`PlaceOrder`, `CancelOrder`). Orchestrates entities to fulfil a request. | Entities, and *interfaces* it defines for what it needs. |
| **Interface Adapters** | Controllers, request/response mappers, repository implementations, gateway implementations. Translates between the outside world and the use cases. | Use cases and entities. |
| **Frameworks & Drivers** | Laravel, the HTTP kernel, Eloquent, MySQL, the Stripe SDK, the queue. | Everything — but nothing depends *on* it from the inside. |

---

## The Dependency Rule

> **Source code dependencies must point only inward, toward higher-level policy.**

A class in an inner circle must never mention the name of a class in an outer circle. `PlaceOrder` (use case) may not reference `OrderController`, `EloquentOrderRepository`, `Request`, or `DB`. The dependency arrow always goes from concrete detail toward abstract rule.

When an inner layer *needs* something from the outside — "save this order somewhere" — it does not call the database. It declares an **interface** it owns, and an outer layer implements it. This is the Dependency Inversion Principle, and it is the mechanism that lets the circles hold.

<figure>
<svg viewBox="0 0 680 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Without inversion, the use case points out to the database class. With inversion, the use case defines a repository interface and the database class points inward to implement it.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .k{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
  </style>
  <rect x="1" y="1" width="330" height="210" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="18" y="24" fill="#b91c1c">✗  Direct dependency</text>
  <rect class="bx" x="30" y="44" width="120" height="40" rx="8"/>
  <text class="k" x="46" y="68">PlaceOrder</text>
  <rect class="bx" x="185" y="44" width="120" height="40" rx="8"/>
  <text class="k" x="196" y="68">EloquentRepo</text>
  <path d="M150 64 H182" fill="none" stroke="#b91c1c" stroke-width="1.5"/>
  <polygon points="185,64 176,59 176,69" fill="#b91c1c"/>
  <text class="n" x="30" y="118">Use case names a framework class.</text>
  <text class="n" x="30" y="136">Swapping the DB means editing</text>
  <text class="n" x="30" y="154">the business rule. Can't unit test</text>
  <text class="n" x="30" y="172">without a database.</text>

  <rect x="349" y="1" width="330" height="210" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="366" y="24" fill="#15803d">✓  Inverted dependency</text>
  <rect class="bx" x="378" y="44" width="120" height="40" rx="8"/>
  <text class="k" x="394" y="68">PlaceOrder</text>
  <rect class="bx" x="378" y="104" width="150" height="40" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="392" y="128">OrderRepository</text>
  <rect class="bx" x="378" y="164" width="150" height="40" rx="8"/>
  <text class="k" x="392" y="188">EloquentRepo</text>
  <path d="M438 84 V102" fill="none" stroke="#15803d" stroke-width="1.5"/>
  <polygon points="438,104 433,95 443,95" fill="#15803d"/>
  <path d="M453 164 V146" fill="none" stroke="#15803d" stroke-width="1.5"/>
  <polygon points="453,144 448,153 458,153" fill="#15803d"/>
  <text class="n" x="548" y="90">interface owned</text>
  <text class="n" x="548" y="106">by the use case</text>
  <text class="n" x="548" y="180">implements it,</text>
  <text class="n" x="548" y="196">points inward</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The interface belongs to the inner layer. The database class depends on the abstraction, not the reverse.</figcaption>
</figure>

---

## Real-world use case: "Place an order"

A customer submits a cart. The system must: check every product is in stock, calculate the total, charge the card, save the order, and email a receipt. If the charge fails, nothing is saved.

We will build this feature from the inside out.

### 1. Entities — the domain, no framework in sight

```php
// domain/Order.php
final class Order
{
    /** @param OrderLine[] $lines */
    private function __construct(
        public readonly OrderId $id,
        public readonly CustomerId $customerId,
        public readonly array $lines,
        private OrderStatus $status,
    ) {}

    public static function place(OrderId $id, CustomerId $customerId, array $lines): self
    {
        if ($lines === []) {
            throw new DomainException('An order must have at least one line.');
        }
        return new self($id, $customerId, $lines, OrderStatus::Pending);
    }

    public function total(): Money
    {
        return array_reduce(
            $this->lines,
            fn (Money $carry, OrderLine $l) => $carry->add($l->subtotal()),
            Money::zero('USD'),
        );
    }

    public function markPaid(): void
    {
        $this->status = OrderStatus::Paid;
    }
}
```

`Order` has no idea it will be stored in MySQL or created from an HTTP request. It only knows what an order *is* and what makes one valid. You can test `total()` and the "must have a line" rule with zero setup.

### 2. Ports — interfaces the use case owns

The use case needs to load products, persist orders, take payment, and notify the customer. It defines what it needs and nothing more:

```php
// application/ports/ProductCatalog.php
interface ProductCatalog
{
    public function find(ProductId $id): ?Product;
}

// application/ports/OrderRepository.php
interface OrderRepository
{
    public function save(Order $order): void;
}

// application/ports/PaymentGateway.php
interface PaymentGateway
{
    public function charge(CustomerId $customer, Money $amount): PaymentResult;
}

// application/ports/OrderNotifier.php
interface OrderNotifier
{
    public function orderPlaced(Order $order): void;
}
```

These live *with* the use case, in the application layer. They are phrased in domain terms — `charge(CustomerId, Money)`, not `createStripePaymentIntent(array $params)`.

### 3. The Use Case — application business rules

```php
// application/PlaceOrder.php
final class PlaceOrder
{
    public function __construct(
        private ProductCatalog $catalog,
        private OrderRepository $orders,
        private PaymentGateway $payments,
        private OrderNotifier $notifier,
    ) {}

    public function handle(PlaceOrderCommand $command): OrderId
    {
        $lines = [];
        foreach ($command->items as $item) {
            $product = $this->catalog->find($item->productId)
                ?? throw new ProductNotFound($item->productId);

            if (! $product->hasStock($item->quantity)) {
                throw new OutOfStock($product->id);
            }
            $lines[] = new OrderLine($product->id, $product->price, $item->quantity);
        }

        $order = Order::place(OrderId::generate(), $command->customerId, $lines);

        $result = $this->payments->charge($command->customerId, $order->total());
        if (! $result->successful()) {
            throw new PaymentDeclined($result->reason());
        }

        $order->markPaid();
        $this->orders->save($order);
        $this->notifier->orderPlaced($order);

        return $order->id;
    }
}
```

Read it top to bottom: it is the business process in plain terms. No `Request`, no `DB::transaction`, no `Mail::to()`, no Stripe. Those words never appear in this layer. Swap MySQL for DynamoDB, Stripe for PayPal, HTTP for a CLI command — this class does not change.

<figure>
<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow: HTTP controller builds a command and calls PlaceOrder. PlaceOrder talks to four interfaces. Concrete adapters implement each interface using Eloquent, Stripe, and Mailer.">
  <style>
    .k{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
    .ap{fill:#eff6ff;stroke:#bfdbfe;stroke-width:1.5;}
    .uc{fill:#dbeafe;stroke:#60a5fa;stroke-width:1.5;}
  </style>
  <rect class="bx" x="1" y="105" width="120" height="46" rx="8"/>
  <text class="k" x="14" y="125">Controller</text>
  <text class="n" x="14" y="142">(Laravel)</text>

  <rect class="uc" x="165" y="100" width="130" height="56" rx="8"/>
  <text class="k" x="182" y="124">PlaceOrder</text>
  <text class="n" x="182" y="142">use case</text>

  <path d="M121 128 H162" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="165,128 156,123 156,133" fill="#94a3b8"/>

  <rect class="ap" x="340" y="10" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="352" y="34">ProductCatalog</text>
  <rect class="ap" x="340" y="66" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="352" y="90">OrderRepository</text>
  <rect class="ap" x="340" y="122" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="352" y="146">PaymentGateway</text>
  <rect class="ap" x="340" y="178" width="150" height="38" rx="8" stroke-dasharray="4 3"/>
  <text class="k" x="352" y="202">OrderNotifier</text>

  <path d="M295 120 L338 34 M295 124 L338 85 M295 132 L338 141 M295 138 L338 197" fill="none" stroke="#94a3b8" stroke-width="1.2"/>

  <rect class="bx" x="520" y="10" width="150" height="38" rx="8"/>
  <text class="k" x="532" y="34">EloquentCatalog</text>
  <rect class="bx" x="520" y="66" width="150" height="38" rx="8"/>
  <text class="k" x="532" y="90">EloquentOrders</text>
  <rect class="bx" x="520" y="122" width="150" height="38" rx="8"/>
  <text class="k" x="532" y="146">StripeGateway</text>
  <rect class="bx" x="520" y="178" width="150" height="38" rx="8"/>
  <text class="k" x="532" y="202">MailNotifier</text>

  <path d="M520 29 H494 M520 85 H494 M520 141 H494 M520 197 H494" fill="none" stroke="#15803d" stroke-width="1.3"/>
  <polygon points="492,29 501,24 501,34" fill="#15803d"/>
  <polygon points="492,85 501,80 501,90" fill="#15803d"/>
  <polygon points="492,141 501,136 501,146" fill="#15803d"/>
  <polygon points="492,197 501,192 501,202" fill="#15803d"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The use case depends only on the dashed interfaces. Green arrows are framework code implementing them — pointing inward.</figcaption>
</figure>

### 4. Interface Adapters — translate the outside world

**The controller** turns an HTTP request into a command, calls the use case, and turns the result into a response. That is *all* it does.

```php
// adapters/http/PlaceOrderController.php
final class PlaceOrderController
{
    public function __construct(private PlaceOrder $placeOrder) {}

    public function __invoke(PlaceOrderRequest $request): JsonResponse
    {
        $command = new PlaceOrderCommand(
            customerId: new CustomerId($request->user()->id),
            items: array_map(
                fn ($row) => new CartItem(new ProductId($row['product_id']), (int) $row['qty']),
                $request->validated('items'),
            ),
        );

        try {
            $orderId = $this->placeOrder->handle($command);
        } catch (OutOfStock | PaymentDeclined | ProductNotFound $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(['order_id' => (string) $orderId], 201);
    }
}
```

**A repository** implements the port using Eloquent, mapping between the domain `Order` and the `orders` table. The Eloquent model is an implementation detail that never leaves this file.

```php
// adapters/persistence/EloquentOrderRepository.php
final class EloquentOrderRepository implements OrderRepository
{
    public function save(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $row = OrderModel::updateOrCreate(
                ['id' => (string) $order->id],
                ['customer_id' => (string) $order->customerId, 'status' => $order->statusValue()],
            );
            $row->lines()->delete();
            foreach ($order->lines as $line) {
                $row->lines()->create([
                    'product_id' => (string) $line->productId,
                    'unit_price' => $line->unitPrice->cents(),
                    'quantity'   => $line->quantity,
                ]);
            }
        });
    }
}
```

**A gateway** adapts the Stripe SDK to the `PaymentGateway` port:

```php
// adapters/payment/StripePaymentGateway.php
final class StripePaymentGateway implements PaymentGateway
{
    public function __construct(private StripeClient $stripe) {}

    public function charge(CustomerId $customer, Money $amount): PaymentResult
    {
        try {
            $intent = $this->stripe->paymentIntents->create([
                'amount'   => $amount->cents(),
                'currency' => strtolower($amount->currency()),
                'customer' => (string) $customer,
                'confirm'  => true,
            ]);
            return PaymentResult::ok($intent->id);
        } catch (CardException $e) {
            return PaymentResult::failed($e->getMessage());
        }
    }
}
```

### 5. Frameworks & Drivers — wire it together

The only place the layers meet is the composition root. In Laravel that is a service provider:

```php
// app/Providers/OrderingServiceProvider.php
public function register(): void
{
    $this->app->bind(ProductCatalog::class, EloquentProductCatalog::class);
    $this->app->bind(OrderRepository::class, EloquentOrderRepository::class);
    $this->app->bind(OrderNotifier::class, MailOrderNotifier::class);

    $this->app->bind(PaymentGateway::class, function ($app) {
        return new StripePaymentGateway($app->make(StripeClient::class));
    });
}
```

Laravel now knows how to build `PlaceOrder`: it sees the four interface type-hints, resolves each to the concrete class above, and injects them. The controller asks for `PlaceOrder`, gets a fully wired instance, and none of the inner code ever named a framework class.

---

## What this buys you

<figure>
<svg viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four benefits: testable core, swappable details, framework independence, and screaming architecture.">
  <style>
    .t{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="10" width="330" height="80" rx="9" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="18" y="34">Testable business rules</text>
  <text class="d" x="18" y="54">PlaceOrder tested with in-memory fakes.</text>
  <text class="d" x="18" y="72">No DB, no HTTP, milliseconds per test.</text>

  <rect x="349" y="10" width="330" height="80" rx="9" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="366" y="34">Swappable details</text>
  <text class="d" x="366" y="54">Stripe → PayPal, MySQL → Postgres:</text>
  <text class="d" x="366" y="72">new adapter, one bind line. Core untouched.</text>

  <rect x="1" y="108" width="330" height="80" rx="9" fill="#fef9c3" stroke="#fde68a"/>
  <text class="t" x="18" y="132">Framework independence</text>
  <text class="d" x="18" y="152">Laravel upgrade or migration to a queue</text>
  <text class="d" x="18" y="170">worker touches adapters only.</text>

  <rect x="349" y="108" width="330" height="80" rx="9" fill="#f5f3ff" stroke="#ddd6fe"/>
  <text class="t" x="366" y="132">Intent-revealing structure</text>
  <text class="d" x="366" y="152">The application/ folder lists use cases:</text>
  <text class="d" x="366" y="170">PlaceOrder, CancelOrder, RefundOrder.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The point is not the folders. It is that the expensive-to-change code (rules) is isolated from the cheap-to-change code (details).</figcaption>
</figure>

A test for the use case needs no framework:

```php
public function test_it_declines_when_the_card_fails(): void
{
    $placeOrder = new PlaceOrder(
        catalog: new InMemoryCatalog([$this->product('p1', price: 1000, stock: 5)]),
        orders: $orders = new InMemoryOrderRepository(),
        payments: new AlwaysDeclinesGateway(),
        notifier: new NullNotifier(),
    );

    $this->expectException(PaymentDeclined::class);

    $placeOrder->handle(new PlaceOrderCommand(
        new CustomerId('c1'),
        [new CartItem(new ProductId('p1'), 2)],
    ));

    $this->assertCount(0, $orders->all()); // nothing persisted
}
```

---

## The traps

<div markdown="1">

| Mistake | Why it hurts |
| --- | --- |
| **Entities that extend `Model`** | Eloquent is now a core dependency. Every test needs a database; the domain is coupled to the ORM's lifecycle. |
| **Use cases that take a `Request` or return a `JsonResponse`** | The application layer now depends on HTTP. It can't be reused from a queue job, a command, or a test without faking the web. |
| **Interfaces in the outer layer** | If `OrderRepository` lives next to Eloquent instead of next to the use case, the arrow points the wrong way. The port belongs to the consumer. |
| **A `Services/` folder that just wraps the ORM** | Layers named but not respected. If `OrderService` calls `DB::` and returns arrays, you have indirection without inversion. |
| **Applying all four layers to a CRUD admin panel** | Clean Architecture pays off where business rules are rich and long-lived. For a settings table, a controller and a model are fine. |

</div>

---

## When to reach for it

Clean Architecture is an investment: more files, more interfaces, more indirection. It earns that cost when:

- the **domain rules are non-trivial** and will outlive the current framework version;
- you have **multiple entry points** to the same logic (HTTP, queue, CLI, scheduled job);
- **testing speed matters** and you don't want a database in every test;
- the team is large enough that **clear boundaries** prevent the codebase turning to mud.

For a weekend CRUD app, skip it. For the payments module of a platform you will run for five years, the boundaries are worth every extra file.

---

## A five-point checklist

1. **Point every source dependency inward.** If an inner class names an outer class, you have a violation.
2. **Keep entities and use cases free of framework types.** No `Model`, no `Request`, no facades, no SDK classes.
3. **Let the consumer own the interface.** The port sits with the use case that needs it; the outer layer implements it.
4. **Make the use case the unit of the application layer** — one class per action, readable as a business process.
5. **Wire everything in one composition root** (a service provider) and nowhere else.

---

## Conclusion

Clean Architecture is one rule wearing four circles: **details depend on rules, never the reverse.** You enforce it by having each inner layer declare the interfaces it needs and letting the framework layer implement them at a single wiring point.

The payoff is that the code most expensive to get wrong — the business logic — is the code least entangled with the parts you will replace. Frameworks come and go; the meaning of "place an order" stays put.
