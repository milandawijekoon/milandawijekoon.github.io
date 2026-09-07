---
title: "SQL Injection, Explained: How It Works and How to Prevent It"
category: Security
excerpt: >-
  A short, diagram-led note on the single most famous web vulnerability. What SQL
  injection actually is, why string-built queries are the root cause, how a real
  attack unfolds step by step, and the small number of habits that shut it down
  for good. Readable in about 10 minutes.
---

SQL injection has been near the top of every "most dangerous web vulnerabilities" list for over two decades. It is old, well understood, and completely preventable — yet it still shows up in production code, usually for the same reason: a query was built by gluing strings together.

This note is a compact tour. By the end you should be able to explain what SQL injection is, spot the pattern that causes it, and know exactly which technique stops it.

---

## The one-sentence definition

**SQL injection happens when data supplied by a user is allowed to change the _structure_ of a SQL query, instead of being treated purely as a _value_ inside it.**

Everything else in this article is a consequence of that sentence.

---

## Why it happens: code and data get mixed

A SQL query has two kinds of content:

- **Code** — the keywords and structure: `SELECT`, `FROM`, `WHERE`, `AND`, `OR`, parentheses, operators.
- **Data** — the values: a username, an email, a product id, a search term.

When you build a query by concatenating strings, the user's data is pasted directly into the code. The database has no way to know which characters came from you (the developer) and which came from the user. It just parses the whole thing as one SQL statement.

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram showing user input concatenated into a SQL string, which the database parses as a mix of code and data">
  <style>
    .lbl{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .sub{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .mono{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;}
    .box{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;rx:10;}
  </style>
  <rect class="box" x="1" y="30" width="200" height="70" rx="10"/>
  <text class="lbl" x="16" y="55">Developer's template</text>
  <text class="mono" x="16" y="78" fill="#2563eb">"...WHERE name = '"</text>

  <rect class="box" x="1" y="150" width="200" height="70" rx="10"/>
  <text class="lbl" x="16" y="175">User input</text>
  <text class="mono" x="16" y="198" fill="#b91c1c">' OR '1'='1</text>

  <path d="M205 65 H255 M205 185 H255 M255 65 Q275 65 275 110 M255 185 Q275 185 275 130 M275 110 V125 H300" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="300,118 292,113 292,123" fill="#94a3b8"/>

  <rect class="box" x="305" y="80" width="230" height="90" rx="10"/>
  <text class="lbl" x="320" y="105">Concatenated string</text>
  <text class="mono" x="320" y="130" fill="#0f172a">WHERE name = '</text>
  <text class="mono" x="320" y="150" fill="#b91c1c">' OR '1'='1</text>
  <text class="mono" x="428" y="150" fill="#0f172a">'</text>

  <path d="M539 125 H575" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="578,125 570,120 570,130" fill="#94a3b8"/>

  <rect class="box" x="582" y="80" width="96" height="90" rx="10"/>
  <text class="lbl" x="600" y="120">Database</text>
  <text class="sub" x="598" y="140">parses it</text>
  <text class="sub" x="598" y="154">all as SQL</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The database receives one blob of text. The quote in the user's input closes the string early; everything after it is read as SQL code.</figcaption>
</figure>

---

## A concrete attack, step by step

Here is a login lookup written the dangerous way. The language is PHP, but the flaw is identical in every language and framework.

```php
// DANGEROUS — never do this
$name = $_GET['name'];

$sql = "SELECT id, email FROM users WHERE name = '" . $name . "'";
$result = $db->query($sql);
```

### Step 1 — the normal case

Input: `alice`

```sql
SELECT id, email FROM users WHERE name = 'alice'
```

Works fine. This is why the bug survives code review — the happy path looks correct.

### Step 2 — break out of the string

Input: `' OR '1'='1`

```sql
SELECT id, email FROM users WHERE name = '' OR '1'='1'
```

`'1'='1'` is always true, so the `WHERE` clause matches **every row**. The attacker just dumped the entire `users` table.

### Step 3 — go further

Input: `'; DROP TABLE users; --`

```sql
SELECT id, email FROM users WHERE name = ''; DROP TABLE users; --'
```

The `--` comments out the trailing quote so the statement stays valid. If the driver allows stacked queries, the table is gone.

### Step 4 — steal data from other tables

Input: `' UNION SELECT card_number, cvv FROM payments --`

```sql
SELECT id, email FROM users WHERE name = ''
UNION SELECT card_number, cvv FROM payments --'
```

`UNION` welds a second result set onto the first. The login screen now returns payment data.

<figure>
<svg viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Escalation ladder from reading all rows, to modifying data, to reading other tables, to full server compromise">
  <style>
    .t{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="150" width="150" height="46" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="20" y="170">Bypass filter</text>
  <text class="d" x="20" y="187">OR 1=1</text>

  <rect x="171" y="110" width="150" height="46" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="190" y="130">Read all rows</text>
  <text class="d" x="190" y="147">dump a table</text>

  <rect x="341" y="70" width="150" height="46" rx="8" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="360" y="90">Cross-table read</text>
  <text class="d" x="360" y="107">UNION SELECT</text>

  <rect x="511" y="20" width="165" height="46" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="530" y="40">Write / RCE</text>
  <text class="d" x="530" y="57">DROP, stacked queries</text>

  <path d="M151 165 L171 140 M321 128 L341 100 M491 88 L511 55" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
  <polygon points="171,140 162,141 168,149" fill="#94a3b8"/>
  <polygon points="341,100 332,101 338,109" fill="#94a3b8"/>
  <polygon points="511,55 502,56 508,64" fill="#94a3b8"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">One injectable parameter is rarely "just" a data leak. It is a foothold that escalates.</figcaption>
</figure>

---

## The fix: parameterized queries

The cure is to **send the query structure and the data to the database separately**. This is called a *parameterized query* or *prepared statement*.

You send a query with placeholders:

```sql
SELECT id, email FROM users WHERE name = ?
```

Then you send the value `' OR '1'='1` separately. The database has already finished parsing the query structure — it knows `name = ?` expects exactly one value. Whatever you pass for `?` is stored as that column's value and **never re-parsed as SQL**. The attack string becomes a literal (nonsensical) username that matches no one.

<figure>
<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparison: concatenation sends code and data together and is unsafe; parameterized query sends the template first, then the value, and is safe">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .m{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>

  <rect x="1" y="1" width="678" height="120" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="20" y="26" fill="#b91c1c">✗  String concatenation</text>
  <text class="m" x="20" y="52">query = "... WHERE name = '" + input + "'"</text>
  <text class="m" x="20" y="74">DB receives:  ...WHERE name = '' OR '1'='1'</text>
  <text class="n" x="20" y="100">Structure and value arrive fused. The DB parses the attacker's quote as syntax.</text>

  <rect x="1" y="138" width="678" height="120" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="20" y="163" fill="#15803d">✓  Parameterized query</text>
  <text class="m" x="20" y="189">1. DB parses:  ... WHERE name = ?</text>
  <text class="m" x="20" y="211">2. Bind value:  "' OR '1'='1"   →  bound to ?</text>
  <text class="n" x="20" y="237">Parsing is done before the value shows up. The value can only be data.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Same user input, two outcomes. The only difference is whether the value was concatenated or bound.</figcaption>
</figure>

### How it looks in real code

**Raw PDO (PHP):**

```php
$stmt = $db->prepare('SELECT id, email FROM users WHERE name = ?');
$stmt->execute([$_GET['name']]);
$rows = $stmt->fetchAll();
```

**Laravel query builder** — parameter binding is automatic:

```php
$users = DB::table('users')
    ->where('name', $request->input('name'))
    ->get();
```

**Laravel Eloquent:**

```php
$users = User::where('name', $request->input('name'))->get();
```

**Node.js (`pg`):**

```js
await client.query(
  'SELECT id, email FROM users WHERE name = $1',
  [req.query.name]
);
```

**Python (`sqlite3` / DB-API):**

```python
cur.execute(
    "SELECT id, email FROM users WHERE name = ?",
    (request.args["name"],),
)
```

In every case the placeholder (`?`, `$1`, `:name`) marks a slot, and the value travels in a separate argument. That is the whole idea.

---

## The trap: things that are *not* fixes

<div markdown="1">

| Non-fix | Why it fails |
| --- | --- |
| **Escaping quotes by hand** (`str_replace("'", "''", $x)`) | Easy to get wrong; breaks on different encodings; useless for numeric contexts where no quotes are needed (`id = 1 OR 1=1`). |
| **Blocklisting words** like `DROP`, `UNION`, `--` | Attackers bypass with comments, casing, encoding, whitespace tricks. Also breaks legitimate input ("I work in M&A, DROP me a line"). |
| **Hiding SQL errors** | Blind SQL injection needs no error messages — attackers infer data from timing or true/false responses. |
| **A Web Application Firewall alone** | Useful defense-in-depth, but pattern matching is bypassable. It buys time, not safety. |
| **`addslashes()` / generic escaping** | Not context-aware; documented bypasses exist. |
| **ORM, used carelessly** | `User::whereRaw("name = '$name'")` or `DB::select("... $name ...")` reintroduces the exact bug. The ORM only protects you when you let it bind. |

</div>

---

## Where people still get burned even with an ORM

Parameter binding covers **values**. It cannot bind **identifiers** — table names, column names, `ORDER BY` columns, or `ASC`/`DESC`. Those cannot be placeholders in SQL.

```php
// user controls the sort column — cannot be a bound parameter
$sortColumn = $request->input('sort');          // "created_at); DROP TABLE ..."
$users = User::orderBy($sortColumn)->get();      // unsafe
```

For identifiers, use an **allow-list**: map user input to a fixed set of known-good values.

```php
$allowed = ['name', 'created_at', 'email'];
$sortColumn = in_array($request->input('sort'), $allowed, true)
    ? $request->input('sort')
    : 'name';

$users = User::orderBy($sortColumn)->get();      // safe
```

Same rule for dynamic `IN (...)` lists, `LIKE` patterns (bind the value, escape `%` and `_` if they must be literal), and any raw fragment you truly cannot avoid.

---

## The four flavours of SQL injection

Knowing the categories helps you recognise an attack in logs and understand why "hide the error message" is not a defense.

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four types of SQL injection grouped into in-band, blind, and out-of-band">
  <style>
    .g{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1d4ed8;}
    .k{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .v{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .bx{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1.5;}
  </style>
  <text class="g" x="1" y="18">IN-BAND — answer comes back on the same screen</text>
  <rect class="bx" x="1" y="28" width="330" height="64" rx="9"/>
  <text class="k" x="16" y="49">Error-based</text>
  <text class="v" x="16" y="69">DB error text leaks table &amp; column names</text>
  <text class="v" x="16" y="85">directly into the HTTP response.</text>
  <rect class="bx" x="349" y="28" width="330" height="64" rx="9"/>
  <text class="k" x="364" y="49">Union-based</text>
  <text class="v" x="364" y="69">UNION SELECT appends attacker rows to</text>
  <text class="v" x="364" y="85">the page's normal result set.</text>

  <text class="g" x="1" y="126">BLIND — no data returned, answer is inferred</text>
  <rect class="bx" x="1" y="136" width="330" height="64" rx="9"/>
  <text class="k" x="16" y="157">Boolean-based</text>
  <text class="v" x="16" y="177">Page changes for "... AND 1=1" vs "1=2".</text>
  <text class="v" x="16" y="193">Data read one true/false question at a time.</text>
  <rect class="bx" x="349" y="136" width="330" height="64" rx="9"/>
  <text class="k" x="364" y="157">Time-based</text>
  <text class="v" x="364" y="177">"... AND SLEEP(5)" — a slow response means</text>
  <text class="v" x="364" y="193">the condition was true. Works with zero output.</text>

  <text class="g" x="1" y="234">OUT-OF-BAND — data exfiltrated over another channel (DNS/HTTP) when the app is fully silent</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Blind and out-of-band variants need no error messages and no visible output — which is why suppressing errors is not protection.</figcaption>
</figure>

---

## How it gets found

Attackers and testers probe the same way, and you can run these checks against your own app:

- **The single quote.** Enter `'` in every field and URL parameter. A 500 error, a broken page, or a SQL error string means the input reaches a query unescaped.
- **Boolean pair.** Compare `?id=10` with `?id=10 AND 1=1` and `?id=10 AND 1=2`. If the last one returns a different (or empty) page, the parameter is injectable.
- **Timing probe.** `?id=10 AND SLEEP(5)` — if the response is ~5 seconds slower, the input is being executed.
- **Automated scanners.** `sqlmap` automates all of the above; static analysers (Semgrep, PHPStan rules, `bandit` for Python) flag string-built queries at build time. Wire one into CI.

Test on systems you own or are authorised to test. Unauthorised probing is illegal.

---

## Defense in depth

Parameterized queries stop the vulnerability. The other layers limit the blast radius if something slips through — a legacy endpoint, a third-party library, a raw query added under deadline.

<figure>
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Five concentric layers of defense against SQL injection, from parameterized queries at the core outward to monitoring">
  <style>
    .ring{fill:none;stroke-width:34;}
    .rl{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .rc{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#1d4ed8;}
  </style>
  <circle class="ring" cx="150" cy="150" r="40" stroke="#2563eb"/>
  <circle class="ring" cx="150" cy="150" r="74" stroke="#60a5fa"/>
  <circle class="ring" cx="150" cy="150" r="108" stroke="#93c5fd"/>
  <circle class="ring" cx="150" cy="150" r="142" stroke="#bfdbfe"/>
  <circle class="ring" cx="150" cy="150" r="176" stroke="#dbeafe"/>

  <text class="rc" x="118" y="154">core</text>

  <line x1="320" y1="150" x2="360" y2="150" stroke="#cbd5e1"/>
  <text class="rl" x="366" y="118">1  Parameterized queries / prepared statements</text>
  <text class="rl" x="366" y="146">2  ORM or query builder as the default path</text>
  <text class="rl" x="366" y="174">3  Allow-list validation for identifiers &amp; enums</text>
  <text class="rl" x="366" y="202">4  Least-privilege DB account (no DROP, scoped grants)</text>
  <text class="rl" x="366" y="230">5  WAF, logging, anomaly alerts, code review</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Only layer 1 removes the bug. Layers 2–5 decide how bad it is when someone forgets layer 1.</figcaption>
</figure>

**Least privilege matters more than people think.** If the application's database user cannot `DROP`, cannot read the `payments` table, and cannot write to `users`, then an injection in the product search is contained to what that account can already do. Give each service its own account with only the grants it needs.

---

## A five-point checklist

1. **Never build a query with string concatenation or interpolation.** If you see a variable inside a SQL string, stop.
2. **Use placeholders for every value** — `?`, `$1`, `:name` — and pass data as separate arguments.
3. **Allow-list anything that can't be a placeholder** — sort columns, table names, `ASC`/`DESC`, `LIMIT` when dynamic.
4. **Give the app a least-privilege database account.** Separate accounts per service. No schema rights in production.
5. **Grep your codebase for the danger signs:** `whereRaw`, `DB::raw`, `DB::select("`, `query("... $`, `execute("... " +`, `f"SELECT ... {`. Review every hit.

---

## Conclusion

SQL injection is not a sophisticated attack. It is the predictable result of letting user data land in the same string as SQL keywords. The database cannot tell the two apart, so it trusts all of it.

Parameterized queries fix this by design: the structure is parsed first, the values arrive after, and a value can never become code. Reach for your framework's binding — `where()`, `prepare()`, `$1` — as the default, keep a short allow-list for the parts that can't be bound, run the app on a database account that can't do much damage, and this entire class of vulnerability closes.
