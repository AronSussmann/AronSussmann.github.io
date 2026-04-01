# Test Scenarios And Failure Modes

This file lists high-value mock scenarios for regression testing.

## Frontend Room Editor

1. Add one room with `room-input` and click `Legg til`.
Expected: room pill appears, hint count increases.

2. Add many rooms in one input: `301, 302, A12`.
Expected: three pills, normalized and deduplicated values.

3. Add duplicates with mixed case: `a12, A12, a12`.
Expected: one room only (`A12`).

4. Click `Slett` on a room pill.
Expected: only selected room is removed.

5. Click `Tom romliste`.
Expected: all pills removed, hint says no rooms registered.

6. Click `Legg til flere` with invalid content (` , ;`).
Expected: alert shown, no list changes.

7. Upload valid room JSON array.
Expected: list is replaced by uploaded rooms.

8. Upload invalid room JSON object.
Expected: error alert, previous list preserved.

## Allocation API + Logic

1. Single applicant, one matching room.
Expected: one assignment, zero unassigned.

2. Two applicants with same pair code and same room.
Expected: both assigned to that room with pair note.

3. Pair code mismatch (`TEAM1` vs `TEAM2`).
Expected: fallback to single winner by priority/lottery rules.

4. Pair code case mismatch (`teamx` vs `TEAMX`).
Expected: still treated as same pair code.

5. Applicant list contains duplicate names.
Expected: each person still treated as separate entry.

6. Available rooms include blanks/null/duplicates.
Expected: cleaned room set, no crash.

7. Applicant has >8 preferences.
Expected: only first 8 preferences are considered.

8. No available rooms.
Expected: everyone goes to unassigned with clear note.

9. Invalid request payload (`applicants: null`, `availableRooms: null`).
Expected: empty response arrays, no 500.

## Lottery/Tie Cases

1. Same seniority and same first choice room for 2+ applicants.
Expected: different runs can produce different winners.

2. Re-run same payload multiple times.
Expected: room allocation varies only where candidates are tied.

3. Pair vs single with equal total seniority.
Expected: verify current intended behavior is documented and stable.

## Failure Injection (How Program Can Break)

1. Stale browser cache serves old `app.js`.
Symptom: buttons do nothing, old hint text remains.
Mitigation: versioned asset URLs + hard refresh.

2. Backend unavailable or very slow.
Symptom: allocation click gives error message or hangs.
Mitigation: timeout + explicit retry UX.

3. Huge applicant payload (thousands).
Symptom: slower response and possible UI freeze.
Mitigation: size limits, backend pagination/batching, perf tests.

4. Invalid or mixed room semantics (single vs pair capacity not modeled).
Symptom: two people could share room when not intended.
Mitigation: add room metadata (`capacity`, `type`) to input model.

5. Conflicting pair groups (`3+` people with same pair code for one room).
Symptom: surprising fallback behavior.
Mitigation: validate pair groups and reject/flag invalid input.

6. Non-deterministic lottery without audit trail.
Symptom: hard to explain who won tie.
Mitigation: log seed and tie groups used per run.

7. Missing client-side telemetry for JS startup errors.
Symptom: "nothing happens" without useful diagnostics.
Mitigation: visible status line + error hook + optional remote logging.

## Suggested Next Hardening Steps

1. Add request/response schema validation tests (contract tests).
2. Add load test for 1000+ applicants and dense preference overlap.
3. Add deterministic "seeded lottery" mode for reproducible audits.
4. Add room metadata model and enforce capacity constraints.
