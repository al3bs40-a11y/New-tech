---
name: Node ESM TypeScript tests
description: Import-resolution behavior for Node's built-in TypeScript stripping in ESM test files.
---

When a Node ESM test imports a TypeScript module that is executed with `--experimental-strip-types`, use explicit `.ts` extensions on relative imports, including imports inside the TypeScript module under test.

**Why:** Node's native ESM resolver does not resolve extensionless TypeScript imports, even when the Vite bundler and TypeScript type checker accept them.

**How to apply:** For `.mjs` tests that import source `.ts` files, include `.ts` in every relative source import and confirm the project's TypeScript config permits TypeScript extensions.
