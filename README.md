# Hazel × GF

A typed structure editor for a small Grammatical Framework clause grammar. It
reuses Hazelnut's semantic ideas—typed holes, a focused tree, and
type-preserving edit actions—without embedding or compiling the Hazel OCaml
application.

One shared abstract tree is linearized into English, German, and Swedish by
the locally installed GF 3.11 runtime. Category hues are shared by the tree,
typed holes, and surface spans. Focus and hover identify exact node
occurrences; morphology annotations expose fused and empty exponents.

**Try it:** <https://wmacmil.github.io/hazel-gf/> — no install needed.

The hosted version needs no GF server: GF runs in the page.
`gf --make --output-format=json` compiles the grammar to `HazelGF.json`
(123 KB gzipped), and the vendored GF TypeScript runtime
(`vendor/gf-typescript`, LGPL-3.0) linearizes it in the browser, tagging
every token with the tree node that emitted it. Incomplete trees are
previewed in the browser either way.

## Run

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>. The command starts both the GF HTTP sidecar and
Vite, and stops both on Ctrl-C.

For the production-shaped server:

```sh
npm run serve
```

Open <http://127.0.0.1:8043/>. GF serves both the static bundle and
`HazelGF.pgf`, so no CORS configuration or custom backend is involved.

Worked trees can also be opened directly:

- `/?example=see`
- `/?example=agreement`

If the RGL is somewhere other than `~/code/gf/gf-rgl/dist/alltenses`, set
`GF_RGL_DIST` before building.

## Views

Four settings, each in the URL and remembered:

- `mode=view|edit`: view is full width; edit adds the palette column (fill,
  clear, wrap, write a word into a hole).
- `operad=flow|tree`: the operad as a SvelteFlow wiring diagram (default) or a
  recursive tree. In the flow view every input port is a typed handle;
  dragging a node's output onto a hole's port moves that subtree there, and
  `isValidConnection` asks the kernel (`editor.ts: moveProblem`), showing the
  reason for a refused wire.
- `layout=right|left|above|below`: where the graph sits relative to the
  sentences; details (tense variations) stay across the bottom.
- `colors=channels|pos`: channels (hue = abstract vs concrete) or parts of
  speech (hue = POS, shade = abstract vs concrete; hues editable in the
  palette popover). See docs/design.md.
- `lines=auto|columns|rows`: languages side by side or one per row. `auto`
  measures the pane and uses columns only when all sentences fit together;
  every sentence then scales (0.55×–2×) to fill its space without clipping.

## Parsing (text → tree)

Type a sentence in any language above the sentences. GF parses it in the
browser (a Web Worker, since a German parse costs ~350 ms of GF prediction);
nothing is pregenerated. One reading loads with Enter; several are listed
with what only each reading uses (*I see the woman with the dog*: `AdvVP` —
the PP modifies the seeing — or `AdvCN` — it modifies the woman). A failed
parse is marked, not rejected: how far it got, words outside the lexicon, and
the words GF would accept next (click one to continue). Capitalization the
grammar requires is repaired (*der mann* → *der Mann*). `parsing.test.ts`
round-trips sampled sentences in every language back to their own trees.

## Writing

Focus any hole and type a word in English, German, or Swedish. Candidates are
the typed ways that word can fill the hole, with the remaining arguments as
holes to fill next (*Frau* in an NP hole → `DetCN ⟦Det⟧ (UseN WomanN)`). An
inflected form also pins what it commits to (*schlief* pins `PAST`). After a
leaf is placed, focus moves to the next hole. See
[docs/writing-and-decks.md](docs/writing-and-decks.md) for sentence entry,
decks, and practice (designed, not built yet).

## Prepositional phrases

`PrepNP : (Prep, NP) → Adv`, `AdvVP : (VP, Adv) → VP`, `AdvCN : (CN, Adv) → CN`,
with *in, on, with, to, under*. The grammar is now recursive, which is why GF
runs in the browser rather than from a precomputed table. Focus a VP or CN and
the palette offers the adverbial as a type-correct wrapper.

Case comes from government. GF's tables do not show which case a preposition
or verb governs, so `npm run oracle` recovers it by governing a pronoun and
reading which paradigm cell comes back (*mit* + *er* → *ihm* = Dat). A word
is labelled `DAT`/`ACC` only where its form marks the case overtly (*dem*,
*ihm*, *him*, *henne*; not *Haus* or *sie*), with the preposition or verb as
its controller. German contractions (*im*, *zum*, *zur*, *in der*) are the
preposition absorbing the article; that word realizes both nodes.

## Tense

`MkS : (Temp, Pol, Cl) → S`. `Temp` has eight leaves—present, past, future,
conditional, and their perfects—built with the RGL's `mkTemp`. Below the
linearizations, **Tense variations** shows the current tree with only its
`Temp` leaf swapped, in all three languages; click a row to adopt it.

GF's brackets attribute auxiliaries (*has*, *wird*, *ska*) to the clause, not
to `Temp`, so `projection.ts` recovers the verb group: the first auxiliary (or
the verb, if there is none) is the finite element and carries the tense label;
perfects add `PERF` to the *have* auxiliary and `PTCP` to the participle.
Agreement follows each language: English marks `3SG` only in the present,
German's finite verb always agrees, and Swedish shows it as `∅`.

## Static build (GitHub Pages)

```sh
npm run preview:static      # static bundle, GF in the browser
npm run oracle              # needs GF + RGL; regenerates oracle/ and public/static/paradigms.json
```

`npm run deploy` compiles the grammar, type-checks, tests, builds the static
bundle and force-pushes `dist/` to the `gh-pages` branch, which GitHub Pages
serves.

`oracle/` holds the GF *server's* bracketed output for all 16416 PP-free
sentences, sharded by tense. It is not shipped: `runtime.conformance.test.ts`
checks that the browser runtime gives the same text, the same token
provenance, and the same morpheme projection. Re-run `npm run oracle` and
commit when the grammar or lexicon changes.

## Verify

```sh
npm run verify
```

This compiles only the small application grammar, type-checks the Svelte app,
runs the editor/provenance tests, and checks three golden GF linearizations.
It does not build the RGL, Hazel, OCaml, GHC, or an opam switch.

`npm run check:layout` (part of verify and deploy) drives the system Chrome
through every layout, example, and line mode, hovering the edge words and
boxes, and fails on a clipped focus outline, avoidable overflow, a pane
covering a sentence, or a needed scrollbar that is not visible.

## Architecture

- `grammar/` — shared abstract syntax and three RGL-backed concretes.
- `src/lib/editor.ts` — typed holes, focus movement, structural edits, import
  validation, and GF serialization.
- `src/lib/gf.ts` — the narrow GF HTTP adapter.
- `src/lib/projection.ts` — bracket-token provenance, node yields, and
  grammar-owned annotations for Swedish suffixed definiteness and agreement.
- `src/components/` — recursive colored tree and linked linearization rows.

Incomplete trees never reach GF. The browser shows category-marked placeholders
until the term is complete; GF then becomes authoritative for the surface text.

See [docs/design.md](docs/design.md) for the connection to the Hungarian gloss
work and the Hazel/Hazelnut sources.
