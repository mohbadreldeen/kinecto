---
name: clean-code
description: "Use when writing, reviewing, or refactoring software for readability, maintainability, testability, and long-term delivery speed using Clean Code principles."
compatibility: "Language-agnostic. Works across frontend, backend, and infrastructure codebases."
---

# Clean Code

## When to use

Use this skill when work involves:

- Refactoring messy or fragile code
- Improving naming, function design, class cohesion, or module boundaries
- Reducing duplication and hidden side effects
- Improving tests, error handling, and maintainability
- Preventing long-term slowdown from code entropy

## Inputs required

- Goal of change (feature, bug fix, refactor, performance)
- Target files/modules and known pain points
- Constraints (deadline, compatibility, performance)
- Existing tests and validation commands

## Principles

- Clean code is a professional obligation, not optional polish.
- Code is read far more than written; optimize for readers.
- Small details matter: names, spacing, boundaries, consistency.
- Keep code simple, expressive, and focused.
- Leave touched code cleaner than you found it (Boy Scout Rule).

## Procedure

### 1) Stabilize first

1. Confirm current behavior with tests or reproducible checks.
2. Identify high-risk areas and key paths.
3. Mark smells:
   - Long functions
   - Mixed abstraction levels
   - Duplicated logic
   - Hidden side effects
   - Unclear names
   - Switch-heavy behavior logic

### 2) Improve naming

1. Use intention-revealing names.
2. Prefer meaningful, searchable, pronounceable identifiers.
3. Avoid disinformation, noise words, and misleading abbreviations.
4. Keep naming consistent across module boundaries.

### 3) Refactor functions

1. Keep functions small and single-purpose.
2. Keep one level of abstraction per function.
3. Extract cohesive substeps into named helpers.
4. Minimize parameters:
   - Prefer 0-2 arguments
   - Avoid boolean flags when possible
   - Avoid output parameters
5. Make side effects explicit and unsurprising.

### 4) Reduce duplication and branching complexity

1. Remove repeated logic via shared abstractions.
2. Prefer polymorphism/strategy over broad type conditionals.
3. Encapsulate boundary and integration details.
4. Separate orchestration from low-level implementation details.

### 5) Error handling

1. Prefer structured exceptions over scattered error-code checks (where language/runtime supports).
2. Keep happy path readable; isolate error plumbing.
3. Wrap third-party errors in application-level exception types.
4. Avoid returning null where empty objects/collections or special-case objects are clearer.

### 6) Tests as first-class code

1. Keep tests clean and readable.
2. Follow FIRST:
   - Fast
   - Independent
   - Repeatable
   - Self-validating
   - Timely
3. Test one concept per test.
4. Add boundary and failure-path coverage.
5. Refactor test duplication and improve test naming language.

### 7) Class/module design

1. Apply SRP: one reason to change per class/module.
2. Maximize cohesion, minimize coupling.
3. Depend on abstractions, not concrete implementations.
4. Keep construction/wiring separate from runtime behavior.
5. Isolate cross-cutting concerns (logging, auth, transactions, retries).

### 8) Comments policy

1. Prefer expressive code over explanatory comments.
2. Keep comments only when they add intent/rationale that code cannot show.
3. Remove stale, redundant, or commented-out code blocks.

### 9) Formatting and structure

1. Keep files and units digestible.
2. Group related concepts; separate unrelated ones.
3. Maintain consistent team formatting and conventions.
4. Avoid non-functional style churn in behavior-focused changes.

## Verification checklist

- Names reveal intent clearly.
- Functions do one thing at one abstraction level.
- Parameter lists are minimal and coherent.
- Side effects are explicit.
- Duplication/complexity is reduced.
- Error handling is consistent and decoupled from core flow.
- Tests are clear and cover boundaries/failures.
- The change is easier to extend than before.

## Common failure modes

- Deadline-driven quick fixes that add hidden complexity
- Large rewrites without incremental safety checks
- Weak tests causing fear of change
- Comment clutter replacing real refactoring
- Mixing domain logic with framework/transport details
