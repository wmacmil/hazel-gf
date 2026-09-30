import { CONSTRUCTORS, profile as signature } from './grammar'
import { findNode, freshId, hole, nextHole, outputOf, preorder, replaceNode, toPartialTerm } from './editor'
import type { Workbench } from './builder'
import type { Paradigms } from './morphology'
import type { CategoryId, Node, NodeId } from './model'
import { searchExpressions } from './search'

/**
 * Keyboard grafting: every edit is "put an expression at the focused node",
 * and the expression can come from anywhere — words parsed in any language
 * (concrete → abstract), an operation of the right type (abstract, direct),
 * or a fragment already on the bench. Three verbs, one prompt:
 *
 * - insert (i): write something new here;
 * - graft (g):  bring a bench fragment here;
 * - extend (e): keep what is here and build around it — the new expression
 *   has a hole of this node's sort, and this node fills it (*the man* +
 *   `_ and the woman` → *the man and the woman*).
 *
 * Nothing is lost: a subtree that is replaced goes to the bench (like cut, x).
 * Pure; App applies the results to the document or to a bench fragment.
 */
export type GraftMode = 'insert' | 'graft' | 'extend'
export const GRAFT_MODES: GraftMode[] = ['insert', 'graft', 'extend']

export type GraftCandidate = {
  key: string
  source: 'parse' | 'bench' | 'function'
  expression: Node
  /** What to show: the words for a parse, the operation or fragment term otherwise. */
  title: string
  detail: string
  /** For bench candidates: the fragment it comes from (removed from the bench when used). */
  fragment?: NodeId
  language?: string
  /** For word matches from the type search: features the form commits to (schlief → PAST). */
  pins?: string[]
}

export type TreeEdit = { root: Node; focus: NodeId; displaced?: Node }

const firstHole = (node: Node, sort?: CategoryId) => preorder(node).find(item => item.kind === 'hole' && (!sort || item.expected === sort))

/** Put `replacement` at `nodeId`; a replaced non-hole subtree comes back as `displaced`. Focus: its first obligation, else the next hole. */
export function substitute(root: Node, nodeId: NodeId, replacement: Node): TreeEdit {
  const target = findNode(root, nodeId)
  if (!target) throw new Error('Unknown node')
  if (outputOf(replacement) !== outputOf(target)) throw new Error(`Sort ${outputOf(replacement)} does not fit ${outputOf(target)}`)
  const next = replaceNode(root, nodeId, replacement)
  const obligation = firstHole(replacement)
  return { root: next, focus: obligation?.id ?? nextHole(next, replacement.id), displaced: target.kind === 'hole' ? undefined : target }
}

/** Why `wrapper` cannot extend a node of sort `sort`, or undefined if it can. */
export function extendProblem(sort: CategoryId, wrapper: Node): string | undefined {
  if (outputOf(wrapper) !== sort) return `Gives ${outputOf(wrapper)}, not ${sort}`
  if (!firstHole(wrapper, sort)) return `Has no ${sort} hole to put this into`
}

/** Build around `nodeId`: it fills `wrapper`'s first hole of its sort, and `wrapper` takes its place. */
export function extend(root: Node, nodeId: NodeId, wrapper: Node): TreeEdit {
  const target = findNode(root, nodeId)
  if (!target) throw new Error('Unknown node')
  const problem = extendProblem(outputOf(target), wrapper)
  if (problem) throw new Error(problem)
  const filled = replaceNode(wrapper, firstHole(wrapper, outputOf(target))!.id, target)
  const next = replaceNode(root, nodeId, filled)
  const obligation = preorder(filled).find(item => item.kind === 'hole' && !findNode(target, item.id))
  return { root: next, focus: obligation?.id ?? filled.id }
}

/** Cut `nodeId` out, leaving a hole of its sort; the cut subtree is `displaced`. A hole has nothing to cut. */
export function cut(root: Node, nodeId: NodeId): TreeEdit | undefined {
  const target = findNode(root, nodeId)
  if (!target || target.kind === 'hole') return undefined
  const gap = hole(outputOf(target))
  return { root: replaceNode(root, nodeId, gap), focus: gap.id, displaced: target }
}

/** A fresh-id copy (bench fragments and the document must never share node ids). */
export function cloneFresh(node: Node): Node {
  return node.kind === 'hole' ? { ...node, id: freshId() } : { ...node, id: freshId(), children: node.children.map(cloneFresh) }
}

export const termOf = (node: Node) => toPartialTerm(node).replace(/\?(\w+)/g, '⟦$1⟧')

type Parsed = { expression: Node; text: string; language: string; via: string[] }

/**
 * The candidates for one prompt, best first. `sort` is the focused node's sort
 * (undefined for a new bench fragment: anything goes). `excluded` is the
 * fragment being edited, which cannot be grafted into itself.
 */
export function graftCandidates(options: {
  mode: GraftMode
  sort: CategoryId | undefined
  query: string
  parsed: Parsed[]
  bench: Workbench
  paradigms: Paradigms | undefined
  excluded?: NodeId
}): GraftCandidate[] {
  const { mode, sort, query, parsed, bench, paradigms, excluded } = options
  const text = query.trim().toLocaleLowerCase()
  const fits = (node: Node) => !sort || (mode === 'extend' ? !extendProblem(sort, node) : outputOf(node) === sort)

  const fromParse: GraftCandidate[] = parsed.filter(reading => fits(reading.expression)).map(reading => ({
    key: `parse:${reading.language}:${toPartialTerm(reading.expression)}`, source: 'parse', expression: reading.expression,
    title: reading.text, detail: termOf(reading.expression), language: reading.language,
  }))

  const fromBench: GraftCandidate[] = bench.fragments
    .filter(fragment => fragment.id !== excluded && fits(fragment))
    .filter(fragment => !text || termOf(fragment).toLocaleLowerCase().includes(text))
    .map(fragment => ({ key: `bench:${fragment.id}`, source: 'bench', expression: fragment, fragment: fragment.id, title: termOf(fragment), detail: `bench · ${outputOf(fragment)}` }))

  let fromFunctions: GraftCandidate[]
  if (mode === 'extend') {
    // Operations giving this sort with an input of it: the node goes into that input.
    fromFunctions = sort ? CONSTRUCTORS
      .filter(item => item.output === sort && item.inputs.includes(sort) && !item.id.startsWith('Hole'))
      .filter(item => !text || item.id.toLocaleLowerCase().includes(text) || item.label.toLocaleLowerCase().includes(text))
      .map(item => ({
        key: `function:${item.id}`, source: 'function' as const,
        expression: { kind: 'apply' as const, id: freshId(), constructor: item.id, output: item.output, children: item.inputs.map(hole) },
        title: item.id, detail: `${item.label} · ${signature(item)}`,
      })) : []
  } else if (!text && sort) {
    // Nothing typed yet: every operation that returns this sort.
    fromFunctions = CONSTRUCTORS.filter(item => item.output === sort && !item.id.startsWith('Hole') && !item.editorOnly).map(item => ({
      key: `function:${item.id}`, source: 'function' as const,
      expression: { kind: 'apply' as const, id: freshId(), constructor: item.id, output: item.output, children: item.inputs.map(hole) },
      title: item.id, detail: `${item.label} · ${signature(item)}`,
    }))
  } else {
    fromFunctions = searchExpressions(query, sort, paradigms, 12).map(result => ({
      key: `function:${result.path.join('>')}:${result.word?.form ?? ''}`, source: 'function' as const, expression: result.expression,
      title: result.word ? result.word.form : result.path.join(' › '), detail: `${termOf(result.expression)} · ${signature(result.operation)}`,
      language: result.word?.language, pins: result.word?.pins,
    }))
  }

  const ordered = mode === 'graft' ? [fromBench, fromParse, fromFunctions] : [fromParse, fromFunctions, fromBench]
  const seen = new Set<string>()
  return ordered.flat().filter(candidate => {
    const term = `${candidate.source === 'bench' ? candidate.fragment : ''}:${toPartialTerm(candidate.expression)}`
    return !seen.has(term) && (seen.add(term), true)
  })
}
