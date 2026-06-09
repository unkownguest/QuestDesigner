const { chromium } = require('playwright')

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  const expectedBySection = {
    Dashboard: /recent quests/i,
    Quests: /quest records/i,
    Characters: /character database/i,
    World: /linked design data/i,
    'AI Generator': /review package/i,
    Dialogue: /node palette/i,
  }

  for (const [section, pattern] of Object.entries(expectedBySection)) {
    await page.getByRole('button', { name: section }).click()
    const body = await page.locator('body').innerText()
    if (!pattern.test(body)) {
      throw new Error(`${section} did not render expected content.`)
    }
  }

  await page.getByRole('button', { name: 'AI Generator' }).click()
  await page.getByRole('button', { name: 'Generate with API' }).click()
  await page.getByText('AI endpoint is not configured').waitFor({ timeout: 10000 })

  await page.getByRole('button', { name: 'Create Local Draft' }).click()
  await page.getByRole('button', { name: 'Import into Project' }).click()

  const stage = page.getByRole('dialog', { name: 'Playable quest stage' })
  await stage.locator('.pixi-stage canvas').waitFor({ timeout: 10000 })
  await stage.getByRole('button', { name: 'Continue' }).click()

  const stored = await page.evaluate(() => ({
    quests: JSON.parse(localStorage.getItem('narrative-forge-quests') || '[]').length,
    characters: JSON.parse(localStorage.getItem('narrative-forge-characters') || '[]').length,
    nodes: JSON.parse(localStorage.getItem('quest-designer-project' ) || '{}')?.nodes?.length || 0,
  }))

  if (stored.quests < 2 || stored.characters < 2 || stored.nodes < 8) {
    throw new Error('Generated import did not persist expected project data.')
  }

  if (errors.length > 0) {
    throw new Error(`Console errors detected: ${errors.join(' | ')}`)
  }

  await browser.close()
  console.log('Smoke test passed')
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
