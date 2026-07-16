# Contract: Geocode proxy Edge Function

## Endpoint

`POST /functions/v1/geocode-proxy`

Auth: same JWT/anon pattern as `llm-proxy`.

### Request

```json
{ "placeName": "Alexandria" }
```

### Response 200

```json
{
  "placeNameNormalized": "alexandria",
  "lat": 31.2,
  "lng": 29.9,
  "cached": true
}
```

### Response 4xx/5xx

JSON `{ "error": "..." }` — client sets `geocodeStatus: "failed"`.

## Server behavior

1. Normalize: trim + lowercase.
2. `SELECT` from `geocode_cache`; if hit, return with `cached: true`.
3. Else enqueue Nominatim request behind ≤1 req/s throttle; `User-Agent: MyLearning/1.0 (vault-geocode; contact: …)`.
4. On success: upsert `geocode_cache`, return lat/lng with `cached: false`.
5. On Nominatim failure: return 502; do not write cache row (or write failed sentinel — prefer no row so retry later is possible).

## Client

- Never call Nominatim from browser.
- On success: update vault entry `lat`, `lng`, `geocodeStatus: "resolved"`, `saveVault`.
- On failure: `geocodeStatus: "failed"`.

## Table

See `data-model.md` — `geocode_cache`.
