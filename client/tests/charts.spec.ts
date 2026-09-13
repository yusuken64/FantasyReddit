import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'
test.beforeEach(async ({ page }) => { await mockApi(page) })

test('holding chart joins all observations in a single price series on refresh', async ({ page }) => {
  let measured = false
  await page.route('**/api/prices/*', route => route.fulfill({ json: [
    { price: 460, observed_at: '2026-09-13T23:00:00Z', pricing_model: 'opening-score-age-v1' },
    ...(measured ? [
      { price: 420, observed_at: '2026-09-13T23:05:00Z', pricing_model: 'momentum-v1' },
      { price: 380, observed_at: '2026-09-13T23:10:00Z', pricing_model: 'momentum-v1' },
    ] : []),
  ] }))
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/holdings')
  await expect(page.getByRole('button', { name: 'Price history', exact: true })).toHaveCount(0)
  const chart = page.getByRole('region', { name: 'Price chart for abc123', exact: true })
  await expect(chart.locator('.recharts-line-dot')).toHaveCount(1)
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(0)
  await expect(page.getByText(/Insufficient history to show a trend/)).toBeVisible()
  measured = true
  await page.getByRole('button', { name: 'Refresh price history' }).click()
  await expect(chart.locator('.recharts-line-dot')).toHaveCount(3)
  await expect(chart.locator('.recharts-line-curve[d*="L"]')).toHaveCount(1)
  await expect(chart.locator('.chart-legend')).toHaveText('● Price')
  await expect(chart.locator('.recharts-line')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'evidence/stock-chart-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: 'evidence/stock-chart-desktop.png', fullPage: true })
})

for (const count of [0, 1, 2]) {
  test(`portfolio renders ${count} saved snapshots honestly`, async ({ page }) => {
    await page.route('**/api/portfolio', route => route.fulfill({ json: {
      credits: 9540, holdings_value: 460, portfolio_value: 10000, stale: false,
      history: Array.from({ length: count }, (_, i) => ({ bucket: new Date(Date.UTC(2026, 8, 13, 23, i * 5)).toISOString(), credits: 9540, holdings_value: 460 - i * 10 })),
    } }))
    await page.goto('/portfolio')
    const chart = page.getByRole('region', { name: 'Portfolio value chart', exact: true })
    if (!count) {
      await expect(page.getByText(/Insufficient history to show a trend/)).toBeVisible()
      await expect(chart).toHaveCount(0)
    } else {
      await expect(chart.locator('.recharts-line-dot')).toHaveCount(count)
      await expect(chart.locator('.recharts-line-curve')).toHaveCount(count === 1 ? 0 : 1)
    }
  })
}
