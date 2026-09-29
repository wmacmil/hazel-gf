# Design provenance

## The Hungarian precedent

The prototype deliberately reproduces the relationship already present in the
parent Hungarian learning application:

- a card retains the GF `absTree` it linearizes;
- both surface projections carry colored `segments`;
- feature chips use the same palette as the realized morphology;
- a segment with several feature preimages receives a blended fiber color;
- a grammatical feature with no overt exponent can appear as `∅`.

The relevant implementation evidence was inspected in
`app/src/lib/components/flashcard/CardFace.svelte`,
`pipeline/bilingual_cards.py`, and
`gf/rgl-audit/POLYMORPHIC-MORPHOLOGY.md` in the parent workspace. The new
editor strengthens that card representation into a live relation:

```text
focused abstract node ⇄ realization fiber ⇄ Eng / Ger / Swe span
```

GF bracket output supplies lexical token provenance. The application grammar
supplies the small amount of morphology metadata that bracket output erases,
such as Swedish `kvinna·n` and present agreement with an empty Swedish person
exponent.

## Hazel/Hazelnut contribution

The editor follows the typed-hole and zipper discipline summarized in
[hazelifying-gf.md](hazelifying-gf.md). The key sources are:

- [Hazelnut: A Bidirectionally Typed Structure Editor Calculus (POPL 2017)](https://arxiv.org/abs/1607.04180)
- [Live Functional Programming with Typed Holes (POPL 2019)](https://doi.org/10.1145/3290327)
- the Hazel project, [hazel.org](https://hazel.org), and its implementation,
  [hazelgrove/hazel](https://github.com/hazelgrove/hazel)

The OCaml implementation is research evidence, not a runtime dependency. The
TypeScript editor enforces the relevant sensibility invariant directly: every
operation with profile `(A₁, ..., Aₙ) → B` can fill only a `B` hole, and it
creates child holes of colors `A₁, ..., Aₙ`.

## Color and occurrence identity

Hue denotes the operadic color/category. It is therefore stable across every
occurrence of `NP`, `VP`, and the other categories. A black focus outline—not a
new hue—identifies one exact occurrence. Selecting a structural node highlights
the union of its descendants' surface fibers in all three concrete syntaxes.

Feature labels are a second, morphological layer. They explain why a surface
token can realize several coordinates without conflating those coordinates
with the syntactic category palette.

## Two surfaces: operad and algebra

The abstract and concrete sides are deliberately different materials, so they
can never be mistaken for each other (the doctrine from the June 2026
coloring-demo prompts: "the colors of the operad and then the colors in the
algebra … half the color spectrum for POS and the other half for morphology"):

| | Operad (abstract syntax) | Algebra (each concrete syntax) |
|---|---|---|
| Material | dark blueprint, monospace operation cards | paper, serif words |
| Hue means | the sort (GF category) | the feature axis (tense, aspect, agreement, polarity, definiteness) |
| Hue range | cool half, 120°–276° (`CATEGORY_COLORS`) | warm half, 328°–56° (`FEATURE_COLORS`) |
| Shows | operations, profiles `(A₁,…,Aₙ) → B`, typed ports | words → morphemes: stem, *changed stem* (wavy), affix, ∅ |

The operad reaches the paper only as hairline **phrase boxes** under each
sentence (the little-discs picture from coloring-demo Trial 6): one box per
node over the words it yields, dashed and numbered when the yield is
discontinuous (*hat … geschlafen*). Focus is an overlay (white on the
blueprint, black on paper) and never recolors anything.
`src/lib/style.test.ts` checks the two hue ranges stay disjoint.

Morphemes come from GF's own paradigm tables (`public/static/paradigms.json`,
from `l -table`), not hand-written splits. Each morpheme records the nodes
that control it, so hovering *-s* in *he sleeps* lights `HePron` and the
`Temp` leaf. Clicking a tense/aspect morpheme pins that feature, which
restricts the `Temp` palette and fades the tense variations it rules out.
`src/lib/__golden__/morphology.txt` is the reviewed segmentation of the whole
verb lexicon; `morphology.test.ts` also checks, for all 16416 sentences, that
morphemes concatenate back to the word and that inflected words occur in
GF's paradigm for their leaf.

## Two colour theories (`colors=channels|pos`)

`src/lib/palette.svelte.ts` is the only source of colour; every component asks
it for a sort's *abstract* shade (operad cards, ports, wires) or *concrete*
shade (phrase boxes, words).

- **channels** (default): hue is the channel. Sorts take the cool half of the
  wheel in the operad, feature axes the warm half in the text; morphemes are
  coloured by their fiber. `style.test.ts` keeps the halves disjoint.
- **pos**: hue is the part of speech (noun, pronoun, determiner, verb,
  adposition, clause, tense · polarity), and *shade* is the channel: a deep
  fill with a bright accent in the abstract operad, a light wash with dark ink
  in the concrete text. A verb is the same hue as a card and as a word; only
  its lightness says which projection it is in. Exponents take a deeper wash
  than stems; feature labels still name the features. Each family's hue is
  editable (the palette popover) and remembered locally.
  `palette.test.ts` checks: one family per sort, one hue per family in both
  projections, abstract dark (< 35% lightness) and concrete light (> 80%).
