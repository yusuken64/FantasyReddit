import { test, expect } from '@playwright/test'
import { holding, mockApi } from './fixtures'

test.beforeEach(async ({ page }) => { await mockApi(page) })

test('portfolio compares holdings with different observation times and toggles their values', async ({ page }) => {
  await page.route('**/api/holdings', route => route.fulfill({ json: [holding(), { ...holding(), symbol: 'second', title: 'Second stock', shares: 5 }, { ...holding(), symbol: 'sold', shares: 0 }] }))
  await page.route('**/api/prices/*', route => route.fulfill({ json: route.request().url().endsWith('abc123') ? [
    { price: 10, observed_at: '2026-09-13T12:00:00Z' }, { price: 20, observed_at: '2026-09-13T12:10:00Z' },
  ] : [{ price: 40, observed_at: '2026-09-13T12:05:00Z' }, { price: 50, observed_at: '2026-09-13T12:15:00Z' }] }))
  await page.goto('/portfolio')
  const chart = page.getByRole('region', { name: 'Held stocks chart', exact: true })
  await expect(chart.locator('.recharts-line')).toHaveCount(2)
  await expect(chart.locator('.recharts-line-dot')).toHaveCount(4)
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
  await chart.getByText('View held stock observations').click()
  await expect(chart.getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('10 virtual credits')
  await page.getByLabel('Chart values').selectOption('value')
  await expect(chart.getByRole('columnheader', { name: 'Total value' })).toBeVisible()
  await expect(chart.getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('30 virtual credits')
  await expect(chart.getByRole('row').nth(3).getByRole('cell').nth(2)).toHaveText('200 virtual credits')
  await page.getByLabel('Chart values').selectOption('price')
  await expect(chart.getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('10 virtual credits')
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `evidence/portfolio-stocks-${width}.png`, fullPage: true })
  }
})

test('partial history failures leave other stocks visible and can be retried', async ({ page }) => {
  await page.route('**/api/holdings', route => route.fulfill({ json: [holding(), { ...holding(), symbol: 'second', title: 'Second stock' }] }))
  let failed = true
  await page.route('**/api/prices/*', route => route.fulfill(failed && route.request().url().endsWith('second') ? { status: 503, json: { error: { message: 'History unavailable' } } } : { json: [{ price: 20, observed_at: '2026-09-13T12:00:00Z' }] }))
  await page.goto('/portfolio')
  const section = page.getByRole('region', { name: 'Held stocks over time', exact: true })
  await expect(section.getByRole('alert')).toContainText('Second stock (second): History unavailable')
  await expect(section.locator('.recharts-line-dot')).toHaveCount(1)
  failed = false
  await section.getByRole('button', { name: 'Refresh stock chart' }).click()
  await expect(section.getByRole('alert')).toHaveCount(0)
  await expect(section.locator('.recharts-line-dot')).toHaveCount(2)
})

test('empty holdings and stocks without observations have explicit empty states', async ({ page }) => {
  await page.route('**/api/holdings', route => route.fulfill({ json: [] }))
  await page.goto('/portfolio')
  await expect(page.getByText('No stocks held yet.')).toBeVisible()
  await page.route('**/api/holdings', route => route.fulfill({ json: [holding()] }))
  await page.getByRole('button', { name: 'Refresh stock chart' }).click()
  await expect(page.getByText('A growing conversation (abc123): No price history yet.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Held stocks chart', exact: true })).toHaveCount(0)
})
