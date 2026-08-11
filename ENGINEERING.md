# Album Motion engineering practices

## TDD loop

For a behavior change, write one small failing unit test first. Implement only enough code to make it pass. Then refactor names, duplication, and structure while the test remains green.

Use `npm test` for a single full test run, `npm run test:watch` while developing, and `npm run check` before committing.

## Automated code quality

`npm run lint` runs Biome's recommended TypeScript, React, accessibility, and correctness rules. React hook dependency and hook-order rules are explicitly required because mistakes in those areas can create stale state or inconsistent renders.

Use `npm run lint:fix` for safe automatic lint fixes and `npm run format` when you intentionally want to format the project. The all-in-one `npm run check` command runs environment checks, linting, tests, TypeScript, and the production build.

Biome is used instead of ESLint because the current TypeScript 7 compiler is newer than the TypeScript range supported by the current `typescript-eslint` parser. We do not force unsupported peer dependencies or downgrade the compiler solely for tooling.

GitHub Actions runs the same `npm run check` command for every pull request and for changes merged to `main`.

The check also synthesizes the AWS CDK stack locally. Infrastructure behavior is tested with CDK assertions before deployment, including public-access blocking, encryption, retention, retries, and budget alerts. Synthesis does not require an AWS account; cloud integration tests are a later boundary.

## What to unit test

- Test project rules, validation, destinations, motion math, and serialization as pure TypeScript.
- Test external boundaries through small interfaces; the fake renderer exercises the same asynchronous contract a production backend client will implement.
- Test what a caller can observe, rather than private implementation details.
- Keep PixiJS canvas lifecycle and browser-only behavior in focused integration checks; do not mock the entire renderer in unit tests.

## Maintainability rules

- Give each module one clear reason to change.
- Prefer explicit domain names over generic helpers.
- Remove duplication when two pieces of code represent the same business rule and should change together.
- Do not merge merely similar code that has different meanings; readability is more valuable than clever abstraction.
- Keep React responsible for interface state and PixiJS responsible for frame rendering.
- Keep the project model independent of payments, hosting customers, and browser UI.

These are practical interpretations of TDD, DRY, and Clean Code principles. They are working agreements, not a reason to add ceremony or abstractions without a concrete benefit.
