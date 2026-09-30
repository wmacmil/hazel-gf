import { describe, expect, it } from 'vitest'
import { outputOf, preorder, toGfTerm } from './editor'
import type { ApplyNode } from './model'
import { addFragment, adoptable, detach, emptyBench, openHoles, plug, plugProblem, removeFragment } from './builder'

const holeOf = (node: ApplyNode, port: number) => node.children[port]

describe('the tree builder workbench (after Operad14)', () => {
  it('assembles a sentence from separately placed fragments, checked at every plug', () => {
    let bench = emptyBench()
    for (const operation of ['MkS', 'Present', 'Positive', 'PredVP', 'UsePron', 'IPron', 'UseV', 'SleepV']) bench = addFragment(bench, operation)
    const [mks, present, positive, pred, usePron, iPron, useV, sleepV] = bench.fragments as ApplyNode[]
    expect(plugProblem(bench, useV.id, pred.id, 0)).toMatch(/does not match/)        // a VP into the NP port
    expect(plugProblem(bench, mks.id, mks.id, 0)).toMatch(/itself/)
    bench = plug(bench, iPron.id, usePron.id, 0)
    bench = plug(bench, sleepV.id, useV.id, 0)
    bench = plug(bench, usePron.id, pred.id, 0)
    bench = plug(bench, useV.id, pred.id, 1)
    bench = plug(bench, present.id, mks.id, 0)
    bench = plug(bench, positive.id, mks.id, 1)
    expect(plugProblem(bench, positive.id, mks.id, 1)).toMatch(/root/)               // no longer a fragment
    bench = plug(bench, pred.id, mks.id, 2)
    expect(bench.fragments).toHaveLength(1)
    expect(toGfTerm(bench.fragments[0])).toBe('MkS Present Positive (PredVP (UsePron IPron) (UseV SleepV))')
    expect(adoptable(bench.fragments[0])).toBe(true)
    expect(openHoles(bench)).toBe(0)
  })

  it('refuses a filled port and detaches a subtree back into its own fragment', () => {
    let bench = addFragment(addFragment(addFragment(emptyBench(), 'UseN'), 'DogN'), 'CatN')
    const [useN, dog, cat] = bench.fragments as ApplyNode[]
    bench = plug(bench, dog.id, useN.id, 0)
    expect(plugProblem(bench, cat.id, useN.id, 0)).toMatch(/already connected/)
    bench = detach(bench, dog.id)
    expect(bench.fragments.map(fragment => (fragment as ApplyNode).constructor)).toEqual(['UseN', 'CatN', 'DogN'])
    expect(holeOf(bench.fragments[0] as ApplyNode, 0)).toMatchObject({ kind: 'hole', expected: 'N' })
    expect(removeFragment(bench, cat.id).fragments).toHaveLength(2)
  })

  it('keeps every fragment well-sorted: plugging never changes a slot’s sort', () => {
    let bench = addFragment(addFragment(emptyBench(), 'DetCN'), 'Definite')
    const [detCn, definite] = bench.fragments as ApplyNode[]
    bench = plug(bench, definite.id, detCn.id, 0)
    for (const node of preorder(bench.fragments[0])) expect(outputOf(node)).toBeTruthy()
    expect(adoptable(bench.fragments[0])).toBe(false)
  })
})
