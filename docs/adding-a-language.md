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

## French (landed 2026-09-30)

French was the first language added through this checklist. The 2026-09-29
probe predicted what it would stress; this is what each needed.

| Issue | What was done |
|---|---|
| GF's BIND token `&+` (*l' &+ homme*) | The browser runtime's text joins bound tokens as the server does; the projection drops `&+` and marks the next segment `bound`, matching surface words by concatenation. A bound word renders flush against the previous one (dotted seam): *l'·homme* is one written word whose morphemes come from `Definite` and `ManN`. The parser splits typed elisions (*l'homme* → `l'` `homme`) unless the whole word is known (*aujourd'hui*). |
| *ne … pas*: two words, both attributed to the VP | `negation: "^(ne\|n'\|pas)$"`; every negation word of a negative clause realizes `Pol`, so its phrase box has two runs. |
| `pre { … }` variants (*vieux/vieil*, *le/l'*, *je/j'*) missing from `l -table` | The oracle adds each leaf's `SymKP` alternatives from the compiled grammar as `pre N` cells. A variant is allomorphy, never agreement. Fixed a vendored gf-typescript bug: every matching alternative was emitted (*le vieil vieil homme*); now the first wins, as in GF. |
| Participle agreement (*elle est venue*, *je l'ai vue*) | `participleAgreement: "(VPart Masc Sg)"`: a participle in another form carries `AGR` on its ending (*ven·u·e*), controlled by the object (the preceding clitic) or else the subject. |
| *être* selection | `IrregFre.venir_V` carries it; nothing else needed. |
| Synthetic future and conditional (*courrons*, *achèterais*) | Profile rows per tense (`PRES`, `PAST` = imparfait, `FUT`, `COND`). Endings are lists per person (3SG *-e / -t / -d* by conjugation class) with `prefer: "ending"`, giving *nag·ent*, *dor·t*, *cour·r·ons*; a tense row's own stem where it extends the lexical one (*voy·ai·t*, *lis·ai·t*); no present-tense marker (*voi·s*). |
| Preposition inside the article's form (*à la*, *au*) | A word that is the preposition's own form realizes the preposition (*à* + *la[DEF]*); a fused one (*au*) realizes both. |
| Irregular comparatives (*meilleur*) | The oracle also reads the `compar` field; analytic comparatives put `CMP` on *plus*. |

The goldens (`*.fr.txt`) were reviewed line by line; adding French left the
English, German, and Swedish goldens byte-identical.
