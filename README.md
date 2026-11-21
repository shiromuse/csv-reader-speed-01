# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/shiromuse/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/shiromuse/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A drop-in, dependency-free replacement for make.fun's csv-reader 1.0.0 that returns identical `{columns, rows, errors}` on every input — including broken CSV — while running several times faster. The parser core lives in `solve.js` (it exports `run(input)`); `main.ts` is the harness driver that reads `/input/cases.json` and writes `/output/answers.json`.

Verified locally against the reference implementation on 10,000+ adversarial and fuzzed cases (exact match on all of them) and through the official scorer (6/6 on the practice set and on freshly generated sets).

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=vaf6tbqs&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
