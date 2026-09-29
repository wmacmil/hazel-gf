// Layout regression check in a real browser (the system Chrome, via playwright-core).
// Builds nothing: run after `npm run build:static` (npm run check:layout does both).
// Fails if, in any layout, hovering an edge word or box clips its focus outline,
// a sentence overflows although it could be scaled to fit, or a sentence that
// cannot fit has no visible scrollbar.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const PORT = 8045
const BASE = `http://127.0.0.1:${PORT}/hazel-gf/`
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  env: { ...process.env, VITE_BASE: '/hazel-gf/' }, stdio: 'ignore',
})

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(BASE)).ok) return } catch { /* not up yet */ }
    await new Promise(done => setTimeout(done, 250))
  }
  throw new Error('preview server did not start')
}

/** Outlines drawn by focused/hovered elements that an overflow-clipping ancestor cuts off. */
const clippedOutlines = () => {
  const cut = []
  for (const el of document.querySelectorAll('.sentences-pane *, .details-pane *')) {
    const style = getComputedStyle(el)
    const width = parseFloat(style.outlineWidth) || 0
    if (style.outlineStyle === 'none' || !width) continue
    const reach = width + (parseFloat(style.outlineOffset) || 0)
    const rect = el.getBoundingClientRect()
    let clip = el.parentElement
    while (clip && clip !== document.body && getComputedStyle(clip).overflowX === 'visible' && getComputedStyle(clip).overflowY === 'visible') clip = clip.parentElement
    const bounds = clip.getBoundingClientRect()
    const amount = Math.max(0, bounds.left - (rect.left - reach)) + Math.max(0, rect.right + reach - bounds.right)
      + Math.max(0, bounds.top - (rect.top - reach)) + Math.max(0, rect.bottom + reach - bounds.bottom)
    if (amount > 0.5) cut.push(`${el.className.split(' ')[0]} cut ${amount.toFixed(1)}px by ${clip.className.split(' ')[0]}`)
  }
  return cut
}

const rows = () => [...document.querySelectorAll('.algebra-row .fit')].map(fit => ({
  overflow: fit.scrollWidth - fit.clientWidth,
  scrollbar: fit.offsetHeight - fit.clientHeight,
  zoom: Number(getComputedStyle(fit.querySelector('.grid')).zoom),
}))

const failures = []
let browser
try {
  await waitForServer()
  // Headless Chrome hides scrollbars by default; keep them, since their visibility is under test.
  browser = await chromium.launch({ channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  for (const layout of ['right', 'left', 'above', 'below']) {
    for (const example of ['see', 'place', 'with']) {
      for (const lines of ['auto', 'rows', 'columns']) {
        const where = `layout=${layout} example=${example} lines=${lines}`
        await page.goto(`${BASE}?example=${example}&mode=view&operad=flow&layout=${layout}&lines=${lines}`)
        await page.waitForSelector('.algebra-row .piece')
        await page.waitForTimeout(700)
        const count = await page.locator('.algebra-row').count()
        for (let row = 0; row < count; row++) {
          for (const which of ['first', 'last']) {
            const piece = page.locator('.algebra-row').nth(row).locator('.piece')[which]()
            try { await piece.hover({ timeout: 2000 }) } catch {
              failures.push(`${where}: ${which} word of row ${row + 1} cannot be hovered (covered by another pane)`)
              continue
            }
            for (const problem of await page.evaluate(clippedOutlines)) failures.push(`${where}: hover ${which} word of row ${row + 1}: ${problem}`)
          }
        }
        try { await page.locator('.algebra-row .box').first().hover({ timeout: 2000 }) } catch { failures.push(`${where}: S box cannot be hovered`) }
        for (const problem of await page.evaluate(clippedOutlines)) failures.push(`${where}: hover S box: ${problem}`)
        // One baseline: every morpheme's text in a sentence sits at the same height.
        const wobble = await page.evaluate(() => [...document.querySelectorAll('.algebra-row')].map(row => {
          const tops = [...row.querySelectorAll('.grid > .cell .piece .text')].map(text => text.getBoundingClientRect().top)
          return Math.max(...tops) - Math.min(...tops)
        }))
        wobble.forEach((spread, index) => { if (spread > 1) failures.push(`${where}: row ${index + 1} text wobbles ${spread.toFixed(1)}px off one baseline`) })
        for (const [index, row] of (await page.evaluate(rows)).entries()) {
          if (lines !== 'columns' && row.overflow > 0 && row.zoom > 0.56) failures.push(`${where}: row ${index + 1} overflows ${row.overflow}px at scale ${row.zoom}`)
        }
      }
    }
  }
  // A pane too narrow for the smallest scale must scroll, with a visible scrollbar.
  await page.goto(`${BASE}?example=with&mode=view&operad=flow&layout=right&lines=rows`)
  await page.waitForSelector('.algebra-row .piece')
  await page.addStyleTag({ content: '.sentences-pane { width: 170px !important; max-width: 170px !important; }' })
  await page.waitForTimeout(700)
  for (const [index, row] of (await page.evaluate(rows)).entries()) {
    if (row.overflow > 0 && row.scrollbar < 6) failures.push(`narrow pane: row ${index + 1} overflows ${row.overflow}px with no visible scrollbar`)
  }
} finally {
  await browser?.close()
  server.kill()
}

if (failures.length) {
  console.error(`${failures.length} layout problem(s):\n${failures.slice(0, 40).join('\n')}`)
  process.exit(1)
}
console.log('layout ok: no clipped outlines, no avoidable overflow, visible scrollbars when needed (4 layouts × 3 examples × 3 line modes)')
