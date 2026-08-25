---
title: "Payment Gateways Explained: How Online Payments Work and How to Integrate Them with Laravel"
category: Payments
excerpt: >-
  A complete guide to understanding online payment flows and building a clean,
  extensible payment integration in Laravel — covering architecture, webhooks,
  security, database design, and the failure scenarios that catch developers off guard.
---

Payment integration is one of those topics where the gap between "it works in the sandbox" and "it's safe in production" is wide enough to cause real financial damage. Most tutorials show you how to call an API. This article explains what is actually happening, why the architecture matters, and what the failure modes are — so that when things go wrong in production, you are not caught off guard.

---

## The Payment Ecosystem

Before writing a single line of code, it helps to understand the roles involved in processing a payment. Confusing these terms leads to architectural mistakes that are expensive to unwind.

### Gateway, Processor, and Acquiring Bank

These three terms are often used interchangeably. They are not the same.

| Entity | Role |
|--------|------|
| **Payment Gateway** | The API your application talks to. Handles the interface, encryption, and routing of payment data. Examples: Stripe, Adyen, PayPal |
| **Payment Processor** | Communicates with card networks on behalf of the merchant. Often invisible to developers — it sits between the gateway and the banks |
| **Acquiring Bank** | The merchant's bank. Receives funds from the card network after successful transactions |
| **Card Network** | Visa, Mastercard, Amex — the rails that route transactions between banks |
| **Issuing Bank** | The customer's bank. Approves or declines the charge |

In modern integrations (Stripe, Square), the gateway, processor, and sometimes the acquiring bank relationship are bundled under one provider. In enterprise setups, these are often separate entities with separate contracts and integrations.

### Terminology You Need to Know

**Authorization**: The issuing bank confirms the customer has sufficient funds and reserves the amount. No money has moved yet.

**Capture**: The merchant requests the reserved funds be transferred. This triggers settlement.

**Settlement**: The actual movement of funds from the customer's bank to the merchant's acquiring bank. This typically takes 1–2 business days.

**Payment Intent**: Stripe's model for representing a payment attempt across its lifecycle — from creation through confirmation. Other gateways have equivalent constructs.

**Refund**: Reversing a captured payment back to the customer.

**Void**: Cancelling an authorization before capture. No funds were ever moved.

**Chargeback**: The customer disputes a payment directly with their bank. The bank reverses the funds and initiates a dispute process. Chargebacks are expensive and losing them is common.

**Webhook**: An HTTP POST from the gateway to your server, notifying you of an event (payment succeeded, refund processed, dispute opened). Your primary source of ground truth for payment status.

**Idempotency**: Ensuring that sending the same request multiple times produces the same result only once. Critical for payment operations where network failures can cause duplicate requests.

**3D Secure / SCA**: An authentication step (often a bank OTP or app confirmation) required by European regulation (SCA under PSD2) and increasingly common elsewhere. The gateway handles the redirect flow; your integration needs to support it.

**PCI DSS**: The Payment Card Industry Data Security Standard. A set of security requirements for any system that handles card data. When you use a hosted payment form or tokenization, your scope is significantly reduced. Never handle raw card numbers if you can avoid it.

---

## The Complete Payment Flow

Here is what happens from the moment a customer clicks "Pay" to the moment money arrives in your account:

```
Customer
  └─▶ Merchant Website / App
        └─▶ Your Backend (Laravel)
              └─▶ Payment Gateway API
                    └─▶ Payment Processor
                          └─▶ Card Network (Visa / Mastercard)
                                └─▶ Issuing Bank (customer's bank)
                                      │
                               Approve / Decline
                                      │
                    ◀─────────────────┘ (authorization response)
              ◀─────┘ (gateway response)
        ◀─────┘ (API response to backend)
  ◀─────┘ (UI update)

Later (async):
Gateway ──▶ Webhook ──▶ Your Backend ──▶ Update Order
```

### Step by Step

**1. Customer submits payment.** The payment form, ideally hosted by the gateway (Stripe Elements, Braintree Hosted Fields), tokenizes the card client-side. Raw card numbers never touch your server.

**2. Your backend creates a payment intent.** You call the gateway API with the amount, currency, and any idempotency key. The gateway returns a client secret or transaction token.

**3. The gateway routes the request.** The gateway passes the transaction to the processor, which routes through the card network to the issuing bank.

**4. Authorization response.** The issuing bank approves or declines. The response comes back through the chain. Decline reasons are often generic for fraud prevention.

**5. Your backend receives the API response.** Record the transaction immediately, whatever the status. Do not discard declined payments — they are part of your audit trail.

**6. The customer is redirected.** Depending on the flow (one-step, 3DS, redirect-based), the customer may see a result immediately or be redirected back to your site after off-site authentication.

**7. Webhook confirms the final status.** Do not rely on the redirect. Webhooks arrive separately, are retried on failure by the gateway, and are your authoritative source of payment status. More on this shortly.

**8. Settlement.** Funds move from the issuing bank through the network to your acquiring bank, typically 1–2 business days after capture.

---

## Payment Architecture in Laravel

The goal of the architecture is to keep gateway-specific code isolated from your business logic. When you switch gateways, or add a second one for a new client, you should be adding code — not editing existing payment flows.

```
PaymentController
  └─▶ PaymentService          (business logic: idempotency, recording, orchestration)
        └─▶ PaymentGatewayInterface    (contract)
              ├─▶ StripePaymentGateway
              ├─▶ PayPalPaymentGateway
              └─▶ MolliePaymentGateway
```

The controller handles HTTP concerns. The service handles business logic. The gateway classes handle provider-specific API calls. The interface enforces consistency across providers.

---

## Database Design

Payment data should be treated as an audit trail. Never overwrite a row — append new records or update status with careful attention to what was before.

```sql
-- Core orders table (abbreviated)
CREATE TABLE orders (
    id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    status        ENUM('pending','processing','paid','failed','refunded') NOT NULL DEFAULT 'pending',
    total_cents   INT UNSIGNED NOT NULL,
    currency      CHAR(3) NOT NULL,
    created_at    TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- One record per payment attempt
CREATE TABLE payments (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_id        BIGINT UNSIGNED NOT NULL,
    gateway         VARCHAR(50) NOT NULL,          -- 'stripe', 'paypal', etc.
    gateway_payment_id  VARCHAR(255) NULL,         -- gateway's transaction/intent ID
    amount_cents    INT UNSIGNED NOT NULL,
    currency        CHAR(3) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method  VARCHAR(100) NULL,             -- 'card', 'bank_transfer', etc.
    idempotency_key VARCHAR(255) NOT NULL,
    gateway_response    JSON NULL,                 -- raw gateway response
    failure_reason  VARCHAR(500) NULL,
    created_at      TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP NOT NULL,
    UNIQUE KEY uq_idempotency (gateway, idempotency_key),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Append-only event log for gateway callbacks
CREATE TABLE payment_transactions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    payment_id      BIGINT UNSIGNED NOT NULL,
    event_type      VARCHAR(100) NOT NULL,        -- 'charge.succeeded', 'refund.created', etc.
    gateway_event_id VARCHAR(255) NULL,           -- gateway's event ID for deduplication
    amount_cents    INT UNSIGNED NULL,
    status          VARCHAR(50) NOT NULL,
    raw_payload     JSON NULL,
    processed_at    TIMESTAMP NOT NULL,
    UNIQUE KEY uq_gateway_event (gateway_event_id),
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);
```

### Important Design Decisions

**Store `amount_cents` as an integer.** Never store money as a floating-point value. `0.1 + 0.2 !== 0.3` in floating-point arithmetic. Use integers (cents/pence/minor currency units) everywhere, and format for display only at the presentation layer.

**`gateway_response` as JSON.** Store the raw gateway response. You will need it when debugging discrepancies, handling disputes, or doing reconciliation weeks later.

**`payment_transactions` is append-only.** Each webhook event creates a new row. You can reconstruct the full payment history from this table. Never delete rows from this table.

**`idempotency_key` has a unique index.** This prevents duplicate charge records if your application retries a failed request.

---

## Laravel Implementation

### Configuration

```php
// config/payment.php
return [
    'default_gateway' => env('PAYMENT_GATEWAY', 'stripe'),

    'gateways' => [
        'stripe' => [
            'secret_key'       => env('STRIPE_SECRET_KEY'),
            'webhook_secret'   => env('STRIPE_WEBHOOK_SECRET'),
            'currency'         => env('PAYMENT_CURRENCY', 'usd'),
        ],
        'paypal' => [
            'client_id'        => env('PAYPAL_CLIENT_ID'),
            'client_secret'    => env('PAYPAL_CLIENT_SECRET'),
            'webhook_id'       => env('PAYPAL_WEBHOOK_ID'),
            'mode'             => env('PAYPAL_MODE', 'sandbox'), // 'sandbox' | 'live'
        ],
    ],
];
```

```bash
# .env — never commit real values
PAYMENT_GATEWAY=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMENT_CURRENCY=usd
```

### The Interface and Value Objects

```php
// app/Contracts/PaymentGatewayInterface.php
interface PaymentGatewayInterface
{
    public function createPayment(PaymentRequest $request): PaymentResult;
    public function capturePayment(string $gatewayPaymentId): PaymentResult;
    public function refund(string $gatewayPaymentId, int $amountCents): RefundResult;
    public function constructWebhookEvent(string $payload, string $signature): WebhookEvent;
}

// app/DTOs/PaymentRequest.php
final class PaymentRequest
{
    public function __construct(
        public readonly int    $amountCents,
        public readonly string $currency,
        public readonly string $paymentMethodId,
        public readonly string $idempotencyKey,
        public readonly string $returnUrl,
        public readonly array  $metadata = [],
    ) {}
}

// app/DTOs/PaymentResult.php
final class PaymentResult
{
    private function __construct(
        public readonly bool   $success,
        public readonly string $status,
        public readonly ?string $gatewayPaymentId,
        public readonly ?string $failureReason,
        public readonly array   $rawResponse,
    ) {}

    public static function success(string $gatewayPaymentId, string $status, array $raw): self
    {
        return new self(true, $status, $gatewayPaymentId, null, $raw);
    }

    public static function failure(string $reason, array $raw = []): self
    {
        return new self(false, 'failed', null, $reason, $raw);
    }
}

// app/DTOs/RefundResult.php
final class RefundResult
{
    public function __construct(
        public readonly bool   $success,
        public readonly string $refundId,
        public readonly ?string $failureReason,
    ) {}
}

// app/DTOs/WebhookEvent.php
final class WebhookEvent
{
    public function __construct(
        public readonly string $type,
        public readonly string $gatewayEventId,
        public readonly array  $data,
    ) {}
}
```

### Stripe Gateway Implementation

```php
// app/Gateways/StripePaymentGateway.php
class StripePaymentGateway implements PaymentGatewayInterface
{
    private StripeClient $client;

    public function __construct(
        private readonly LoggerInterface $logger,
    ) {
        $this->client = new StripeClient(config('payment.gateways.stripe.secret_key'));
    }

    public function createPayment(PaymentRequest $request): PaymentResult
    {
        try {
            $intent = $this->client->paymentIntents->create(
                [
                    'amount'         => $request->amountCents,
                    'currency'       => strtolower($request->currency),
                    'payment_method' => $request->paymentMethodId,
                    'confirm'        => true,
                    'return_url'     => $request->returnUrl,
                    'metadata'       => $request->metadata,
                ],
                ['idempotency_key' => $request->idempotencyKey]
            );

            return PaymentResult::success(
                $intent->id,
                $intent->status,
                $intent->toArray()
            );
        } catch (CardException $e) {
            $this->logger->notice('Card declined', ['code' => $e->getStripeCode()]);
            return PaymentResult::failure($e->getMessage(), $e->getJsonBody() ?? []);
        } catch (ApiErrorException $e) {
            $this->logger->error('Stripe API error', ['error' => $e->getMessage()]);
            return PaymentResult::failure('Gateway error. Please try again.');
        }
    }

    public function capturePayment(string $gatewayPaymentId): PaymentResult
    {
        try {
            $intent = $this->client->paymentIntents->capture($gatewayPaymentId);
            return PaymentResult::success($intent->id, $intent->status, $intent->toArray());
        } catch (ApiErrorException $e) {
            $this->logger->error('Stripe capture failed', ['intent_id' => $gatewayPaymentId]);
            return PaymentResult::failure($e->getMessage());
        }
    }

    public function refund(string $gatewayPaymentId, int $amountCents): RefundResult
    {
        try {
            $refund = $this->client->refunds->create([
                'payment_intent' => $gatewayPaymentId,
                'amount'         => $amountCents,
            ]);

            return new RefundResult(true, $refund->id, null);
        } catch (ApiErrorException $e) {
            $this->logger->error('Stripe refund failed', [
                'payment_intent' => $gatewayPaymentId,
                'error'          => $e->getMessage(),
            ]);
            return new RefundResult(false, '', $e->getMessage());
        }
    }

    public function constructWebhookEvent(string $payload, string $signature): WebhookEvent
    {
        $event = Webhook::constructEvent(
            $payload,
            $signature,
            config('payment.gateways.stripe.webhook_secret')
        );

        return new WebhookEvent(
            type:           $event->type,
            gatewayEventId: $event->id,
            data:           $event->data->toArray(),
        );
    }
}
```

### Payment Service

```php
// app/Services/PaymentService.php
class PaymentService
{
    public function __construct(
        private readonly PaymentGatewayInterface $gateway,
        private readonly PaymentRepository       $payments,
        private readonly LoggerInterface          $logger,
    ) {}

    public function initiatePayment(Order $order, string $paymentMethodId): Payment
    {
        $idempotencyKey = $this->buildIdempotencyKey($order);

        // Check for an existing payment with this key — prevents duplicates
        $existing = $this->payments->findByIdempotencyKey(
            config('payment.default_gateway'),
            $idempotencyKey
        );

        if ($existing !== null && $existing->status === 'succeeded') {
            return $existing;
        }

        $payment = $this->payments->create([
            'order_id'        => $order->id,
            'gateway'         => config('payment.default_gateway'),
            'amount_cents'    => $order->total_cents,
            'currency'        => $order->currency,
            'status'          => 'pending',
            'idempotency_key' => $idempotencyKey,
        ]);

        $result = $this->gateway->createPayment(new PaymentRequest(
            amountCents:     $order->total_cents,
            currency:        $order->currency,
            paymentMethodId: $paymentMethodId,
            idempotencyKey:  $idempotencyKey,
            returnUrl:       route('payments.return', ['order' => $order->id]),
            metadata:        ['order_id' => (string) $order->id],
        ));

        $this->payments->update($payment, [
            'gateway_payment_id' => $result->gatewayPaymentId,
            'status'             => $result->status,
            'gateway_response'   => $result->rawResponse,
            'failure_reason'     => $result->failureReason,
        ]);

        $this->logger->info('Payment initiated', [
            'order_id'    => $order->id,
            'payment_id'  => $payment->id,
            'gateway'     => config('payment.default_gateway'),
            'success'     => $result->success,
        ]);

        return $payment->refresh();
    }

    public function refundPayment(Payment $payment, int $amountCents): RefundResult
    {
        if ($payment->status !== 'succeeded') {
            throw new \DomainException("Cannot refund a payment in status: {$payment->status}");
        }

        if ($amountCents > $payment->amount_cents) {
            throw new \DomainException('Refund amount exceeds original payment amount');
        }

        $result = $this->gateway->refund($payment->gateway_payment_id, $amountCents);

        if ($result->success) {
            $this->payments->update($payment, [
                'status' => $amountCents === $payment->amount_cents ? 'refunded' : 'partially_refunded',
            ]);
        }

        return $result;
    }

    private function buildIdempotencyKey(Order $order): string
    {
        return hash('sha256', implode('|', [
            'order',
            $order->id,
            $order->total_cents,
            $order->currency,
            $order->created_at->timestamp,
        ]));
    }
}
```

### Controller

```php
// app/Http/Controllers/PaymentController.php
class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentService $paymentService,
    ) {}

    public function store(PaymentRequest $request, Order $order): JsonResponse
    {
        $this->authorize('pay', $order);

        try {
            $payment = $this->paymentService->initiatePayment(
                $order,
                $request->validated('payment_method_id')
            );

            return response()->json([
                'payment_id' => $payment->id,
                'status'     => $payment->status,
                'client_secret' => $payment->gateway_response['client_secret'] ?? null,
            ]);
        } catch (\DomainException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function refund(RefundRequest $request, Payment $payment): JsonResponse
    {
        $this->authorize('refund', $payment);

        $result = $this->paymentService->refundPayment(
            $payment,
            $request->validated('amount_cents')
        );

        if (!$result->success) {
            return response()->json(['error' => $result->failureReason], 422);
        }

        return response()->json(['refund_id' => $result->refundId]);
    }
}
```

### Service Container Binding

```php
// app/Providers/PaymentServiceProvider.php
class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentGatewayInterface::class, function (Application $app): PaymentGatewayInterface {
            return match(config('payment.default_gateway')) {
                'stripe' => $app->make(StripePaymentGateway::class),
                'paypal' => $app->make(PayPalPaymentGateway::class),
                default  => throw new \InvalidArgumentException(
                    'Unsupported payment gateway: ' . config('payment.default_gateway')
                ),
            };
        });
    }
}
```

---

## Webhooks

This is the most common source of production payment bugs.

When your customer completes payment and is redirected back to your site, you receive a URL parameter and maybe a short API response telling you the payment succeeded. **Do not trust this alone.** Networks fail. Browsers close. Redirects get intercepted. The redirect is a convenience for the user experience — not a payment confirmation.

Webhooks are the payment gateway's way of telling your server what actually happened, independently of the customer's browser. They arrive asynchronously, are retried on failure, and are the authoritative record.

```
Gateway
  └─▶ POST /webhooks/payment  (your endpoint)
        └─▶ Verify signature
              └─▶ Identify event type
                    ├─▶ payment_intent.succeeded  → mark payment succeeded, fulfill order
                    ├─▶ payment_intent.failed     → mark payment failed
                    ├─▶ charge.refunded           → update refund record
                    └─▶ charge.dispute.created    → alert + freeze order
```

### Webhook Controller

```php
// app/Http/Controllers/WebhookController.php
class WebhookController extends Controller
{
    public function __construct(
        private readonly PaymentGatewayInterface $gateway,
        private readonly WebhookProcessor        $processor,
        private readonly LoggerInterface          $logger,
    ) {}

    public function handle(Request $request): Response
    {
        $signature = $request->header('Stripe-Signature', '');
        $payload   = $request->getContent();

        try {
            $event = $this->gateway->constructWebhookEvent($payload, $signature);
        } catch (\UnexpectedValueException $e) {
            $this->logger->warning('Webhook payload invalid', ['error' => $e->getMessage()]);
            return response('Invalid payload', 400);
        } catch (\SignatureVerificationException $e) {
            $this->logger->warning('Webhook signature mismatch', ['error' => $e->getMessage()]);
            return response('Invalid signature', 400);
        }

        // Return 200 immediately — processing happens in a job
        // This prevents the gateway from timing out and retrying
        ProcessWebhookJob::dispatch($event)->onQueue('webhooks');

        return response('', 200);
    }
}
```

### Webhook Processor

```php
// app/Jobs/ProcessWebhookJob.php
class ProcessWebhookJob implements ShouldQueue
{
    use Dispatchable, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        private readonly WebhookEvent $event,
    ) {}

    public function handle(
        PaymentRepository          $payments,
        OrderRepository            $orders,
        PaymentTransactionRepository $transactions,
        LoggerInterface             $logger,
    ): void {
        // Deduplicate — gateway may send the same event multiple times
        if ($transactions->eventAlreadyProcessed($this->event->gatewayEventId)) {
            return;
        }

        DB::transaction(function () use ($payments, $orders, $transactions, $logger) {
            $transactions->record([
                'gateway_event_id' => $this->event->gatewayEventId,
                'event_type'       => $this->event->type,
                'status'           => 'processing',
                'raw_payload'      => $this->event->data,
                'processed_at'     => now(),
            ]);

            match ($this->event->type) {
                'payment_intent.succeeded' => $this->handlePaymentSucceeded($payments, $orders),
                'payment_intent.failed'    => $this->handlePaymentFailed($payments),
                'charge.refunded'          => $this->handleRefunded($payments),
                default                    => null, // Acknowledge but ignore unhandled event types
            };
        });
    }

    private function handlePaymentSucceeded(
        PaymentRepository $payments,
        OrderRepository   $orders,
    ): void {
        $gatewayPaymentId = $this->event->data['object']['id'] ?? null;

        if ($gatewayPaymentId === null) {
            return;
        }

        $payment = $payments->findByGatewayPaymentId($gatewayPaymentId);

        if ($payment === null) {
            return;
        }

        if ($payment->status === 'succeeded') {
            return; // Idempotent — already handled
        }

        $payments->update($payment, ['status' => 'succeeded']);

        $order = $orders->find($payment->order_id);
        $orders->update($order, ['status' => 'paid']);

        FulfillOrderJob::dispatch($order);
    }

    private function handlePaymentFailed(PaymentRepository $payments): void
    {
        $gatewayPaymentId = $this->event->data['object']['id'] ?? null;
        $failureReason    = $this->event->data['object']['last_payment_error']['message'] ?? 'Unknown failure';

        if ($gatewayPaymentId === null) {
            return;
        }

        $payment = $payments->findByGatewayPaymentId($gatewayPaymentId);

        if ($payment !== null) {
            $payments->update($payment, [
                'status'         => 'failed',
                'failure_reason' => $failureReason,
            ]);
        }
    }

    private function handleRefunded(PaymentRepository $payments): void
    {
        // Similar pattern — find the payment, update status
    }
}
```

Two important details here:

**Return 200 immediately.** If your webhook endpoint takes longer than ~30 seconds or returns a non-200 status, the gateway will retry. Handle processing asynchronously in a queued job.

**Deduplicate on `gateway_event_id`.** Gateways retry webhooks on failure. Your `payment_transactions` table has a unique index on `gateway_event_id` — use it to skip events you have already processed.

### Protecting Webhook Endpoints from CSRF

Webhook routes receive requests from the gateway, not from a browser. They must be excluded from CSRF protection:

```php
// app/Http/Middleware/VerifyCsrfToken.php
protected $except = [
    'webhooks/*',
];
```

---

## Security

### What to Never Do

- **Never store raw card numbers.** PCI DSS compliance for systems that store card data is complex and expensive. Use tokenization (Stripe Elements, Braintree Hosted Fields) so card numbers never touch your server.
- **Never store CVV.** At all. Not even briefly. It is a PCI DSS violation regardless of how it is stored.
- **Never log sensitive payment data.** Logs should contain transaction IDs, amounts, statuses — not card numbers, payment method details, or API keys.
- **Never trust the frontend for payment confirmation.** JavaScript can be manipulated. Always confirm payment status server-side via webhook or an API call to the gateway.

### What You Must Do

**Verify webhook signatures.** Gateways sign their webhook payloads with a secret. Verify the signature before processing any event. Without this, an attacker can send fake payment success events to your endpoint.

**Validate amounts server-side.** Never trust the amount sent from the frontend. Calculate the total from your database and charge that amount. A customer should not be able to alter the price by modifying a form field.

**Use idempotency keys.** On every payment creation request, send an idempotency key. If the request is retried (network failure, timeout), the gateway returns the original result rather than creating a duplicate charge.

**Use HTTPS everywhere.** This should be obvious, but TLS certificates should cover every endpoint — payment forms, API callbacks, and webhook receivers.

**Protect your API secrets.** Store gateway credentials in environment variables. Never commit them to version control. Rotate them immediately if they are exposed.

---

## Failure Scenarios

These are the situations that expose weak payment integrations. Plan for all of them.

### Payment Declined

The most common failure. The gateway returns an error code (`card_declined`, `insufficient_funds`, etc.). Your application should:
- Record the failed payment attempt
- Return a user-friendly error (not the raw gateway message)
- Allow the customer to try a different payment method

### Gateway Timeout

Your request to the gateway times out. You do not know whether the payment was created on the gateway's side. This is why idempotency keys matter — retry the request with the same key. If the gateway received the original, it returns the same result without charging twice.

### Customer Closes the Browser

Payment may have been processed. The redirect back to your site never fires. Without a webhook, your order is stuck in `pending` forever. Solution: rely on webhooks to confirm payment, not the redirect.

### Webhook Arrives Before Redirect

Webhooks can arrive before the customer is redirected back to your site. Your order may already be `paid` by the time your redirect handler runs. Your redirect handler must handle this gracefully — do not error out if the order is already fulfilled.

### Webhook Arrives Multiple Times

Gateways retry webhooks when your endpoint returns a non-200 status or times out. Your processing logic must be idempotent. The unique index on `gateway_event_id` in `payment_transactions` handles this at the database level.

### Refund Failure

Refunds can fail if the gateway account has insufficient funds, the charge is too old, or the card has been closed. Always check the refund result. Never assume a refund request succeeds. Store the result and build an admin tool for manual reconciliation.

### Duplicate Payment

A user double-clicks "Pay". Two requests hit your backend simultaneously. Idempotency keys and the unique index on `(gateway, idempotency_key)` in your `payments` table prevent duplicate charges. Use database transactions when checking for and creating payments.

---

## Complete Payment Flow Summary

```
1. Customer initiates checkout
      │
2. Backend creates order (status: pending)
      │
3. Backend calls gateway to create payment intent
      │
4. Gateway returns client secret / redirect URL
      │
5. Frontend confirms payment (Stripe.js / redirect)
      │
      ├─▶ 3D Secure authentication (if required)
      │
6. Gateway processes payment with issuing bank
      │
      ├─▶ Authorization approved
      │         │
      │   7. Gateway fires webhook: payment_intent.succeeded
      │         │
      │   8. Your webhook endpoint receives and acknowledges (200)
      │         │
      │   9. Queued job: verify signature, deduplicate, update payment + order
      │         │
      │   10. FulfillOrderJob dispatched
      │
      └─▶ Authorization declined
                │
          7b. Gateway fires webhook: payment_intent.failed
                │
          8b. Payment marked failed, customer notified
```

---

## Production Considerations

### Money Representation

Always store amounts as integers in the smallest currency unit (cents for USD/EUR, pence for GBP). Format for display only at the view layer. Use a dedicated money library (`moneyphp/money`) for currency arithmetic to avoid floating-point rounding errors.

### Idempotency

Generate idempotency keys that are deterministic per logical operation. A good key for an order payment might be `sha256("order:{$order->id}:attempt:{$attemptNumber}")`. If the customer retries after a failure, increment the attempt number so a new charge is created rather than returning the result of the failed one.

### Database Transactions

Wrap payment status updates in database transactions. The `payments` table and `orders` table are often updated together — if one update fails, neither should commit.

```php
DB::transaction(function () use ($payment, $order) {
    $this->payments->update($payment, ['status' => 'succeeded']);
    $this->orders->update($order, ['status' => 'paid']);
});
```

### Reconciliation

Gateway statements and your database will occasionally diverge — network issues, undelivered webhooks, manual refunds via the gateway dashboard. Build a reconciliation process that periodically fetches transactions from the gateway and compares them to your records. Flag discrepancies for manual review.

### Logging

Log the following at minimum:
- Every payment creation attempt (with amount, currency, gateway)
- Every webhook event received (with event type and gateway event ID)
- Every status transition (with the before and after states)
- Every failure (with the reason, but never sensitive card data)

---

## Common Developer Mistakes

**Trusting the frontend for payment confirmation.** The redirect URL carrying `payment_intent=succeeded` can be faked. Always confirm server-side.

**Not verifying webhook signatures.** Without signature verification, anyone can POST to your webhook endpoint and mark any order as paid.

**No idempotency.** A network timeout causes a retry, which causes a duplicate charge. The customer is charged twice. Idempotency keys on every charge request prevent this.

**Treating every API response as final.** A `payment_intent.requires_action` response means the customer needs to complete 3DS authentication. The payment is not done. Handle the full lifecycle.

**Updating order status without confirming payment status.** An `order.status = paid` update should only happen after a verified webhook or a gateway API call confirms the payment has succeeded.

**Mixing gateway code with business logic.** If your order fulfillment logic knows which gateway was used, you have a coupling problem. The order service should call `PaymentGatewayInterface` — not `StripePaymentGateway`.

**Hardcoding API keys.** They end up in version control, log files, and error reports. Environment variables only.

**Storing payment data you do not need.** Every piece of card data you store is a liability. Tokenization exists specifically so you do not have to.

---

## Conclusion

Payment integrations are not just API integrations. They are systems that handle real money, operate across asynchronous, distributed infrastructure, and fail in subtle and expensive ways.

The architecture in this article — an interface-backed gateway layer, idempotent payment creation, webhook-driven status updates, and append-only transaction records — is not over-engineering. It is the minimum responsible design for a system that will be maintained, debugged, and extended over time.

The key lessons:

- **Webhooks are your source of truth**, not redirects.
- **Verify every webhook signature** before acting on it.
- **Store money as integers**, never floats.
- **Idempotency keys on every charge** prevent the most expensive class of payment bugs.
- **Never trust the frontend** for payment confirmation.
- **Separate gateway code from business logic** so that adding a new provider is a config change, not a rewrite.

For production integrations, always consult the official documentation of your chosen payment provider. This article establishes the patterns and principles — the provider's documentation covers the specific API contracts, error codes, and compliance requirements that apply to your integration.
