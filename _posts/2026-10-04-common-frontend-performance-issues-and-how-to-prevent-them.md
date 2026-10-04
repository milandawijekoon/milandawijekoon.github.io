---
title: "Why Is My Website Slow? 7 Common Frontend Performance Issues and How to Prevent Them"
category: Engineering
excerpt: >-
  Most slow websites are slow for the same seven reasons. See real-world
  failures, the code behind each one, and the small fixes that prevent them.
  A 12-minute read.
---

A user taps your page on a mid-range phone. Three seconds of white screen. Then the layout jumps, the button they wanted moves, and they tap the wrong thing. They leave.

Google's own research found that the chance of a visitor leaving rises by about **32% when load time goes from 1 to 3 seconds**. Speed is a feature, and you lose users quietly when you ignore it.

The good news: frontend slowness is rarely mysterious. The same seven causes show up again and again. This guide walks through each one with a real failure story, the code, and the fix. Reading time: about 12 minutes.

---

## The big picture: where does the time go?

Before the causes, understand the journey. Every page goes through the same pipeline, and each cause below hurts one stage.

<figure>
<svg viewBox="0 0 680 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Browser pipeline: download, parse and execute JavaScript, render, then interact. Each stage can be slowed down by a different problem">
  <style>
    .t{font:700 13px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .r{font:600 11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#b91c1c;}
  </style>
  <rect x="1" y="16" width="148" height="76" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="14" y="42">1. Download</text>
  <text class="d" x="14" y="62">HTML, JS, CSS,</text>
  <text class="d" x="14" y="78">images, fonts</text>

  <rect x="177" y="16" width="148" height="76" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="190" y="42">2. Run JavaScript</text>
  <text class="d" x="190" y="62">Parse, compile,</text>
  <text class="d" x="190" y="78">execute</text>

  <rect x="353" y="16" width="148" height="76" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="366" y="42">3. Render</text>
  <text class="d" x="366" y="62">Layout, paint,</text>
  <text class="d" x="366" y="78">composite</text>

  <rect x="529" y="16" width="148" height="76" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="542" y="42">4. Interact</text>
  <text class="d" x="542" y="62">Click, scroll,</text>
  <text class="d" x="542" y="78">type, respond</text>

  <path d="M150 54 H176 M326 54 H352 M502 54 H528" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <polygon points="176,54 168,49 168,59" fill="#94a3b8"/>
  <polygon points="352,54 344,49 344,59" fill="#94a3b8"/>
  <polygon points="528,54 520,49 520,59" fill="#94a3b8"/>

  <text class="r" x="75" y="122" text-anchor="middle">Huge bundles</text>
  <text class="r" x="75" y="140" text-anchor="middle">Heavy images</text>
  <text class="r" x="75" y="158" text-anchor="middle">Blocking fonts</text>

  <text class="r" x="251" y="122" text-anchor="middle">Long tasks</text>
  <text class="r" x="251" y="140" text-anchor="middle">Too many scripts</text>

  <text class="r" x="427" y="122" text-anchor="middle">Layout shifts</text>
  <text class="r" x="427" y="140" text-anchor="middle">Forced reflows</text>

  <text class="r" x="603" y="122" text-anchor="middle">Re-render storms</text>
  <text class="r" x="603" y="140" text-anchor="middle">Janky handlers</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Slow pages are slow at one specific stage. Find the stage first.</figcaption>
</figure>

Google measures the result with three **Core Web Vitals**:

| Metric | Plain meaning | "Good" target |
|---|---|---|
| **LCP** (Largest Contentful Paint) | When the main content appears | under 2.5 s |
| **INP** (Interaction to Next Paint) | How fast the page reacts to a tap or click | under 200 ms |
| **CLS** (Cumulative Layout Shift) | How much the page jumps around | under 0.1 |

Keep these three in your head. Every cause below maps to one of them.

---

## Cause #1: shipping too much JavaScript

**Real-world failure.** A team built a product page with a charting library, a date library, and a utility library. Each was added with a simple `import`. Nobody checked the bundle. It grew to **2.4 MB**. On a fast office laptop it felt fine. On a budget Android phone over 4G, the page was blank for 6 seconds, and mobile conversions dropped.

JavaScript is the most expensive thing you ship. An image only needs to be downloaded and decoded, but JavaScript must be downloaded, **parsed, compiled, and executed**, all on the user's slow CPU.

**The bad code:**

```js
// Imports the ENTIRE library (~70 KB) just to use one function
import _ from "lodash";

const names = _.uniq(users.map((u) => u.name));
```

**The fix: import only what you use, and split code by route.**

```js
// Only the one function is bundled
import uniq from "lodash/uniq";

const names = uniq(users.map((u) => u.name));
```

```js
// React: load the heavy chart only when the user opens that page
import { lazy, Suspense } from "react";

const SalesChart = lazy(() => import("./SalesChart"));

export default function Dashboard() {
  return (
    <Suspense fallback={<p>Loading chart...</p>}>
      <SalesChart />
    </Suspense>
  );
}
```

<figure>
<svg viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Before code splitting a single 2.4 megabyte bundle loads on every page. After code splitting the home page loads only 180 kilobytes and the rest loads on demand">
  <style>
    .l{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .w{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#fff;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <text class="l" x="0" y="18">Before: one giant bundle for every page</text>
  <rect x="0" y="30" width="680" height="40" rx="8" fill="#ef4444"/>
  <text class="w" x="14" y="55">app.js  2.4 MB (home + charts + admin + editor)</text>

  <text class="l" x="0" y="112">After: split by route, load on demand</text>
  <rect x="0" y="124" width="52" height="40" rx="8" fill="#10b981"/>
  <rect x="60" y="124" width="150" height="40" rx="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-dasharray="4 3"/>
  <rect x="218" y="124" width="150" height="40" rx="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-dasharray="4 3"/>
  <rect x="376" y="124" width="150" height="40" rx="8" fill="#e2e8f0" stroke="#cbd5e1" stroke-dasharray="4 3"/>
  <text class="d" x="0" y="188">Green: 180 KB loaded now.   Grey: charts, admin, editor, fetched only when visited.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The fastest byte is the one you never send.</figcaption>
</figure>

**Prevent it:** set a **performance budget** (for example, "initial JS under 200 KB gzipped") and fail the build when it is exceeded. Use a bundle analyzer (`webpack-bundle-analyzer` or `vite-bundle-visualizer`) every few weeks.

---

## Cause #2: unoptimized images

**Real-world failure.** A marketing team uploaded a 4 MB hero photo straight from a designer. It was displayed at 400 px wide. The page's LCP was 7 seconds, because the biggest element on screen was also the biggest download.

Images are usually the **largest part of a page's weight**. The usual mistakes: wrong size, wrong format, and loading everything at once.

**The bad code:**

```html
<!-- 4000x3000 JPEG, shown at 400px, loaded even if far below the fold -->
<img src="/images/hero.jpg">
```

**The fix:**

```html
<img
  src="/images/hero-800.webp"
  srcset="/images/hero-400.webp 400w,
          /images/hero-800.webp 800w,
          /images/hero-1600.webp 1600w"
  sizes="(max-width: 600px) 100vw, 400px"
  width="800" height="600"
  alt="Team working at a whiteboard"
  fetchpriority="high"
>

<!-- Below the fold: let the browser wait -->
<img src="/images/team.webp" width="800" height="600"
     alt="Our team" loading="lazy" decoding="async">
```

Four habits to remember:

- Use **WebP or AVIF**. They are often 30 to 50% smaller than JPEG.
- Use `srcset` so phones do not download desktop-sized images.
- Add `loading="lazy"` to anything **below** the fold. Never to your main hero image.
- Always set `width` and `height`. This also fixes Cause #5.

---

## Cause #3: blocking the main thread

**Real-world failure.** An e-commerce site had a search box that filtered 20,000 products as you typed. Every keystroke ran a heavy loop. On a laptop it was fine. On a phone, typing felt like wading through mud, with each letter appearing a second late. That is a bad **INP** score.

The browser has **one main thread** that does everything: runs your JavaScript, handles clicks, and paints the screen. If your code runs for 300 ms, the page is frozen for 300 ms.

<figure>
<svg viewBox="0 0 680 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Main thread timeline: a long 300 millisecond task blocks the user's click, while splitting the work into small chunks lets the click run between chunks">
  <style>
    .l{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .w{font:700 11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#fff;}
    .d{font:12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <text class="l" x="0" y="16">One long task: the click waits</text>
  <rect x="0" y="26" width="480" height="36" rx="6" fill="#ef4444"/>
  <text class="w" x="12" y="49">Heavy filter loop (300 ms)</text>
  <rect x="480" y="26" width="60" height="36" rx="6" fill="#3b82f6"/>
  <text class="w" x="490" y="49">Click</text>

  <text class="l" x="0" y="106">Chunked work: the click runs in between</text>
  <rect x="0" y="116" width="90" height="36" rx="6" fill="#f59e0b"/>
  <rect x="94" y="116" width="60" height="36" rx="6" fill="#3b82f6"/>
  <text class="w" x="104" y="139">Click</text>
  <rect x="158" y="116" width="90" height="36" rx="6" fill="#f59e0b"/>
  <rect x="252" y="116" width="90" height="36" rx="6" fill="#f59e0b"/>
  <text class="d" x="360" y="139">Same total work, but the page stays responsive.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Anything over 50 ms is a "long task" the user can feel.</figcaption>
</figure>

**The bad code:**

```js
input.addEventListener("input", (e) => {
  // Runs on EVERY keystroke, blocks the thread
  const results = products.filter((p) =>
    expensiveMatch(p, e.target.value)
  );
  render(results);
});
```

**The fix: debounce the input, and move heavy work off the main thread.**

```js
function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

input.addEventListener(
  "input",
  debounce((e) => render(search(e.target.value)))
);
```

```js
// search.worker.js: heavy work runs in a Web Worker, not the UI thread
self.onmessage = ({ data: { query, products } }) => {
  self.postMessage(products.filter((p) => expensiveMatch(p, query)));
};

// main.js
const worker = new Worker("search.worker.js");
worker.postMessage({ query, products });
worker.onmessage = (e) => render(e.data);
```

---

## Cause #4: re-rendering too much

**Real-world failure.** A dashboard had a clock in the header that updated every second. The clock's state lived in the top-level component, so **every second the entire dashboard, with 500 table rows, re-rendered**. The laptop fan spun up and scrolling stuttered.

In frameworks like React, changing state re-renders that component **and all of its children**. If state lives too high, small changes cause huge work.

**The bad code:**

```jsx
function Dashboard() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <Clock time={now} />
      <HugeTable rows={rows} />   {/* re-renders every second! */}
    </>
  );
}
```

**The fix: keep state close to where it is used, and memoize expensive children.**

```jsx
function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{now.toLocaleTimeString()}</span>;
}

const HugeTable = memo(function HugeTable({ rows }) {
  return rows.map((r) => <Row key={r.id} row={r} />);
});

function Dashboard() {
  return (
    <>
      <Clock />          {/* only this re-renders each second */}
      <HugeTable rows={rows} />
    </>
  );
}
```

Also **virtualize long lists**. If you have 10,000 rows, render only the ~20 visible ones with a library like `react-window`. The DOM stays small, and a small DOM is a fast DOM.

> Tip: do not wrap everything in `memo`. Measure with the React DevTools Profiler first. Moving state down is usually the free win.

---

## Cause #5: layout shifts (the page that jumps)

**Real-world failure.** A news site loaded an ad banner after the article text. The banner pushed the text down just as readers were about to tap a link. They hit an ad instead, and angry support emails followed. This is a bad **CLS** score.

The browser does not know how big an image, ad, or embed will be until it loads, so it reserves no space. When content arrives, everything below it jumps.

<figure>
<svg viewBox="0 0 680 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Layout shift: without reserved space an image loads and pushes the paragraph down; with reserved space the paragraph stays still">
  <style>
    .l{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .d{font:11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .r{font:700 11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#b91c1c;}
    .g{font:700 11.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#15803d;}
  </style>
  <text class="l" x="0" y="16">Without reserved space</text>
  <rect x="0" y="26" width="300" height="190" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
  <rect x="16" y="40" width="268" height="14" rx="4" fill="#cbd5e1"/>
  <rect x="16" y="64" width="268" height="12" rx="4" fill="#e2e8f0"/>
  <rect x="16" y="82" width="200" height="12" rx="4" fill="#e2e8f0"/>
  <rect x="16" y="104" width="268" height="60" rx="6" fill="#fecaca" stroke="#f87171" stroke-dasharray="4 3"/>
  <text class="r" x="150" y="140" text-anchor="middle">Image pops in, pushes text</text>
  <rect x="16" y="176" width="268" height="12" rx="4" fill="#e2e8f0"/>
  <rect x="16" y="194" width="200" height="12" rx="4" fill="#e2e8f0"/>

  <text class="l" x="380" y="16">With width and height set</text>
  <rect x="380" y="26" width="300" height="190" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
  <rect x="396" y="40" width="268" height="14" rx="4" fill="#cbd5e1"/>
  <rect x="396" y="64" width="268" height="12" rx="4" fill="#e2e8f0"/>
  <rect x="396" y="82" width="200" height="12" rx="4" fill="#e2e8f0"/>
  <rect x="396" y="104" width="268" height="60" rx="6" fill="#bbf7d0" stroke="#4ade80" stroke-dasharray="4 3"/>
  <text class="g" x="530" y="140" text-anchor="middle">Space reserved. Nothing moves.</text>
  <rect x="396" y="176" width="268" height="12" rx="4" fill="#e2e8f0"/>
  <rect x="396" y="194" width="200" height="12" rx="4" fill="#e2e8f0"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Reserve the space before the content arrives.</figcaption>
</figure>

**The fix:**

```css
/* Reserve space for anything that loads late */
img, video { max-width: 100%; height: auto; }

.hero-img   { aspect-ratio: 4 / 3; }
.ad-slot    { min-height: 250px; }   /* the ad may load late, the space won't */
```

```html
<!-- Width and height let the browser compute the ratio before download -->
<img src="/a.webp" width="800" height="600" alt="...">
```

Fonts cause shifts too. Add `font-display: swap` and preload your main font so text does not jump when the web font arrives.

---

## Cause #6: too many (or too slow) network requests

**Real-world failure.** A landing page loaded 14 third-party scripts: analytics, two chat widgets, A/B testing, heatmaps, and more. One of them, a tag manager, had an outage. Because it was loaded as a **blocking** script in the `<head>`, the whole page waited for it and stayed blank for 10 seconds. A third-party problem became the team's outage.

Every request costs time, and any **render-blocking** resource delays the first paint.

**The bad code:**

```html
<head>
  <!-- Blocks HTML parsing until downloaded AND executed -->
  <script src="https://widgets.example.com/chat.js"></script>
  <link rel="stylesheet" href="/all-styles-for-every-page.css">
</head>
```

**The fix:**

```html
<head>
  <!-- Connect early to a critical origin -->
  <link rel="preconnect" href="https://cdn.example.com">

  <!-- Preload the one thing the first screen needs -->
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>

  <!-- defer: download in parallel, run after HTML is parsed -->
  <script src="/app.js" defer></script>

  <!-- async: for independent scripts like analytics -->
  <script src="https://analytics.example.com/a.js" async></script>
</head>
```

Prevention checklist for the network:

- **Cache aggressively.** Use hashed file names (`app.3f9a1c.js`) with `Cache-Control: max-age=31536000, immutable`.
- **Use a CDN** so files come from a server near the user.
- **Compress** with Brotli or gzip.
- **Audit third parties** every quarter. Ask of each one: "What does this cost in milliseconds, and is it worth it?"
- **Fetch data in parallel**, not one after another:

```js
// Slow: waterfall (each request waits for the previous one)
const user   = await fetchUser();
const orders = await fetchOrders();
const prefs  = await fetchPrefs();

// Fast: all three run at the same time
const [user, orders, prefs] = await Promise.all([
  fetchUser(),
  fetchOrders(),
  fetchPrefs(),
]);
```

---

## Cause #7: forced reflows and memory leaks

Two quieter killers that bite after the page has loaded.

**Forced reflow (layout thrashing).** Reading a layout value (like `offsetHeight`) right after changing a style forces the browser to recalculate layout immediately. Do it inside a loop and you do it hundreds of times.

```js
// Bad: read, write, read, write... forces layout on every iteration
items.forEach((el) => {
  el.style.width = box.offsetWidth / 2 + "px";   // read then write, repeated
});

// Good: read once, then write
const half = box.offsetWidth / 2;
items.forEach((el) => {
  el.style.width = half + "px";
});
```

**Memory leaks.** A single-page app that is left open all day slowly gets slower, then crashes the tab. The classic cause is a listener or timer that is never cleaned up.

```jsx
// Bad: the listener lives forever, even after the component is gone
useEffect(() => {
  window.addEventListener("resize", onResize);
}, []);

// Good: always return a cleanup function
useEffect(() => {
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);
```

> Rule of thumb: anything you **start** (listener, interval, subscription, observer), you must **stop**.

---

## How to find the problem (before guessing)

Do not optimize by gut feeling. Follow this order:

<figure>
<svg viewBox="0 0 680 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Debugging flow: run Lighthouse, check the Network tab, record a Performance profile, fix one issue, then re-measure">
  <style>
    .t{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="14" width="124" height="76" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="12" y="40">Lighthouse</text>
  <text class="d" x="12" y="60">Get a baseline</text>
  <text class="d" x="12" y="76">score and hints</text>

  <rect x="147" y="14" width="124" height="76" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="158" y="40">Network tab</text>
  <text class="d" x="158" y="60">Big files, slow</text>
  <text class="d" x="158" y="76">or blocking calls</text>

  <rect x="293" y="14" width="124" height="76" rx="10" fill="#fef2f2" stroke="#fecaca"/>
  <text class="t" x="304" y="40">Performance tab</text>
  <text class="d" x="304" y="60">Find long tasks</text>
  <text class="d" x="304" y="76">and re-renders</text>

  <rect x="439" y="14" width="124" height="76" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="450" y="40">Fix one thing</text>
  <text class="d" x="450" y="60">Biggest win</text>
  <text class="d" x="450" y="76">first</text>

  <rect x="585" y="14" width="94" height="76" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="596" y="40">Re-measure</text>
  <text class="d" x="596" y="60">Prove it</text>
  <text class="d" x="596" y="76">worked</text>

  <path d="M126 52 H146 M272 52 H292 M418 52 H438 M564 52 H584" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <polygon points="146,52 138,47 138,57" fill="#94a3b8"/>
  <polygon points="292,52 284,47 284,57" fill="#94a3b8"/>
  <polygon points="438,52 430,47 430,57" fill="#94a3b8"/>
  <polygon points="584,52 576,47 576,57" fill="#94a3b8"/>
  <text class="d" x="340" y="124" text-anchor="middle">Test on a throttled "Slow 4G" and a 4x CPU slowdown, not just your fast laptop.</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">Measure, find, fix one thing, measure again.</figcaption>
</figure>

Lighthouse and the browser DevTools are free and built in. Also track **real user data** (for example with the `web-vitals` library), because your laptop is not your customer's phone:

```js
import { onLCP, onINP, onCLS } from "web-vitals";

const send = (m) => navigator.sendBeacon("/analytics", JSON.stringify(m));
onLCP(send);
onINP(send);
onCLS(send);
```

---

## Prevention checklist (copy this into your PR template)

- [ ] Initial JavaScript is within budget; heavy routes are lazy-loaded.
- [ ] Images are resized, modern format, `lazy` below the fold, with `width` and `height`.
- [ ] No long tasks over 50 ms on user input; heavy work is debounced or in a worker.
- [ ] State lives as low as possible; long lists are virtualized.
- [ ] Space is reserved for images, ads, embeds, and fonts.
- [ ] Scripts use `defer` or `async`; third parties are audited.
- [ ] API calls run in parallel, not in a waterfall.
- [ ] Every listener, timer, and subscription is cleaned up.
- [ ] Lighthouse runs in CI and fails the build on regression.

---

## Key takeaways

1. **Slow pages are slow at a specific stage.** Download, run, render, or interact. Find which.
2. **JavaScript is the most expensive byte.** Send less, split the rest.
3. **Images are usually the heaviest asset.** Resize, compress, lazy-load.
4. **One main thread.** Keep tasks short, or move work to a worker.
5. **Keep state low** so a tiny change does not re-render the world.
6. **Reserve space** so the page does not jump.
7. **Be careful with third-party scripts.** Their outage becomes your outage.
8. **Measure on real devices**, set a budget, and let CI guard it.

You do not need a rewrite or a new framework to make a site fast. You need to measure, fix the biggest cause, and keep the habit. Start with one page this week: run Lighthouse, fix the top issue, and see the number move.

Thanks for reading. If this helped, share it with a teammate who just added "one more small library."
