import { test, expect } from '@playwright/test'
import { mockApi, post } from './fixtures'
test('a stock with no measured history can be bought at its opening estimate', async ({ page }) => {
  await mockApi(page)
  let measured = false, orders = 0
  await page.route('**/api/market', route => route.fulfill({ json: [{ ...post(), pricing_model: measured ? 'momentum-v1' : 'opening-score-age-v1', momentum: measured ? 10 : null }] }))
  await page.route('**/api/quotes', route => route.fulfill({ json: { id: crypto.randomUUID(), price: 60, cost: 60, expires_at: new Date(Date.now() + 30000).toISOString(), strike: null, premium: null, contract_size: 1, quantity: 1, option_expiry: null, pricing_model: 'opening-score-age-v1' } }))
  await page.route('**/api/orders', async route => { orders++; await route.fulfill({ json: { success: true, credits: 9940 } }) })
  await page.goto('/redditStocks')
  await expect(page.getByRole('button', { name: 'Buy shares', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Buy option', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Price history', exact: true }).click()
  await expect(page.getByText(/Insufficient history to show a trend/)).toBeVisible()
  await page.getByRole('button', { name: 'Buy shares', exact: true }).click()
  await page.getByRole('button', { name: 'Get quote', exact: true }).click()
  await expect(page.getByText('Quoted underlying price: 60 virtual credits per share.')).toBeVisible()
  await expect(page.getByText(/Opening estimate|Opening price|Measured price/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
  expect(orders).toBe(1)
  measured = true
  await page.getByRole('button', { name: 'Refresh market' }).click()
  await expect(page.getByRole('button', { name: 'Buy option', exact: true })).toBeEnabled()
})
