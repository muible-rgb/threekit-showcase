# Benchmarks - the model behind the table

`long_game_benchmarks.py` is the source of truth for every percentile the app
shows. `build.py` regenerates the tables from it. The app never runs either:
it ships `data/benchmarks/long_game_lookup_v1.0.0.json`, a precomputed table,
and `src/lib/scoring/benchmark.ts` only looks values up.

Full account of sources, grades and limitations: `docs/long_game_methodology_v1.0.0.md`.

```
pip install numpy scipy pandas openpyxl
python3 tools/benchmarks/build.py        # writes tools/benchmarks/out/
```

`scoring.reference.js` is the zero-dependency JavaScript scorer the table was
delivered with. `src/lib/scoring/benchmark.ts` is a typed port of it and must
return the same number for every input; the validation table in
`src/lib/scoring/benchmark.test.ts` is what holds the two together.

## Publishing a new version

1. Change the model. Bump `VERSION` in `long_game_benchmarks.py` - PATCH for
   documentation only, MINOR for a recalibration that moves scores, MAJOR for a
   protocol or convention change.
2. `python3 tools/benchmarks/build.py`.
3. Diff `out/long_game_lookup_vX.Y.Z.json` against the previous version and
   list every (event, sex, age) cell that moved by more than two points.
4. Copy the lookup into `data/benchmarks/` and add it to `BENCHMARKS` in
   `src/lib/benchmarks/registry.ts`. Point `CURRENT_BENCHMARK_VERSION` at it.
5. Update the validation table in the test if the reference values changed,
   and say so in CHANGELOG.md.

Shipped tables are never edited. Results carry the version they were scored
under and are scored against it on read, so a new table does not move anyone's
history.
