# ADR 0001 — vz-sched preemption math and vmin invariant

Date: 2026-05-22
Status: Accepted
Related beads: `netlistsvg-yr5`, `netlistsvg-yr5.1`, `netlistsvg-yr5.2`
Reference: Linux v6.5 `kernel/sched/fair.c`
([wakeup_gran/wakeup_preempt_entity ~L7851-7900](https://github.com/torvalds/linux/blob/v6.5/kernel/sched/fair.c#L7851),
[update_min_vruntime L607](https://github.com/torvalds/linux/blob/v6.5/kernel/sched/fair.c#L607),
[place_entity L4732](https://github.com/torvalds/linux/blob/v6.5/kernel/sched/fair.c#L4732),
[calc_delta_fair L709](https://github.com/torvalds/linux/blob/v6.5/kernel/sched/fair.c#L709))

## Context

`bin/lib/vz-sched/` simulates a CFS-like scheduler for lectures. The
generated LaTeX traces are reused in slides; any mismatch between the
simulated formulas and the model presented to students produces
incorrect didactic material.

Two issues motivated this ADR:

1. The preemption check on `_start_task` (lib.js:96) and `_wakeup`
   (lib.js:123) computes the effective virtual runtime of the
   new/woken task as
   `tw.vrt + wgup * (tw.lambda / sumlambda())`, i.e. `omega` is
   multiplied by a lambda-ratio.
2. `state.vmin` is recomputed in `_task_tick` (lib.js:154) as
   `_.minBy(state.rbt, 'vrt').vrt`. After `_wakeup` calls
   `addToRbt(tw)`, the next refresh of `vmin` includes the waking
   task's `rho` (= `vrt`), which the spec treats as an outside
   value at that moment.

### Evidence from Linux CFS (v6.5)

The reference implementation in `kernel/sched/fair.c` directly
contradicts the current vz-sched formulas:

```c
/* fair.c:709 — delta /= w */
static inline u64 calc_delta_fair(u64 delta, struct sched_entity *se)
{
    if (unlikely(se->load.weight != NICE_0_LOAD))
        delta = __calc_delta(delta, NICE_0_LOAD, &se->load);
    return delta;
}

/* fair.c:~7851 */
static unsigned long wakeup_gran(struct sched_entity *se)
{
    unsigned long gran = sysctl_sched_wakeup_granularity;
    /*
     * By using 'se' instead of 'curr' we penalize light tasks, so
     * they get preempted easier. That is, if 'se' < 'curr' then
     * the resulting gran will be larger, therefore penalizing the
     * lighter [...].
     */
    return calc_delta_fair(gran, se);
}

/* fair.c:~7872 */
static int
wakeup_preempt_entity(struct sched_entity *curr, struct sched_entity *se)
{
    s64 gran, vdiff = curr->vruntime - se->vruntime;
    if (vdiff <= 0)
        return -1;
    gran = wakeup_gran(se);
    if (vdiff > gran)
        return 1;
    return 0;
}
```

`calc_delta_fair(gran, se)` is `gran * NICE_0_LOAD / se.load.weight`,
i.e. `gran` is *divided* by the waking entity's weight (our
`lambda`), never multiplied. The preemption test
`vdiff > gran` is equivalent to `se->vruntime + gran < curr->vruntime`
— exactly the shape used in vz-sched, but with the corrected formula
for `gran`.

For the vmin invariant, `place_entity` (fair.c:4732) reads
`cfs_rq->min_vruntime` to clamp the waking entity's vruntime
*before* it is enqueued into the rb-tree:

```c
static void
place_entity(struct cfs_rq *cfs_rq, struct sched_entity *se, int initial)
{
    u64 vruntime = cfs_rq->min_vruntime;
    if (initial && sched_feat(START_DEBIT))
        vruntime += sched_vslice(cfs_rq, se);
    if (!initial) {
        unsigned long thresh = sysctl_sched_latency;
        if (sched_feat(GENTLE_FAIR_SLEEPERS))
            thresh >>= 1;
        vruntime -= thresh;
    }
    /* ... */
}
```

`update_min_vruntime` (fair.c:607) only considers `curr` and the
leftmost entity in the rb-tree, so the waking entity — which has not
been enqueued yet — is structurally excluded from `min_vruntime` at
clamp time.

## Decision

Adopt the following canonical math for vz-sched, mirroring the Linux
CFS reference. Used uniformly in all preemption decisions and
didactic artifacts (including the new `printConditions` artifact,
`netlistsvg-3l0.1`):

1. **Wakeup / start preemption check.** When deciding whether a
   newly started or just-woken task `tw` preempts `state.curr`,
   compute
   ```
   v = tw.vrt + omega / tw.lambda
   ```
   and preempt iff `v < state.curr.vrt`. `omega` is *divided* by the
   task's own `lambda`; no `sumlambda()` factor is involved. This
   matches `wakeup_gran(se) = gran / weight(se)` in Linux CFS.

2. **vmin invariant.** `state.vmin` represents the minimum virtual
   runtime among tasks currently *competing for the CPU on the
   ready-queue*. A task `tw` being woken up MUST NOT be included in
   `state.vmin` at the moment its own `vrt` is clamped via
   ```
   tw.vrt = max(tw.vrt, vmin - latency/2)
   ```
   Operationally: the clamp must read/refresh `vmin` from
   `state.rbt \ {tw}` before `addToRbt(tw)` runs. This mirrors Linux
   CFS, where `place_entity` reads `cfs_rq->min_vruntime` before the
   entity is enqueued into the rb-tree.

3. **Single source of truth.** Both the preemption check inside the
   event loop and any LaTeX generator that prints these conditions
   must use the same code path / helper for `v` — no per-call-site
   re-derivation of the formula.

## Consequences

- `_start_task` (lib.js:96) and `_wakeup` (lib.js:123) change formula;
  existing snapshots under `bin/lib/vz-sched/__snapshots__/` will be
  regenerated. Past PDFs/slides built from those snapshots become
  out of date — acceptable: the prior outputs encoded a bug.
- `_wakeup` becomes responsible for ensuring `vmin` is fresh and
  excludes `tw` before line 120's clamp. A small helper
  (`vminExcluding(task)`) is the natural place for the rule.
- The new `printConditions` generator (`netlistsvg-3l0.1`) must call
  the shared helper, not re-implement the formula.
- Any future change to the preemption formula requires updating this
  ADR.

## Alternatives considered

- **Keep `omega * (lambda / sumlambda())`.** Rejected: contradicts
  both the lecture model and the Linux CFS reference; produces wrong
  preemption decisions, especially when `sumlambda()` is far from 1.
- **Recompute vmin globally after every rbt mutation.** Rejected as
  overkill; the only window where the invariant is observable is
  inside `_wakeup`, so a local exclusion is sufficient and cheaper.
  Linux achieves the same effect by design via the
  enqueue-after-place ordering.
- **Two separate ADRs (one per bug).** Rejected: both rules describe
  the same canonical CFS-derived model and are easier to maintain
  together.
