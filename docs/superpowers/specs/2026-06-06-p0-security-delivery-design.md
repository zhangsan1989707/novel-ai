# P0 Security Delivery Design

Date: 2026-06-06

## Scope

This design covers the first production-readiness pass for Novel AI. It intentionally avoids Prisma schema changes and does not include the pipeline worker lease redesign.

## Goals

- Prevent cross-user access to project-scoped APIs.
- Prevent AI model API keys from being returned to the browser.
- Make sensitive configuration routes enforce server-side authentication.
- Reduce public health-check information leakage.
- Add focused tests for the highest-risk regressions.

## Project Access Guard

Add a small server-side helper for project ownership checks. Route handlers parse `projectId`, call the helper, and continue only when the current user owns the project. Non-owned projects should return the existing API response shape with a 404-style project-not-found error to avoid disclosing whether another user's project exists.

Child resources must be bound to the already-authorized project. Chapter routes must not read, update, or delete by `chapterId` alone.

First-pass route coverage:

- Project detail, update, and delete.
- Chapter list, create, update, delete, normalize, and reorder.
- Generation and pipeline control routes that can mutate project state or create cost.
- Export, RAG rebuild, style extraction, continuation, blueprint, arc plan, and outline confirmation routes where they are touched by the first pass.

## AI Config Redaction

Add one server-side redaction helper for AI model configuration objects. API responses may expose metadata such as `id`, `name`, `vendor`, `modelId`, endpoints, embedding model metadata, and booleans/previews for key presence. They must never expose `apiKey` or `embeddingApiKey` in plaintext.

All routes returning project objects with `aiModelConfig` must replace that nested object with the safe shape before sending JSON. AI config create/update/set-default routes must return the same safe shape used by GET routes.

## Auth And Health

Sensitive AI config routes must call the server auth helper directly and reject missing or invalid sessions. Middleware cookie presence is not enough for these routes.

The public health endpoint should keep its coarse readiness value but stop returning raw database errors, vendor/model details, or other sensitive configuration details. Detailed diagnostics belong in logs or a later protected endpoint.

AI config test endpoints should return sanitized errors only. Raw provider errors stay server-side.

## Tests

Add focused tests rather than a broad rewrite:

- Project access helper allows owned projects and rejects non-owned projects.
- Chapter child-resource queries bind `chapterId` to `projectId`.
- Project and AI config responses do not contain plaintext `apiKey` or `embeddingApiKey`.
- Public health responses do not expose raw error text or model identity.

## Acceptance Criteria

- `npx tsc --noEmit` passes.
- `npm test` passes.
- No API response in the covered paths returns plaintext AI keys.
- Covered project-scoped mutation/read routes reject non-owned project access.
