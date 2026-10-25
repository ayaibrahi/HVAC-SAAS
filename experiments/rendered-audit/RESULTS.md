# Local execution evidence — 2026-10-25

## Actual execution

Playwright-core 1.64.0, Node 24.20.0, installed Chrome 155.0.8059.85.
No browser download; only the pinned npm package was installed in this experiment.
The whole experiment directory including that dependency measured 13,775,432 bytes
before the final README and this results note were added (about 13.14 MiB).

Real Chrome executed the synthetic JS. All three pages passed at desktop 1440x900
and mobile 390x844. Six JS-disabled baseline observations missed the dynamic
elements, while six JS-enabled observations detected them with exact page URLs.

| Page | Rendered observation | Desktop ms | Mobile ms |
| --- | --- | ---: | ---: |
| Home | Request an estimate CTA | 178 | 170 |
| Services | Call our fixture team; tel:+12025550123; Contact our team | 155 | 153 |
| Contact | Contact form; Send request; Book a visit | 160 | 160 |

The mobile contact page additionally showed Call on mobile / tel:+12025550124.
The hidden phone was excluded at both widths. No form, phone or booking action
was performed.

## Security regression discovered and corrected

First run: 11 passed / 2 failed (the failed redirect subtest also failed its parent).
An allowed fixture redirect reached the second loopback canary when route.continue
was used. No external site was contacted. Switching to maxRedirects: 0 and rejecting
redirect responses before browser fulfillment fixed the reproduced defect.

Second run: **13 tests passed, 0 failed**, exit 0, Node test duration 4.238 s.
This includes source attribution, both viewports, static/rendered differences,
script errors, timeout/unknown results, request/navigation/redirect restrictions,
popup/service-worker/WebSocket restrictions and cleanup. Canary requests: zero.
Page readiness timeout: 305 ms, correctly incomplete, no false absence signals.
All browser contexts/process and the temporary Chrome profile were removed;
fixture servers closed; no tracked processes remained after the run.

## Measured resources on the passing run

- Supervisor wall time: 4.931 s; fixture/browser scenario: 3.823 s.
- Sampled peak process-tree working set: 647.74 MiB (shared pages can be counted twice).
- Sampled peak process-tree private committed memory: 454.34 MiB.
- Observed cumulative tree CPU time: 7.797 CPU-seconds; not an instantaneous CPU percentage.
- Seven samples: peaks and CPU usage are sampled observations, not exhaustive accounting.
- Available host RAM: 5.016 GiB before, minimum sampled 4.582 GiB, 4.982 GiB after.
- C: free space: 16.427 GiB before, 16.424 GiB after. Host-wide differences cannot
  be attributed exclusively to this process.

## Final verification caveat

After that passing run, a prefer-const lint issue was corrected using a session
page holder and cleanup was strengthened with nested finally blocks. The final
TypeScript prototype build passed. The final monitored rerun stopped before browser
launch because its resource gate failed. A fresh measurement at 15:27 Cairo time
reported **0.826 GiB available RAM / 16.393 GiB free C:**.

The exact final source therefore still needs its browser-suite rerun. Do not
attribute the earlier 13/13 result to that unexecuted final run. Root typecheck
passed before the last edits; initial root lint found one prefer-const error, now
corrected but not rerun. git diff --check passed. The full app tests/build were
not run; no deployed/application source files, root dependency files or migrations
changed. Existing audit regression reruns were deferred at the failed resource gate.

Next: after the owner restores at least 4 GiB available RAM and 8 GiB free disk,
run the monitored suite, root lint/typecheck and focused existing audit/opportunity
tests. No Docker repair or restart is needed. No external scans are authorized.
