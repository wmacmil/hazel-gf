# Keyboard navigation and camera

Ported from the user's document-configuration-system (the Operadic Wiki),
after reading its three layers across branches:

- **Command layer** — `docconfig-commands` (vim-modal work, `3914e11`,
  July 2026): semantic command ids, key profiles keyed `context.mode.key`,
  a stateless resolver, and one dispatch adapter in the app. Here:
  `src/lib/nav/commands.ts`, one profile (`vim`), contexts `tree` / `sentence`.
- **Lanes** — `feature/latex-semantic-objects` (`d5800ed`, `b6ea526`,
  Sep 2026): typed document stops in order; `j/k` walk the configured lane and
  `s/d` walk formulas, a separate lane that "never changes tree traversal".
  Here `s/d` is the sentence lane: word by word through the active language,
  keeping its own position (`WordStop`, like docconfig's `focusedStopId`).
- **Graph interaction theory** — `docconfig-graph-theory` on
  `feature/local-surface-revisions-v1` (`b05a567`): keys emit directions;
  a strategy (`spatial`, `structural`, `hybrid-tree`) interprets them over the
  active projection's geometry; camera goals are planned purely
  (`zoom-center` with a floor that never zooms out, `center`, `reveal`,
  `fit-scene`); pointer focus never emits a camera goal. Here:
  `src/lib/nav/graph-theory.ts`, ported with attribution.

## The bifurcated focus

One focused node, two regions (`Tab` switches; clicking a pane selects it):

| key | tree region (SvelteFlow operad) | sentence region (text + phrase boxes) |
|---|---|---|
| `h j k l` | `k`/`j` parent / first child; `h`/`l` previous / next node on the same tree level (siblings, then cousins) | identical — structural, so both trees always agree |
| `s d` | previous/next word of the active sentence | same |
| `[ ]` | previous/next language row | same |
| `⌥h ⌥l ⌥k ⌥j` | structural parent/child/previous/next sibling, layout-independent | same |
| `=` | fit the whole tree | same |

Both trees draw the same focus, so they always move together; only the
geometry that interprets a direction differs.

## Adaptations (and why)

- **hjkl is structural in both trees** (`structural-v1` with a `level`
  sequence, a documented addition). The first port interpreted h/l spatially
  over each drawing, which made the two trees disagree and dead-ended where a
  phrase box spans the whole sentence (PredVP). Spatial strategies remain in
  `lib/nav/graph-theory.ts` for views where layout is the meaning.

- **Edge half-plane** (`halfPlane: 'edge'`, a documented addition to the
  ported spatial algorithm): nested phrase boxes overlap their children, so a
  child's centre can sit right of its parent's; the W3C spatial-navigation
  rule (candidate beyond the current edge) keeps `l` on the next constituent.
  The flow view keeps the original centre rule.
- **Landing node**: GF attributes auxiliaries to the clause, so a word lands
  on a leaf it realizes if any (*doesn't* → `Negative`, *hat* → its tense,
  *im* → `InPrep`), else the deepest node.
- **Camera**: the scene fits on entry and when a different tree loads (the
  root changes), never on selection. The old re-fit ran whenever SvelteFlow
  re-evaluated node initialization, which clicking a node triggers — the
  zoom-out-on-click bug.

`npm run check:nav` (in verify and deploy) exercises all of this with real
keypresses in Chrome.
