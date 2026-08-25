---
title: "SOLID Principles in PHP & Laravel: Writing Maintainable and Scalable Applications"
category: Engineering
excerpt: >-
  SOLID is not a checklist — it's a way of thinking about code that makes
  systems easier to change, test, and extend. This guide walks through every
  principle with real PHP and Laravel examples.
---

Every developer has worked in a codebase that felt impossible to change. A bug fix in one class breaks something in three others. A new feature requires edits in files that have nothing to do with the feature. Unit tests are painful to write because dependencies are baked in everywhere.

SOLID principles are a practical response to these problems. They were articulated by Robert C. Martin and give names to design patterns experienced engineers naturally gravitate toward — not because the patterns are fashionable, but because they genuinely reduce the cost of changing code over time.

This article covers all five principles specifically from a PHP and Laravel perspective, with realistic examples and an honest discussion of where to draw the line between clean design and unnecessary abstraction.

---

## What SOLID Means

SOLID is an acronym:

| Letter | Principle | Core Idea |
|--------|-----------|-----------|
| S | Single Responsibility Principle | A class should have one reason to change |
| O | Open/Closed Principle | Open for extension, closed for modification |
| L | Liskov Substitution Principle | Subtypes must be substitutable for their base types |
| I | Interface Segregation Principle | Prefer many focused interfaces over one large one |
| D | Dependency Inversion Principle | Depend on abstractions, not concretions |

These principles are not isolated rules. They reinforce each other. A class that follows SRP is easier to satisfy LSP. Applying DIP naturally pushes you toward ISP. Think of them as a coherent system, not a checklist.

---

## S — Single Responsibility Principle

> A class should have one reason to change.

"Reason to change" is the key phrase. If a class changes when the business logic changes *and* when the email template changes *and* when the database schema changes, that is three reasons to change — and a sign the class is doing too much.

### The Problem

```php
class OrderController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // Validate
        $data = $request->validate([
            'user_id'    => 'required|exists:users,id',
            'items'      => 'required|array',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity'   => 'required|integer|min:1',
        ]);

        // Calculate total
        $total = 0;
        foreach ($data['items'] as $item) {
            $product = Product::find($item['product_id']);
            $total  += $product->price * $item['quantity'];
        }

        // Create order
        $order = Order::create([
            'user_id' => $data['user_id'],
            'total'   => $total,
            'status'  => 'pending',
        ]);

        foreach ($data['items'] as $item) {
            $order->items()->create($item);
        }

        // Send email
        Mail::to($order->user->email)->send(new OrderConfirmationMail($order));

        // Update inventory
        foreach ($data['items'] as $item) {
            Product::find($item['product_id'])
                ->decrement('stock', $item['quantity']);
        }

        return response()->json($order, 201);
    }
}
```

This controller creates orders, calculates totals, sends email, and manages inventory. Any change to any of those four responsibilities means editing this class. It is also nearly untestable in isolation.

### Refactored

Separate responsibilities into dedicated classes:

```php
// app/Services/OrderService.php
class OrderService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly OrderRepository  $orders,
    ) {}

    public function createOrder(array $data): Order
    {
        $total = $this->calculateTotal($data['items']);

        $order = $this->orders->create([
            'user_id' => $data['user_id'],
            'total'   => $total,
            'status'  => 'pending',
        ], $data['items']);

        $this->inventory->decrementStock($data['items']);

        return $order;
    }

    private function calculateTotal(array $items): int
    {
        return array_sum(array_map(
            fn(array $item) => Product::find($item['product_id'])->price * $item['quantity'],
            $items
        ));
    }
}
```

```php
// app/Http/Controllers/OrderController.php
class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
    ) {}

    public function store(OrderRequest $request): JsonResponse
    {
        $order = $this->orderService->createOrder($request->validated());

        OrderConfirmationJob::dispatch($order);

        return response()->json($order, 201);
    }
}
```

The controller now has one job: accept an HTTP request, delegate to the service, return a response. The email is dispatched as a queued job — it has its own class and its own reason to change.

### When SRP Becomes Over-Engineering

SRP does not mean one method per class or one class per action. A `UserRepository` that has `find()`, `create()`, `update()`, and `delete()` is following SRP — its single responsibility is data access for the User model. Splitting that into `UserFinder`, `UserCreator`, `UserUpdater`, and `UserDeleter` is fragmentation, not design.

The test is always: do changes to this class tend to arrive together? If so, they belong together. If changes arrive from completely different directions (email designer vs. database engineer vs. business analyst), separate them.

---

## O — Open/Closed Principle

> Software entities should be open for extension, but closed for modification.

Adding a new behaviour should not require editing existing, tested code. You extend the system, you don't reach into it and modify it.

### The Problem

```php
class DiscountCalculator
{
    public function calculate(Order $order, string $type): int
    {
        if ($type === 'percentage') {
            return (int) ($order->total * 0.10);
        }

        if ($type === 'fixed') {
            return 500; // cents
        }

        if ($type === 'loyalty') {
            return $order->user->points > 1000 ? 1000 : 0;
        }

        return 0;
    }
}
```

Every new discount type means editing `DiscountCalculator`. That breaks existing tests and risks introducing regressions.

### Refactored with Polymorphism

```php
// app/Discounts/DiscountStrategyInterface.php
interface DiscountStrategyInterface
{
    public function calculate(Order $order): int;
}

// app/Discounts/PercentageDiscount.php
class PercentageDiscount implements DiscountStrategyInterface
{
    public function __construct(private readonly float $rate) {}

    public function calculate(Order $order): int
    {
        return (int) ($order->total * $this->rate);
    }
}

// app/Discounts/FixedDiscount.php
class FixedDiscount implements DiscountStrategyInterface
{
    public function __construct(private readonly int $amountCents) {}

    public function calculate(Order $order): int
    {
        return $this->amountCents;
    }
}

// app/Discounts/LoyaltyDiscount.php
class LoyaltyDiscount implements DiscountStrategyInterface
{
    public function calculate(Order $order): int
    {
        return $order->user->points > 1000 ? 1000 : 0;
    }
}
```

Adding a new discount type (`SeasonalDiscount`, `ReferralDiscount`) means adding a new class — not modifying existing ones.

```php
class DiscountCalculator
{
    public function calculate(Order $order, DiscountStrategyInterface $strategy): int
    {
        return $strategy->calculate($order);
    }
}
```

### Laravel Context

In Laravel, this pattern maps naturally to tagged bindings in the service container:

```php
// AppServiceProvider.php
$this->app->tag([
    PercentageDiscount::class,
    FixedDiscount::class,
    LoyaltyDiscount::class,
], 'discounts');
```

Or driven by configuration:

```php
$strategy = match($coupon->type) {
    'percentage' => new PercentageDiscount($coupon->value / 100),
    'fixed'      => new FixedDiscount($coupon->value),
    'loyalty'    => new LoyaltyDiscount(),
    default      => throw new InvalidArgumentException("Unknown discount type: {$coupon->type}"),
};
```

---

## L — Liskov Substitution Principle

> Objects of a subtype must be substitutable for objects of their base type without altering the correctness of the program.

In practical terms: if you have a type `A` and a subtype `B extends A`, any code that works with `A` must work equally well with `B` — without surprises, exceptions, or behavioural changes the caller did not expect.

### A Violation

```php
abstract class PaymentMethod
{
    abstract public function charge(int $amountCents): PaymentResult;
    abstract public function refund(string $transactionId, int $amountCents): RefundResult;
}

class BankTransfer extends PaymentMethod
{
    public function charge(int $amountCents): PaymentResult
    {
        // works fine
    }

    public function refund(string $transactionId, int $amountCents): RefundResult
    {
        throw new \RuntimeException('Bank transfers cannot be refunded through this interface');
    }
}
```

Code that calls `$paymentMethod->refund(...)` will break silently if a `BankTransfer` instance is passed. The caller cannot substitute one `PaymentMethod` for another without knowing the concrete type — which defeats the purpose of the abstraction.

### Fix: Model the Contract Accurately

```php
interface Chargeable
{
    public function charge(int $amountCents): PaymentResult;
}

interface Refundable
{
    public function refund(string $transactionId, int $amountCents): RefundResult;
}

class CreditCardGateway implements Chargeable, Refundable
{
    public function charge(int $amountCents): PaymentResult { /* ... */ }
    public function refund(string $transactionId, int $amountCents): RefundResult { /* ... */ }
}

class BankTransferGateway implements Chargeable
{
    public function charge(int $amountCents): PaymentResult { /* ... */ }
    // No refund — and that's fine, it's not in the contract
}
```

Now the type system itself prevents the incorrect substitution. Callers that need refund capability declare `Refundable` — and `BankTransferGateway` simply won't satisfy that type.

### LSP in Laravel

LSP violations in Laravel often appear in:

- **Eloquent model inheritance**: Subclasses that override methods and silently ignore or alter scopes in ways that break callers.
- **Repository patterns**: A `CachedUserRepository` that extends `UserRepository` but returns stale data for methods the caller doesn't expect to be cached.
- **Queue jobs**: Jobs that implement a `ShouldQueue` contract but handle failures differently than the dispatcher expects.

The fix is always the same — make the interface accurately describe the behaviour contract, not just the method signatures.

---

## I — Interface Segregation Principle

> A class should not be forced to implement interfaces it does not use.

Fat interfaces create brittle coupling. When one interface changes, every class implementing it must be updated — even if only one method is relevant to that class.

### The Problem

```php
interface NotificationChannelInterface
{
    public function sendEmail(string $to, string $subject, string $body): void;
    public function sendSms(string $to, string $message): void;
    public function sendPushNotification(string $deviceToken, string $message): void;
    public function sendSlackMessage(string $channel, string $message): void;
}

class EmailNotifier implements NotificationChannelInterface
{
    public function sendEmail(string $to, string $subject, string $body): void
    {
        // real implementation
    }

    public function sendSms(string $to, string $message): void
    {
        throw new \BadMethodCallException('Not implemented');
    }

    public function sendPushNotification(string $deviceToken, string $message): void
    {
        throw new \BadMethodCallException('Not implemented');
    }

    public function sendSlackMessage(string $channel, string $message): void
    {
        throw new \BadMethodCallException('Not implemented');
    }
}
```

`EmailNotifier` is forced to implement three methods it cannot fulfil. Any caller that checks the interface is misled.

### Fix: Focused Interfaces

```php
interface EmailNotifiableInterface
{
    public function sendEmail(string $to, string $subject, string $body): void;
}

interface SmsNotifiableInterface
{
    public function sendSms(string $to, string $message): void;
}

interface PushNotifiableInterface
{
    public function sendPushNotification(string $deviceToken, string $message): void;
}

interface SlackNotifiableInterface
{
    public function sendSlackMessage(string $channel, string $message): void;
}

class EmailNotifier implements EmailNotifiableInterface
{
    public function sendEmail(string $to, string $subject, string $body): void
    {
        // clean, complete implementation
    }
}

class OmniNotifier implements EmailNotifiableInterface, SmsNotifiableInterface, SlackNotifiableInterface
{
    // implements only what it actually supports
}
```

### Impact on Testability

Smaller interfaces make mocking far simpler. A service that needs to send an email only declares `EmailNotifiableInterface` as a dependency — and your test only needs a mock with one method, not four.

```php
class OrderService
{
    public function __construct(
        private readonly EmailNotifiableInterface $mailer,
    ) {}
}

// In test:
$mailer = $this->createMock(EmailNotifiableInterface::class);
$mailer->expects($this->once())->method('sendEmail');
```

---

## D — Dependency Inversion Principle

> High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions.

This is often misunderstood as "always inject dependencies" — but DIP is specifically about the *direction of the dependency*. High-level business logic should not know about concrete database drivers, third-party SDKs, or file-system implementations. It should depend on an interface, and the concrete implementation should be wired in from outside.

### Dependency Injection vs. Dependency Inversion

These are related but distinct:

- **Dependency Injection (DI)**: Passing dependencies into a class rather than constructing them inside it. A pattern for *how* dependencies are provided.
- **Dependency Inversion (DIP)**: Ensuring that the dependency is an abstraction (interface), not a concretion. A rule about *what* you depend on.

You can have DI without DIP:

```php
// DI, but not DIP — still coupled to a concrete class
class ReportService
{
    public function __construct(
        private readonly MySqlReportRepository $repository, // concrete
    ) {}
}
```

DI *and* DIP:

```php
// DI + DIP — depends on the abstraction
class ReportService
{
    public function __construct(
        private readonly ReportRepositoryInterface $repository, // abstraction
    ) {}
}
```

### Laravel's Service Container

Laravel's service container is built for DIP. You bind an interface to a concrete implementation in a service provider, and the container resolves it automatically:

```php
// AppServiceProvider.php
public function register(): void
{
    $this->app->bind(
        ReportRepositoryInterface::class,
        MySqlReportRepository::class,
    );
}
```

In tests, you swap the binding:

```php
$this->app->bind(
    ReportRepositoryInterface::class,
    InMemoryReportRepository::class,
);
```

Business logic is never touched. Only the binding changes.

### Practical Example

```php
// app/Contracts/ReportRepositoryInterface.php
interface ReportRepositoryInterface
{
    public function findByDateRange(Carbon $from, Carbon $to): Collection;
    public function save(Report $report): void;
}

// app/Repositories/MySqlReportRepository.php
class MySqlReportRepository implements ReportRepositoryInterface
{
    public function findByDateRange(Carbon $from, Carbon $to): Collection
    {
        return Report::whereBetween('created_at', [$from, $to])->get();
    }

    public function save(Report $report): void
    {
        $report->save();
    }
}

// app/Services/ReportService.php
class ReportService
{
    public function __construct(
        private readonly ReportRepositoryInterface $reports,
    ) {}

    public function generateMonthlyReport(int $year, int $month): Report
    {
        $from   = Carbon::create($year, $month, 1)->startOfDay();
        $to     = $from->copy()->endOfMonth();
        $data   = $this->reports->findByDateRange($from, $to);
        $report = new Report($data);

        $this->reports->save($report);

        return $report;
    }
}
```

`ReportService` has no knowledge of MySQL, Eloquent, or any persistence mechanism. It deals in domain concepts: `Report`, `Collection`, `Carbon`. The infrastructure details live in `MySqlReportRepository`, isolated and swappable.

---

## Real-World Example: Payment Processing

Let's put all five principles together in one cohesive example — a payment system that can support multiple payment gateways.

### The Interface

```php
// app/Contracts/PaymentGatewayInterface.php
interface PaymentGatewayInterface
{
    public function charge(PaymentRequest $request): PaymentResult;
    public function refund(string $transactionId, int $amountCents): RefundResult;
    public function getTransaction(string $transactionId): TransactionDetails;
}
```

### Gateway Implementations

```php
// app/Gateways/StripePaymentGateway.php
class StripePaymentGateway implements PaymentGatewayInterface
{
    public function __construct(
        private readonly StripeClient $client,
        private readonly LoggerInterface $logger,
    ) {}

    public function charge(PaymentRequest $request): PaymentResult
    {
        try {
            $intent = $this->client->paymentIntents->create([
                'amount'               => $request->amountCents,
                'currency'             => strtolower($request->currency),
                'payment_method'       => $request->paymentMethodId,
                'confirm'              => true,
                'return_url'           => $request->returnUrl,
                'idempotency_key'      => $request->idempotencyKey,
            ]);

            return PaymentResult::success($intent->id, $intent->status);
        } catch (ApiErrorException $e) {
            $this->logger->error('Stripe charge failed', [
                'error'    => $e->getMessage(),
                'request'  => $request->toArray(),
            ]);
            return PaymentResult::failure($e->getMessage());
        }
    }

    public function refund(string $transactionId, int $amountCents): RefundResult
    {
        // Stripe-specific refund logic
    }

    public function getTransaction(string $transactionId): TransactionDetails
    {
        // Stripe-specific retrieval
    }
}

// app/Gateways/PayPalPaymentGateway.php
class PayPalPaymentGateway implements PaymentGatewayInterface
{
    public function __construct(
        private readonly PayPalHttpClient $client,
        private readonly LoggerInterface $logger,
    ) {}

    public function charge(PaymentRequest $request): PaymentResult
    {
        // PayPal-specific implementation — same interface, different details
    }

    public function refund(string $transactionId, int $amountCents): RefundResult
    {
        // PayPal-specific refund
    }

    public function getTransaction(string $transactionId): TransactionDetails
    {
        // PayPal-specific retrieval
    }
}
```

### The Service

```php
// app/Services/PaymentService.php
class PaymentService
{
    public function __construct(
        private readonly PaymentGatewayInterface $gateway,
        private readonly PaymentRepository       $payments,
        private readonly LoggerInterface          $logger,
    ) {}

    public function processPayment(Order $order, string $paymentMethodId): Payment
    {
        $idempotencyKey = $this->generateIdempotencyKey($order);

        $request = new PaymentRequest(
            amountCents:      $order->total_cents,
            currency:         $order->currency,
            paymentMethodId:  $paymentMethodId,
            idempotencyKey:   $idempotencyKey,
            returnUrl:        route('payments.return', $order),
        );

        $result = $this->gateway->charge($request);

        $payment = $this->payments->record([
            'order_id'       => $order->id,
            'transaction_id' => $result->transactionId,
            'amount_cents'   => $order->total_cents,
            'currency'       => $order->currency,
            'status'         => $result->status,
            'gateway'        => $result->gateway,
        ]);

        return $payment;
    }

    private function generateIdempotencyKey(Order $order): string
    {
        return hash('sha256', "order-{$order->id}-{$order->created_at->timestamp}");
    }
}
```

### Binding in the Container

```php
// AppServiceProvider.php
public function register(): void
{
    $this->app->bind(PaymentGatewayInterface::class, function (Application $app) {
        return match(config('payment.default_gateway')) {
            'stripe' => $app->make(StripePaymentGateway::class),
            'paypal' => $app->make(PayPalPaymentGateway::class),
            default  => throw new InvalidArgumentException('Unknown payment gateway'),
        };
    });
}
```

Adding a new gateway (`BankPaymentGateway`, `MolliePaymentGateway`) means:
1. Create a new class implementing `PaymentGatewayInterface`
2. Add a binding condition in the service provider
3. Set the config value

`PaymentService` is never touched. The business logic is unaware a new gateway exists.

---

## Common Mistakes

### 1. Creating Interfaces for Everything

Not every class needs an interface. A `CurrencyConverter` with a single, stable implementation does not need a `CurrencyConverterInterface` unless you have a concrete reason to swap it (testing, multiple implementations, package boundary). Gratuitous interfaces add indirection without benefit.

### 2. Excessive Repositories

The repository pattern is useful when you want to decouple business logic from the persistence layer. It is not a mandatory layer for every model. Simple CRUD operations in a small application do not need a repository. Add the pattern when you need it.

### 3. Too Many Service Classes

Splitting every action into its own `Service` class fragments cohesive logic. An `OrderService` that creates, updates, cancels, and ships orders is fine. Creating `OrderCreationService`, `OrderUpdaterService`, `OrderCancellationService`, and `OrderShipmentService` for what is essentially one domain concept is fragmentation masquerading as SRP.

### 4. Applying SOLID Mechanically

SOLID principles are guidelines, not laws. They work best when you understand *why* a principle exists and apply it in response to a real problem. Applying them before a problem exists is premature abstraction, and premature abstraction has the same symptoms as no abstraction at all: code that is hard to understand and expensive to change.

---

## Practical Checklist

Before shipping a class or reviewing a pull request, run through this:

**SRP**
- [ ] Can you describe this class's responsibility in one sentence without using "and"?
- [ ] If a business rule changes, does this class change? If a database schema changes, does it also change? If yes — too many responsibilities.

**OCP**
- [ ] To add a new variant of this behaviour, do you need to edit this class or just add a new one?
- [ ] Is there a `switch` or chain of `if/elseif` that will grow with each new feature?

**LSP**
- [ ] Does any subclass throw `NotImplementedException` or `BadMethodCallException` for methods in the parent contract?
- [ ] Would a caller be surprised by what they get from a subtype?

**ISP**
- [ ] Does any class implement an interface but leave some methods throwing exceptions or returning stub values?
- [ ] Is the interface so large that most implementors only use half of it?

**DIP**
- [ ] Does this class `new` up its own dependencies internally?
- [ ] Are dependencies typed as concrete classes rather than interfaces?
- [ ] Would swapping the implementation require editing this file?

---

## Conclusion

SOLID principles are most useful when they are understood as a vocabulary for design problems rather than a prescription for every class you write. They describe the shape of maintainable code — code that does not collapse under the weight of new requirements.

In PHP and Laravel, the principles map naturally to established patterns: services, repositories, form requests, jobs, service providers, and the container. Most Laravel applications that are well-designed are already applying SOLID in some form, even if the developers are not naming it.

Start by learning to recognise the problems each principle solves. Write code that is simple to begin with. Add abstraction in response to real friction — when a class genuinely starts having multiple reasons to change, when adding a feature genuinely requires editing stable, tested code. That is when SOLID principles pay their rent.
