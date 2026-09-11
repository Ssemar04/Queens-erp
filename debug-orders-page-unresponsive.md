# debug-orders-page-unresponsive.md
Status: **[OPEN]** · Session: `orders-page-unresponsive` · Created: 2026-08-08

## Context
File: `d:\House\qterp\frontend\src\routes\app.orders.tsx` (user reports page is **not responding** — frozen UI, unresponsive buttons/inputs, browser task-hang or slow interactions).

## Reproduction Hints TBD
- Route: `/app/orders`
- Opened line: `L526` (`<X className="h-3 w-3" />`) — likely inside a dialog/sheet/drawer close button, suggesting the hang may occur when interacting with a modal flow OR the table renders inside the sheet.

## Falsifiable Hypotheses (Step 1)
ID | Hypothesis | Evidence Needed to Confirm/Falsify
---|---|---
H1 | **Infinite re-render loop** in `app.orders.tsx` (e.g., `useEffect` with non-stable object/function dep → state write every render). | **Pre-instrument:** Count renders over 3s with a render counter; capture call stacks for `setState` calls; if renders ≥ 50/sec with same prop inputs → H1 true.
H2 | **Synchronous main-thread block** from large-data processing: `orders` list is filtered/sorted/grouped **inline in render** (no `useMemo`) OR has N-squared nested Array ops for each row. | **Timing probes:** Wrap order-list transformation + render with `performance.now()`; if single render > 150ms OR total main-thread busy > 80% over 2s → H2 true.
H3 | **Broken async / retry storm** from `getOrders` TanStack Query. Missing `staleTime`, `enabled:false` edge case, circular `queryKey`, or backend CORS/5xx causing exponential retry backoff (but sync UI block? Unlikely — check anyway). | Query-state logs: number of `fetchStatus:fetching` events per minute; if retries ≥ 10/min and `fetchStatus` toggling → H3 true.
H4 | **Unbounded event-listener accumulation** on window/document (scroll, resize, keydown) from useEffect without cleanup, OR Sheet/Drawer `open` change keeps registering handlers → every interaction piles on work. | Listener counts: each `useEffect(() => addEventListener(x), […])` invocation count; if net-add > 1 per mount/unmount cycle → H4 true.
H5 | **Circular derived state** — `filteredOrders` computed inline → updates a `filteredCount` state via `useEffect([filteredOrders])` → renders recompute `filteredOrders` → useEffect fires again (stable-reference trap). | Log `filteredOrders.length` + `filteredCount` write timestamps; if alternating every render without user input → H5 true.

## Instrumentation Plan (Step 2 — first code change = instrumentation ONLY)
Targets inside `app.orders.tsx`:
1. **Render counter** — `useRef` incremented every function-body execution + `performance.mark`
2. **Order-transform probe** — wrap order list `useMemo`/inline filter-map-sort with `performance.measure`
3. **Query-state hook probe** — log `{isPending, isFetching, data.length, fetchStatus, error?.message}` on every change
4. **Event-listener probe** — wrap any `addEventListener` `useEffect`s with mount/unmount counts
5. **Dialog/sheet open/close probe** (L526 area) — log open toggles + close click counts

Server: Debug Server will be launched to collect `trae-debug-log-orders-page-unresponsive.ndjson`.

## Evidence (Step 3)
(TBD after reproduction — logs + screenshots.)

## Root Cause (TBD)

## Fix (TBD)

## Post-Fix Verify (TBD)

## Cleanup
(TBD — remove instrumentation, close Debug Server, delete .dbg env & log file.)
