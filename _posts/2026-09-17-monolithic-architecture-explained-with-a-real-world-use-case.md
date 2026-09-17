---
title: "Monolithic Architecture Explained with a Real-World Use Case"
category: Architecture
excerpt: >-
  Monolithic Architecture in plain terms: what "one deployable unit" really
  means, and one real feature — placing an order — built the monolith way
  with Laravel and Vue.js. A 10–15 minute read.
---

Before microservices were a talking point, almost every application was built this way by default: one codebase, one process, one deployment. That's a **monolith** — not a slur, just a shape. This note strips it to the essentials: what actually makes something monolithic, one real feature built that way with Laravel and Vue.js, and when the shape stops paying for itself. It reads in about 10–15 minutes.

---

## The one-sentence definition

**Monolithic Architecture builds an application's UI, business logic, and data access as modules inside a single codebase that compiles, deploys, and scales as one unit.**

Everything below is a consequence of that sentence.

---

## Why "one unit"?

A monolith isn't "bad code" or "no structure" — it can be as cleanly layered as any other design. The defining trait is **deployment boundary**, not internal organization: every request, whether it hits the orders page or the inventory page, is served by the same running process, and shipping any change means shipping the whole application again.

<figure>
<svg id="diagram-monolith-unit" viewBox="0 0 640 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A single box labeled Application process containing three internal layers: Presentation (Laravel routes, controllers, and Vue.js views), Business Logic (orders, inventory, payments modules), and Data Access (one shared database connection). One arrow labeled deploy points from the whole box to a single database, showing it ships and scales as one unit.">
  <style>
    #diagram-monolith-unit .dg-lbl{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    #diagram-monolith-unit .dg-sub{font:10.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
    #diagram-monolith-unit .dg-k{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    #diagram-monolith-unit .dg-note{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>

  <rect x="60" y="20" width="520" height="280" rx="14" fill="#eff6ff" stroke="#93c5fd" stroke-width="2"/>
  <text class="dg-lbl" x="320" y="44" text-anchor="middle">Application Process (one deployable unit)</text>

  <rect x="90" y="64" width="460" height="56" rx="8" fill="#dbeafe" stroke="#60a5fa" stroke-width="1.5"/>
  <text class="dg-lbl" x="320" y="88" text-anchor="middle">Presentation</text>
  <text class="dg-sub" x="320" y="104" text-anchor="middle">Laravel routes/controllers + Vue.js components</text>

  <rect x="90" y="134" width="460" height="80" rx="8" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1.5"/>
  <text class="dg-lbl" x="320" y="156" text-anchor="middle">Business Logic</text>
  <text class="dg-sub" x="320" y="172" text-anchor="middle">Orders module · Inventory module · Payments module</text>
  <text class="dg-sub" x="320" y="188" text-anchor="middle">— all in-process PHP calls, no network hop —</text>

  <rect x="90" y="228" width="460" height="56" rx="8" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1.5"/>
  <text class="dg-lbl" x="320" y="252" fill="#ffffff" text-anchor="middle">Data Access</text>
  <text class="dg-sub" x="320" y="268" fill="#e0e7ff" text-anchor="middle">One shared Eloquent database connection</text>

  <path d="M320 300 V330" fill="none" stroke="#1d4ed8" stroke-width="2.5" marker-end="url(#arrow)"/>
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#1d4ed8"/>
    </marker>
  </defs>
  <rect x="255" y="332" width="130" height="34" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
  <text class="dg-k" x="278" y="354">MySQL</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Everything ships together, runs in the same process, and scales by running more copies of the whole box.</figcaption>
</figure>

| Trait | What it means in practice |
| --- | --- |
| **One codebase** | Orders, inventory, and payments modules live in the same Laravel repository. |
| **One process** | A call from the orders module to the inventory module is a plain PHP method call — no HTTP, no message queue, no network latency. |
| **One deployment** | A one-line bug fix in the payments module still ships the entire application. |
| **One scaling unit** | If only checkout is under load, you still spin up another copy of the *whole* app — there's no way to scale checkout alone. |

This is the mirror image of microservices, where each of those modules would be its own deployable service with its own database. Monolithic isn't the absence of structure — internally it can (and should) still separate presentation, business logic, and data access. The difference is that those layers are folders and classes, not network boundaries.

---

## Real-world use case: "Place an order"

Same feature as before, different shape: a customer submits a cart, the system checks stock, calculates the total, saves the order, and sends a confirmation email. We'll build the backend with Laravel and the interactive checkout form with Vue.js — both compiled and deployed as one application, no separate services to talk to.

### 1. One Laravel app, one Vite build, one deployment

```
order-monolith/
├── app/
│   ├── Http/Controllers/
│   │   └── OrderController.php
│   ├── Models/
│   │   ├── Order.php
│   │   └── Stock.php
│   ├── Services/
│   │   ├── InventoryService.php
│   │   ├── OrderService.php
│   │   └── Exceptions/OutOfStockException.php
│   └── Mail/
│       └── OrderConfirmed.php
├── resources/
│   ├── js/
│   │   ├── components/
│   │   │   └── CheckoutForm.vue
│   │   └── app.js
│   └── views/
│       └── checkout.blade.php
├── routes/web.php
├── database/migrations/
├── composer.json
└── package.json
```

Every folder under `app/` still separates concerns — but they all reference each other directly via PHP's autoloader and ship in the same `php artisan` deploy, with the Vue components compiled by Vite into the same public build.

### 2. Data access — one shared Eloquent connection

```php
// app/Models/Stock.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    protected $fillable = ['product_id', 'quantity'];
}
```

```php
// app/Models/Order.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = ['customer_id', 'total', 'status'];
}
```

Every module reuses the same connection defined once in `config/database.php`. There's no "orders database" and "inventory database" — one schema, one set of tables, joined with plain Eloquent relationships or query builder when needed.

### 3. Inventory module — business logic, no network hop to reach it

```php
// app/Services/InventoryService.php
namespace App\Services;

use App\Models\Stock;

class InventoryService
{
    public function checkStock(array $items): bool
    {
        foreach ($items as $item) {
            $stock = Stock::where('product_id', $item['product_id'])->first();

            if (! $stock || $stock->quantity < $item['quantity']) {
                return false;
            }
        }

        return true;
    }

    public function decrementStock(array $items): void
    {
        foreach ($items as $item) {
            Stock::where('product_id', $item['product_id'])
                ->decrement('quantity', $item['quantity']);
        }
    }
}
```

### 4. Orders module — calls inventory directly, as a method

```php
// app/Services/Exceptions/OutOfStockException.php
namespace App\Services\Exceptions;

use Exception;

class OutOfStockException extends Exception {}
```

```php
// app/Services/OrderService.php
namespace App\Services;

use App\Mail\OrderConfirmed;
use App\Models\Order;
use App\Services\Exceptions\OutOfStockException;
use Illuminate\Support\Facades\Mail;

class OrderService
{
    public function __construct(
        private InventoryService $inventory,
    ) {}

    public function placeOrder(string $customerId, array $items, string $email): Order
    {
        // Direct method call — same process, no HTTP, no message broker.
        if (! $this->inventory->checkStock($items)) {
            throw new OutOfStockException('One or more items are unavailable');
        }

        $total = collect($items)->sum(fn ($i) => $i['quantity'] * $i['unit_price']);

        $order = Order::create([
            'customer_id' => $customerId,
            'total' => $total,
            'status' => 'CONFIRMED',
        ]);

        $this->inventory->decrementStock($items);
        Mail::to($email)->send(new OrderConfirmed($order));

        return $order;
    }
}
```

Notice what's missing compared to a ports-and-adapters version: no interface definitions to satisfy, no separate service to deploy. `OrderService` just calls `InventoryService` directly — Laravel's container injects it automatically — because they're guaranteed to be running together, in the same process, at the same version.

### 5. Notifications — a Mailable

```php
// app/Mail/OrderConfirmed.php
namespace App\Mail;

use App\Models\Order;
use Illuminate\Mail\Mailable;

class OrderConfirmed extends Mailable
{
    public function __construct(public Order $order) {}

    public function build(): self
    {
        return $this->subject('Order confirmed')
            ->view('emails.order-confirmed')
            ->with(['order' => $this->order]);
    }
}
```

### 6. Controller and route — wiring inside the same process

```php
// app/Http/Controllers/OrderController.php
namespace App\Http\Controllers;

use App\Services\Exceptions\OutOfStockException;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private OrderService $orderService) {}

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => 'required|string',
            'email' => 'required|email',
            'items' => 'required|array|min:1',
        ]);

        try {
            $order = $this->orderService->placeOrder(
                $validated['customer_id'],
                $validated['items'],
                $validated['email'],
            );

            return response()->json($order, 201);
        } catch (OutOfStockException $e) {
            return response()->json(['error' => $e->getMessage()], 409);
        }
    }
}
```

```php
// routes/web.php
use App\Http\Controllers\OrderController;
use Illuminate\Support\Facades\Route;

Route::get('/checkout', fn () => view('checkout'));
Route::post('/orders', [OrderController::class, 'store']);
```

<figure>
<svg id="diagram-monolith-flow" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow inside one process: a Vue.js component submits to a Laravel route, which calls the order service directly. Order service calls inventory service and Mail directly as in-process calls, all sharing one database connection.">
  <style>
    #diagram-monolith-flow .dg-k{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    #diagram-monolith-flow .dg-n{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    #diagram-monolith-flow .dg-bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
    #diagram-monolith-flow .dg-uc{fill:#dbeafe;stroke:#60a5fa;stroke-width:1.5;}
  </style>
  <rect class="dg-bx" x="1" y="70" width="130" height="46" rx="8"/>
  <text class="dg-k" x="14" y="90">CheckoutForm</text>
  <text class="dg-n" x="14" y="107">.vue</text>

  <path d="M131 93 H162" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="165,93 156,88 156,98" fill="#94a3b8"/>

  <rect class="dg-uc" x="165" y="64" width="150" height="58" rx="8"/>
  <text class="dg-k" x="178" y="88">OrderController</text>
  <text class="dg-n" x="178" y="106">method call</text>

  <path d="M315 78 H360 M315 108 H360" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="363,78 354,73 354,83" fill="#94a3b8"/>
  <polygon points="363,108 354,103 354,113" fill="#94a3b8"/>

  <rect class="dg-bx" x="363" y="50" width="160" height="36" rx="8"/>
  <text class="dg-k" x="373" y="72">InventoryService</text>
  <rect class="dg-bx" x="363" y="100" width="160" height="36" rx="8"/>
  <text class="dg-k" x="405" y="122">Mail</text>

  <path d="M443 86 V150 M443 136 V150" fill="none" stroke="#15803d" stroke-width="1.3"/>
  <path d="M373 86 L443 150" fill="none" stroke="#15803d" stroke-width="1.3" opacity="0"/>

  <rect class="dg-bx" x="373" y="150" width="140" height="36" rx="8" fill="#eff6ff"/>
  <text class="dg-k" x="410" y="172">MySQL</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Every arrow is an in-process call. There is no network between modules — only between the browser and the app.</figcaption>
</figure>

### 7. Frontend — a Vue.js component in the same repo

{% raw %}
```vue
<!-- resources/js/components/CheckoutForm.vue -->
<script setup>
import { ref } from 'vue';
import axios from 'axios';

const items = ref([{ product_id: '', quantity: 1, unit_price: 0 }]);
const email = ref('');
const error = ref(null);
const order = ref(null);

async function submitOrder() {
  error.value = null;

  try {
    const response = await axios.post('/orders', {
      customer_id: 'c1',
      email: email.value,
      items: items.value,
    });
    order.value = response.data;
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Something went wrong';
  }
}
</script>

<template>
  <form @submit.prevent="submitOrder">
    <input v-model="email" type="email" placeholder="Email" required />

    <div v-for="(item, index) in items" :key="index">
      <input v-model="item.product_id" placeholder="Product ID" />
      <input v-model.number="item.quantity" type="number" min="1" />
      <input v-model.number="item.unit_price" type="number" step="0.01" />
    </div>

    <button type="submit">Place order</button>

    <p v-if="error">{{ error }}</p>
    <p v-if="order">Order {{ order.id }} confirmed — total {{ order.total }}</p>
  </form>
</template>
```
{% endraw %}

```js
// resources/js/app.js
import { createApp } from 'vue';
import CheckoutForm from './components/CheckoutForm.vue';

createApp(CheckoutForm).mount('#checkout-form');
```

The Vue component talks to `/orders` over plain HTTP because it runs in the browser — but the *build* of that component ships inside the same Laravel repo, compiled by the same Vite pipeline, deployed by the same `php artisan` release. There's no separate frontend service, repo, or deploy pipeline unless you deliberately choose to split it out.

### 8. Testing — in the same process, no mocking a network

```php
// tests/Feature/OrderTest.php
namespace Tests\Feature;

use App\Models\Stock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_an_order_when_stock_is_unavailable(): void
    {
        Mail::fake();

        Stock::create(['product_id' => 'p1', 'quantity' => 0]);

        $response = $this->postJson('/orders', [
            'customer_id' => 'c1',
            'email' => 'a@example.com',
            'items' => [['product_id' => 'p1', 'quantity' => 1, 'unit_price' => 10]],
        ]);

        $response->assertStatus(409);
        Mail::assertNothingSent();
    }
}
```

There's no port or interface to satisfy — the test hits the real `OrderController` through Laravel's HTTP testing helpers and a real (in-memory/test) database, because in a monolith "the module" and "the dependency" are the same codebase.

---

## Why this pays off: speed, for a while

One repo, one deploy pipeline, one process to run locally. A new developer clones the repo, runs `composer install && npm install && php artisan serve`, and the whole application — orders, inventory, notifications, and the Vue checkout form — is up. There's no service mesh to configure, no distributed tracing to set up just to see one request's path, and a database transaction across "orders" and "inventory" is a normal Eloquent transaction, not a saga.

---

## The traps

<div markdown="1">

| Mistake | Why it hurts |
| --- | --- |
| **Letting modules reach into each other's tables directly** | The orders controller running raw queries against `stock` bypasses `InventoryService`'s rules — now stock logic lives in two places. |
| **No internal module boundaries at all** | A monolith with every Eloquent query and every Vue call thrown into one giant controller isn't "simple," it's a ball of mud — internal structure still matters even without network boundaries. |
| **Scaling the whole app because one endpoint is hot** | If checkout gets 100x traffic but the rest of the app doesn't, you're paying to scale features that don't need it. |
| **One failing module taking down the whole process** | An unhandled exception in the mail service can crash the request serving orders and inventory too — there's no isolation between them. |
| **Treating "monolith" as an excuse to skip tests** | The lack of network boundaries makes tests *easier* (see above), not optional. |

</div>

---

## When to reach for it

A monolith is the default for good reason — it minimizes operational cost until you have a proven reason to pay more. It's the right shape when:

- the team is **small enough that one deploy pipeline and one on-call rotation is simpler**, not slower;
- the domain is **still being discovered**, so splitting it into services now would mean guessing the wrong boundaries and paying to undo them;
- you need **strong consistency** — one database transaction across features — more than independent scaling;
- **low operational overhead** matters more than independent deployability: no service mesh, no distributed tracing, no per-service on-call.

Reach for microservices instead when different parts of the system genuinely need to scale, deploy, or fail independently — and you have the team size to run several services well. Splitting too early just turns one deployable thing into ten things that all still change together.

---

## A five-point checklist

1. **Keep internal module boundaries even without network boundaries.** `app/Services/Orders`, `app/Services/Inventory` — separate classes, no reaching into another module's tables.
2. **Share one database, but don't let every module touch every table.** Route access through the owning module's service class.
3. **Handle errors per-request, not just per-process.** One module's exception shouldn't be able to crash requests served by another.
4. **Test modules through their public methods and HTTP endpoints, not their internals.** It keeps the option to extract a module into its own service later.
5. **Revisit the shape when a real scaling or team-boundary pain shows up** — not before, and not because a blog post said monoliths are outdated.

---

## Conclusion

Monolithic Architecture is one idea: **everything — UI, business logic, data access — ships, runs, and scales as a single unit.** With Laravel and Vue.js that means one Laravel app, service classes that call each other as plain PHP methods, a Vue component compiled into the same build, and one shared database connection — no ports, no adapters, no network between your own code.

The payoff is speed: one thing to build, deploy, and debug, with real transactions instead of distributed ones. The cost shows up later — as a team, a codebase, or a traffic pattern that genuinely needs independent parts. Until then, the monolith isn't a shortcut you'll regret; it's the architecture doing exactly what it's for.
