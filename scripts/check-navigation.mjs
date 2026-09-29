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

  // 4. Typing in an input never navigates.
  await page.getByLabel('Sentence to parse').click()
  const before = await focusedInFlow()
  await page.keyboard.type('hjkl sd')
  expect('keys typed into an input are text, not commands', await focusedInFlow(), before)
} finally {
  await browser?.close()
  server.kill()
}

if (failures.length) {
  console.error(`${failures.length} navigation problem(s):\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('navigation ok: pointer never moves the camera; hjkl per region; s/d along the sentence; [ ] languages; Tab regions; trees move together')
