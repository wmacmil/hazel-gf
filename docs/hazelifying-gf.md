# Toward a Hazel-style editor for GF trees

This note records the bridge now implemented in `apps/hazel-gf/`. The first
prototype uses English, German, and Swedish; Hungarian remains a later
conformance target because its local RGL coverage is incomplete. The operadic
tree/fiber visualization is directly inspired by the Hungarian gloss and GF
phrase-card work in the parent repository.

## Structural correspondence

GF abstract-syntax categories are the sorts of the syntax. A GF constructor
such as

```gf
PredVP : NP -> VP -> Cl
```

has the operation profile

```text
(NP, VP) → Cl
```

and a constructor such as the local Hungarian demonstration's

```gf
verb2Form : V2Lex -> Obj -> Pers -> Num -> Form
```

has the profile

```text
(V2Lex, Obj, Pers, Num) → Form
```

The categories are heterogeneous input and output sorts. The resulting GF
abstract syntax is therefore naturally read as an operadic term language:
constructor composition is tree substitution at matching sorts. This statement
does not by itself choose symmetric versus nonsymmetric structure; the ordered
arguments in the GF signatures should be preserved unless an explicit symmetry
is justified.

Hazelnut contributes a different layer: a typed zipper, holes, and edit-action
semantics for *incomplete* trees. The useful synthesis is:

1. a cursor focuses one subterm in a GF abstract tree;
2. an empty hole remembers the required GF category at that position;
3. the palette contains exactly constructors whose result category matches the
   focused hole;
4. choosing a constructor replaces one hole by typed child holes;
5. movement, deletion, construction, and completion remain defined even while
   the tree is incomplete;
6. concrete syntaxes may project partial trees without being treated as the
   source of truth.

## Minimal typed state

```text
Category       := GF abstract category (S, Cl, NP, VP, V2, ...)
Constructor    := named profile (A₁, ..., Aₙ) → B
Term B         := complete GF tree of category B
ZTerm B        := focused/incomplete GF tree whose outer category is B
Hole B         := missing subtree required to have category B
Edit Γ A B     := action taking a focused A-state to a focused B-state
```

The first prototype should avoid pretending that all GF functions share one
untyped `Node` shape. Category-indexed holes and constructor profiles are the
mechanism that rules out grammatically impossible products.

## First vertical slice

Use the RGL's clause fragment rather than the project's older string-valued
hand grammar:

```text
(NP, VP) → Cl
(Cl) → S
(V2, NP) → VP
(V) → VP
```

After the three-language slice is stable, add Hungarian feature-bearing lexical
operations already demonstrated in `gf/rgl-demo/HunDemo.gf`, especially:

```text
(V2Lex, Obj, Pers, Num) → Form
```

This separates two obligations:

- abstract grammaticality comes from GF category-correct construction;
- Hungarian realization, including definite/indefinite conjugation, comes from
  the Hungarian RGL concrete syntax.

## Research reading order

1. **Hazelnut (POPL 2017)** — bidirectional typing, zippers, edit actions,
   sensibility, movement erasure invariance.
2. **Toward Semantic Foundations for Program Editors (SNAPL 2017)** — overall
   semantic program-editor agenda.
3. **Hazelnut Live (POPL 2019)** — dynamic meaning for incomplete programs.
4. **Gradual Structure Editing with Obligations (VL/HCC 2023)** — natural text
   entry without abandoning structure.
5. **Live Pattern Matching with Typed Holes (OOPSLA 2023)** — holes in patterns.
6. **Total Type Error Localization and Recovery (POPL 2024)** — principled
   recovery around ill-typed regions.
7. **Polymorphism with Typed Holes (TFP 2024)** — polymorphic terms and holes.
8. **Grove (POPL 2025)** — bidirectionally typed collaborative structure
   editing and commutative actions.
9. **Incremental Bidirectional Typing (OOPSLA 2025)** — efficient updates after
   localized edits.

## Non-goals for the first prototype

- Do not make concrete strings the editing model.
- Do not accept an arbitrary tree and validate only after the fact.
- Do not conflate GF categories with linguistic feature values.
- Do not claim parametric polymorphism merely because there are many GF
  categories; polymorphic constructor schemes require quantified category
  variables and appropriate naturality/functoriality conditions.
- Do not modify the parent Hungarian repository until an explicit integration
  boundary and test plan are agreed.
