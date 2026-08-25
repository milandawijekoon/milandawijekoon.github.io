# Milanda Wijekoon — Jekyll Site

A Jekyll rebuild of the portfolio site, matching the layout/behavior pattern of
yoosuf.me: sticky header, availability-pill hero, card-feed sections, and
full blog posts with reading progress + share links.

## Structure

```
_config.yml       Site settings, permalinks, plugins
_data/nav.yml      Header navigation
_data/services.yml Services shown on Home + Services page
_data/process.yml  "How we'd work together" steps
_layouts/          default, home, page, blog, post
_includes/         header, footer, icon, reading_time
_posts/            Blog posts (Markdown, one file per post)
assets/css/main.css
assets/js/main.js
index.html         Home
services.html       Services page
about.md            About page (Markdown)
contact.html         Contact page
blog/index.html      Blog listing
```

## Run locally

Requires Ruby (3.x recommended) and Bundler.

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000

## Add a new blog post

Create a new file in `_posts/` named `YYYY-MM-DD-your-slug.md`:

```markdown
---
title: Your Post Title
category: Engineering
excerpt: A one-sentence summary shown on the blog index and post header.
---

Your post content in Markdown goes here.
```

It will automatically appear on the Home page (latest 3) and the Blog index,
sorted newest first.

## Deploy

This is a stock Jekyll site, so it deploys directly to:
- **GitHub Pages** — push to a repo, enable Pages, done (uses the `github-pages` gem set if you swap the Gemfile for it).
- **Netlify / Vercel / Cloudflare Pages** — build command `bundle exec jekyll build`, publish directory `_site`.

## Note

This project was generated in a sandboxed environment without access to
rubygems.org, so it hasn't been run through `bundle install` / `jekyll build`
here — please run it locally to verify before deploying. The structure
follows standard Jekyll conventions throughout, so it should build cleanly.
