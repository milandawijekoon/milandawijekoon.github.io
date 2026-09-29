---
title: "Must-Know Code Quality Practices for Software Engineers"
category: Engineering
excerpt: >-
  Code quality is not about being fancy — it's about writing code that is
  readable, testable, secure, and cheap to change. A 12-minute guide with real
  failures, diagrams, and before/after code.
---

Every codebase starts clean. Then deadlines arrive, shortcuts pile up, and one day a "small change" takes a week. That slow decay has a name: **technical debt**. And sometimes the bill arrives all at once.

This short guide covers the practices that keep code **readable, maintainable, testable, scalable, and secure** — each with a real-world failure and a code-level fix. Reading time: about 12 minutes.

---

## The big picture

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Six pillars of code quality: readability, small units, testability, security, error handling, and automation">
  <style>
    .t{font:700 14px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="10" width="218" height="100" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="18" y="40">1. Readability</text>
  <text class="d" x="18" y="62">Names that explain intent</text>
  <text class="d" x="18" y="80">Code is read 10x more</text>
  <text class="d" x="18" y="98">than it is written</text>

  <rect x="231" y="10" width="218" height="100" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="248" y="40">2. Small, focused units</text>
  <text class="d" x="248" y="62">One job per function/class</text>
  <text class="d" x="248" y="80">Easy to change, easy to</text>
  <text class="d" x="248" y="98">scale</text>

  <rect x="461" y="10" width="218" height="100" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="478" y="40">3. Testability</text>
  <text class="d" x="478" y="62">Inject dependencies</text>
  <text class="d" x="478" y="80">Tests prove behaviour and</text>
  <text class="d" x="478" y="98">protect refactors</text>

  <rect x="1" y="130" width="218" height="100" rx="10" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="18" y="160">4. Security by default</text>
  <text class="d" x="18" y="182">Never trust input</text>
  <text class="d" x="18" y="200">Validate, escape, use</text>
  <text class="d" x="18" y="218">least privilege</text>

  <rect x="231" y="130" width="218" height="100" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="248" y="160">5. Honest error handling</text>
  <text class="d" x="248" y="182">Fail loudly, never silently</text>
  <text class="d" x="248" y="200">Log with context, not</text>
  <text class="d" x="248" y="218">secrets</text>

  <rect x="461" y="130" width="218" height="100" rx="10" fill="#ecfeff" stroke="#a5f3fc"/>
  <text class="t" x="478" y="160">6. Automation</text>
  <text class="d" x="478" y="182">Linters, CI, code review</text>
  <text class="d" x="478" y="200">Let machines catch what</text>
  <text class="d" x="478" y="218">humans forget</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Six habits cover most of what separates code that ages well from code that becomes a liability.</figcaption>
</figure>

---

## 1. Write code for humans first

The compiler doesn't care about your variable names. Your teammates — and you, six months from now — do.

```php
// Hard to read
function calc($a, $b, $c) {
    return $a - ($a * $b / 100) + $c;
}

// Self-explanatory
function finalPrice(float $price, float $discountPercent, float $shipping): float
{
    $discount = $price * $discountPercent / 100;

    return $price - $discount + $shipping;
}
```

Quick rules:

- Name things by **intent** (`$discountPercent`), not type or abbreviation (`$b`).
- Replace magic numbers with named constants.
- Comments should explain **why**, not **what**. If you need a comment to explain what a line does, rename something.

### Real-world failure: Mars Climate Orbiter (1999)

NASA lost a $125M spacecraft because one team's software produced thrust data in **pound-force seconds** while another team's code expected **newtons**. Both were plain numbers. Nothing in the code said which unit it was, so nothing caught the mismatch.

The code-level lesson: make meaning explicit.

```php
final class Newtons
{
    public function __construct(public readonly float $value) {}

    public static function fromPoundForce(float $lbf): self
    {
        return new self($lbf * 4.44822);
    }
}

function applyThrust(Newtons $thrust): void { /* ... */ }
```

Now passing raw pounds-force to `applyThrust()` is a type error, not a crash in space.

---

## 2. Keep units small and focused

A function or class should have **one reason to change** (the Single Responsibility Principle). Giant methods that validate, calculate, save, and email are impossible to test and terrifying to modify.

```php
// One method doing everything
public function checkout(Request $request)
{
    // validate... calculate totals... charge card...
    // save order... send email... update stock...
}

// Each step has one owner
public function checkout(CheckoutRequest $request): OrderResource
{
    $order = $this->orders->place($request->validated());
    $this->payments->charge($order);
    OrderPlaced::dispatch($order);

    return new OrderResource($order);
}
```

Now the email logic can change without touching payment code. If you want to go deeper, read my post on [SOLID Principles in PHP & Laravel](/blog/solid-principles-in-php-and-laravel/).

**Rule of thumb:** if you can't describe what a function does in one sentence without the word "and", split it.

---

## 3. Design for testability

Code that creates its own dependencies can't be tested in isolation.

```php
// Hard-wired: every test hits the real payment API
class InvoiceService
{
    public function pay(Invoice $invoice): void
    {
        $gateway = new StripeGateway(env('STRIPE_KEY'));
        $gateway->charge($invoice->total);
    }
}

// Dependency injected: tests pass in a fake
class InvoiceService
{
    public function __construct(private PaymentGateway $gateway) {}

    public function pay(Invoice $invoice): void
    {
        $this->gateway->charge($invoice->total);
    }
}

// Test
public function test_it_charges_the_invoice_total(): void
{
    $gateway = new FakeGateway();
    (new InvoiceService($gateway))->pay(new Invoice(total: 5000));

    $this->assertSame(5000, $gateway->lastCharge());
}
```

A good test suite is what lets you refactor without fear. Without it, every cleanup is a gamble, so nobody cleans anything, and debt grows.

### Real-world failure: Knight Capital (2012)

Knight Capital deployed new trading software to 7 of its 8 servers. The 8th kept old code, and a repurposed feature flag woke up a long-dead routine that fired off unintended orders. In about **45 minutes the firm lost roughly $440 million** and never recovered as an independent company.

What good practice would have helped:

- **Delete dead code** instead of leaving it dormant.
- **Never reuse a flag** for a different meaning.
- **Automate deployments** so all servers get the same build, and test the deployment itself.

---

## 4. Treat every input as hostile

Security is a code-quality issue, not a separate phase. Most breaches come from a few boring mistakes.

### SQL injection

```php
// Vulnerable: user input becomes SQL
$users = DB::select("SELECT * FROM users WHERE email = '$email'");
// email = ' OR '1'='1  -> returns every user

// Safe: parameters are data, never code
$users = DB::select('SELECT * FROM users WHERE email = ?', [$email]);
```

### Cross-site scripting (XSS)

```php
// Vulnerable
echo "<p>Hello, {$_GET['name']}</p>";

// Safe (Blade escapes by default with double braces)
{% raw %}// <p>Hello, {{ $name }}</p>{% endraw %}
echo '<p>Hello, ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</p>';
```

Deep dives: [SQL Injection](/blog/sql-injection-explained-and-how-to-prevent-it/) and [XSS](/blog/xss-attack-explained-and-how-to-prevent-it/).

### Validate at the boundary

```php
$data = $request->validate([
    'amount'   => ['required', 'integer', 'min:1', 'max:1000000'],
    'currency' => ['required', 'in:USD,EUR,LKR'],
]);
```

Reject bad data at the door and the rest of your code can trust what it receives.

### Real-world failure: Heartbleed (2014)

OpenSSL's heartbeat feature let a client say "echo back N bytes of this message". The code trusted N without checking it against the real message size, so attackers asked for 64 KB back and received **adjacent server memory: passwords, private keys, sessions**. One missing bounds check exposed a huge portion of the internet.

```php
// The Heartbleed pattern, in PHP terms
function echoBack(string $payload, int $claimedLength): string
{
    // Bug: trusts the caller's claimed length
    return substr($payload, 0, $claimedLength);
}

// Fix: never trust a length you didn't measure
function echoBack(string $payload, int $claimedLength): string
{
    if ($claimedLength !== strlen($payload)) {
        throw new InvalidArgumentException('Length mismatch');
    }

    return $payload;
}
```

### Real-world failure: Equifax (2017)

Attackers exploited a known flaw in Apache Struts for which a patch had been available for months. Roughly **147 million people's** data was exposed. The lesson: **outdated dependencies are code you are shipping**. Run `composer audit` (or `npm audit`) in CI and update on a schedule.

### Secrets never live in code

```php
// Never commit this
$apiKey = 'sk_live_51H8xample...';

// Read from environment, keep .env out of git
$apiKey = config('services.stripe.key');
```

---

## 5. Handle errors honestly

Swallowed exceptions are bugs that hide until they're expensive.

```php
// Silent failure: the payment failed, the user thinks it worked
try {
    $gateway->charge($order);
} catch (Exception $e) {
    // ignore
}

// Explicit: fail loudly, log with context, tell the caller
try {
    $gateway->charge($order);
} catch (PaymentDeclined $e) {
    Log::warning('Payment declined', ['order_id' => $order->id]);
    throw new CheckoutFailed('Your card was declined.', previous: $e);
}
```

Guidelines:

- Catch **specific** exceptions, not blanket `Exception`.
- Log the order ID, not the card number. Logs are not a safe place for secrets or personal data.
- Use **early returns** (guard clauses) to avoid deeply nested `if` pyramids.

```php
// Nested
if ($user) {
    if ($user->isActive()) {
        if ($user->can('export')) {
            return $this->export($user);
        }
    }
}

// Guard clauses
if (! $user?->isActive() || ! $user->can('export')) {
    abort(403);
}

return $this->export($user);
```

---

## 6. Automate quality with gates

Willpower doesn't scale; pipelines do. Every check you automate is one nobody has to remember.

<figure>
<svg viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Quality gates pipeline: editor linter, code review, automated tests, security scan, production, with cost of fixing a defect increasing left to right">
  <style>
    .t{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .c{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
  </style>
  <rect x="1" y="20" width="118" height="80" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="14" y="48">Editor</text>
  <text class="d" x="14" y="68">Linter, formatter</text>
  <text class="d" x="14" y="84">static analysis</text>

  <rect x="141" y="20" width="118" height="80" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="154" y="48">Code review</text>
  <text class="d" x="154" y="68">A second pair of</text>
  <text class="d" x="154" y="84">eyes on every PR</text>

  <rect x="281" y="20" width="118" height="80" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="294" y="48">CI tests</text>
  <text class="d" x="294" y="68">Unit + integration</text>
  <text class="d" x="294" y="84">on every push</text>

  <rect x="421" y="20" width="118" height="80" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="434" y="48">Security scan</text>
  <text class="d" x="434" y="68">Dependency audit,</text>
  <text class="d" x="434" y="84">secret detection</text>

  <rect x="561" y="20" width="118" height="80" rx="10" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="574" y="48">Production</text>
  <text class="d" x="574" y="68">Real users, real</text>
  <text class="d" x="574" y="84">money, real damage</text>

  <path d="M120 60 H140 M260 60 H280 M400 60 H420 M540 60 H560" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <polygon points="140,60 132,55 132,65" fill="#94a3b8"/>
  <polygon points="280,60 272,55 272,65" fill="#94a3b8"/>
  <polygon points="420,60 412,55 412,65" fill="#94a3b8"/>
  <polygon points="560,60 552,55 552,65" fill="#94a3b8"/>

  <defs>
    <linearGradient id="cost" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#86efac"/>
      <stop offset="0.5" stop-color="#fcd34d"/>
      <stop offset="1" stop-color="#f87171"/>
    </linearGradient>
  </defs>
  <rect x="1" y="135" width="678" height="10" rx="5" fill="url(#cost)"/>
  <text class="c" x="1" y="168">Cheap to fix</text>
  <text class="c" x="679" y="168" text-anchor="end">Expensive to fix</text>
  <text class="d" x="340" y="190" text-anchor="middle">The earlier a defect is caught, the less it costs</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Shift checks left. A typo caught by a linter costs seconds; the same bug in production can cost millions.</figcaption>
</figure>

A minimal GitHub Actions workflow for a Laravel project:

```yaml
name: CI
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      - run: composer install --no-interaction --prefer-dist
      - run: composer audit                 # vulnerable dependencies
      - run: vendor/bin/pint --test         # code style
      - run: vendor/bin/phpstan analyse     # static analysis
      - run: php artisan test               # automated tests
```

If any step fails, the merge is blocked. That's the point.

---

## Managing technical debt

Some debt is deliberate and fine: shipping an MVP fast is a business decision. The danger is **unmanaged** debt, where nobody knows it exists and interest compounds.

<figure>
<svg viewBox="0 0 680 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Line chart comparing feature delivery speed over time: teams that manage debt keep steady speed, teams that ignore it slow down">
  <style>
    .a{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .l{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;}
  </style>
  <line x1="50" y1="20" x2="50" y2="190" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="50" y1="190" x2="660" y2="190" stroke="#cbd5e1" stroke-width="1.5"/>
  <text class="a" x="14" y="110" transform="rotate(-90 14 110)" text-anchor="middle">Delivery speed</text>
  <text class="a" x="355" y="222" text-anchor="middle">Time</text>

  <path d="M50 70 C200 62 400 58 640 56" fill="none" stroke="#16a34a" stroke-width="3"/>
  <path d="M50 70 C180 70 300 100 400 140 C480 170 560 178 640 182" fill="none" stroke="#dc2626" stroke-width="3"/>

  <text class="l" x="640" y="46" text-anchor="end" fill="#16a34a">Debt managed: steady pace</text>
  <text class="l" x="430" y="172" text-anchor="end" fill="#dc2626">Debt ignored: every change slows down</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Quick shortcuts feel fast at first. Compounding interest is what eventually stalls the team.</figcaption>
</figure>

Practical habits:

- **Boy Scout rule:** leave the code slightly cleaner than you found it.
- **Track debt visibly** (a `tech-debt` label in your issue tracker) and reserve roughly 10-20% of each sprint for paying it down.
- **Refactor under test.** Add a test first, then change the structure, then confirm the test still passes.
- **Write ADRs** (short Architecture Decision Records) so future engineers know *why* a trade-off was made.

---

## The 10-point checklist

Before you open a pull request, ask yourself:

1. Would a new teammate understand the names without asking me?
2. Does each function/class do one thing?
3. Can I test it without a database, network, or clock?
4. Did I validate all external input and escape all output?
5. Are queries parameterized and secrets kept out of the repo?
6. Are errors handled specifically, logged safely, and never swallowed?
7. Is there dead code, a stale flag, or a commented-out block I can delete?
8. Do tests cover the happy path **and** the failure paths?
9. Are dependencies up to date and audited?
10. Did CI pass, and did someone else review it?

---

## Key takeaways

- **Readability** is the cheapest quality investment you can make.
- **Small, focused units** and **dependency injection** make code testable and scalable.
- **Security is a coding habit**: validate input, parameterize queries, escape output, patch dependencies.
- **Real disasters** (Mars Climate Orbiter, Knight Capital, Heartbleed, Equifax) came from ordinary mistakes: unclear units, dead code, a missing check, an unpatched library.
- **Automate** what you can and **manage debt** deliberately, before it manages you.

Quality isn't perfection. It's making the next change safe, cheap, and boring. Start with one item from the checklist in your next pull request and build from there.
