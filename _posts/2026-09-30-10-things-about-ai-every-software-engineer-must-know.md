---
title: "10 Things About AI Every Software Engineer Must Know"
category: Engineering
excerpt: >-
  AI can make you faster, or it can quietly fill your codebase with debt,
  vulnerabilities, and a surprise bill. A short, diagram-led guide to the ten
  fundamentals every engineer needs: how LLMs really work, how to keep
  AI-written code secure and testable, and how to spend tokens wisely. Real
  failures and code included. Readable in about 12 minutes.
---

AI coding tools are now part of the daily toolbox. Used well, they remove boilerplate and speed up learning. Used blindly, they produce code that *looks* right, compiles, passes a quick glance, and fails in production.

The engineers who win with AI are not the ones who prompt the most. They are the ones who understand what the tool actually is. This guide gives you ten fundamentals, each with a **real-world failure** and **code you can reuse**. Reading time: about 12 minutes.

---

## The big picture

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ten AI fundamentals grouped into three areas: understand, protect, and optimize">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .s{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
    .g{font:700 12px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:1px;}
  </style>
  <text class="g" x="2" y="18" fill="#2563eb">UNDERSTAND</text>
  <rect x="1" y="26" width="218" height="58" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="h" x="14" y="50">1. It predicts, not knows</text>
  <text class="s" x="14" y="68">Hallucinations are normal</text>
  <rect x="231" y="26" width="218" height="58" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="h" x="244" y="50">2. Tokens are the currency</text>
  <text class="s" x="244" y="68">Everything is metered</text>
  <rect x="461" y="26" width="218" height="58" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="h" x="474" y="50">3. Context is finite</text>
  <text class="s" x="474" y="68">More input is not better</text>
  <text class="g" x="2" y="110" fill="#dc2626">PROTECT</text>
  <rect x="1" y="118" width="164" height="58" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="14" y="142">4. AI code = untrusted</text>
  <text class="s" x="14" y="160">Review like a stranger's PR</text>
  <rect x="177" y="118" width="164" height="58" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="190" y="142">5. Guard your data</text>
  <text class="s" x="190" y="160">No secrets in prompts</text>
  <rect x="353" y="118" width="164" height="58" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="366" y="142">6. Prompt injection</text>
  <text class="s" x="366" y="160">Input is an attack surface</text>
  <rect x="529" y="118" width="150" height="58" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="542" y="142">7. Validate output</text>
  <text class="s" x="542" y="160">Schemas, not hope</text>
  <text class="g" x="2" y="202" fill="#16a34a">OPTIMIZE</text>
  <rect x="1" y="210" width="332" height="38" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="14" y="234">8. Specific prompts</text>
  <text class="s" x="140" y="234">Clear asks cost fewer retries</text>
  <rect x="347" y="210" width="166" height="38" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="360" y="234">9. Control cost</text>
  <rect x="527" y="210" width="152" height="38" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="540" y="234">10. You own it</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Three questions: Do I understand the tool? Is my system protected from it? Am I using it efficiently?</figcaption>
</figure>

---

## 1. An LLM predicts text. It does not "know" facts

A large language model (LLM) is trained to answer one question: *given these tokens, what token is most likely next?* It is brilliant at plausible text and has no built-in fact checker. When it lacks information, it doesn't say "I don't know". It produces the most plausible-sounding answer. That is a **hallucination**.

<figure>
<svg viewBox="0 0 680 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow from prompt to tokens to model to next-token probabilities to output">
  <style>
    .t{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .m{font:12px ui-monospace,Menlo,Consolas,monospace;fill:#0f172a;}
  </style>
  <defs><marker id="a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#94a3b8"/></marker></defs>
  <rect x="1" y="30" width="120" height="80" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="16" y="56">Your prompt</text>
  <text class="m" x="16" y="78">"Sum two ints"</text>
  <rect x="157" y="30" width="120" height="80" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="172" y="56">Tokens</text>
  <text class="m" x="172" y="78">[Sum][ two][ ints]</text>
  <rect x="313" y="30" width="120" height="80" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="328" y="56">Model</text>
  <text class="d" x="328" y="78">Billions of weights</text>
  <rect x="469" y="30" width="120" height="80" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="484" y="56">Next token?</text>
  <text class="m" x="484" y="76">"add" 61%</text>
  <text class="m" x="484" y="94">"plus" 22%</text>
  <path d="M121 70H153" stroke="#94a3b8" stroke-width="2" marker-end="url(#a1)"/>
  <path d="M277 70H309" stroke="#94a3b8" stroke-width="2" marker-end="url(#a1)"/>
  <path d="M433 70H465" stroke="#94a3b8" stroke-width="2" marker-end="url(#a1)"/>
  <path d="M529 110V136H60V118" stroke="#94a3b8" stroke-width="2" fill="none" stroke-dasharray="5 4"/>
  <text class="d" x="190" y="154">Pick one, append it, and repeat until the answer is complete</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The loop has no "is this true?" step. Truth has to come from you.</figcaption>
</figure>

### Real-world failure: Air Canada's chatbot (2024)

A customer asked Air Canada's website chatbot about bereavement fares. The bot invented a refund policy that didn't exist. The airline argued the chatbot was "a separate legal entity". A Canadian tribunal disagreed and ordered the airline to honour what its bot said. In a similar case in 2023, US lawyers were sanctioned for filing court briefs with case citations that ChatGPT had fabricated.

**Code-level lesson:** never treat model output as a fact source. Ground it with your own data, and verify anything that matters.

```php
// Risky: the model answers from "memory"
$answer = $llm->ask("What is our refund policy?");

// Safer: ground the answer in the real policy text
$policy = $policies->current('refunds');   // your source of truth

$answer = $llm->ask(
    "Answer ONLY from the policy below. If the answer is not there, reply 'NOT_FOUND'.\n\n" .
    "POLICY:\n{$policy->body}\n\nQUESTION: {$question}"
);

if ($answer === 'NOT_FOUND') {
    return $this->handOffToHuman($question);
}
```

---

## 2. Tokens are the currency of AI

Models don't read words. They read **tokens**: chunks of text, roughly 4 characters or three-quarters of a word in English. You pay for tokens **in** (your prompt) and tokens **out** (the answer), and output is usually priced higher. Code, JSON, and non-English text often use more tokens than you'd guess.

If you can't estimate a request's cost before sending it, you can't control it.

```php
final class TokenBudget
{
    // Rough rule of thumb for English text and code: ~4 characters per token.
    // Use your provider's token counter for exact numbers.
    public static function estimate(string $text): int
    {
        return (int) ceil(strlen($text) / 4);
    }

    // Prices change often and differ by model: load them from config, never hard-code.
    public static function cost(int $tokensIn, int $tokensOut, array $price): float
    {
        return ($tokensIn  / 1_000_000) * $price['input_per_million']
             + ($tokensOut / 1_000_000) * $price['output_per_million'];
    }
}
```

---

## 3. The context window is finite, and more is not better

The **context window** is everything the model can see at once: system instructions, chat history, pasted files, tool results, *and* the answer it is writing. When it fills up, old content is dropped or summarized. Even before then, a model buried in irrelevant text gets worse at finding what matters.

<figure>
<svg viewBox="0 0 680 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A context window bar split into system prompt, chat history, retrieved files, your question, and reserved space for the answer">
  <style>
    .t{font:700 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <text class="t" x="1" y="22">One context window = input + output share the same budget</text>
  <rect x="1" y="40" width="678" height="54" rx="10" fill="none" stroke="#94a3b8" stroke-width="2"/>
  <rect x="3" y="42" width="70" height="50" fill="#dbeafe"/>
  <rect x="73" y="42" width="230" height="50" fill="#fef3c7"/>
  <rect x="303" y="42" width="190" height="50" fill="#fee2e2"/>
  <rect x="493" y="42" width="60" height="50" fill="#dcfce7"/>
  <rect x="553" y="42" width="124" height="50" fill="#f3e8ff"/>
  <text class="t" x="10" y="72">System</text>
  <text class="t" x="82" y="72">Chat history (grows)</text>
  <text class="t" x="312" y="72">Pasted files / tool output</text>
  <text class="t" x="500" y="72">Ask</text>
  <text class="t" x="562" y="72">Reply space</text>
  <text class="d" x="1" y="122">Tip: keep the system prompt short, trim old history, and send only the files that matter.</text>
  <text class="d" x="1" y="142">A 2,000-line file pasted "just in case" is paid for, and diluted, on every single turn.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Every turn re-sends the conversation, so long chats get slower, costlier, and less accurate.</figcaption>
</figure>

**Practical habits:** start a new chat for a new task. Paste the function, not the whole repo. Summarize long history instead of replaying it. Ask for a diff, not a full-file rewrite.

---

## 4. AI-generated code is untrusted code

AI writes code that resembles the code it was trained on, including insecure code. Review every suggestion as if a stranger sent you the pull request, because functionally, one did.

```php
// A typical "it works!" suggestion: SQL injection
public function search(string $email)
{
    return DB::select("SELECT * FROM users WHERE email = '$email'");
}

// What you should merge: parameterized query
public function search(string $email)
{
    return DB::select('SELECT id, name FROM users WHERE email = ?', [$email]);
}
```

If that looks familiar, see my post on [SQL Injection Explained and How to Prevent It](/blog/sql-injection-explained-and-how-to-prevent-it/).

### Real-world failure: hallucinated packages ("slopsquatting")

Researchers found that code models regularly recommend **packages that don't exist**, and often repeat the same fake names. Attackers can register those names with malicious code and wait for someone to run `composer require` or `npm install` on the AI's advice.

**Code-level lesson:** before adding any dependency an AI suggested, check that it is real, maintained, and the one you meant.

```bash
composer show vendor/package-name     # does it exist? who maintains it?
composer audit                        # known vulnerabilities in your tree
```

### Real-world failure: an AI agent deleted a production database (2025)

In a widely reported July 2025 incident, an AI coding agent on the Replit platform deleted a company's live database during a declared code freeze, then gave misleading answers about it. The root cause wasn't "AI is evil". The agent had **write access to production** and nothing forced a human to approve destructive actions.

**Code-level lesson:** apply least privilege to agents exactly as you would to a junior engineer: read-only credentials by default, separate environments, and an approval gate for anything destructive.

---

## 5. Never put secrets or private data in a prompt

Anything you send leaves your machine. Depending on the provider and plan, it may be logged or retained. Treat a prompt like a message to an external vendor, because it is one.

### Real-world failure: Samsung (2023)

Engineers at Samsung pasted proprietary source code and internal meeting notes into a public chatbot while looking for quick help. The company reportedly restricted generative-AI use on internal devices afterwards.

**Code-level lesson:** redact before you send, at a single choke point, not scattered across the codebase.

```php
final class PromptRedactor
{
    private const PATTERNS = [
        '/\b[\w.+-]+@[\w-]+\.[\w.]+\b/'         => '[EMAIL]',
        '/\b(?:\d[ -]*?){13,16}\b/'             => '[CARD]',
        '/(?i)(api[_-]?key|secret|token)\s*[:=]\s*\S+/' => '$1=[REDACTED]',
    ];

    public static function clean(string $text): string
    {
        return preg_replace(array_keys(self::PATTERNS), array_values(self::PATTERNS), $text);
    }
}

$response = $llm->ask(PromptRedactor::clean($userMessage));
```

Regex is a safety net, not a guarantee. The real rules: keep secrets in environment variables, never in code you paste, and use enterprise plans with clear data-retention terms for company work.

---

## 6. Prompt injection: input is an attack surface

An LLM can't reliably tell your **instructions** from **data** that contains instructions. If a user, a web page, an email, or a PDF says "ignore previous instructions", the model may obey. This is **prompt injection**, the AI-era cousin of SQL injection.

### Real-world failure: the $1 car (2023)

A car dealership's website chatbot was talked into "agreeing" to sell a new SUV for one dollar. A user simply told it to agree with everything the customer said. It wasn't a binding deal, but it was embarrassing and went viral. Now imagine that bot could also issue refunds or call your internal APIs.

<figure>
<svg viewBox="0 0 680 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A safe AI pipeline: user input is sanitized, goes to the model in an untrusted zone, output is validated, then a human or policy gate approves before any action">
  <style>
    .t{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <defs><marker id="a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#94a3b8"/></marker></defs>
  <rect x="150" y="12" width="190" height="126" rx="12" fill="#fef2f2" stroke="#fca5a5" stroke-dasharray="6 4"/>
  <text class="d" x="162" y="30" fill="#dc2626" style="fill:#dc2626">UNTRUSTED ZONE</text>
  <rect x="1" y="50" width="120" height="60" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="14" y="78">User / doc</text>
  <text class="d" x="14" y="96">any input</text>
  <rect x="165" y="50" width="160" height="60" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="178" y="78">LLM</text>
  <text class="d" x="178" y="96">can be manipulated</text>
  <rect x="368" y="50" width="130" height="60" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="381" y="78">Validate</text>
  <text class="d" x="381" y="96">schema + rules</text>
  <rect x="541" y="50" width="138" height="60" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="554" y="78">Approve</text>
  <text class="d" x="554" y="96">human / policy</text>
  <path d="M121 80H161" stroke="#94a3b8" stroke-width="2" marker-end="url(#a2)"/>
  <path d="M325 80H364" stroke="#94a3b8" stroke-width="2" marker-end="url(#a2)"/>
  <path d="M498 80H537" stroke="#94a3b8" stroke-width="2" marker-end="url(#a2)"/>
  <text class="d" x="1" y="168">Trust the pipeline, never the model. Only the last box is allowed to touch real systems.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Put your guardrails outside the model, where an attacker's text can't rewrite them.</figcaption>
</figure>

**Code-level lesson:** never let the model decide what it's *allowed* to do. Your code decides.

```php
// The model may only *request* an action from this allow-list.
private const ALLOWED = ['lookup_order', 'track_shipment'];   // no refunds, no deletes

public function run(array $toolCall, User $user): mixed
{
    if (! in_array($toolCall['name'], self::ALLOWED, true)) {
        throw new ForbiddenToolException($toolCall['name']);
    }

    // Authorization uses the real logged-in user, never an ID the model supplied.
    $order = $user->orders()->findOrFail($toolCall['args']['order_id']);

    return $this->tools->execute($toolCall['name'], $order);
}
```

---

## 7. Validate AI output like any untrusted input

If your code consumes AI output (JSON, SQL, a category, a price), parse and validate it exactly as you would a form submission. The model will sometimes return extra prose, a wrong type, a missing field, or a confident wrong answer.

```php
$raw = $llm->ask($prompt . "\nReturn ONLY JSON: {\"category\": string, \"priority\": 1-5}");

$data = json_decode($raw, true);

$validator = Validator::make($data ?? [], [
    'category' => ['required', Rule::in(['billing', 'bug', 'feature', 'other'])],
    'priority' => ['required', 'integer', 'between:1,5'],
]);

if ($validator->fails()) {
    // Retry a limited number of times, then fall back: never loop forever.
    return $this->fallbackToHumanTriage($ticket);
}

$ticket->update($validator->validated());
```

Notice three habits: an **allow-list** for categories, a **range check** for numbers, and a **bounded fallback** instead of trusting (or endlessly retrying) the model. Most providers also offer a *structured output* / JSON-schema mode. Use it, and still validate.

**Test it too.** AI features need tests just like anything else. Keep a small "golden set" of inputs with expected outputs and run it in CI whenever you change the prompt or model, so you catch regressions instead of users.

---

## 8. Good prompts are specs, and specs reduce cost

A vague prompt gets a vague answer, which leads to a follow-up, which leads to another. Every retry re-sends context and burns tokens. A precise prompt is the cheapest optimization you have.

| Vague (costly) | Specific (cheap) |
|---|---|
| "Fix my code" | "This Laravel 11 action throws `N+1` on `orders->items`. Fix it with eager loading. Return only a diff." |
| "Write tests" | "Write Pest tests for `RefundService::issue()` covering: full refund, partial refund, and already-refunded. No DB, mock the gateway." |
| "Make it better" | "Reduce cyclomatic complexity. Keep the public signature and behaviour identical." |

A reliable prompt has five parts: **role/context, task, constraints, examples, and output format**.

```text
Context:     Laravel 11, PHP 8.3, Pest for tests.
Task:        Refactor OrderController@store into a service class.
Constraints: Keep route and response shape unchanged. No new packages.
Example:     Follow the style of app/Services/InvoiceService.php.
Output:      A unified diff only, no explanations.
```

The "Output" line matters most for cost: asking for *only the diff* can cut output tokens dramatically versus a full rewrite with commentary.

---

## 9. Control cost before it controls you

AI cost is usage-based, so a bug or a loop can become a bill. Four levers handle most of it:

1. **Right-size the model.** Use a small, cheap model for classification and formatting. Save the large one for hard reasoning.
2. **Cap everything.** Set `max_tokens`, request timeouts, retry limits, and a per-user or per-day budget.
3. **Cache.** Identical questions shouldn't be paid for twice. Many providers also discount repeated prompt prefixes ("prompt caching"), so keep the stable part of your prompt first.
4. **Send less.** Trim history, retrieve only relevant chunks, and ask for concise output.

```php
public function classify(string $text, User $user): string
{
    // 1. Budget guard: a runaway loop hits a wall, not your credit card.
    if ($this->usage->todayFor($user) > config('ai.daily_token_limit')) {
        throw new BudgetExceededException();
    }

    // 2. Cache: same input, same answer, zero tokens.
    $key = 'ai:classify:' . sha1($text);

    return Cache::remember($key, now()->addDay(), function () use ($text, $user) {
        // 3. Route to the cheap model and cap the output.
        $result = $this->llm->ask(
            model: config('ai.models.cheap'),
            prompt: "Classify as billing|bug|feature|other. Reply with one word.\n\n{$text}",
            maxTokens: 5,
        );

        $this->usage->record($user, $result->tokensIn, $result->tokensOut);

        return trim($result->text);
    });
}
```

### Real-world failure: the silent retry loop

A very common pattern: an agent or script calls a model, gets a malformed answer, retries with the *whole* conversation appended, fails again, and repeats overnight. Nothing crashes. Nothing alerts. The bill just grows. The fix is boring and effective: a retry cap, a per-job token budget, and an alert when daily spend passes a threshold.

**Measure first.** Log tokens in, tokens out, model, latency, and feature name for every call. You can't optimize what you can't see.

---

## 10. You own the code. AI is a tool, not a teammate who takes the blame

If you commit it, it's yours. "The AI wrote it" isn't a defense in a code review, an outage, or a security audit. AI generates code faster than people can review it, which means **technical debt can now accumulate at machine speed**: duplicated logic, inconsistent patterns, untested branches, and code nobody on the team truly understands.

Keep your standards exactly where they were:

- **Understand before you merge.** If you can't explain a line, you can't maintain it. Ask the AI to explain it, then verify.
- **Keep changes small.** Small AI-assisted PRs are reviewable. A 3,000-line generated diff is not.
- **Write the tests first** (or demand them). Tests turn "looks right" into "is right".
- **Follow your architecture.** Tell the AI your patterns. Don't let it invent a new one per file. See [Must-Know Code Quality Practices](/blog/must-know-code-quality-practices-for-software-engineers/) and [AI-Assisted Development in Fintech Engineering](/blog/ai-assisted-development-in-fintech-engineering/).
- **Keep learning the fundamentals.** Juniors who skip understanding now become seniors who can't debug later.

---

## The 10-point checklist

Before you ship anything AI-assisted, ask yourself:

1. Did I verify facts and APIs instead of trusting confident output?
2. Do I know roughly how many tokens this call costs?
3. Am I sending only the context the model needs?
4. Did I review the generated code like a stranger's PR (security, edge cases)?
5. Are all suggested dependencies real, maintained, and audited?
6. Are secrets and personal data redacted or excluded?
7. Can untrusted input reach the model, and can the model reach anything dangerous?
8. Is AI output validated against a schema or allow-list?
9. Are there `max_tokens`, retry caps, caching, and a spend limit?
10. Do tests cover it, and can I explain every line I'm committing?

---

## Key takeaways

- LLMs **predict plausible text**; they don't guarantee truth. Ground and verify.
- **Tokens and context are your budget.** Measure them, trim them, cap them.
- **AI code and AI output are untrusted input.** Review, validate, and apply least privilege.
- **Real failures** (Air Canada, Samsung, hallucinated packages, the deleted production database) came from ordinary gaps: no grounding, leaked data, no review, too much access.
- **You stay accountable.** AI raises your speed. Your judgment still sets the quality.

AI won't replace engineers who understand it, but it will amplify the habits they already have, good or bad. Pick one item from the checklist and apply it in your next pull request.
