# Adding a language

A language is a declared profile, not code spread through the app. Adding one is:

1. **A concrete syntax** `grammar/HazelGF<X>.gf` over the shared abstract
   `HazelGF.gf`, built on the RGL (`open Syntax<X>, Paradigms<X>`). Give every
   lexical leaf explicit paradigm arguments (gender, plural, principal parts);
   smart paradigms guess wrong for irregular words, and the tense work already
   caught *sleeped*, *hat gegangen*, *sovde*, and *läsade* that way.
2. **A profile** in `languages.json` (typed in `src/lib/languages.ts`):
   citation cells, infinitive ending, negation patterns, how agreement is
   realized (`fused-suffix`, `personal-ending`, or `zero`), optional personal
   endings / circumfix / suffixed definiteness, the partial-preview lexicon, and
   smoke goldens.
3. **`npm run oracle`**, then review the new golden
   `src/lib/__golden__/morphology.<code>.txt` line by line before committing it.

Nothing else changes: `scripts/build-gf.sh`, `scripts/oracle.mjs`,
`scripts/smoke-gf.mjs`, the runtimes, the palette, the phrase boxes, and every
grid read the registry.

## What must pass

`npm run verify`, which includes:

- `languages.test.ts`, per profile: the concrete is in the compiled grammar;
  its smoke goldens linearize in the browser runtime; its patterns compile;
  every noun and verb has its citation cell in GF's paradigm table; every leaf
  has a preview word.
- `morphology.test.ts`: the reviewed golden, and, for every oracle sentence,
  that morphemes concatenate back to the word and that every inflected word
  occurs in its leaf's GF paradigm.
- `runtime.conformance.test.ts`: the browser runtime equals the GF server on
  every oracle tree (text, token provenance, morpheme projection).

## French readiness

Probed on 2026-09-29 by compiling a throwaway `HazelGFFre` outside the repo
(`/tmp/frprobe`) and reading the browser runtime's token tags. French compiles
against the local RGL (`SyntaxFre.gfo` present). Irregular verbs need
`ParadigmsFre`'s 7 principal parts (*tenir, tiens, tenons, tiennent, tint,
tiendra, tenu*). What the probe showed, and what each needs before French lands:

| Output (token@node) | Issue | Needed |
|---|---|---|
| `l'@Definite &+@Definite homme@ManN` | GF's BIND token `&+` is emitted literally; gf-typescript's `linearize` does not join it | Join bound tokens in `browser-gf.ts` into one word whose morphemes come from different nodes (*l'·homme* = `Definite` + `ManN`); add `&+` handling to the conformance test |
| `ne@UseV dort@SleepV pas@UseV` | Negation is two discontinuous tokens, both attributed to `UseV` | `negation: "^(ne|n'|pas)$"`; `annotate` must link **every** matching word to `Pol` (today only the first); the `Pol` phrase box then has two runs |
| `je@IPron la@ShePron vois@SeeV2` | Object clitic before the verb | Nothing new: the VP box is discontinuous, already supported |
| `je l'@ShePron ai@PredVP vue@SeeV2` | Past participle agrees with a preceding clitic (*vue* = FEM) | A `gender` feature axis (warm hue), with the object pronoun as its controller |
| `elle n' a pas marché` | Auxiliary selection (*avoir* here) | For *être* verbs (*aller*, *venir*), declare them with `ParadigmsFre`'s *être* flag; agreement *allée* again needs `gender` |
| `nous courrons` | Future is synthetic (one word), unlike English/German/Swedish | Verb cells differ: read French `VForm` cells as the parent app's `pipeline/french_verbs.py` does for `gf/rgl-audit/french-verbs/ConjFr.gf` (Bescherelle) and map them in the profile's personal endings |

Agreement in French is a `personal-ending` language like German, but its rows
are per tense *and* mood; the profile's `personalEndings.rows` will need one
entry per tense label.
