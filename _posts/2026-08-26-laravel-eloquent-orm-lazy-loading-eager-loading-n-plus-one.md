---
title: "Eloquent ORM, Lazy Loading, and the N+1 Query Problem in Laravel"
category: Laravel
excerpt: >-
  The code that quietly fires a hundred database queries — and how understanding
  Eloquent's loading model turns a performance disaster into a two-query operation.
  A complete guide from ORM fundamentals to production-safe query patterns.
---

You write the feature. It looks clean. You test it locally on a handful of records, it responds in milliseconds, and you ship it. Then production traffic arrives, and your database starts screaming.

Here's the code in question:

```php
$users = User::all();

foreach ($users as $user) {
    echo $user->posts->count();
}
```

On your local machine with five test users, this is instant. In production with 1,000 users, it silently executes **1,001 database queries**. Your application slows to a crawl. Users wait. Servers buckle.

This is the N+1 query problem — one of the most common and most overlooked performance issues in Laravel applications. It's almost invisible until it bites you, because nothing in the code looks wrong. The ORM is doing exactly what you told it to. The problem is what you *didn't* tell it.

Understanding how to identify and fix N+1 problems — and developing the instinct to write efficient Eloquent code from the start — begins with understanding how your ORM actually works beneath the surface.

---

## What Is an ORM?

ORM stands for **Object-Relational Mapping**. It bridges the gap between the object-oriented world of your application code and the relational world of your database.

Without an ORM, every database interaction is raw SQL:

```sql
SELECT * FROM users WHERE id = 1;
SELECT * FROM posts WHERE user_id = 1;
```

Raw SQL is powerful and precise, but it requires you to parse result arrays, manually map columns to variables, handle SQL injection risks, and re-implement the same boilerplate across hundreds of queries.

An ORM translates between the two worlds. You work with objects; the ORM handles the SQL:

```php
$user = User::find(1);
echo $user->name;

foreach ($user->posts as $post) {
    echo $post->title;
}
```

### The Conceptual Mapping

```
Database Table   →   Model Class
Database Row     →   Model Instance (Object)
Table Column     →   Object Property
Foreign Key      →   Relationship Method
Result Set       →   Collection of Models
```

### Advantages of Using an ORM

- **Abstraction:** Write PHP instead of SQL; switch databases with minimal changes
- **Security:** Parameterized queries baked in — SQL injection is dramatically harder to introduce
- **Productivity:** Common operations (find, create, update, delete) are one-liners
- **Relationships:** Express related data as object relationships, not manual JOINs
- **Ecosystem:** Query scopes, casts, observers, events, and more

### The Trade-offs

ORMs can generate inefficient SQL if you don't understand what they're doing, load far more data than you need, and abstract away details that matter for performance. The discipline required is not less than raw SQL — it's different. Knowing your ORM's behavior is how you use it well.

### Eloquent: Laravel's ORM

Laravel ships with **Eloquent**, an expressive ORM built on the Active Record pattern. Each model represents a database table; model instances represent individual rows. Eloquent infers conventions (table name from class name, primary key as `id`, timestamps) so minimal configuration is required:

```php
class User extends Model
{
    // Maps to the `users` table by convention.
    // Eloquent assumes: primary key = `id`, timestamps = true.
}
```

---

## Understanding Eloquent Relationships

Relationships are where Eloquent gets both powerful and dangerous.

### hasMany

A user has many posts. The `posts` table has a `user_id` foreign key pointing back to the user.

```php
class User extends Model
{
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }
}
```

### belongsTo

The inverse: a post belongs to a user.

```php
class Post extends Model
{
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
```

### hasOne

```php
class User extends Model
{
    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
    }
}
```

### belongsToMany

Posts and tags share a many-to-many relationship via a pivot table.

```php
class Post extends Model
{
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }
}
```

### The Critical Question

Defining a relationship method creates a query builder — but doesn't run the query yet. When you write:

```php
$posts = $user->posts;
```

You're accessing the relationship as a *property* (no parentheses). This triggers Eloquent's magic `__get()` method, which detects the relationship method, runs the query, caches the result on the model, and returns it.

This deferred behavior — queries only running when accessed — is **Lazy Loading**. And it is both Eloquent's most convenient feature and the root of the N+1 problem.

---

## What Is Lazy Loading?

Lazy Loading means relationship queries are deferred until the moment you actually access the relationship.

```php
$user = User::find(1);
// Only one query has executed:
// SELECT * FROM users WHERE id = 1 LIMIT 1

$posts = $user->posts;
// NOW the second query runs:
// SELECT * FROM posts WHERE user_id = 1

$count = $user->posts->count();
// No additional query — result is cached on $user after the first access
```

**Approximate SQL generated:**

```sql
SELECT * FROM users WHERE id = 1 LIMIT 1;

SELECT * FROM posts WHERE user_id = 1;
```

After the first access, Eloquent caches the result on the model instance. Subsequent accesses to `$user->posts` return the cached collection — no additional query.

### When Lazy Loading Is the Right Tool

Lazy loading is perfectly appropriate in several situations:

- **Single model instances:** Loading one user and conditionally accessing their posts
- **Conditional access:** Only some code paths need the related data
- **Unknown access patterns:** A service method that may or may not use the relationship

```php
// Fine: single user, posts only loaded if the condition is met
$user = User::find(1);

if ($user->is_active) {
    displayPosts($user->posts); // Query runs here, once
} else {
    showInactiveMessage();       // No query at all
}
```

### When Lazy Loading Becomes Dangerous

The moment you loop over a *collection* of models and access a relationship on each one, lazy loading fires one query per model. That's N+1.

---

## What Is Eager Loading?

Eager Loading instructs Eloquent to load relationships *upfront*, as part of the initial query. Laravel's `with()` method enables this:

```php
$users = User::with('posts')->get();
```

Instead of waiting to see whether you'll access posts, Eloquent fires two queries immediately:

**Approximate SQL generated:**

```sql
-- Query 1: retrieve all users
SELECT * FROM users;

-- Query 2: retrieve ALL their posts in one round-trip
SELECT * FROM posts WHERE user_id IN (1, 2, 3, 4, 5, ...);
```

Eloquent collects user IDs from the first result, bundles them into a single `WHERE user_id IN (...)` clause, then distributes posts back to their matching users in PHP memory.

When your loop accesses `$user->posts`, there's nothing to query — the data is already in memory:

```php
$users = User::with('posts')->get();

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        // No database query — $user->posts is already loaded
        echo $post->title;
    }
}
```

Two queries total — regardless of whether you have 10 users or 10,000.

> **The key shift:** With eager loading, the loop iterates over in-memory data. With lazy loading inside a loop, the loop drives database queries. That single distinction explains everything.

---

## Lazy Loading vs Eager Loading

| Dimension | Lazy Loading | Eager Loading |
|-----------|-------------|---------------|
| When query runs | On first property access | At query time, before access |
| Query count (collection) | 1 + N (one per model) | 1 + 1 (flat, regardless of N) |
| Syntax | `$user->posts` | `User::with('posts')->get()` |
| Performance in loops | Degrades linearly with N | Constant — N doesn't matter |
| Memory usage | Lower if relationship unused | Higher upfront; all data loaded |
| Best for | Single model, conditional access | Collections with known related data |
| N+1 risk | High (inside loops) | None for the eager-loaded relation |
| Wasted data risk | Low — only loads on access | Higher — loads even if unused |

Neither strategy is universally superior. The right choice depends on your access pattern.

---

## The N+1 Query Problem

This is the section that matters most.

### The Problem, Made Explicit

```php
$users = User::all();  // Query 1: SELECT * FROM users

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        // Query per user: SELECT * FROM posts WHERE user_id = ?
        // This fires ONCE for each $user in the outer loop
        echo $post->title;
    }
}
```

Each time PHP evaluates `$user->posts` inside the loop, Eloquent checks: "Have I loaded this relationship?" The answer is no — each `$user` is a fresh model instance with no cached relationship data. So Eloquent fires a query. One per user. Every iteration.

**What the database actually sees:**

```sql
-- The first query
SELECT * FROM users;

-- Then one query per user...
SELECT * FROM posts WHERE user_id = 1;
SELECT * FROM posts WHERE user_id = 2;
SELECT * FROM posts WHERE user_id = 3;
-- ...and so on, for every user in the table
```

**The math:**

```
1 query  → retrieve users
N queries → retrieve posts for each user

Total = N + 1 queries

With 100 users:   101 queries
With 1,000 users: 1,001 queries
With eager loading: 2 queries, always
```

### Why This Destroys Performance

Each database query carries overhead that doesn't disappear because the query is simple:

- **Network round-trip:** Each query travels from PHP to the database server and back
- **Connection overhead:** Each query requires parsing, planning, and execution
- **Concurrency:** Under load, multiple requests each doing 101 queries compete for database connections — a pool that handles 100 concurrent simple-query requests can collapse under 100 concurrent 101-query requests

A single `WHERE user_id IN (1, 2, ... 100)` query returns the same data as 100 individual queries — in a fraction of the time, using one round-trip, one parse, one plan.

> **The invisible danger:** N+1 problems are silent in development. With 3 test users, you're running 4 queries instead of 2 — the difference is imperceptible. In production with 500 users per page, you're running 501 queries instead of 2. The first time you notice is when the monitoring alerts fire.

---

## Solving N+1 with Eager Loading

The fix is one method call:

```php
// Before (N+1 problem):
$users = User::all();

// After (eager loading):
$users = User::with('posts')->get();
```

The loop code is identical — but Eloquent now has all the posts in memory before the loop begins:

```php
$users = User::with('posts')->get();

foreach ($users as $user) {
    foreach ($user->posts as $post) {
        // No database query — data already loaded
        echo $post->title;
    }
}
```

**What Eloquent does internally:**

1. Executes `SELECT * FROM users` and collects all user IDs
2. Executes `SELECT * FROM posts WHERE user_id IN (1, 2, 3, ...)`
3. Groups the posts by `user_id` in PHP memory
4. Sets the grouped posts as the cached relationship on each `User` model

### Eager Loading an Already-Fetched Collection

If you've already retrieved a collection without eager loading, `loadMissing()` loads relationships afterward without re-querying models that already have the data:

```php
$users = User::all();  // Already fetched

$users->loadMissing('posts');  // Two queries — no extra work for already-loaded models
```

---

## Nested Relationships

Real applications have deeper relationship trees. Accessing nested relationships lazily creates nested N+1 problems.

```php
// PROBLEM: 1 + N + N*M queries
$users = User::all();

foreach ($users as $user) {
    foreach ($user->posts as $post) {          // N queries
        foreach ($post->comments as $comment) { // N*M queries
            echo $comment->body;
        }
    }
}
```

With 100 users and 10 posts each: 1 + 100 + 1,000 = **1,101 queries**.

Eager loading handles nested relationships with dot notation:

```php
// Three queries total — flat, regardless of depth
$users = User::with('posts.comments')->get();
```

You can eager load multiple relationships, including mixes of flat and nested:

```php
$users = User::with([
    'posts.comments',
    'posts.tags',
    'profile',
])->get();
```

Eloquent is smart enough to load `posts` only once even when both `posts.comments` and `posts.tags` are specified.

---

## Conditional Eager Loading

Pass a closure to constrain the eager-loaded query:

```php
$users = User::with([
    'posts' => function ($query) {
        $query->where('published', true)
              ->orderBy('created_at', 'desc');
    },
])->get();
```

Modern Laravel supports arrow function syntax:

```php
$users = User::with([
    'posts' => fn($query) => $query->where('published', true),
])->get();
```

> **Important:** This constraint applies only to the eager-loaded result. If you later access a user's unpublished posts, they won't be in the already-loaded collection. This is expected behavior — but know that the constraint affects what's in memory, not what's in the database.

### withCount — Aggregates Without Loading

A common pattern is needing a count of related records without loading the records themselves:

```php
$users = User::withCount('posts')->get();

foreach ($users as $user) {
    echo $user->posts_count; // Integer attribute — no collection loaded
}
```

`withCount()` adds a `posts_count` attribute via a subquery. Similarly, `withSum()`, `withAvg()`, and `withMax()` handle aggregates without loading full related collections.

---

## Selecting Only Required Columns

Eager loading all columns is wasteful when you need only a subset:

```php
$users = User::with('posts:id,user_id,title,created_at')->get();
```

> **Always include the foreign key.** When selecting specific columns on an eager-loaded relationship, you **must** include the foreign key (`user_id` here). Without it, Eloquent cannot map posts back to their parent users, and `$user->posts` will return empty collections — silently, with no error.

Column selection on the parent model:

```php
$users = User::select('id', 'name', 'email')
    ->with('posts:id,user_id,title')
    ->get();
```

If your `posts` table stores full article bodies and you only need titles for a list view, not selecting the `content` column meaningfully reduces both query time and PHP memory consumption. This compounds across large result sets.

---

## Detecting N+1 Problems

### Laravel Debugbar

Install `barryvdh/laravel-debugbar` in development. It displays every query that ran for each request — count, duration, SQL, and the PHP call stack that triggered it.

```bash
composer require barryvdh/laravel-debugbar --dev
```

When a page you expect to run in 5 queries is actually running 50, the debugbar shows you exactly what fired and from where.

### Laravel Telescope

Laravel's first-party debugging assistant records requests, queries, jobs, cache operations, and more in a persistent UI.

```bash
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

### DB::listen() — Quick In-Code Debugging

```php
use Illuminate\Support\Facades\DB;

DB::listen(function ($query) {
    logger($query->sql, [
        'bindings' => $query->bindings,
        'time_ms'  => $query->time,
    ]);
});
```

Drop this in a service provider temporarily. Every query appears in your log with SQL, bindings, and execution time — repeated patterns like `SELECT * FROM posts WHERE user_id = ?` firing dozens of times are immediately visible.

### DB::getQueryLog() — Inline Inspection

```php
DB::enableQueryLog();

// ...code under investigation...
$users = User::all();
foreach ($users as $user) { $user->posts->count(); }

$log = DB::getQueryLog();
dd(count($log), $log); // How many queries? What did they say?
```

---

## Preventing Lazy Loading

Laravel can throw an exception whenever a relationship is lazily loaded — turning accidental lazy loading from a silent performance problem into an immediate, visible error during development.

```php
// In AppServiceProvider::boot()
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::preventLazyLoading(! app()->isProduction());
}
```

The `! app()->isProduction()` guard is important. In development and testing, lazy loading throws a `LazyLoadingViolationException`:

```
Attempted to lazy load [posts] on model [App\Models\User]
but lazy loading is disabled.
```

In production, the guard disables the prevention — so if a lazy load sneaks through, it degrades performance silently rather than crashing for users.

`Model::preventLazyLoading()` is particularly valuable when onboarding new developers, refactoring controller logic, or running test suites where datasets are too small to reveal the performance problem naturally.

---

## Common Eloquent Performance Mistakes

### 1. Loading relationships inside loops

```php
// WRONG: query per iteration
foreach ($users as $user) {
    $count = $user->posts->count(); // N queries
}

// BETTER: use withCount()
$users = User::withCount('posts')->get();
foreach ($users as $user) {
    $count = $user->posts_count; // In-memory attribute
}
```

### 2. Confusing the relationship property and method

`$user->posts` returns the cached collection (or lazy-loads once and caches). `$user->posts()` returns a new query builder — it always queries, never uses the cache.

```php
// WRONG: re-querying every time
if ($user->posts()->count() > 0) { // New query
    show($user->posts()->get());    // Another new query
}

// BETTER: access the property
if ($user->posts->count() > 0) { // Lazy-loads once
    show($user->posts);            // Uses cached collection
}
```

### 3. Eager loading relationships you don't use

Every relationship you add to `with()` is a query. Load only what your current request actually needs.

```php
// WRONG: loading five relationships, using one
$users = User::with(['posts', 'comments', 'roles', 'permissions', 'profile'])->get();
// ...then only using $user->name in the template
```

### 4. Forgetting pagination

`->get()` fetches every matching row into PHP memory. Paginate by default; `->get()` should be a deliberate choice, not a habit.

```php
// WRONG: loading all users — no limit
$users = User::with('posts')->get();

// BETTER: paginate
$users = User::with('posts')->paginate(25);
```

### 5. Ignoring database indexes

Eager loading with `WHERE user_id IN (...)` is fast only if `user_id` is indexed. Eloquent generates good queries; your schema must support them.

```php
// In your migration:
$table->foreignId('user_id')->constrained(); // Creates index automatically
```

### 6. Assuming the ORM optimizes queries for you

Eloquent helps you write queries. It doesn't optimize them. Understanding the SQL your code generates — and verifying it through logging or Debugbar — is your responsibility.

---

## Eager Loading Does Not Mean "Load Everything"

A common overreaction to learning about N+1 problems is adding `with()` to every query as a defensive habit. This creates different performance problems: loading megabytes of data you never use, inflating PHP memory, and adding unnecessary queries to requests that don't need them.

The guiding question is simple:

> **"Will I access this relationship for every item in this collection?"**
> If yes — eager load it. If no, or if you're not sure, lazy loading is fine. Measure; don't guess.

**When Lazy Loading is appropriate:**
- Working with a single model instance, not a collection
- The relationship is accessed conditionally — only in some code paths
- You're in a service where callers decide what to do with the model

**When Eager Loading is the right choice:**
- Rendering a list where every item displays related data
- Building an API endpoint that serializes models with their relationships
- Processing a collection in a job or command where all records use the related data

---

## Real-World Example: Optimizing an API Endpoint

Let's build a `GET /api/users` endpoint that returns users with their posts and each post's comment count.

### The Naive Implementation

```php
// Potentially 1,001+ queries
public function index(): JsonResponse
{
    $users = User::all(); // No limit — loads every user

    return response()->json(
        $users->map(function ($user) {
            return [
                'id'         => $user->id,
                'name'       => $user->name,
                'post_count' => $user->posts->count(), // Lazy: N queries
                'posts'      => $user->posts->map(function ($post) {
                    return [
                        'title'         => $post->title,
                        'comment_count' => $post->comments->count(), // N*M queries
                    ];
                }),
            ];
        })
    );
}
```

With 100 users and 10 posts each: 1 + 100 + 1,000 = **1,101 queries** per request.

### The Optimized Implementation

```php
// ~3-4 queries per request, regardless of database size
public function index(Request $request): JsonResponse
{
    $users = User::select('id', 'name', 'email')      // Only needed columns
        ->withCount('posts')                            // Subquery, no collection loaded
        ->with([
            'posts:id,user_id,title',                  // Eager + column selection
            'posts.comments:id,post_id',               // Nested eager, only IDs needed
        ])
        ->paginate(25);                                 // Cap result set

    return response()->json([
        'data' => $users->map(function ($user) {
            return [
                'id'         => $user->id,
                'name'       => $user->name,
                'post_count' => $user->posts_count,    // From withCount()
                'posts'      => $user->posts->map(function ($post) {
                    return [
                        'title'         => $post->title,
                        'comment_count' => $post->comments->count(), // In-memory
                    ];
                }),
            ];
        }),
        'meta' => [
            'total'        => $users->total(),
            'current_page' => $users->currentPage(),
            'per_page'     => $users->perPage(),
        ],
    ]);
}
```

| Change | Why |
|--------|-----|
| `select('id', 'name', 'email')` | Don't load columns you don't serialize |
| `withCount('posts')` | Gets post count via subquery; no collection in memory |
| `with(['posts:id,user_id,title'])` | Eager loads posts with only needed columns |
| `'posts.comments:id,post_id'` | Eager loads comments; `count()` in the map uses in-memory data |
| `paginate(25)` | Caps the result set; prevents loading unbounded data |

---

## Performance Thinking: Queries vs Data

Here is a nuance that experienced developers understand and beginners often miss: **fewer queries is not automatically faster**.

Database performance is the result of several factors working together:

| Factor | Description |
|--------|-------------|
| Number of queries | Round-trips to the database; each carries overhead |
| Amount of data | Rows × columns × row size = bytes on the wire and in memory |
| Query complexity | Joins, subqueries, sorting, and aggregates have planning costs |
| Index effectiveness | A table scan defeats a fast eager-loading query |
| Memory pressure | Loading 10,000 model instances into PHP consumes real RAM |
| Database concurrency | Many concurrent queries compete for connection pools |

The goal is not to minimize query count. The goal is to minimize the *total cost* of retrieving the data your application actually needs.

**Practical heuristics:**

- **Collection with related data needed for all items:** Eager load — always
- **Single-item detail pages:** Eager load the relationships your view renders; skip the rest
- **Aggregate data:** Use `withCount()`, `withSum()`, or subqueries — don't load collections just to count them
- **Conditional data:** Consider lazy loading or AJAX load-on-demand
- **Large result sets:** Always paginate — an unconstrained `->get()` on a table that might grow to a million rows is a time bomb

---

## Best Practices Checklist

- **Understand when relationships are loaded.** Know the difference between lazy loading (default) and eager loading (`with()`), and which one your code is using
- **Watch for relationship access inside loops.** Every `$model->relationship` inside a `foreach` is a potential N+1
- **Eager load when you know the data is needed.** If you'll access a relationship for every item in a collection, load it upfront
- **Don't eager load what you won't use.** Every relationship in `with()` is a query — only load what your request actually needs
- **Select only required columns.** Use `select()` and the `relationship:col1,col2` syntax to avoid loading unused data
- **Paginate result sets.** Never call `->get()` on a query that could return an unbounded number of rows
- **Use `withCount()` for aggregates.** Don't load full collections just to call `->count()` on them
- **Monitor generated queries in development.** Use Laravel Debugbar or Telescope to verify your code generates the queries you expect
- **Enable `Model::preventLazyLoading()` in development.** Let Laravel surface accidental lazy loading as an exception, not a silent drain
- **Index your foreign keys.** Eager loading is only fast if `WHERE user_id IN (...)` can use an index
- **Measure, don't guess.** Profile your queries in production. Intuition is a starting point; data is the answer

---

## Conclusion

Eloquent is one of the most developer-friendly ORMs in any language. Its expressive API makes database interaction feel natural — and that naturalness is exactly what makes the N+1 problem so dangerous. The code that causes it *looks* right. The ORM does exactly what you asked. The problem is invisible until the moment it isn't.

Understanding Lazy Loading and Eager Loading is not an advanced topic reserved for senior developers. It is the fundamental knowledge you need to write Eloquent code that works in production, not just in development. Every developer who touches an Eloquent model in a loop should understand what that loop is asking the database to do.

The progression from `User::all()` to `User::with('posts.comments')->paginate(25)` is not just about adding method calls. It reflects a mental model of your ORM: what it loads, when it loads, what it asks the database to do, and what the database pays for each request. That mental model is the difference between code that performs elegantly at scale and code that quietly buries your infrastructure under a thousand unnecessary queries.

Eloquent gives you the tools. Use them deliberately.
