# Writing, and decks of cards

How the editor becomes something you *write* in, from a vocabulary, and how
that vocabulary and its phrases become decks. Part 1 is built; parts 2–4 are
the design.

## 1. Word entry into a typed hole (built)

`src/lib/writing.ts`, `src/components/WriteBox.svelte`. When a hole of sort C
is focused, you can type a word in any profile's language:

- **Index.** Every form in GF's paradigm tables (`public/static/paradigms.json`)
  maps back to its leaf and the cells that hold it (*schlief* → `SleepV`,
  `VImpfInd Sg P1/P3`). Leaves with no table (prepositions, polarity) are
  indexed by their preview word.
- **Typing.** A candidate is the shortest chain of constructors from C down to
  the leaf; every other argument becomes a typed hole, an *obligation*, as in
  Hazel. *Frau* in an NP hole is `DetCN ⟦Det⟧ (UseN WomanN)`. *schlief* in a
  blank S hole is the whole skeleton `MkS ⟦Temp⟧ ⟦Pol⟧ (PredVP ⟦NP⟧ (UseV
  SleepV))`.
- **Pins.** An inflected form pins the tense/aspect features that *every*
  matching cell agrees on: *schlief* pins `PAST` (the Temp palette then offers
  only past tenses); *geschlafen* pins `PTCP`. Syncretic forms pin nothing:
  *slept* (past or participle), Swedish *sov* (preterite or imperative).
- **Kernel.** `insertAt` is typed like `moveProblem`: only holes, only the
  hole's sort. Focus goes to the first obligation, else to the next hole.

## 2. Sentence entry (designed)

Type a whole sentence in a language and let GF parse it. The vendored runtime
already has `parseString` and prefix `complete`
(`vendor/gf-typescript/index.ts`).

- **0 parses**: mark, don't reject. Show the longest prefix that `complete`
  accepts and underline the first token it cannot continue; unknown words
  (absent from the form index) are marked separately. This follows Hazel's
  total error localization ("marking", POPL 2024, in the local library):
  the editor stays in a meaningful state around the error.
- **1 parse**: load it as the document, keep the text as the prompt.
- **n parses**: an ambiguity picker. Each reading is shown as its operad
  (tree/flow view) with its linearization in the *other* languages, which is
  usually where the ambiguity becomes visible (*I see the woman with the dog*:
  `AdvVP` vs `AdvCN`).
- **Ghost text**: while typing, `complete` proposes next words, filtered to
  the lexicon.

Parsing and word entry meet in the middle: a partly parsed sentence can leave
typed holes to fill by word entry.

## 3. Decks (designed)

A deck is data, versioned and licensed:

```ts
type Deck = {
  id: string
  license: string              // must be in the open allow-list (test-enforced)
  languages: string[]          // language profile ids
  lexicon: LexicalEntry[]      // new leaves, with explicit paradigm arguments per language
  phrases: { term: string; tags: string[] }[]   // GF terms: cards are trees
}
type LexicalEntry = {
  id: string                   // e.g. KitchenN
  category: 'N' | 'V' | 'V2' | 'A' | 'Adv' | 'Prep'
  forms: Record<string, string[]>  // per language: mkN/mkV arguments (gender, plural, principal parts)
  gloss: string
}
```

- **Phrases load on the fly**: they are just terms over the current grammar,
  checked with `fromGfTerm` + `validateDocument`.
- **Vocabulary needs a rebuild**, because GF cannot compile in the browser.
  A generator writes `grammar/LexDeck<X>.gf` (abstract + one concrete per
  language) from `lexicon`, with explicit paradigm arguments, as in the verb
  fixes to `HazelGFGer.gf`. Then `gf --make` runs, which takes about a second
  for this grammar.
  - Local: a watcher recompiles and the dev server reloads.
  - Static site: decks are prebuilt bundles (`HazelGF.<deck>.json` +
    `paradigms.<deck>.json`), selected with `?deck=`.
- **Gold check**: every generated form is compared against UniMorph (the
  parent app already ships UniMorph tooling for Hungarian and German), and the
  deck's golden segmentation is reviewed like `__golden__/*.txt`.
- **First deck**: self-authored and openly licensed (house/city/food nouns,
  motion verbs), seeded by the place nouns already in the grammar (`TableN`,
  `GardenN`, `CityN`). Deutsch 4000 (`memrise-community`) must never enter
  this public repo; a licence allow-list test enforces it.

## 4. Practice (designed)

A card is a tree. Practice is the editor with the answer hidden:

- **Prompt**: the card's linearization in the learner's language, plus the
  target sort (usually `S`).
- **Answer**: build it by word entry (part 1) or sentence entry (part 2) in
  the target language.
- **Grading**: tree equality, not string equality, so word order and spelling
  variants that GF accepts are right by construction.
- **Feedback at the morpheme level**: diff the expected and given
  linearizations morpheme by morpheme, using the same sub-boxes. A wrong
  ending shows as a colored sub-box mismatch (expected *schläf·t*, got
  *schlaf·t*: a changed stem missed), and hovering it lights the controller
  (the subject for agreement, `Temp` for tense), which says *why*.
- **Scheduling**: the parent Hungarian app's SM-2 review loop, keyed by card
  id and tags; its cards already carry `absTree`.
