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

## Operad views

The abstract tree can be drawn as the recursive **tree**, as a SvelteFlow
**flow** wiring diagram, or **both** side by side (the default). Choose with
the toggle above the tree, or with `?operad=tree|flow|both`; the choice is
remembered. Both views render the same `OperadCard` and share focus and hover.

In the flow view every input port is a typed handle. Dragging a node's top
(output) handle onto a hole's port moves that subtree there and leaves a hole
of the same sort behind. `isValidConnection` asks the kernel
(`editor.ts: moveProblem`), and the canvas shows the reason for a refused
wire, e.g. *Sort VP does not match port NP*. The canvas is a projection of the
document, rebuilt from the tree on each change, never edited in place.

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
