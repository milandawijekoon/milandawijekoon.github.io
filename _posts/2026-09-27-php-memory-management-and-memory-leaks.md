---
title: "PHP Memory Cleanup and Memory Leaks: How They Happen and How to Fix Them"
category: PHP
excerpt: >-
  A short, diagram-led note on how PHP actually manages memory, why long-running
  PHP processes (queue workers, CLI scripts, Octane/Swoole apps) leak memory
  even though "PHP has garbage collection", real production failure scenarios,
  and the code-level fixes and best practices. Readable in about 10–15 minutes.
---

{% raw %}
A queue worker starts at 30MB. Six hours and 40,000 jobs later, it's sitting at 1.2GB and gets killed by the OOM killer mid-job. The on-call engineer restarts it, the graph resets to 30MB, and it climbs again. Nobody touched the code between the good week and the bad week.

This is the most common PHP memory story, and it confuses people because PHP has **automatic garbage collection**. The truth is: PHP's memory manager cleans up perfectly at the end of *every request*. The leaks happen in the code that runs *inside* one long-lived process, request after request, job after job, never getting that clean reset.

---

## How PHP actually manages memory

Every PHP variable is a **zval** (Zend value) with a **refcount**. When the refcount hits zero, the memory is freed immediately. This handles almost everything — until you get a **circular reference**.

<figure>
<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two diagrams. Left: a simple object with refcount 1, freed instantly when the variable goes out of scope. Right: two objects referencing each other in a cycle, refcount never reaches zero by reference counting alone, so PHP's cycle collector must run periodically to free them.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <defs>
    <marker id="p1a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker>
    <marker id="p1r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#dc2626"/></marker>
  </defs>

  <rect x="1" y="1" width="329" height="258" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="h" x="16" y="26" fill="#15803d">✓  Simple reference</text>
  <rect x="40" y="60" width="90" height="40" rx="7" fill="#fff" stroke="#86efac"/>
  <text class="m" x="85" y="84" text-anchor="middle">$a</text>
  <rect x="200" y="60" width="90" height="40" rx="7" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="245" y="84" text-anchor="middle">Object</text>
  <path d="M130 80 H198" stroke="#475569" stroke-width="1.5" marker-end="url(#p1a)"/>
  <text class="n" x="164" y="72" text-anchor="middle">refcount 1</text>
  <text class="s" x="16" y="150">unset($a);</text>
  <text class="s" x="16" y="170">refcount → 0</text>
  <text class="h" x="16" y="200" fill="#15803d">Freed immediately</text>
  <text class="n" x="16" y="222">No garbage collector needed.</text>

  <rect x="350" y="1" width="329" height="258" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="h" x="366" y="26" fill="#b91c1c">✗  Circular reference</text>
  <rect x="400" y="60" width="90" height="40" rx="7" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="445" y="84" text-anchor="middle">Parent</text>
  <rect x="550" y="60" width="90" height="40" rx="7" fill="#fee2e2" stroke="#fca5a5"/>
  <text class="t" x="595" y="84" text-anchor="middle">Child</text>
  <path d="M490 74 H548" stroke="#dc2626" stroke-width="1.5" marker-end="url(#p1r)"/>
  <text class="n" x="519" y="66" text-anchor="middle">-&gt;child</text>
  <path d="M548 92 H490" stroke="#dc2626" stroke-width="1.5" marker-end="url(#p1r)"/>
  <text class="n" x="519" y="105" text-anchor="middle">-&gt;parent</text>
  <text class="s" x="366" y="150">unset($parent);</text>
  <text class="s" x="366" y="170">refcount stays 1 (each other)</text>
  <text class="h" x="366" y="200" fill="#b91c1c">Not freed by refcounting</text>
  <text class="n" x="366" y="222">Waits for the cycle collector (gc_collect_cycles).</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Reference counting frees most memory instantly. Cycles need PHP's separate cycle-collecting garbage collector, which runs periodically, not instantly.</figcaption>
</figure>

The key fact that causes most confusion: **at the end of a normal PHP-FPM request, none of this matters.** The whole process memory (the "arena") is thrown away and rebuilt for the next request, cycles and all. PHP's garbage collector exists to stop memory from ballooning **during** one very long execution — a CLI script, a queue worker loop, or a long-running Swoole/RoadRunner/Octane worker that serves thousands of requests **without restarting**.

That's the whole story in one line: **PHP-FPM leaks don't matter (new process every request). Long-running PHP leaks do (same process forever).**

---

## Real-world failure scenarios

<div markdown="1">

| # | Scenario | What actually happens | Root cause |
| --- | --- | --- | --- |
| 1 | **Queue worker OOM after hours** | A Laravel `queue:work` process (not `--once`) grows until the OS kills it mid-job | Static caches, event listeners, or Eloquent models accumulating across jobs in the same process |
| 2 | **Laravel Octane / Swoole worker degrades** | Response times creep up, then a worker restarts itself under memory pressure | Framework singletons holding request-scoped data (`Auth::user()`, request objects) between requests |
| 3 | **CLI import script crashes at row 800,000** | A "process all rows" script that was fine on staging (10k rows) dies on production (2M rows) | Eloquent's query builder loading the whole table into an array before iterating |
| 4 | **Symfony event dispatcher circular leak** | A long-running console command slowly leaks despite `unset()` everywhere | Closures capturing `$this`, registered as listeners, never deregistered — classic reference cycle |
| 5 | **Image processing service leaks per request** | A worker resizing uploads gets slower and fatals with "Allowed memory size exhausted" after N images | `imagecreatefromjpeg()` resources or GD/Imagick objects never explicitly destroyed |
| 6 | **"Memory leak" that's actually a memory limit bug** | A single request legitimately needs 600MB (huge CSV export) and dies at `memory_limit=512M` | Not a leak at all — unbounded growth *within one request*, fixed by streaming instead of buffering |

</div>

Scenario 6 is worth calling out on its own: **not every "PHP memory leak" is a leak.** A leak is memory that should have been freed but wasn't, across iterations. A single request loading a 2GB file into a string is just bad memory *usage*, not a leak — the fix is different (streaming/generators, not garbage collection).

<figure>
<svg viewBox="0 0 680 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Line chart contrasting three memory patterns over time: a healthy sawtooth that resets on each garbage collection cycle, a slow leak that ratchets upward and never returns to baseline, and a single request spike that is high usage but not a leak.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .s{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#334155;}
  </style>
  <rect x="0" y="0" width="680" height="220" fill="#fff"/>
  <path d="M40 190 H660 M40 20 V190" stroke="#cbd5e1" stroke-width="1.5"/>
  <text class="n" x="10" y="20">MB</text>
  <text class="n" x="640" y="208">time</text>

  <path d="M40 170 L100 130 L102 168 L160 128 L162 166 L220 126 L222 164 L280 124 L282 162 L340 122"
        fill="none" stroke="#16a34a" stroke-width="2.5"/>
  <text class="s" x="200" y="100" fill="#15803d">Healthy: GC resets it (sawtooth)</text>

  <path d="M40 180 L120 160 L200 145 L280 128 L360 110 L440 90 L520 68 L600 44"
        fill="none" stroke="#dc2626" stroke-width="2.5"/>
  <text class="s" x="470" y="80" fill="#b91c1c">Leak: never comes back down</text>

  <path d="M40 185 L360 185 L365 30 L370 185 L660 185"
        fill="none" stroke="#f59e0b" stroke-width="2.5"/>
  <text class="s" x="380" y="30" fill="#b45309">High usage, not a leak: one big request, then freed</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">A real leak is the pattern that never returns to baseline. A single tall spike that drops back down is a design/streaming problem, not garbage collection.</figcaption>
</figure>

---

## The five usual suspects (with code)

### 1. Growing arrays / caches in a long-lived loop

```php
// ❌ Runs inside `queue:work`, which never restarts the process.
// $processedIds grows forever and is never cleared.
class ImportListener
{
    private array $processedIds = [];

    public function handle(RowImported $event): void
    {
        $this->processedIds[] = $event->id; // never trimmed
    }
}
```

```php
// ✅ Don't accumulate state across jobs in a singleton/listener.
// Either scope it to the job, or cap and flush it explicitly.
class ImportListener
{
    public function handle(RowImported $event): void
    {
        Cache::increment('import:processed'); // external store, not process memory
    }
}
```

### 2. Loading everything instead of streaming

```php
// ❌ Pulls all 2 million rows into one PHP array before the loop even starts.
foreach (User::all() as $user) {
    $this->export->addRow($user);
}
```

```php
// ✅ chunk() / cursor() keep memory flat regardless of table size.
User::query()->orderBy('id')->cursor()->each(function (User $user) {
    $this->export->addRow($user);
});
```

`cursor()` uses a PHP generator and hydrates one model at a time; `chunk(1000, ...)` does it in batches. Either is a constant-memory fix for what would otherwise be O(n) memory growth in a single request or job.

### 3. Circular references that outlive their usefulness

```php
// ❌ Closure captures $this, and $this holds an array of these closures.
// A cycle: Dispatcher -> listeners[] -> Closure -> $this (Dispatcher).
class EventBus
{
    private array $listeners = [];

    public function listen(callable $listener): void
    {
        $this->listeners[] = $listener;
    }
}

$bus = new EventBus();
$bus->listen(fn ($e) => $bus->log($e)); // captures $bus by reference
```

This isn't automatically catastrophic — PHP's cycle collector *will* eventually free it — but on a hot path in a long-running worker, cycles pile up faster than the collector runs, and each collector pass itself costs CPU. Prefer weak references when a callback structurally needs to point back at its owner:

```php
// ✅ WeakMap / WeakReference don't count toward refcount, so no cycle forms.
class EventBus
{
    private array $listeners = [];

    public function listen(object $owner, callable $listener): void
    {
        $this->listeners[] = new WeakReference($owner) === null ? $listener : $listener;
    }
}
```

In practice, the simplest fix is usually structural: don't let long-lived singletons hold closures that capture themselves — pass IDs or events, not `$this`.

### 4. Native resources that PHP's GC doesn't know about

```php
// ❌ GD image resources are C-level memory. The zval can be garbage collected
// while the underlying bitmap is still sitting in memory in older PHP/extension versions,
// and even where it's tied correctly, forgetting imagedestroy() in a loop adds up.
foreach ($uploads as $path) {
    $img = imagecreatefromjpeg($path);
    $resized = imagescale($img, 800);
    imagejpeg($resized, $outputPath);
    // missing: imagedestroy($img); imagedestroy($resized);
}
```

```php
// ✅ Explicitly free native resources every iteration in a long-running process.
foreach ($uploads as $path) {
    $img = imagecreatefromjpeg($path);
    $resized = imagescale($img, 800);
    imagejpeg($resized, $outputPath);
    imagedestroy($img);
    imagedestroy($resized);
}
```

The same applies to Imagick objects (`->clear(); ->destroy();`), open file handles, and database cursors — anything backed by a C extension is a candidate for a leak PHP's own GC cannot see, because it only tracks zvals, not the memory those extensions allocate underneath them.

### 5. Framework/global state that survives between requests (Octane, Swoole, RoadRunner)

```php
// ❌ In a traditional PHP-FPM app this is harmless — the process dies after the request.
// Under Octane, this same singleton is reused for the NEXT request too.
class ReportBuilder
{
    private array $rows = [];

    public function addRow(array $row): void
    {
        $this->rows[] = $row; // never reset between requests under Octane
    }
}
```

```php
// ✅ Reset per-request state explicitly, or avoid singletons for request-scoped data.
class ReportBuilder
{
    private array $rows = [];

    public function boot(): void
    {
        $this->rows = []; // Octane's RequestReceived / RequestTerminated hooks call this
    }
}
```

Laravel Octane specifically warns about this class of bug: anything bound as a singleton keeps its state across every request the worker handles, which is exactly the assumption that PHP-FPM code makes safely and Octane code cannot.

---

## Debugging a real leak

<figure>
<svg viewBox="0 0 700 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flowchart for diagnosing a PHP memory leak. Confirm memory grows across iterations, not within one. Then check native resources, then check for circular references and singletons holding state, then use memory_get_usage snapshots between iterations to bisect which line adds memory, then fix and confirm the sawtooth returns.">
  <style>
    .h{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;}
    .t{font:600 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .m{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0f172a;}
    .n{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <defs>
    <marker id="p5k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker>
  </defs>
  <g stroke="#64748b" stroke-width="1.4" fill="none" marker-end="url(#p5k)">
    <path d="M170 52 V72"/>
    <path d="M170 116 V140"/>
    <path d="M170 184 V208"/>
    <path d="M170 252 V276"/>
  </g>
  <rect x="20" y="12" width="300" height="40" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="170" y="36" text-anchor="middle">Memory grows request-to-request?</text>

  <rect x="20" y="72" width="300" height="44" rx="8" fill="#dbeafe" stroke="#93c5fd"/>
  <text class="t" x="170" y="89" text-anchor="middle">Log memory_get_usage()</text>
  <text class="t" x="170" y="106" text-anchor="middle">every N iterations</text>

  <rect x="20" y="140" width="300" height="44" rx="8" fill="#fef9c3" stroke="#fde047"/>
  <text class="t" x="170" y="157" text-anchor="middle">Bisect: comment out</text>
  <text class="t" x="170" y="174" text-anchor="middle">sections, re-run</text>

  <rect x="20" y="208" width="300" height="44" rx="8" fill="#fff" stroke="#cbd5e1"/>
  <text class="t" x="170" y="225" text-anchor="middle">Check: singletons, closures,</text>
  <text class="t" x="170" y="242" text-anchor="middle">GD/Imagick, static arrays</text>

  <rect x="20" y="276" width="300" height="44" rx="8" fill="#dcfce7" stroke="#86efac"/>
  <text class="t" x="170" y="293" text-anchor="middle">Fix, then confirm memory</text>
  <text class="t" x="170" y="310" text-anchor="middle">returns to baseline</text>

  <rect x="350" y="72" width="330" height="248" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text class="m" x="368" y="98">gc_collect_cycles();</text>
  <text class="m" x="368" y="120">printf("%dMB\n",</text>
  <text class="m" x="382" y="138">memory_get_usage(true)/1e6);</text>
  <text class="n" x="368" y="166">Call this every 100/1000 iterations</text>
  <text class="n" x="368" y="184">inside the loop you suspect.</text>
  <text class="n" x="368" y="212">A flat line = healthy.</text>
  <text class="n" x="368" y="230">A steady climb that never</text>
  <text class="n" x="368" y="248">drops = confirmed leak.</text>
  <text class="n" x="368" y="276">Xdebug's memory profiler or</text>
  <text class="n" x="368" y="294">Blackfire pinpoints the exact line.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Confirm it's a leak (grows across iterations) before hunting for a fix — a lot of "leaks" turn out to be one oversized request instead.</figcaption>
</figure>

```php
// Minimal leak-hunting harness for a suspect long-running loop.
for ($i = 0; $i < 100000; $i++) {
    processJob($jobs[$i]);

    if ($i % 1000 === 0) {
        gc_collect_cycles();
        fwrite(STDERR, sprintf(
            "[%d] mem=%.1fMB peak=%.1fMB\n",
            $i,
            memory_get_usage(true) / 1e6,
            memory_get_peak_usage(true) / 1e6
        ));
    }
}
```

If the `mem=` number keeps climbing even right after `gc_collect_cycles()`, it's a real leak, not an uncollected cycle — force-running the collector rules that out.

---

## Best practices checklist

<div markdown="1">

| Practice | Why it matters |
| --- | --- |
| **Use `cursor()`/`chunk()` for big datasets** | Keeps memory flat regardless of row count; avoids "works on staging, dies on production" |
| **Never let `queue:work` run forever unmonitored** | Set `--max-jobs`, `--max-time`, or `--memory=512` so Laravel recycles the worker itself before the OS has to kill it |
| **Explicitly free native resources** (`imagedestroy`, `$imagick->clear()`, `fclose`) | The GC doesn't track memory a C extension allocated outside the zval system |
| **Avoid closures capturing `$this` in long-lived singletons** | Creates reference cycles that pile up faster than the collector runs on a hot path |
| **Reset request-scoped singleton state under Octane/Swoole** | Code that's safe under PHP-FPM (new process per request) is not automatically safe under a persistent worker |
| **Unset large local variables after use in loops**, e.g. `unset($rows); gc_collect_cycles();` | Nudges reclamation forward inside CPU-bound loops rather than waiting for the threshold-based collector |
| **Treat `memory_limit` errors as two different bugs** | "Grows every iteration" = leak (fix the accumulation). "One request needs more than the limit" = usage (fix with streaming, not GC) |
| **Profile before guessing** | Xdebug's memory functions or Blackfire show the exact allocation site; guessing wastes more time than a five-minute profile |

</div>

---

## A five-point summary

1. **PHP frees memory two ways**: instantly via refcounting, and periodically via a cycle collector for circular references. Both matter only *within* one process's lifetime.
2. **PHP-FPM requests don't leak** in practice because the whole process is thrown away after each request. **Long-running processes** (queue workers, Octane/Swoole, CLI scripts) are where leaks actually hurt.
3. **The usual suspects**: unbounded caches/arrays in loops, loading whole datasets instead of streaming, closures creating reference cycles, un-freed native resources (GD/Imagick/file handles), and singleton state surviving between requests under Octane.
4. **Not every OOM is a leak.** A single oversized request is a usage problem, fixed with generators/streaming — not with `gc_collect_cycles()`.
5. **Diagnose with data**: log `memory_get_usage(true)` every N iterations, force `gc_collect_cycles()` before measuring, and bisect the loop until the climbing line stops climbing.

---

## Conclusion

PHP's garbage collector is good at its job — the leaks people hit in practice aren't PHP failing to collect garbage, they're code holding onto references longer than it needs to, inside a process that's alive far longer than a single request ever used to be. Once you're running queue workers or an Octane/Swoole app, you've opted into managing memory the way a long-running Java or Node service does: watch it, cap it, and free native resources yourself. Do that, and the sawtooth stays flat instead of climbing.
{% endraw %}
