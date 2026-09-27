---
name: explain
description: Explain any concept using the Feynman Technique with progressive depth. Start with simple definitions, real-world analogies, and concrete examples. Then offer deeper dives into architecture and advanced topics. Use when a user asks "what is", "explain", "teach me", or wants to understand something deeply with fresh perspectives and mental models.
---

# Explain Skill

Break down any complex topic into digestible layers, from simple definitions to advanced architecture.


## How This Works

When you explain something, follow this depth-first approach:

### Layer 1: Foundation (Always Start Here)

1. **Simple Definition**
   - Explain as if teaching a carpenter, child, or someone with zero background
   - One sentence that captures the essence
   - No jargon, no hand-waving
   - Example: "A cache is like keeping your favorite tools on your workbench instead of in the storage shed—faster to grab, but limited space"

2. **Why It Exists & Where It's Used**
   - Real problem it solves
   - Where you encounter it in the real world
   - Why anyone should care
   - Example: "Used in every app you use. Without caches, every Google search would take 50x longer"

3. **Concrete Real-Life Analogy**
   - Extend the simple definition with a relatable scenario
   - Should resonate even with non-technical people
   - Build mental model bridge from familiar to technical
   - Example: "Like a restaurant: kitchen (storage) is far away, but they keep popular dishes in the warming station (cache) for fast service"

4. **Practical Examples**
   - 1-2 real examples from different domains
   - Show how it works in practice
   - Include a code snippet if technical (but keep it simple)
   - Example: Browser cache, CPU cache, Redis in microservices

### Layer 2: Ask the User

After Layer 1, always ask:

```
Want to go deeper? I can explain:
1. **Architecture & How It Works** — Internals, design tradeoffs, when it breaks
2. **Advanced Patterns** — Real production implementations, optimization techniques
3. **Both** — Full deep dive from basics to expert level
4. **Neither, I'm good** — Keep it at this level
```

### Layer 3: Deep Dive (Only if Requested)

If user asks for architecture/advanced:
Before implementing, ask me questions about the requirements, edge cases, and constraints I should consider.

1. **How It Actually Works**
   - Technical mechanism (use the AGENTS.md approach)
   - Data structures, algorithms, key decisions
   - Complexity analysis if relevant
   - Example: "LRU Cache uses HashMap (O(1) lookup) + LinkedList (O(1) eviction). When full, removes least recently used item"

2. **Design Tradeoffs**
   - What this approach wins on (latency? cost? memory?)
   - What it loses on
   - Real numbers when possible (P50/P99, throughput)
   - Example: "Redis cache: 1ms hit vs 50ms DB query. Memory cost: $50/GB. Typical hit rate: 80%"

3. **Production Reality**
   - How it fails in the real world
   - Operational complexity
   - Lessons from Google/Meta/Netflix/Uber
   - Example: "Netflix learned: cache misses at midnight during popular show release cause 2x traffic spike"

4. **Fresh Perspective**
   - Unconventional angle even experts miss
   - Tradeoff no one talks about
   - Mental model that clicks differently
   - Example: "Most people think caches are about speed. Actually they're about managing the cost of coordination between layers"

5. **Follow-up Questions**
   - Ask 2-3 questions to deepen understanding
   - Probe gaps in their mental model
   - Guide next learning steps
   - Example: "Now that you know how caches work, what happens when you have 100 servers all caching different data? How do they stay in sync?"

## Instructions for Codex

When a user asks you to explain something:

1. **Identify the concept** they're asking about
2. **Start with Layer 1 immediately**
   - Don't ask what they know
   - Jump straight to simple definition + analogy + example
   - Keep it to 2-3 paragraphs
3. **Present the question** (Layer 2 decision point)
4. **If they choose deeper**: Go to Layer 3 with architecture, tradeoffs, production reality
5. **Always end with follow-up questions** to guide their next learning step

## Constraints

- **No hand-waving**: Every claim backed by analogy, example, or real-world case
- **80-20 focus**: Explain what matters most first. Save edge cases for follow-up
- **No corporate jargon**: Cut "leverage", "optimize", "operationalize", "synergize"
- **Tradeoffs explicit**: Always show the cost (latency, memory, complexity, operational burden)
- **Real numbers**: P50/P99 latency, throughput, cost—not guesses

## Examples

### Example 1: What is a Cache?

**Simple Definition:**
"A cache is like keeping your favorite tools on your workbench instead of in the storage shed—faster to grab, but limited space."

**Why & Where:**
"Every app you use has caches. Without them, loading a webpage would take 50x longer. Your browser caches images, Reddit caches hot posts in memory, your CPU caches frequently used data."

**Analogy:**
"Restaurant kitchen analogy: Head chef keeps popular dishes in the warming station (cache) instead of making them from scratch. Cold prep (storage) is slow but unlimited. Warming station is fast but limited."

**Example:**
"Browser cache stores images/CSS so you don't re-download them. Hit: instant (1ms). Miss: 200ms from server. Typical hit rate on news sites: 70-80%."

**[Then ask Layer 2 question]**

**[If user says "architecture"]:**

"How caches actually work: HashMap (O(1) lookup) + LinkedList (O(1) eviction). When you request data: 1) Check HashMap—hit? Return instantly. 2) Miss? Fetch from storage, add to cache, remove oldest item if full.

Trade-offs: Memory is expensive ($50/GB cloud). Hit rate depends on pattern (temporal locality = recently used will be reused). Netflix: 80% hit rate saves millions on bandwidth.

Real world lesson: Caches create cascade failures. If cache dies and all requests hit DB, DB gets 10x traffic and crashes. Need circuit breakers."

**[Then ask]:**
"Want to learn: 1) How to pick cache size? 2) How distributed caches (Redis) stay in sync? 3) Why LRU can fail?"

### Example 2: What is Machine Learning?

**Simple Definition:**
"Machine learning is teaching a computer to recognize patterns instead of writing step-by-step instructions. Like teaching a kid to recognize dogs by showing examples, not writing rules."

**Why & Where:**
"Spam filters, Netflix recommendations, your phone's face unlock—all ML. If you had to write code for every spam variant, you'd need millions of rules. ML learns from examples instead."

**Analogy:**
"Traditional code is like recipe instructions: 'Add 2 cups flour, beat for 3 minutes, etc.' ML is like teaching an apprentice: show 1000 cakes, point out 'good' vs 'bad', they learn patterns. It's slower upfront, but works for anything."

**Example:**
"Spam filter: trained on 10 million emails (labeled spam/not spam). Learns patterns: 'Emails from 'prize@scam.com' with 'CLICK NOW' are usually spam'. When new email arrives, it predicts: 95% likely spam."

**[Then ask Layer 2 question]**

## Best Practices

1. **Always start simple** — No jargon in first paragraph
2. **Build progressively** — Foundation → architecture → production reality
3. **Use mental models** — Analogies stick better than definitions
4. **Show tradeoffs** — What does this cost?
5. **Real examples beat hypotheticals** — "Netflix learned X" > "imagine if"
6. **Ask follow-ups** — Leave them with next-level questions
7. **Fresh perspective** — Flip the mental model users already have

## When to Use This Skill

- User asks "What is X?" or "Explain Y"
- User says "Teach me about", "Help me understand", "I'm confused about"
- User wants to learn something deeply, not just survive
- You want to give explanations that stick

## When NOT to Use This Skill

- User wants quick facts (just answer briefly)
- User is debugging code (use code-focused skills)
- User wants to learn to learn (use learn-feynman skill instead)