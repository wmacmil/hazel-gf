# gf-typescript (vendored)

- Source: https://github.com/GrammaticalFramework/gf-typescript
- Commit: af978f4 (2022-07-04), files `src/index.ts` and `src/pgf-json.ts`. Changes:
  a `// @ts-nocheck` header so this app's strict type-check skips them, and one
  added method, `GFConcrete.parseTokens` (marked "hazel-gf addition"), which
  reports how many tokens parsed before a failure.
  One bug fix (marked "hazel-gf fix"): in `pre { … }` linearization only the first
  matching alternative is emitted, as in GF (upstream emitted every match: French
  *le vieil vieil homme*).
- Author: John J. Camilleri. License: LGPL-3.0-or-later
  (https://www.gnu.org/licenses/lgpl-3.0.html), as declared in the upstream package.json.

It is the maintained TypeScript port of GF's `gflib.js` runtime. The app uses it to
linearize (and later parse) GF trees in the browser from `HazelGF.json`
(`gf --make --output-format=json`), so the static site needs no GF server.
