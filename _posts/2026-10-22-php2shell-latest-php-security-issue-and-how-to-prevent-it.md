---
title: "PHP2Shell: The Latest PHP Security Issue, How to Prevent It, and Which PHP Versions Are Safe"
category: Security
excerpt: >-
  Two critical flaws in PHP itself, not in your application, can let an
  unauthenticated attacker run code on your web server. A short, diagram-led
  note on what PHP2Shell is, how the bugs work at code level, which versions are
  safe, and exactly what to do today. A 12-minute read.
---

Most PHP security advice is about *your* code: validate input, escape output, use prepared statements. PHP2Shell is different. The bug is in the **PHP engine itself**. You can write perfectly clean code, follow every best practice, and still be exposed, because the vulnerable code runs *before your application even starts*.

This note is written for developers and students. It explains what happened, how the flaws work (with simplified code), what it looks like when it goes wrong, and the exact steps to fix and verify your servers. It reflects what was public on **22 October 2026**; the situation is moving fast, so always check the official PHP advisories linked at the end.

Reading time: about 12 minutes.

---

## What is PHP2Shell, in one paragraph

**PHP2Shell** is the nickname for two critical remote code execution (RCE) flaws in PHP's core, tracked as **CVE-2026-109618** and **CVE-2026-109619**. The PHP security team rates both **9.2 (Critical)** on CVSS v4.0. Both can be triggered over the network with **no login**, and both can end with an attacker running code as your web server's user. PHP shipped fixes on **21 October 2026**.

| | CVE-2026-109618 | CVE-2026-109619 |
|---|---|---|
| Advisory title | RCE via OOM corruption | RCE via stale global state |
| Bug class | Invalid memory used after an out-of-memory abort | Use-after-free of request memory |
| Trigger | Make PHP run out of memory at the wrong moment | Leave stale state behind, then hit the same worker again |
| Impact | Unauthenticated code execution (confirmed on Apache `mod_php`) | Code execution and memory disclosure |

---

## Why this one is different

<figure>
<svg viewBox="0 0 680 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Request flow showing the vulnerable code runs inside the PHP engine, before the application code">
  <style>
    .t{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="50" width="120" height="70" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text class="t" x="18" y="80">Internet</text>
  <text class="d" x="18" y="100">any visitor</text>

  <rect x="165" y="50" width="130" height="70" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text class="t" x="182" y="80">Web server</text>
  <text class="d" x="182" y="100">Apache / Nginx</text>

  <rect x="339" y="30" width="190" height="110" rx="10" fill="#fee2e2" stroke="#fca5a5" stroke-width="1.5"/>
  <text class="t" x="356" y="58">PHP engine</text>
  <text class="d" x="356" y="80">request startup, uploads,</text>
  <text class="d" x="356" y="96">sessions, memory manager</text>
  <text class="t" x="356" y="124" fill="#b91c1c" style="fill:#b91c1c">PHP2Shell lives here</text>

  <rect x="573" y="50" width="106" height="70" rx="10" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1.5"/>
  <text class="t" x="590" y="80">Your app</text>
  <text class="d" x="590" y="100">Laravel, WP...</text>

  <path d="M121 85 H161 M295 85 H335 M529 85 H569" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <polygon points="165,85 157,80 157,90" fill="#94a3b8"/>
  <polygon points="339,85 331,80 331,90" fill="#94a3b8"/>
  <polygon points="573,85 565,80 565,90" fill="#94a3b8"/>
  <text class="d" x="339" y="168">Your input validation never gets a chance to run.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The flaw sits in the engine, upstream of your framework, your middleware and your validation.</figcaption>
</figure>

Three things make it serious:

1. **It is unauthenticated.** The attacker needs network access to your web server and nothing else.
2. **It is in the runtime.** Laravel, Symfony, WordPress, Drupal, a plain `index.php`: all sit on top of the same engine.
3. **It is old.** Researchers trace the affected code back to PHP 5.4 (2012), so a very large installed base is in scope.

---

## Timeline

<figure>
<svg viewBox="0 0 680 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Timeline: 17 October first exploitation attempt, 20 October details leak, 21 October patches released, then in-the-wild exploitation">
  <style>
    .t{font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <line x1="30" y1="60" x2="650" y2="60" stroke="#cbd5e1" stroke-width="3"/>
  <circle cx="90" cy="60" r="9" fill="#f59e0b"/>
  <circle cx="260" cy="60" r="9" fill="#ef4444"/>
  <circle cx="430" cy="60" r="9" fill="#22c55e"/>
  <circle cx="595" cy="60" r="9" fill="#ef4444"/>
  <text class="t" x="55" y="35">17 Oct</text>
  <text class="d" x="22" y="90">First exploit attempt</text>
  <text class="d" x="22" y="106">seen by Amazon</text>
  <text class="t" x="225" y="35">20 Oct</text>
  <text class="d" x="196" y="90">Details leak before</text>
  <text class="d" x="196" y="106">coordinated release</text>
  <text class="t" x="395" y="35">21 Oct</text>
  <text class="d" x="372" y="90">Patched PHP released</text>
  <text class="d" x="372" y="106">(earlier than planned)</text>
  <text class="t" x="555" y="35">Now</text>
  <text class="d" x="520" y="90">Exploitation reported</text>
  <text class="d" x="520" y="106">across many sites</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Attacks started before most teams could patch. Amazon's honeypots saw an attempt four days before disclosure.</figcaption>
</figure>

The practical lesson: with a leak, the window between "public" and "being attacked" is hours, not weeks. Public exploit code is also circulating and is unverified; do not run it. It may itself contain malware.

---

## How the bugs work (simplified, code level)

The real fixes are in C inside `php-src`. The snippets below are **simplified teaching sketches** of the patterns described in the official advisories, not copies of the actual source.

### Bug 1: running out of memory at the wrong moment (CVE-2026-109618)

PHP enforces `memory_limit`. When a request exceeds it, PHP must stop the request immediately. Historically it does that with `longjmp()`, a C function that **jumps out of the current code** straight to a recovery point, skipping everything in between.

That is fine when nothing important is half-finished. The problem is when the jump happens while request data is only **partly built**:

```c
// Simplified sketch, NOT real php-src code
void start_request(void) {
    request->headers = NULL;          // not ready yet
    request->files   = NULL;          // not ready yet

    request->headers = alloc_headers();   // <- memory limit hit HERE
    //   ^ allocation fails, PHP calls longjmp() and jumps away.
    //   request->files is never initialised properly.
    request->files   = alloc_files();
}

void shutdown_request(void) {
    // Cleanup code TRUSTS the structure is valid
    free_all(request->headers);
    free_all(request->files);         // <- garbage pointer: memory corruption
}
```

An attacker's job is simply to **make the request consume memory until the limit trips at the right instant**. The advisory describes ways to do that with a crafted multipart upload, for example parts with many headers that use far more PHP memory than their size on the wire, or many empty file fields that still create metadata. No special access is needed.

<figure>
<svg viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flow: allocation fails, longjmp aborts, data half built, cleanup trusts it, memory corruption; the patch replaces longjmp with a soft limit at a safe point">
  <style>
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="20" width="118" height="64" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="14" y="48">1. Big request</text>
  <text class="d" x="14" y="66">eats memory</text>

  <rect x="141" y="20" width="118" height="64" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="154" y="48">2. Limit hit</text>
  <text class="d" x="154" y="66">longjmp() abort</text>

  <rect x="281" y="20" width="118" height="64" rx="8" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="294" y="48">3. Half-built</text>
  <text class="d" x="294" y="66">request data</text>

  <rect x="421" y="20" width="118" height="64" rx="8" fill="#fed7aa" stroke="#fdba74"/>
  <text class="t" x="434" y="48">4. Cleanup</text>
  <text class="d" x="434" y="66">trusts bad data</text>

  <rect x="561" y="20" width="118" height="64" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="574" y="48">5. Corruption</text>
  <text class="d" x="574" y="66">attacker steers it</text>

  <path d="M119 52 H137 M259 52 H277 M399 52 H417 M539 52 H557" stroke="#94a3b8" stroke-width="1.5" fill="none"/>

  <rect x="141" y="124" width="398" height="56" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="156" y="148">The fix: no more longjmp() on OOM</text>
  <text class="d" x="156" y="166">Soft limit is checked at the next safe point; a higher hard limit exits cleanly.</text>
  <path d="M200 84 V124" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Top row: the vulnerable path. Bottom: how the patched versions behave instead.</figcaption>
</figure>

### Bug 2: stale state that outlives its memory (CVE-2026-109619)

PHP workers (PHP-FPM children, Apache processes) are **long-lived** and serve many requests one after another. At the end of each request PHP frees the request heap. Some C globals, such as error, session and decoder state, are supposed to be reset *before* that memory is freed.

If a request dies abnormally (a fatal error, a timeout, an out-of-memory), that reset can be skipped. The global still points at memory that is now gone:

```c
// Simplified sketch, NOT real php-src code
static session_state *current_session;   // survives between requests

void handle_request_A(void) {
    current_session = heap_alloc(sizeof(session_state));
    ...
    fatal_error();                        // request dies abnormally
    // current_session = NULL;            // <- reset is SKIPPED
}

void end_request(void) {
    heap_free_all();                      // heap freed, pointer now dangling
}

void handle_request_B(void) {
    // Runs BEFORE normal initialisation (e.g. upload progress)
    use(current_session);                 // <- use-after-free
}
```

<figure>
<svg viewBox="0 0 680 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One PHP worker handles request A which leaves a dangling pointer, then request B reads it before initialisation">
  <style>
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="10" width="678" height="210" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text class="t" x="16" y="34">One long-lived PHP worker</text>

  <rect x="20" y="52" width="190" height="62" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="34" y="78">Request A (attacker)</text>
  <text class="d" x="34" y="96">crashes mid-way; skips reset</text>

  <rect x="245" y="52" width="170" height="62" rx="8" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="259" y="78">Heap freed</text>
  <text class="d" x="259" y="96">global pointer left dangling</text>

  <rect x="450" y="52" width="210" height="62" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="464" y="78">Request B (attacker)</text>
  <text class="d" x="464" y="96">reads it before init resets it</text>

  <path d="M210 83 H241 M415 83 H446" stroke="#94a3b8" stroke-width="1.5" fill="none"/>

  <rect x="150" y="150" width="380" height="54" rx="8" fill="#ffffff" stroke="#e2e8f0"/>
  <text class="t" x="166" y="174">Why it needs the same worker</text>
  <text class="d" x="166" y="192">More workers lower the hit rate, but do not remove the risk.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">A bug that is invisible in a single request becomes exploitable across two.</figcaption>
</figure>

The advisory lists two confirmed "consumers" of the stale state: **session upload progress** (a feature that runs before your script and is enabled by default) and, on PHP 8.5, **`fatal_error_backtraces`**. It also notes that any early INI diagnostic, such as a deprecation or warning raised by a per-request setting, can act as a consumer, and that hiding messages with `error_reporting` or `@` does not help.

> **Student takeaway:** two classic C problems, *use of invalid memory* and *use-after-free*, appear here at the level of the whole PHP request lifecycle. PHP is memory-safe for *your* code. The runtime underneath it is C, and C is not.

---

## Which servers are most exposed

| Setup | Risk | Why |
|---|---|---|
| Apache with `mod_php` | **Highest** | Shutdown runs even after a failed startup; confirmed unauthenticated RCE |
| PHP-FPM (Nginx or Apache) | High | Fewer direct paths, but the session path has been validated under suitable app conditions |
| php-cgi, FrankenPHP, LiteSpeed | Treat as exposed | Considered at risk by the PHP team |
| CLI scripts / queue workers | Lower | Not serving web requests, but still patch them |

---

## Real-world failure scenarios

These are **illustrative composites**, built from how the advisories say the flaws behave and from the mistakes teams routinely make. They are not reports about specific companies.

### Scenario 1: "We patched, but nothing changed"

A team runs `apt upgrade`. The package updates. Nobody restarts PHP-FPM. The **old process is still in memory**, still running vulnerable code, for days. The server scan says "patched"; the running worker says otherwise.

**Fix:** restart or redeploy every worker, then confirm the *running* process, not just the package.

### Scenario 2: The container that was never rebuilt

A `Dockerfile` says `FROM php:8.3-apache`. The image was built in July and sits in a registry. Once a fixed base image is published, the tag moves on, but production keeps running the old build. Worse, it is **Apache with `mod_php`**, the highest-risk setup.

**Fix:** rebuild with `--pull`, redeploy, and check `php -v` *inside the running container*.

### Scenario 3: The "stable" legacy box

A company's internal ERP runs on PHP 7.4 on a server nobody wants to touch. PHP 7.4 has had no official release for years. For this issue the PHP team published only minimal source backports for 7.4 to 8.1. The box is reachable from the internet through a customer portal.

**Fix:** get a vendor-patched build (your distro or an LTS vendor) or upgrade. Until then, remove it from the internet.

### Scenario 4: False comfort from a config tweak

An admin sets `session.upload_progress.enabled=0` and `memory_limit=-1`, writes "mitigated" in the ticket and moves on. Both are *interim* measures. The advisories say updating is the only complete fix, and that if an allocation fails for another reason the dangerous path can still run. Removing the memory cap also makes a plain memory-exhaustion denial of service easier.

**Fix:** use mitigations to buy time, never as the end state.

### Scenario 5: A compromised box that nobody noticed

Exploitation leaves normal-looking traffic: a few large multipart requests, a worker that crashes and respawns. Weeks later the server is sending spam from a PHP process. The patch arrives long after the attacker is already in.

**Fix:** patching closes the door but does not evict someone already inside. Check for the signs below.

---

## Which PHP versions are safe?

"Safe" means **at or above the fixed release for your branch**:

| PHP branch | Safe version | Status |
|---|---|---|
| 8.5 | **8.5.12** or newer | Fixed |
| 8.4 | **8.4.27** or newer | Fixed |
| 8.3 | **8.3.36** or newer | Fixed |
| 8.2 | **8.2.35** or newer | Fixed |
| 8.1, 8.0, 7.4 | No official release | Only minimal source backports; use a vendor-patched build or upgrade |
| 7.3 and older (down to 5.4) | None | End of life, no fix; upgrade |

A few important caveats:

- **Distros backport fixes under old version numbers.** Debian, Ubuntu, RHEL and others may show `8.2.30-something` and still be patched. Check the vendor security notice or package changelog, not just `php -v`.
- **`php -v` may lie about the web server.** The CLI binary and the one serving requests can be different installs (or different containers).
- **Hosting panels and bundled PHPs** (cPanel, Plesk, Docker images, vendor appliances) each ship their own PHP. Inventory all of them.

---

## What to do today: a prevention playbook

<figure>
<svg viewBox="0 0 680 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Five step playbook: inventory, patch, restart, verify, hunt">
  <style>
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="20" width="124" height="70" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="14" y="48">1. Inventory</text>
  <text class="d" x="14" y="68">find every PHP</text>
  <rect x="147" y="20" width="124" height="70" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="160" y="48">2. Patch</text>
  <text class="d" x="160" y="68">fixed release</text>
  <rect x="293" y="20" width="124" height="70" rx="8" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="306" y="48">3. Restart</text>
  <text class="d" x="306" y="68">every worker</text>
  <rect x="439" y="20" width="124" height="70" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="452" y="48">4. Verify</text>
  <text class="d" x="452" y="68">running version</text>
  <rect x="585" y="20" width="94" height="70" rx="8" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="598" y="48">5. Hunt</text>
  <text class="d" x="598" y="68">for intruders</text>
  <path d="M125 55 H143 M271 55 H289 M417 55 H435 M563 55 H581" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Order matters. Most real failures skip step 3 or step 4.</figcaption>
</figure>

### Step 1: Find every PHP you run

```bash
# What the CLI says (may NOT be what serves your site)
php -v

# What the web server actually uses
php-fpm -v                      # or php-fpm8.3 -v
apachectl -M 2>/dev/null | grep -i php     # mod_php loaded?

# Inside a running container
docker exec <container> php -v

# Debian/Ubuntu: is the fix backported into this package?
apt changelog php8.3-fpm | grep -i "CVE-2026-1096"

# RHEL/Fedora family
rpm -q --changelog php | grep -i "CVE-2026-1096"
```

### Step 2: Patch (the only complete fix)

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install --only-upgrade 'php*'

# Docker: pull the new base image and rebuild without cache
docker build --pull --no-cache -t myapp:php-patched .
```

In your `Dockerfile`, track the patch line of your branch and rebuild on a schedule, so you are not relying on someone remembering:

```dockerfile
FROM php:8.4-fpm        # follow the branch; rebuild weekly in CI
# Or pin an exact fixed release, then bump it deliberately:
# FROM php:8.4.27-fpm
```

### Step 3: Restart every worker

Patching the package does not touch processes that are already running.

```bash
sudo systemctl restart php8.3-fpm
sudo systemctl restart apache2        # if you use mod_php
# Containers / Kubernetes: redeploy so the pods are replaced
kubectl rollout restart deployment/my-app
```

### Step 4: Verify the *running* version

A quick guard you can run from the web tier (or add to a health check) so a stale worker is obvious:

```php
<?php
// check-php-version.php: fail CI or a health check if PHP is below the fixed release
$fixed = ['8.5' => '8.5.12', '8.4' => '8.4.27', '8.3' => '8.3.36', '8.2' => '8.2.35'];
$branch = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;

if (!isset($fixed[$branch])) {
    fwrite(STDERR, "PHP $branch has no official fix. Use a vendor build or upgrade.\n");
    exit(1);
}
if (version_compare(PHP_VERSION, $fixed[$branch], '<')) {
    fwrite(STDERR, "PHP " . PHP_VERSION . " is vulnerable. Need >= {$fixed[$branch]}.\n");
    exit(1);
}
echo "OK: PHP " . PHP_VERSION . "\n";
```

A distro build with a backported fix reports an older number, so this script can false-alarm there. For those machines, trust the vendor advisory and changelog instead.

### Step 5: Hunt for signs of compromise

Patching does not remove an attacker who is already in. Look at your logs from **17 October** onward for:

- unusually large or deeply nested **multipart** requests,
- PHP workers that crashed or hit their memory limit,
- new or modified files in web roots (new `.php` files in upload directories are a classic web shell sign),
- outbound connections from PHP processes that you cannot explain,
- unexpected cron jobs or new accounts.

If you find anything, preserve logs first, then rotate secrets (database passwords, API keys, `.env` values) on that host.

---

## If you cannot patch right now: stopgaps

None of these make an unpatched server safe. They only reduce exposure while you schedule the real fix.

```ini
; php.ini / FPM pool config. Must be set where the app CANNOT override it.

; CVE-2026-109619: disable session upload progress
session.upload_progress.enabled = 0

; PHP 8.5 only: remove a confirmed producer of stale state
fatal_error_backtraces = 0

; Keep request bodies bounded
post_max_size = 8M
upload_max_filesize = 2M
max_file_uploads = 5
max_input_nesting_level = 8
```

```ini
; PHP-FPM pool: admin values cannot be changed by the application
php_admin_value[session.upload_progress.enabled] = 0
```

```nginx
# Nginx: enforce limits in front of PHP
client_max_body_size 8m;

# If this endpoint never takes uploads, reject multipart entirely
location /api/ {
    if ($content_type ~* "multipart/form-data") { return 415; }
    ...
}
```

Then **restart all workers**. Other practical notes from the advisories:

- A per-worker **container or cgroup memory limit** helps contain denial of service, but it is not a fix.
- **Do not** use `RLIMIT_AS` or `RLIMIT_DATA` to cap memory; they make allocation fail in exactly the way that triggers the vulnerable path.
- Consider `pm.max_requests = 1` on PHP-FPM if you can afford the performance cost, since it stops stale state from reaching a second request.
- A WAF (Cloudflare shipped temporary rules) can block known attack patterns, but only for traffic that passes through it.
- If something truly cannot be patched, **take it off the public internet**.

---

## Defense in depth: reduce the blast radius for next time

PHP2Shell will not be the last runtime bug. Make the next one less painful:

1. **Run the web worker as a low-privilege user.** The attacker gets only what that user can do.
2. **Keep secrets out of the web root and out of readable files.** Use a secret manager where you can.
3. **Make the filesystem read-only** for everything except the directories PHP must write to.
4. **Isolate:** one app per container or pool, so one compromise does not spread.
5. **Egress filtering:** a web server rarely needs to call arbitrary internet hosts.
6. **Patch SLAs:** critical runtime CVEs within 24 to 48 hours, tracked and owned.
7. **Automate rebuilds:** weekly image rebuilds mean you pick up fixes without a fire drill.

---

## A ten-point checklist

1. Listed every place PHP runs (VMs, containers, hosting panels, appliances).
2. Identified each PHP branch and whether it is 8.2 to 8.5 (fixed), 7.4 to 8.1 (backport only) or older (no fix).
3. Upgraded to **8.5.12 / 8.4.27 / 8.3.36 / 8.2.35** or newer, or confirmed the vendor backport.
4. Restarted or redeployed every worker.
5. Verified the **running** version, not just the installed package.
6. Disabled `session.upload_progress` if you do not use it.
7. Capped request sizes at the web server or proxy.
8. Searched logs from 17 October for large multipart requests, crashes and new files.
9. Rotated secrets on any host that looks suspicious.
10. Added automated rebuilds and a version check to CI.

---

## Key takeaways

- PHP2Shell is **two critical flaws in the PHP engine** (CVE-2026-109618 and CVE-2026-109619), exploitable without authentication.
- The causes are classic: **invalid memory after an out-of-memory abort** and **a use-after-free caused by state left behind between requests**.
- **Safe versions:** PHP **8.5.12, 8.4.27, 8.3.36, 8.2.35** or newer. PHP 8.1 and older need a vendor-patched build or an upgrade.
- **Patching is not finished until workers are restarted** and the running version is verified.
- Config changes are stopgaps, not fixes. Updating is the only complete answer.
- Treat any server that was exposed before patching as *possibly compromised* until you have checked.

If you only do one thing today, run `php -v` on the thing that actually serves your site, and compare it with the table above.

---

## Sources and further reading

- PHP security advisories: [GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) (CVE-2026-109618) and [GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) (CVE-2026-109619)
- [Tenable: PHP2Shell FAQ](https://www.tenable.com/blog/php2shell-cve-2026-109618-cve-2026-109619-frequently-asked-questions-about-critical-php-remote)
- [Qualys: how to find, mitigate and patch](https://blog.qualys.com/vulnerabilities-threat-research/2026/10/20/php-announces-critical-security-release-for-two-vulnerabilities)
- [watchTowr: PHP2Shell](https://watchtowr.com/intelligence/php-remote-code-execution-php2shell/)
- [Wikipedia: PHP2Shell](https://en.wikipedia.org/wiki/PHP2Shell)

Details such as affected-version ranges, exploitation status and mitigations were still being updated when this was written. Treat the PHP advisories and your distribution's security notices as the source of truth, and re-check them before acting.
