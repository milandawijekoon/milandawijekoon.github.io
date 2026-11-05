---
layout: page
title: Senior Software Engineer | Tech Lead
short_title: About Milanda Wijekoon
permalink: /about/
eyebrow: About
description: About Milanda Wijekoon, Senior Software Engineer specialising in software architecture, full-stack development, and technical leadership.
---

I'm a Senior Software Engineer based in Colombo, Sri Lanka, with 6+ years of experience building SaaS and fintech platforms. Most of that time has been at OpusXenta (Byond), where I joined as a software engineer in 2020, grew into a senior role and team lead, and contributed to a suite of platforms for the death-care industry along with the payment systems behind them.

My core stack is PHP/Laravel, Vue.js and Node.js on AWS. Beyond writing code, I contribute to architecture decisions, lead delivery and releases, mentor engineers, and troubleshoot complex production issues.

## What I've worked on

- Helped integrate multiple payment gateways, including Payrix, Windcave, Square, Till and Linkly, into OpusPay, a unified payment middleware with real-time transaction processing and per-client gateway configuration that needs no code changes.
- Contributed to fintech solutions covering web, ACH and terminal payments, and helped implement secure QR payment flows across the company's platforms.
- Integrated Avalara tax compliance software, working directly with support teams to resolve integration issues and meet business requirements.
- Core developer in migrating a legacy Laravel application to the latest release. I resolved upgrade issues and stabilised the systems.
- Fine-tuned the Docker setup for Laravel and Vue.js services, and helped stabilise and optimise performance after the move from a monolithic container to a multi-container architecture.
- Served as team lead for Byond Market, a no-code marketplace builder, coordinating delivery, release management and production deployments.
- Contributed to Omnea, a UK marketplace for finding funeral directors and cemeteries, and to a shared UI component library that keeps design consistent across company products.
- Worked as a core member of the SaaS and fintech engineering teams, contributing to architecture decisions across the company's death-care platform suite and payment systems.
- Helped resolve security vulnerabilities identified through penetration testing.
- Contributed to replacing legacy Sage CRM functionality with new cemetery mapping and plot and inventory management features.
- Earlier in my career, built and tested backend services for Avanti, a leading UK travel insurance application (Spring Boot, Hibernate, MySQL), and wrote and tested SQL scripts for a large database migration.

## How I work

I care about systems that are predictable, well-instrumented, and easy for the next engineer to understand and extend. In practice that means careful code review, disciplined release management and mentoring, so teams ship with confidence. I also use AI-assisted tools such as Claude Code and GitHub Copilot to move faster on repetitive work, while keeping the same quality bar on everything that ships.

## Career & Education

<ol class="timeline">
{% for job in site.data.experience %}
  <li class="timeline-item">
    <span class="timeline-period">{{ job.period }}</span>
    <h3 class="timeline-role">{{ job.role }}</h3>
    <p class="timeline-company">{{ job.company }}</p>
  </li>
{% endfor %}
</ol>

<h2 id="badges-certificates">Badges &amp; Certificates</h2>

<div class="badge-grid">
  <a class="badge-card" href="https://academy.claude.com/verify/8114a29bb79f6dd098538da4197237f7" target="_blank" rel="noopener">
    <picture>
      <source type="image/webp" srcset="{{ '/assets/images/badge-claude-101-440.webp' | relative_url }} 440w, {{ '/assets/images/badge-claude-101-880.webp' | relative_url }} 880w" sizes="(max-width:767px) 45vw, 220px">
      <img src="{{ '/assets/images/badge-claude-101-440.jpg' | relative_url }}" srcset="{{ '/assets/images/badge-claude-101-440.jpg' | relative_url }} 440w, {{ '/assets/images/badge-claude-101-880.jpg' | relative_url }} 880w" sizes="(max-width:767px) 45vw, 220px" alt="Claude 101 course completion badge from Claude Academy" class="badge-image" width="440" height="300" loading="lazy" decoding="async">
    </picture>
    <span class="badge-meta">
      <span class="badge-title">Claude 101</span>
      <span class="badge-issuer">Claude Academy &middot; October 2026</span>
      <span class="badge-verify">Verify badge &rarr;</span>
    </span>
  </a>
  <a class="badge-card" href="https://academy.claude.com/verify/e1249aeabaf347ab41ed31367358b1a6" target="_blank" rel="noopener">
    <picture>
      <source type="image/webp" srcset="{{ '/assets/images/badge-claude-code-101-440.webp' | relative_url }} 440w, {{ '/assets/images/badge-claude-code-101-880.webp' | relative_url }} 880w" sizes="(max-width:767px) 45vw, 220px">
      <img src="{{ '/assets/images/badge-claude-code-101-440.jpg' | relative_url }}" srcset="{{ '/assets/images/badge-claude-code-101-440.jpg' | relative_url }} 440w, {{ '/assets/images/badge-claude-code-101-880.jpg' | relative_url }} 880w" sizes="(max-width:767px) 45vw, 220px" alt="Claude Code 101 course completion badge from Claude Academy" class="badge-image" width="440" height="300" loading="lazy" decoding="async">
    </picture>
    <span class="badge-meta">
      <span class="badge-title">Claude Code 101</span>
      <span class="badge-issuer">Claude Academy &middot; October 2026</span>
      <span class="badge-verify">Verify badge &rarr;</span>
    </span>
  </a>
  <a class="badge-card" href="https://www.hackerrank.com/profile/milanda_wijekoon" target="_blank" rel="noopener">
    <span class="badge-placeholder badge-logo">
      <img src="{{ '/assets/images/hackerrank.svg' | relative_url }}" alt="HackerRank" width="722" height="77" loading="lazy" decoding="async">
    </span>
    <span class="badge-meta">
      <span class="badge-title">Coding profile</span>
      <span class="badge-issuer">@milanda_wijekoon</span>
      <span class="badge-verify">View profile &rarr;</span>
    </span>
  </a>
</div>

<h2 id="toolkit">Core stack</h2>

<ul class="toolkit">
  <li><span class="stack-tag">PHP</span></li>
  <li><span class="stack-tag">Laravel</span></li>
  <li><span class="stack-tag">JavaScript</span></li>
  <li><span class="stack-tag">TypeScript</span></li>
  <li><span class="stack-tag">Node.js</span></li>
  <li><span class="stack-tag">Nest.js</span></li>
  <li><span class="stack-tag">Vue.js</span></li>
  <li><span class="stack-tag">Python</span></li>
  <li><span class="stack-tag">Docker</span></li>
  <li><span class="stack-tag">AWS</span></li>
  <li><span class="stack-tag">SQL</span></li>
  <li><span class="stack-tag">MongoDB</span></li>
  <li><span class="stack-tag">AI &amp; LLM Tools</span></li>
</ul>
