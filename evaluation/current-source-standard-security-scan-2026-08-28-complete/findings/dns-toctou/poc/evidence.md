# Source evidence

See `lib/server/upstream-http.ts:122-151`. DNS is checked at 147, but only a URL is returned at 151; no validated address is pinned.
