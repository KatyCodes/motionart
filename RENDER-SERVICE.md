# Render service HTTP contract

The browser editor depends on the `RenderService` interface, not a specific cloud provider. `createHttpRenderService` is the production-facing adapter for any backend that implements the endpoints below.

## Client setup

```ts
const renderService = createHttpRenderService({
  baseUrl: '/api/company-tbd',
  getHeaders: async () => ({
    Authorization: `Bearer ${await getShortLivedRenderToken()}`,
  }),
});
```

`getHeaders` runs immediately before every submit or poll request, so the host can refresh short-lived authentication. Do not ship a permanent backend secret in browser JavaScript. A customer can instead use a same-origin proxy or issue the editor a narrowly scoped, short-lived token.

Both methods accept an optional `AbortSignal`, allowing React to cancel obsolete requests when the artist changes pages or closes the editor.

## Submit a job

```http
POST /render-jobs
Accept: application/json
Content-Type: application/json
```

The body is a versioned `RenderRequest`. A successful response returns a validated `RenderJob`, normally with HTTP `201` and `status: "submitted"`.

## Poll a job

```http
GET /render-jobs/{url-encoded-job-id}
Accept: application/json
```

The response is the latest versioned `RenderJob`. Its status is one of `submitted`, `processing`, `completed`, or `failed`. A completed job contains one output entry per requested deliverable. A failed job contains a typed failure with a human-readable message and a `retryable` flag.

The first contract only includes output filenames. A later schema version can add expiring download references without changing the meaning of jobs already saved by a host.

## Error response

```json
{
  "code": "RENDERER_UNAVAILABLE",
  "message": "Renderer is temporarily unavailable."
}
```

The client preserves the HTTP status and error code in `RenderServiceHttpError`. HTTP `408`, `429`, and `5xx` responses are classified as retryable. Successful HTTP responses are still treated as untrusted data and must pass `validateRenderJob` before they reach React.

## Customer and Company TBD responsibilities

- The customer host decides when checkout is complete and when to submit the render request.
- Company TBD's service resolves the durable artwork reference, renders the requested outputs, and reports job status.
- Temporary artwork and download URLs are refreshed at their respective boundaries; they are not stored as permanent project identifiers.
- Cross-origin deployments must explicitly allow the customer's origin and required request headers.
