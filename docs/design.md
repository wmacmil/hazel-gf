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
