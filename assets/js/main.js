(() => {
  // Mobile nav toggle
  const burger = document.querySelector(".head-burger");
  const nav = document.getElementById("primary-navigation");
  if (burger && nav) {
    burger.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", String(isOpen));
      burger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        burger.setAttribute("aria-expanded", "false");
        burger.focus();
      }
    });
  }

  // Back-to-top + reading progress
  const topBtn = document.getElementById("back-to-top");
  const progress = document.getElementById("reading-progress");
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    if (topBtn) topBtn.hidden = y < 500;
    if (progress) {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (total > 0 ? Math.min(100, (y / total) * 100) : 0) + "%";
    }
    ticking = false;
  };
  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  };
  window.addEventListener("scroll", requestTick, { passive: true });
  onScroll();

  topBtn?.addEventListener("click", () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  });

  // Share links (blog posts)
  document.querySelectorAll("[data-share]").forEach((el) => {
    const url = window.location.href;
    const title = document.title;
    const kind = el.getAttribute("data-share");
    const links = {
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    };
    if (kind === "copy") {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(url);
          const label = el.querySelector(".share-label") || el;
          const original = label.textContent;
          label.textContent = "Copied!";
          window.setTimeout(() => (label.textContent = original), 1800);
        } catch {
          /* clipboard unavailable — ignore */
        }
      });
    } else if (links[kind]) {
      el.href = links[kind];
      el.target = "_blank";
      el.rel = "noopener";
    }
  });

  // Auto target=_blank for external links
  const currentOrigin = window.location.origin;
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.target || link.hasAttribute("data-share")) return;
    let url;
    try {
      url = new URL(link.getAttribute("href"), window.location.href);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol) || url.origin === currentOrigin) return;
    link.target = "_blank";
    link.setAttribute("rel", [link.rel, "noopener"].filter(Boolean).join(" "));
  });
})();
