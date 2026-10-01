---
title: "Essential Pull Request Review Practices for Software Engineers"
category: Engineering
excerpt: >-
  A pull request review is the last cheap place to catch a bug. A 12-minute
  guide to reviewing and authoring PRs well, with real-world failures,
  diagrams, and code you can learn from.
---

"LGTM 👍" has shipped more bugs than most compilers ever caught.

A pull request (PR) is the last cheap checkpoint before your code meets real users. Review it well and you catch bugs, share knowledge, and keep the codebase healthy. Review it badly and you get a rubber stamp that gives everyone false confidence.

This short guide covers how to **write** a reviewable PR, how to **review** one, and what happens when teams get it wrong. Reading time: about 12 minutes.

---

## The big picture

<figure>
<svg viewBox="0 0 680 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pull request lifecycle: author prepares a small PR, automation checks it, a reviewer reads it, feedback loops back, then merge">
  <style>
    .t{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .c{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
  </style>
  <rect x="1" y="20" width="118" height="80" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="14" y="48">1. Author</text>
  <text class="d" x="14" y="68">Small PR, clear</text>
  <text class="d" x="14" y="84">notes, self-review</text>

  <rect x="141" y="20" width="118" height="80" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="154" y="48">2. Automation</text>
  <text class="d" x="154" y="68">Lint, tests, static</text>
  <text class="d" x="154" y="84">analysis, audit</text>

  <rect x="281" y="20" width="118" height="80" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="294" y="48">3. Reviewer</text>
  <text class="d" x="294" y="68">Design, logic,</text>
  <text class="d" x="294" y="84">security, tests</text>

  <rect x="421" y="20" width="118" height="80" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="434" y="48">4. Feedback</text>
  <text class="d" x="434" y="68">Kind, specific,</text>
  <text class="d" x="434" y="84">actionable</text>

  <rect x="561" y="20" width="118" height="80" rx="10" fill="#ecfeff" stroke="#a5f3fc"/>
  <text class="t" x="574" y="48">5. Merge</text>
  <text class="d" x="574" y="68">Approved, green,</text>
  <text class="d" x="574" y="84">safe to roll back</text>

  <path d="M120 60 H140 M260 60 H280 M400 60 H420 M540 60 H560" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <polygon points="140,60 132,55 132,65" fill="#94a3b8"/>
  <polygon points="280,60 272,55 272,65" fill="#94a3b8"/>
  <polygon points="420,60 412,55 412,65" fill="#94a3b8"/>
  <polygon points="560,60 552,55 552,65" fill="#94a3b8"/>

  <path d="M480 100 V140 H60 V104" stroke="#94a3b8" stroke-width="1.5" fill="none" stroke-dasharray="5 4"/>
  <polygon points="60,102 55,112 65,112" fill="#94a3b8"/>
  <text class="c" x="270" y="160" text-anchor="middle">Changes requested: loop back to the author</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Machines check the mechanical rules so humans can spend their attention on design and correctness.</figcaption>
</figure>

---

## 1. Authors: make your PR easy to review

A review is only as good as the PR in front of the reviewer. Most of the work happens **before** you click "Create".

### Keep it small

Research on review effectiveness (SmartBear/Cisco's well-known study) found that reviewers' defect-finding drops sharply beyond roughly 200 to 400 lines. Past that, people skim. A 2,000-line PR doesn't get a thorough review; it gets "looks fine".

<figure>
<svg viewBox="0 0 680 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chart showing review quality falling as pull request size grows">
  <style>
    .a{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .l{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;}
  </style>
  <line x1="50" y1="20" x2="50" y2="180" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="50" y1="180" x2="660" y2="180" stroke="#cbd5e1" stroke-width="1.5"/>
  <text class="a" x="14" y="100" transform="rotate(-90 14 100)" text-anchor="middle">Bugs caught per reviewer</text>
  <text class="a" x="355" y="214" text-anchor="middle">Lines changed in the PR</text>
  <text class="a" x="50" y="198" text-anchor="middle">0</text>
  <text class="a" x="200" y="198" text-anchor="middle">200</text>
  <text class="a" x="350" y="198" text-anchor="middle">400</text>
  <text class="a" x="500" y="198" text-anchor="middle">800</text>
  <text class="a" x="650" y="198" text-anchor="middle">2000</text>

  <rect x="50" y="20" width="300" height="160" fill="#16a34a" opacity="0.08"/>
  <path d="M50 40 C150 36 250 44 350 70 C450 110 550 150 650 172" fill="none" stroke="#dc2626" stroke-width="3"/>
  <text class="l" x="60" y="34" fill="#16a34a">Sweet spot: focused review</text>
  <text class="l" x="640" y="124" text-anchor="end" fill="#dc2626">Skimming: "LGTM"</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Illustrative curve. The exact numbers vary, but the shape is consistent: attention falls as size grows.</figcaption>
</figure>

Practical ways to stay small:

- **One PR, one purpose.** A bug fix and a refactor are two PRs.
- **Split by layer** (migration, backend, UI) or use stacked PRs.
- **Hide unfinished work behind a feature flag** instead of waiting to merge a giant branch.

### Write a description that earns trust

Reviewers shouldn't have to reverse-engineer your intent. A simple template works:

```markdown
## What
Add rate limiting to the password-reset endpoint.

## Why
Ticket SEC-142: the endpoint can be used to spam users with reset emails.

## How
Throttle middleware: 5 requests/min per IP + per email. Returns 429.

## Testing
- Added feature tests for the 429 path
- Manually tried 6 requests in a row locally

## Risk / rollback
Low. Revert the route middleware line; no migrations.
```

### Review your own PR first

Open the diff and read it as if a stranger wrote it. You will find leftover `dd()` calls, commented-out code, and the TODO you forgot, **before** anyone else has to point them out.

---

## 2. Reviewers: what to look for

Don't start with spacing and variable names. Review in **priority order**, highest impact first.

<figure>
<svg viewBox="0 0 680 270" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Review priority pyramid from design and correctness at the top down to style, which should be automated">
  <style>
    .t{font:700 13.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
    .s{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <polygon points="340,10 410,60 270,60" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="340" y="48" text-anchor="middle">Design</text>
  <polygon points="262,66 418,66 488,116 192,116" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="340" y="97" text-anchor="middle">Correctness &amp; security</text>
  <polygon points="184,122 496,122 566,172 114,172" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="340" y="153" text-anchor="middle">Tests &amp; error handling</text>
  <polygon points="106,178 574,178 644,228 36,228" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="340" y="209" text-anchor="middle">Readability &amp; naming</text>

  <text class="s" x="660" y="40" text-anchor="end">Human judgment</text>
  <text class="s" x="660" y="258" text-anchor="end">Automate style: formatter &amp; linter</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Spend your attention at the top. If a tool can enforce it, a human shouldn't be commenting on it.</figcaption>
</figure>

### The reviewer's checklist

1. **Design.** Does this approach fit the system? Is there a simpler way?
2. **Correctness.** Edge cases, null values, off-by-one, concurrency, time zones.
3. **Security.** Is input validated? Are queries parameterized? Is access controlled?
4. **Tests.** Do they cover failure paths, not just the happy path?
5. **Error handling & observability.** Will we know when this breaks at 3 a.m.?
6. **Performance.** Any query inside a loop? Any unbounded data?
7. **Readability.** Could a new teammate follow this?

---

## Real-world failure #1: Apple's "goto fail" (2014)

Apple's TLS code, used to verify secure connections on iOS and macOS, contained this:

```c
if ((err = SSLHashSHA1.update(&hashCtx, &signedParams)) != 0)
    goto fail;
    goto fail;   // <- duplicated line, always executes
if ((err = SSLHashSHA1.final(&hashCtx, &hashOut)) != 0)
    goto fail;
```

The second `goto fail;` has no braces around it, so it runs **unconditionally**. The signature check after it was skipped, and attackers on the same network could impersonate secure servers. The diff was a single duplicated line, which is exactly the kind of thing that blends into a busy diff.

What would have caught it:

- A **required-braces style rule** enforced by a linter (automation, not human eyes).
- **Compiler warnings for unreachable code** treated as errors in CI.
- A reviewer asking, "Where is the test that a bad signature is rejected?"

The same trap exists in PHP:

```php
// Looks like both lines belong to the if. They don't.
if ($user->isBanned())
    Log::warning('Banned user attempted login');
    return $this->deny();     // always runs, even for valid users
```

```php
// Always use braces
if ($user->isBanned()) {
    Log::warning('Banned user attempted login');

    return $this->deny();
}
```

---

## Real-world failure #2: Cloudflare's regex outage (2019)

In July 2019 Cloudflare deployed a new Web Application Firewall rule containing a regular expression that could **backtrack catastrophically**. It consumed CPU on their edge servers worldwide, and a large share of the internet's traffic returned errors for about 27 minutes. The rule passed review and tests but was rolled out globally at once.

You can see the same class of bug in miniature:

```php
// Nested quantifiers: the engine can try an exponential number of paths
preg_match('/^(a+)+$/', $input);

// With input "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!" this can hang a request
```

What a good review asks:

- "What happens with **hostile or huge input**?"
- "Is there a **timeout or limit**?"
- "Can we **roll this out gradually** (canary, feature flag) and roll it back fast?"

---

## Real-world failure #3: The 30-second approval (a pattern, not one incident)

This one happens at nearly every company. A teammate opens a 900-line PR late on Friday. Three reviewers glance at it. Two approve within a minute because the other already did. Everyone assumes someone else looked closely. This is the **diffusion of responsibility**.

The code that slips through is usually something like this missing authorization check:

```php
// Looks fine and passes the happy-path test
public function show(Invoice $invoice)
{
    return new InvoiceResource($invoice);
}
```

Any logged-in user can read **any** invoice by changing the ID in the URL. This is a classic IDOR (Insecure Direct Object Reference). A reviewer who asks "who is allowed to call this?" finds it in five seconds:

```php
public function show(Invoice $invoice)
{
    $this->authorize('view', $invoice);   // InvoicePolicy checks ownership

    return new InvoiceResource($invoice);
}
```

And the test that locks it in:

```php
public function test_user_cannot_view_another_users_invoice(): void
{
    $invoice = Invoice::factory()->create();          // belongs to someone else
    $this->actingAs(User::factory()->create())
         ->getJson("/api/invoices/{$invoice->id}")
         ->assertForbidden();
}
```

**Fix the process, not just the bug:** assign a **named** primary reviewer, and cap PR size so a real review is possible.

---

## 3. More code smells reviewers should catch

### The N+1 query

```php
// 1 query for orders + 1 query per order for the customer
$orders = Order::all();
foreach ($orders as $order) {
    echo $order->customer->name;
}

// 2 queries total
$orders = Order::with('customer')->get();
```

Read more in my post on [Eloquent lazy vs eager loading and N+1](/blog/laravel-eloquent-orm-lazy-loading-eager-loading-n-plus-one/).

### The migration that locks production

```php
// Risky on a huge table: adds a column with a default and may lock writes
Schema::table('orders', function (Blueprint $table) {
    $table->string('status')->default('pending');
});
```

A reviewer should ask: how big is `orders`, which database version is running, and does this need to be done in steps (add nullable column, backfill in batches, then add the constraint)?

### The silent catch

```php
try {
    $gateway->charge($order);
} catch (Exception $e) {
    // ignore
}
```

If the charge fails, the user thinks they paid. Ask: "What happens when this throws?" See [Idempotency in Payment Systems](/blog/idempotency-in-payment-systems/) for why this matters with money.

---

## 4. How to give feedback that people welcome

Code review is a conversation between humans. Tone decides whether people learn or get defensive.

| Instead of | Try |
| --- | --- |
| "This is wrong." | "I think this can return null on line 42. Could we handle that case?" |
| "Why didn't you use a collection?" | "Would `collect()->groupBy()` be simpler here? Happy to be wrong." |
| "Fix naming." | "`$d` is hard to follow. What about `$discountPercent`?" |
| "LGTM" (no reading) | "Reviewed the auth flow and tests. One question on the retry logic." |

Helpful habits:

- **Review the code, not the person.** Say "this function", not "you".
- **Explain the why.** Link to docs or an example.
- **Label your comments** so the author knows what's required:
  - `blocker:` must fix before merge
  - `suggestion:` improvement, your call
  - `nit:` tiny style preference, ignore if you like
  - `question:` I want to understand, not necessarily change
- **Praise good work.** "Nice test for the empty cart case" costs nothing.
- **Don't ping-pong.** If a thread goes past 2 or 3 rounds, hop on a quick call.

---

## 5. Receiving feedback well

- **Assume good intent.** The reviewer is helping you ship something safer.
- **Don't take it personally.** Comments are about the code.
- **Respond to every comment**, even with "Done" or a reason for disagreeing.
- **Disagree with data**, not feelings. If you and the reviewer can't agree, ask a third person or the tech lead.
- **Don't force-push over reviewed work** without saying so; it makes reviewers re-read everything.

---

## 6. Let automation do the boring part

If a human is leaving the same comment on every PR, that comment should be a CI check. A minimal GitHub Actions workflow:

```yaml
name: PR Checks
on: pull_request

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      - run: composer install --no-interaction --prefer-dist
      - run: vendor/bin/pint --test        # code style
      - run: vendor/bin/phpstan analyse    # static analysis
      - run: composer audit                # vulnerable dependencies
      - run: php artisan test              # automated tests
```

Then protect your main branch:

- Require **status checks to pass** before merging.
- Require **at least one approval** (two for risky areas).
- Use a **CODEOWNERS** file so the right people are asked automatically:

```text
# .github/CODEOWNERS
/app/Payments/     @team-payments
/database/         @team-platform
/.github/          @team-platform
```

---

## 7. AI-assisted code needs the same scrutiny

AI tools write PRs faster than humans can read them. That raises the bar for review, it doesn't lower it. Treat AI-generated code like a PR from a confident stranger: check that it **actually does what the description says**, that **tests assert real behavior** (not just that the code runs), and that no dependency or API was invented. More in [10 Things About AI Every Software Engineer Must Know](/blog/10-things-about-ai-every-software-engineer-must-know/).

---

## The PR review checklist

**Before you open a PR (author)**

1. Is it focused on one purpose and under ~400 lines?
2. Did I read my own diff and remove debug code?
3. Does the description explain what, why, how, testing, and rollback?
4. Do tests cover the failure paths?
5. Is CI green?

**While reviewing (reviewer)**

6. Do I understand the intent and the design?
7. Who is allowed to call this? What happens on bad input?
8. Are errors handled, logged safely, and visible?
9. Any query in a loop, unbounded data, or risky migration?
10. Is my feedback specific, kind, and labeled (blocker / suggestion / nit)?

---

## Key takeaways

- **Small PRs get real reviews.** Big PRs get "LGTM".
- **Review by priority:** design, correctness, security, tests, then style. Automate style.
- **Real disasters** (Apple's goto fail, Cloudflare's regex outage) hid in plain sight in ordinary-looking diffs.
- **Ask "what could go wrong?"** about input, permissions, load, and rollout.
- **Be kind and specific.** Label comments, praise good work, and review code, not people.
- **Own the outcome.** An approval means you're sharing responsibility for what ships.

A great review isn't about proving you're smarter than the author. It's about making sure the next production incident never gets written. Next time you open a PR, pick one habit from the checklist and try it.
