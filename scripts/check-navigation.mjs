// Keyboard navigation and camera, in the system Chrome (playwright-core).
// Run after a static build (npm run check:nav does both).
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const PORT = 8046
const BASE = `http://127.0.0.1:${PORT}/hazel-gf/`
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { env: { ...process.env, VITE_BASE: '/hazel-gf/' }, stdio: 'ignore' })
const failures = []
const expect = (label, actual, expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`) }
const truthy = (label, value) => { if (!value) failures.push(`${label}: ${JSON.stringify(value)}`) }

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(BASE)).ok) return } catch { /* not up yet */ }
    await new Promise(done => setTimeout(done, 250))
  }
  throw new Error('preview server did not start')
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  page.setDefaultTimeout(8000)
  const viewport = () => page.evaluate(() => {
    const match = document.querySelector('.svelte-flow__viewport').style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/)
    return { x: +match[1], y: +match[2], zoom: +match[3] }
  })
  const focusedInFlow = () => page.locator('.svelte-flow__node .card.focused code').innerText()
  const focusedInTree = () => page.evaluate(() => document.querySelector('.algebra-row.active-line .box.lit .name')?.textContent ?? null)
  const activeWords = () => page.evaluate(() => [...document.querySelectorAll('.algebra-row.active-line .word.active')].map(word => [...word.querySelectorAll('.piece .text')].map(text => text.textContent).join('')))
  const settle = () => page.waitForTimeout(350)

  await page.goto(`${BASE}?example=agreement&mode=view&operad=flow&layout=right&lines=rows`)
  await page.waitForSelector('.svelte-flow__node', { state: 'attached' })
  await page.waitForTimeout(1200)

  // 1. Pointer never moves the camera: zoom in, click a node, hover a word.
  const pane = await page.locator('.svelte-flow').boundingBox()
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2)
  await page.mouse.wheel(0, -300); await page.waitForTimeout(600)
  const zoomed = await viewport()
  const visible = await page.evaluate(() => {
    const frame = document.querySelector('.svelte-flow').getBoundingClientRect()
    return [...document.querySelectorAll('.svelte-flow__node')].find(node => { const r = node.getBoundingClientRect(); return r.left > frame.left + 5 && r.right < frame.right - 5 && r.top > frame.top + 5 && r.bottom < frame.bottom - 40 })?.dataset.id
  })
  await page.locator(`.svelte-flow__node[data-id="${visible}"]`).click(); await settle()
  expect('clicking a node keeps the camera', await viewport(), zoomed)
  await page.locator('.algebra-row .piece').first().hover(); await settle()
  expect('hovering a word keeps the camera', await viewport(), zoomed)

  // 2. Tree region: hjkl over the flow geometry; the camera follows, never zooming out.
  await page.locator('.svelte-flow__node', { hasText: 'DetCN' }).first().click(); await settle()
  expect('region after clicking the graph', (await page.locator('.region-chip b').innerText()).toLowerCase(), 'tree')
  await page.keyboard.press('j'); await settle()
  expect('tree j → first child', await focusedInFlow(), 'Definite')
  const afterJ = await viewport()
  truthy('camera zoom-centers (floor 1.05, never out)', afterJ.zoom >= Math.max(1.05, zoomed.zoom) - 1e-6)
  await page.keyboard.press('l'); await settle()
  expect('tree l → nearest node to the right', await focusedInFlow(), 'UseN')
  await page.keyboard.press('k'); await settle()
  expect('tree k → parent', await focusedInFlow(), 'DetCN')
  await page.keyboard.press('l'); await settle()
  expect('tree l → next constituent', await focusedInFlow(), 'UseV')
  truthy('camera never zooms out while navigating', (await viewport()).zoom >= afterJ.zoom - 1e-6)

  // 3. Tab to the sentence region: s/d walk the sentence, both trees move together.
  await page.keyboard.press('Tab'); await settle()
  expect('Tab switches region', (await page.locator('.region-chip b').innerText()).toLowerCase(), 'sentence')
  await page.keyboard.press('s'); await settle()
  expect('s → previous word (the man doesn’t sleep), an auxiliary lands on its leaf', await activeWords(), ["doesn't"])
  expect('the flow tree follows the sentence focus', await focusedInFlow(), 'Negative')
  await page.keyboard.press('s'); await settle()
  expect('s again → the lane keeps its own position', await activeWords(), ['man'])
  expect('the flow tree follows again', await focusedInFlow(), 'ManN')
  await page.keyboard.press('d'); await page.keyboard.press('d'); await settle()
  expect('d d → two words on', await activeWords(), ['sleep'])
  await page.keyboard.press('k'); await settle()
  expect('sentence k → enclosing phrase box', await focusedInTree(), 'UseV')
  await page.keyboard.press('h'); await settle()
  expect('sentence h → the constituent to the left', await focusedInTree(), 'DetCN')
  await page.keyboard.press(']'); await settle()
  expect('] → next language row', await page.locator('.algebra-row.active-line .language strong').innerText(), 'Deutsch')
  await page.keyboard.press('j'); await page.keyboard.press('d'); await settle()
  expect('German: j into DetCN, d to the next word', await activeWords(), ['Mann'])

  // 3b. h/l mean the same in both trees (structural: same level, reading order),
  // including on a box spanning the whole sentence (PredVP).
  for (const region of ['sentence', 'tree']) {
    // Focus PredVP through its phrase box (always on screen), then enter the region under test.
    await page.locator('.algebra-row.active-line .box', { has: page.locator('.name', { hasText: /^PredVP$/ }) }).first().click(); await settle()
    if ((await page.locator('.region-chip b').innerText()).toLowerCase() !== region) await page.keyboard.press('Tab')
    await page.keyboard.press('h'); await settle()
    expect(`${region}: h on PredVP → the node before it on its level`, await focusedInFlow(), 'Negative')
    await page.keyboard.press('l'); await settle()
    expect(`${region}: l back → PredVP`, await focusedInFlow(), 'PredVP')
    await page.keyboard.press('j'); await page.keyboard.press('l'); await page.keyboard.press('l'); await settle()
    expect(`${region}: j then l l → across cousins, stopping at the level's end`, await focusedInFlow(), 'UseV')
  }

  // 3c. Type-directed search builds a sentence: / opens it on the focused hole.
  await page.goto(`${BASE}?mode=edit&operad=flow&layout=right&lines=auto`)
  await page.waitForSelector('.svelte-flow__node', { state: 'attached' }); await page.waitForTimeout(800)
  await page.locator('.worked select').selectOption('blank sentence'); await settle()
  const search = page.getByLabel('Find an expression')
  const find = async (query, pick = 0) => {
    await search.fill(query); await page.waitForTimeout(250)
    const top = await page.locator('.type-search .result').nth(pick).innerText()
    await page.locator('.type-search .result').nth(pick).click(); await settle()
    return top.replace(/\s+/g, ' ')
  }
  truthy('search: "exist" in an S hole offers MkS › ExistNP', (await find('exist')).includes('MkS › ExistNP'))
  await page.locator('aside .choice', { has: page.locator('code', { hasText: /^Present$/ }) }).click(); await settle()
  await page.locator('aside .choice', { has: page.locator('code', { hasText: /^Positive$/ }) }).click(); await settle()
  const beforeInsert = await viewport()
  truthy('search: "red" in an NP hole reaches DetCN › AdjCN › PositA › RedA', (await find('red')).includes('DetCN › AdjCN › PositA › RedA'))
  expect('inserting an expression never moves the camera', await viewport(), beforeInsert)
  truthy('search: signature -> Det offers determiners', (await find('-> Det')).includes('Det'))
  truthy('search: a word in any language (Vogel)', (await find('Vogel')).includes('Vogel'))
  await page.waitForTimeout(600)
  expect('the searched sentence is complete and linearized', (await page.locator('.workspace-bar code').innerText()).startsWith('MkS Present Positive (ExistNP (DetCN'), true)

  // 3e. Grafting without the mouse: i parses words into the focused hole, e extends, x cuts to the bench, g grafts back.
  await page.goto(`${BASE}?mode=edit&operad=flow&layout=right&lines=auto`)
  await page.waitForSelector('.svelte-flow__node', { state: 'attached' }); await page.waitForTimeout(800)
  await page.locator('.worked select').selectOption('blank sentence'); await settle()
  await page.locator('.svelte-flow__node').first().click(); await settle()
  const term = () => page.locator('.workspace-bar code').innerText()
  const prompt = page.getByLabel('Graft expression')
  const graftWith = async (key, text, source) => {
    await page.keyboard.press(key); await prompt.waitFor()
    await prompt.fill(text)
    if (source) await page.waitForFunction(want => document.querySelector('.graft .results button .source')?.classList.contains(want), source, { timeout: 8000 })
      .catch(async () => { throw new Error(`graft "${text}" found no ${source}: ${(await page.locator('.graft').innerText()).replace(/\s+/g, ' ').slice(0, 300)}`) })
    else await page.waitForTimeout(400)
    await prompt.press('Enter'); await settle()
  }
  await graftWith('i', 'the dog sleeps', 'parse')
  expect('graft: i parses a sentence into the S hole', await term(), 'MkS Present Positive (PredVP (DetCN Definite (UseN DogN)) (UseV SleepV))')
  for (const key of ['j', 'l', 'l', 'j']) { await page.keyboard.press(key); await settle() }
  expect('graft: hjkl reaches the subject', await focusedInFlow(), 'DetCN')
  await graftWith('e', '_ and the woman', 'parse')
  expect('graft: e extends the subject around a typed _', await term(), 'MkS Present Positive (PredVP (ConjNP AndConj (DetCN Definite (UseN DogN)) (DetCN Definite (UseN WomanN))) (UseV SleepV))')
  await page.keyboard.press('x'); await settle()
  expect('graft: x cuts the subject to the bench', await term(), 'incomplete but well-typed')
  await graftWith('i', 'small dog', 'parse')
  expect('graft: a CN phrase lifts into the NP hole, focus moves to its Det obligation', await focusedInFlow(), '⟦Det⟧')
  await graftWith('i', 'every', null)
  expect('graft: the obligation is filled by an operation', await term(), 'MkS Present Positive (PredVP (DetCN EveryDet (AdjCN (PositA SmallA) (UseN DogN))) (UseV SleepV))')
  await page.keyboard.press('k'); await settle()
  expect('graft: k climbs from the filled Det to its NP', await focusedInFlow(), 'DetCN')
  await graftWith('g', '', 'bench')
  expect('graft: g grafts the cut fragment back', await term(), 'MkS Present Positive (PredVP (ConjNP AndConj (DetCN Definite (UseN DogN)) (DetCN Definite (UseN WomanN))) (UseV SleepV))')
  await page.keyboard.press('Meta+z'); await settle()
  expect('graft: undo restores the sentence and the bench together', await term(), 'MkS Present Positive (PredVP (DetCN EveryDet (AdjCN (PositA SmallA) (UseN DogN))) (UseV SleepV))')

  // 3d. The builder: send, cut a wire, re-plug by dragging, refuse a wrong sort, adopt.
  await page.goto(`${BASE}?example=agreement&mode=view&operad=builder&layout=above&lines=auto`)
  await page.waitForSelector('.builder'); await page.waitForTimeout(600)
  const status = () => page.locator('.builder .actions span').innerText()
  await page.getByRole('button', { name: 'clear' }).click()
  await page.getByRole('button', { name: '+ current sentence' }).click(); await settle()
  await page.locator('.builder .svelte-flow__controls-fitview').click(); await page.waitForTimeout(400)
  expect('builder: the sentence arrives as one fragment', await status(), '1 fragment · 0 open holes')
  // hjkl walks the bench like the flow view walks the sentence.
  const benchFocus = () => page.evaluate(() => document.querySelector('.builder .card.focused')?.closest('.operation')?.dataset.op ?? null)
  await page.locator('.builder .svelte-flow__node').first().click(); await settle()
  expect('builder: clicking a node focuses it', await benchFocus(), 'MkS')
  const walk = []
  for (const key of ['j', 'l', 'l', 'j', 'l', 'h', 'k', 'k']) { await page.keyboard.press(key); await settle(); walk.push(await benchFocus()) }
  expect('builder: hjkl walks the fragment', walk.join(' '), 'Present Negative PredVP DetCN UseV DetCN PredVP MkS')
  const wires = await page.locator('.builder .svelte-flow__edge').count()
  expect('builder: every child is wired to its parent', wires, (await page.locator('.builder .svelte-flow__node').count()) - 1)
  await page.evaluate(() => [...document.querySelectorAll('.builder .svelte-flow__edge')].at(-1).dispatchEvent(new MouseEvent('click', { bubbles: true }))); await settle()
  expect('builder: clicking a wire cuts it into two fragments', await status(), '2 fragments · 1 open holes')
  await page.locator('.builder .svelte-flow__controls-fitview').click(); await page.waitForTimeout(400)
  // Re-plug: drag the detached fragment's output onto the hole it left.
  // Fragment roots are the nodes with a toolbar; the detached one is the root that is not MkS.
  const detached = await page.evaluate(() => [...document.querySelectorAll('.builder .svelte-flow__node')]
    .filter(n => n.querySelector('.toolbar') && n.querySelector('.operation')?.dataset.op !== 'MkS').map(n => n.dataset.id))
  const holeId = await page.evaluate(() => [...document.querySelectorAll('.builder .svelte-flow__node')].find(n => n.querySelector('.card.hole'))?.dataset.id)
  // The hole's parent port, from the wire into it (edge ids are `${child}->${parent}:${port}`).
  const holeParent = await page.evaluate(holeId => [...document.querySelectorAll('.builder .svelte-flow__edge')]
    .map(edge => edge.getAttribute('data-id') ?? '').find(id => id.startsWith(`${holeId}->`)), holeId)
  const [parentId, port] = holeParent.split('->')[1].split(':')
  const source = detached[0]
  const a = await page.locator(`.builder .svelte-flow__node[data-id="${source}"] .svelte-flow__handle[data-handleid="out"]`).boundingBox()
  const b = await page.locator(`.builder .svelte-flow__node[data-id="${parentId}"] .svelte-flow__handle[data-handleid="in-${port}"]`).boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await page.mouse.up(); await settle()
  expect('builder: dragging the fragment back onto its hole re-plugs it', await status(), '1 fragment · 0 open holes')
  // A wrong sort is refused with the kernel's reason.
  const beforeAdd = await viewport()
  await page.getByLabel('Add a fragment').fill('UseV'); await page.waitForTimeout(200)
  await page.getByLabel('Add a fragment').press('Enter'); await settle()
  expect('builder: adding a fragment never moves the camera', await viewport(), beforeAdd)
  const added = await page.evaluate(() => {
    const canvas = document.querySelector('.builder').getBoundingClientRect()
    const node = [...document.querySelectorAll('.builder .svelte-flow__node')].find(n => n.querySelector('.operation')?.dataset.op === 'UseV' && n.querySelector('.toolbar'))
    const box = node?.getBoundingClientRect()
    return { visible: !!box && box.left >= canvas.left && box.right <= canvas.right && box.top >= canvas.top && box.bottom <= canvas.bottom, focused: !!node?.querySelector('.card.focused') }
  })
  expect('builder: a new fragment appears in view and takes focus', added, { visible: true, focused: true })
  await page.locator('.builder .svelte-flow__controls-fitview').click(); await page.waitForTimeout(400)
  const useV = await page.evaluate(() => [...document.querySelectorAll('.builder .svelte-flow__node')].find(n => n.querySelector('.operation')?.dataset.op === 'UseV' && n.querySelector('.toolbar'))?.dataset.id)
  const detCn = await page.evaluate(() => [...document.querySelectorAll('.builder .svelte-flow__node')].find(n => n.querySelector('.operation')?.dataset.op === 'DetCN')?.dataset.id)
  const c = await page.locator(`.builder .svelte-flow__node[data-id="${useV}"] .svelte-flow__handle[data-handleid="out"]`).boundingBox()
  const d = await page.locator(`.builder .svelte-flow__node[data-id="${detCn}"] .svelte-flow__handle[data-handleid="in-1"]`).boundingBox()
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down()
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 12 })
  const refusalText = await page.locator('.builder .hint').innerText()
  await page.mouse.up(); await settle()
  truthy('builder: a VP onto a CN port is refused with the reason', /does not match|already connected/.test(refusalText))
  expect('builder: the refused wire changed nothing', await status(), '2 fragments · 1 open holes')
  // Adopt the finished sentence.
  await page.locator('.builder .toolbar .adopt').first().click(); await settle()
  truthy('builder: adopting sets the sentence', (await page.locator('.workspace-bar code').innerText()).startsWith('MkS Present Negative (PredVP (DetCN Definite (UseN ManN))'))

  // The same verbs on the bench: a starts a fragment from words, e wraps it, i fills the new hole.
  await page.locator('.builder .svelte-flow__node').first().click(); await settle()
  await graftWith('a', 'small dog', 'parse')
  expect('bench: a parses words into a new fragment', await status(), '2 fragments · 1 open holes')
  expect('bench: the new fragment is focused', await benchFocus(), 'AdjCN')
  await graftWith('e', 'AdvCN', null)
  expect('bench: e wraps the fragment and focuses its new hole', [await status(), await benchFocus()], ['2 fragments · 2 open holes', 'hole'])
  await graftWith('i', 'in the house', 'parse')
  expect('bench: i fills the hole by parsing', await status(), '2 fragments · 1 open holes')

  // 4. Typing in an input never navigates.
  await page.getByRole('radiogroup', { name: 'operad' }).getByRole('radio', { name: 'flow' }).click(); await settle()
  await page.getByLabel('Sentence to parse').click()
  const before = await focusedInFlow()
  await page.keyboard.type('hjkl sd')
  expect('keys typed into an input are text, not commands', await focusedInFlow(), before)
} catch (crash) {
  // Report what had already failed before the crash: usually the real cause.
  failures.push(`crashed: ${String(crash.message ?? crash).split('\n')[0]} at ${(crash.stack ?? '').split('\n').find(line => line.includes('check-navigation')) ?? '?'}`)
} finally {
  await browser?.close()
  server.kill()
}

if (failures.length) {
  console.error(`${failures.length} navigation problem(s):\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('navigation ok: pointer never moves the camera; hjkl per region; s/d along the sentence; [ ] languages; Tab regions; trees move together')
