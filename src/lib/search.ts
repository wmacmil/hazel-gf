import { CATEGORIES, type ApplyNode, type CategoryId, type Constructor, type LanguageId } from './model'
import { CONSTRUCTORS, profile as signature } from './grammar'
import { preorder } from './editor'
import { LANGUAGES } from './languages'
import type { Paradigms } from './morphology'
import { build, candidates as wordCandidates, chainTo, formIndex, type FormEntry } from './writing'

/**
 * Type-directed search over the operad (Hoogle-style): find expressions whose
 * output fits the focused hole. A query is a name/label (PredVP, adjective), a
 * word in any language (Frau, schlief), or a signature: `NP -> VP` means takes
 * an NP and gives a VP, `-> AP` anything giving an AP. Each result is a whole
 * typed expression for the hole: the shortest chain from the hole's sort down
 * to the matched operation, every other argument left as a hole (obligation).
 */
export type SearchResult = {
  expression: ApplyNode
  operation: Constructor
  /** Constructors from the hole's sort down to the operation, outermost first. */
  path: string[]
  obligations: number
  matched: 'name' | 'word' | 'signature'
  /** For word matches: the word, its language, and the features its cells agree on. */
  word?: { form: string; language: LanguageId; pins: string[] }
  rank: number
}

const SORTS = new Set<string>(CATEGORIES)
const normalize = (text: string) => text.trim().toLocaleLowerCase()

/** `NP -> VP`, `NP, VP -> Cl`, `-> AP`, `: AP`; undefined if the query is not a signature. */
export function parseSignature(query: string): { inputs: CategoryId[]; output?: CategoryId } | undefined {
  const text = query.trim().replace(/→/g, '->').replace(/^::?\s*/, '-> ')
  if (!text.includes('->')) return undefined
  const parts = text.split('->').map(part => part.trim())
  const output = parts.pop()
  const inputs = parts.join(',').split(/[,\s]+/).filter(Boolean)
  const valid = (sort: string | undefined) => !sort || sort === '_' || SORTS.has(sort)
  if (!inputs.every(valid) || !valid(output)) return undefined
  return { inputs: inputs.filter(sort => sort !== '_') as CategoryId[], output: output && output !== '_' ? output as CategoryId : undefined }
}

const obligationsOf = (node: ApplyNode) => preorder(node).filter(item => item.kind === 'hole').length

/** The expression for `operation` in a hole of sort `target` (or the operation alone, with no target). */
function expressionFor(operation: Constructor, target: CategoryId | undefined): { expression: ApplyNode; path: string[] } | undefined {
  const chain = target ? chainTo(target, operation.output) : []
  if (!chain) return undefined
  const expression = build(chain, operation.id)
  return { expression, path: [...chain.map(step => step.constructor), operation.id] }
}

export function searchExpressions(query: string, target: CategoryId | undefined, paradigms: Paradigms | undefined, limit = 12): SearchResult[] {
  const text = normalize(query)
  if (!text) return []
  const results: SearchResult[] = []
  const push = (operation: Constructor, matched: SearchResult['matched'], rank: number, word?: SearchResult['word']) => {
    const found = expressionFor(operation, target)
    if (!found) return
    results.push({ ...found, operation, matched, rank: rank + found.path.length, obligations: obligationsOf(found.expression), word })
  }

  const wanted = parseSignature(query)
  if (wanted) {
    for (const operation of CONSTRUCTORS) {
      if (wanted.output && operation.output !== wanted.output) continue
      const inputs = [...operation.inputs]
      if (!wanted.inputs.every(sort => { const at = inputs.indexOf(sort); if (at < 0) return false; inputs.splice(at, 1); return true })) continue
      push(operation, 'signature', operation.inputs.length === wanted.inputs.length ? 0 : 1)
    }
  } else {
    for (const operation of CONSTRUCTORS) {
      const id = operation.id.toLocaleLowerCase(), label = operation.label.toLocaleLowerCase()
      const rank = id === text || label === text ? 0 : id.startsWith(text) || label.startsWith(text) ? 2 : id.includes(text) || label.includes(text) ? 4 : -1
      if (rank >= 0) push(operation, 'name', rank)
    }
    // Words with no hole to fill (the builder): each matching leaf on its own.
    if (paradigms && !target) {
      for (const language of LANGUAGES) {
        for (const [form, entries] of formIndex(paradigms, language.id)) {
          if (!form.startsWith(text)) continue
          for (const entry of entries) {
            const operation = CONSTRUCTORS.find(item => item.id === entry.leaf)
            if (operation) push(operation, 'word', form === text ? 1 : 3, { form: entry.form, language: entry.language, pins: [] })
          }
        }
      }
    }
    // Words in every language, typed through the same chains (writing.ts).
    if (paradigms && target) {
      for (const language of LANGUAGES) {
        for (const candidate of wordCandidates(formIndex(paradigms, language.id), target, query, 4)) {
          const operation = CONSTRUCTORS.find(item => item.id === candidate.leaf)!
          const exact = normalize(candidate.form) === text
          const entry: FormEntry = candidate
          results.push({
            expression: candidate.subtree, operation, path: candidate.path, obligations: obligationsOf(candidate.subtree),
            matched: 'word', rank: (exact ? 1 : 3) + candidate.path.length,
            word: { form: entry.form, language: entry.language, pins: candidate.pins },
          })
        }
      }
    }
  }
  const seen = new Set<string>()
  return results.sort((a, b) => a.rank - b.rank || a.path.join().localeCompare(b.path.join()))
    .filter(result => { const key = `${result.path.join('>')}|${result.word?.form ?? ''}`; return !seen.has(key) && (seen.add(key), true) })
    .slice(0, limit)
}

export const describe = (result: SearchResult) => `${result.path.join(' › ')}  ${signature(result.operation)}`
