---
title: Lessons from Migrating Laravel 5.7 to Laravel 10
category: Engineering
excerpt: >-
  What actually breaks when you jump five major versions in production, and
  the order of operations that kept the lights on.
---

Jumping five major Laravel versions on a live platform is less about the framework upgrade itself and more about everything that quietly depended on it.

## Start with the dependency graph, not the framework

Before touching `composer.json`, we mapped every package with a hard version ceiling. Several third-party packages hadn't been touched in years, which meant some functionality needed to be rebuilt in-house rather than upgraded.

## Stage the migration in slices

Rather than one big-bang upgrade, we moved through intermediate LTS versions, running the full test suite and a manual smoke test at each stop. It took longer calendar time, but every stage was independently revertible.

## Docker as a safety net

Running the old and new stacks in parallel containers let us diff behavior on real production data before cutting over traffic — catching several subtle query-builder behavior changes we wouldn't have found in code review alone.

## What we'd do differently

Automated test coverage on the legacy app was thinner than we realized until the migration started. Investing in characterization tests before the first line of the upgrade would have caught issues earlier and with more confidence.
