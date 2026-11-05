# Deep reading integration audit — 2026-11-01

## Scope and evidence

Checkout: `v0.5.64`, commit `3f565f2`. This is a read-only source and test audit; no app, emulator, profile, application source, or test file was changed. Boss/Kizuna parsing correctness and low-level OCR were assigned elsewhere and are not repeated here.

Used the existing AST Graphify graph first: `graphify . --code-only --no-cluster --no-viz`; `graphify-out/graph.json` contains 1,852 nodes. It covers 316 code files; code-only excluded 13 docs and 5,342 images and reported 7 unsupported files. `graphify-out/` is currently untracked (`git status --short -- graphify-out` prints `?? graphify-out/`) and is not covered by `.gitignore`; graph generation did not write application files. Source was checked for every finding because the graph may lag.

Targeted tests, unchanged:

```text
npx tsx --test tests/pka-rumble.test.ts tests/assault-reader.test.ts tests/assault-solver.test.ts tests/rumble-rules.test.ts
tests 37, pass 37, fail 0, skipped 0, duration 3.56s
```

An ephemeral, read-only Node probe against `createPkaRumbleReader` gated one capture, cancelled it, queued two reads before the capture unwound, and then released it. Both queued calls entered `io.capture` (peak concurrent captures 2). The probe did not change source or fixtures.

Repeatable PKA probe: `node .local/audit-pka-cancel-restart.cjs` → `{"captureCalls":3,"peakConcurrentCaptures":2,...}`. The same gated mock was run against `createAssaultReader` and also returned 3 captures / peak 2; the Assault conclusion is probe-confirmed, not only inferred statically. The script is ignored under `.local/` and does not require an emulator or ADB binary.

## Flow inventory and checked invariants

| Flow | Producer → consumer and state boundary | Findings from this pass |
|---|---|---|
| Rumble Rules | `electron/main.cjs` IPC → `rumble-rules.cjs` service → renderer rules/profile state | Single active read is rejected; cancellation is checked around capture/input; cleanup avoids Back on an unknown screen. Targeted tests cover wrong-screen rejection, cancellation, phase, and partial rule coverage. No new parsing issue established. |
| Rumble INFO / Assault | `electron/main.cjs` IPC → `assault-rumble.cjs` reader → `validateAssault` → `AssaultRumblePage` worker | Reader checks screen/boss identity, stores only the selected INFO boss, and explicitly warns that whole enemy roster/moves are not verified (`electron/assault-rumble.cjs:60-74`). Page invalidates worker results on state/device changes. The cancelled-read serialization race below also applies to Assault (`electron/assault-rumble.cjs:13-16,75`). |
| PKA Rumble | renderer connect/read → main IPC → `pka-rumble.cjs` capture/roster/details → `validatePkaRumble` → planner worker → saved renderer snapshot | Roster signature is checked through the read; read cancellation and changed-opponent cases have tests. Context validation is bounded. Cancel-and-restart has a service-level concurrent-read race below. Worker result keys include context fingerprint, box, planner data SHA, scenario/category/deep mode (`src/PkaRumblePage.tsx:24-30`). |
| Box file / paste / drop / live scan | `BoxScanner` file input or screenshot/ADB capture → recognition IPC/worker → review list → explicit add to profile | File input accepts multiple PNG/JPEG/WebP, each limited to 16 MiB; live scan bounds pages and checks Character Box identity (`src/BoxScanner.tsx:7,28-45,60`). No paste/drop handler was found; the UI describes image upload and live capture, so absence alone is not a defect. Upload silently slices batches to 100 files (finding below). Adds require explicit selection; confident rows default selected, review/unknown rows do not, and existing owned records are preserved (`src/BoxScanner.tsx:57`, `src/App.tsx:1044-1057`). |
| Worker / IPC / ADB | Trusted main-frame `file://` IPC → bounded IPC handlers → recognition or reader service → ADB capture/input | `main.cjs:20-21` checks sender and logs caught IPC failures. Recognition validates image/grid bounds, allows at most two workers, and times out after 45 s (`electron/recognition.cjs:5-16`; image/grid/pixel checks are in `recognition-core.cjs`). ADB APIs validate the binary/device and bound screenshot/command/input operations (`electron/adb.cjs`). Worker teardown/cancellation does not imply that every service has a per-job identity; PKA/Assault serialization is one such gap below. |
| DB saved profile/boss records | renderer validates loaded payload against bundled catalog IDs → serialized renderer save queue → SQLite single-row JSON payload | Schema v1 is required and bounded at the IPC edge (`electron/main.cjs:24-29`); renderer `validateState` checks the richer record shape and catalog IDs (`src/App.tsx:108-127`, `src/model.ts:12-67`). Invalid/obsolete state opens read-only and is not overwritten. Saves are serialized in renderer order (`src/App.tsx:106,146-157`); SQLite uses one upsert statement and WAL (`electron/main.cjs:15-16,28`). This audit found no new DB/schema race. |
| UI remount and parallel planning | PKA/Assault page-local worker generation + module-level last-view memory; planner inputs include current box/data revision | PKA drops a restored result if its serialized box differs and marks unmounted/in-flight reads stale; device changes clear context/result (`src/PkaRumblePage.tsx:12-23`). A local worker result is accepted only for the current generation (`:28-30`). Cache keys include `data.metadata.sha` and box (`:24-30`). No stale planner-result application was reproduced. Progress events, unlike worker messages, do not carry a run ID (finding below). |

## Findings

### 1. Cancel-then-retry can start two PKA/Assault readers concurrently

**Confirmed service invariant failure; UI impact is conditional.** Both readers permit a new call to wait for a cancelled job's `finished` promise, but do not reserve the service while waiting. Two calls arriving during that interval both pass the initial check, both await the same promise, and both create/assign a new active token after it resolves. The read-only probe reproduced two simultaneous PKA captures. Assault has the same control flow.

Evidence: PKA checks `active` and awaits at [electron/pka-rumble.cjs:39-43](C:/Users/berku/Projects/OPTC-Nakama/electron/pka-rumble.cjs:39), then clears `active` and resolves all waiters in `finally` at `:69`. Assault mirrors this at [electron/assault-rumble.cjs:13-16](C:/Users/berku/Projects/OPTC-Nakama/electron/assault-rumble.cjs:13) and `:75`. Existing cancellation tests prove one retry waits for unwind, but do not queue two retries (`tests/pka-rumble.test.ts:24`; `tests/assault-reader.test.ts` cancellation case).

Minimum fix: reserve a single service queue/starting token synchronously before awaiting the old read, or reject additional waiters and require retry after unwind. Keep cancellation scoped to the old job. Do not let a newer job replace the token that an older job's `finally` is responsible for clearing.

Acceptance: a gated-capture regression starts one read, cancels it, submits two reads before releasing capture, and asserts that at most one new read reaches capture/input; the other must reject or serialize. Also assert cancellation of job A cannot cancel or clear job B.

### 2. Multi-file box import silently ignores files after the first 100

**Source-confirmed behavior; UI test not run.** `BoxScanner.upload` converts the chosen `FileList` to an array and slices to 100, then reports the batch as fully scanned; no count of ignored files or continuation prompt is shown ([src/BoxScanner.tsx:47](C:/Users/berku/Projects/OPTC-Nakama/src/BoxScanner.tsx:47)). Users selecting a larger set can believe the whole collection was scanned. No 101-file renderer test was run in this audit.

Minimum fix: preserve bounded work but report “first 100 of N” and offer the remaining batch, or reject the selection with the cap before beginning. Do not mark the full selection complete after truncation.

Acceptance: with 101 selected files, the UI either processes 100 and names the one remaining, or starts none and clearly requests a batch of at most 100; it must never display the current all-scanned completion text for an incomplete batch.

### 3. Active readers do not share ADB device ownership across services

**Source-confirmed concurrency window; no live-device reproduction was performed.** The renderer permits navigation while a read is busy: sidebar buttons call `setPage` with no busy guard (`src/App.tsx:293-316`). Page switches unmount the prior reader because the page components are conditional (`src/App.tsx:722-805`). Most readers invoke their service cancellation from unmount, but those calls are fire-and-forget and service cancellation is cooperative; an already dispatched ADB operation cannot be withdrawn. The box scanner is a concrete exception: unmount only sets local `stop`/generation state and exposes no box-capture cancellation IPC (`src/BoxScanner.tsx:12`), while its in-progress `screenshot`/`boxScroll` requests continue through main (`src/BoxScanner.tsx:28-45`, `electron/main.cjs:36-38`).

Each reader owns its own service guard, but no guard is shared by device: main constructs independent Rumble, Assault, Boss, PKA, and Kizuna services (`electron/main.cjs:39-60,67-75`); `adb.screenshot` and `adb.boxScroll` launch independent `execFile` operations (`electron/adb.cjs:16-43`). Thus a concrete reachable interleaving is: a Box live scan is awaiting `adb:boxScroll`; the user navigates to PKA Rumble; BoxScanner unmounts but cannot cancel that IPC operation; PKA starts its own reader on the same selected device and may inspect/input while the old box swipe is still pending. The same window exists for a just-dispatched input from other readers after their cooperative cancel. This establishes the ownership gap and UI reachability, not that a particular real MuMu run has visibly misread data.

This audit does not prescribe a blanket global lock. The narrow acceptance test is a mocked IPC/device sequence that starts `boxScroll`, unmounts the scanner, starts another reader against the same device, and proves the second reader cannot take a screen-dependent action until the first operation has completed or been safely cancelled; also verify navigation from an idle reader stays immediate.

### 4. PKA/Assault progress messages have no run identity

**Confirmed missing identity; stale display is a race hypothesis, not reproduced.** Main sends plain progress strings for these readers (`electron/main.cjs:47,59`); preload forwards only the string (`electron/preload.cjs:5,16`); the PKA page accepts any queued event while `reading.current` is true (`src/PkaRumblePage.tsx:21`). Cancel sets that flag false, but starting a new read sets it true again. If an old IPC progress event is still queued when the next read starts, the old text can overwrite the new job's progress. Worker calculation messages have generation checks; these IPC events do not.

Minimum fix: assign a monotonically increasing read ID in the renderer, send/echo it through IPC progress, and ignore progress whose ID is not current. Alternatively detach/replace a per-invocation progress subscription if that can guarantee queued old events are rejected.

Acceptance: deterministic renderer/preload test queues progress from job A, cancels A, begins B, then delivers A's queued event; B's progress text must remain unchanged. Apply the same test to Assault.

## Deliberately not counted as new defects

- Diagnostics are asymmetric, not absent: generic IPC failures are logged by `main.cjs:21`; Kizuna auto records progress/result at `:72`; Boss/PKA behavior use the recorder service (`:50,57`). Rumble Rules/Assault/PKA Rumble progress goes to UI only (`:40,47,59`) and these flows lack Boss-style frame/alignment replay. This is the prior audit's observability gap, not evidence that all logging is missing.
- PKA Rumble accepts `complete:false` per NPC, but its `completeEnemies` planner flag means the active opponent roster was observed; enemy count comparisons additionally require known type/class targets (`src/rumble-planner.ts:27-32,104`). The inspected path does not establish the earlier suspicion that all incomplete detail records are treated as a complete roster. Do not label this a confirmed bug without a fixture where roster identity itself is incomplete.
- The 414 uncovered recognition IDs, missing enemy-type reads in Assault, and documented Rumble/Trusty/bonus scope limits are catalog/feature coverage boundaries already known from handoff, not newly discovered regressions.
- No paste/drop support is implemented in the scanner, but there is no UI promise for those inputs. Not counted as a defect.
- No schema-migration failure, catalog-revision mismatch, manual-grid false add, or stale PKA planner result was reproduced. Profile validation is intentionally fail-closed/read-only; planner cache keys include the data SHA and current box.

## Suggested order

1. Fix and regression-test the shared cancel/retry reservation in PKA and Assault services.
2. Make the 100-file truncation explicit and actionable.
3. Add read IDs to PKA/Assault progress events if a stale-progress reproduction matters to the user.

No implementation, app launch, emulator input, profile mutation, or test change was made in this audit.

## Cross-review note — shared OCR audit

- Re-ran `node .local/tesseract-restart-probe.cjs`: timeout rejected, old mock `terminate()` had started but remained unresolved, and a second worker/read succeeded before old termination resolved. This confirms the deferred-mock ordering race, not overlap duration or memory impact with real Tesseract.
- The proposed REQUIREMENT ROI retention does not remove evidence the current recognition path actually consumes, provided it stores the exact PNG crop and original dimensions/button-relative geometry. `quest-restrictions.cjs:104-108` buffers full frames; `requirement-pixels.cjs:2-5` immediately extracts only x=.108..795 and a .048-height band above the observed button. Per-frame full-screen/modal identity is not checked in that loop today; modal identity is the pre-hold `identity` value and the restored modal is checked after the hold (`quest-restrictions.cjs:56,64`). Thus full-frame retention itself is not currently supplying mid-hold identity proof. If future code wants that proof, retain a compact identity/header ROI or validate it per capture before discarding the frame. Numeric caption evidence stays in the existing exact tooltip ROI; keep all existing pixel/OCR disagreement and dual-text checks unchanged.
- WinRT timeout remains correctly labeled a **source risk, not a runtime defect**: `Task.Wait(20000)` returning false is followed by throw, with no explicit `IAsyncOperation.Cancel()` call (`windows-ocr.ps1:15-18`); bitmap/stream disposal then runs and the server loop can accept another request in the same process (`:22-46`). Source alone does not prove that the native recognition continues, races the next request, or mishandles disposal. Keep the conditional fix gated on runtime fault injection.

