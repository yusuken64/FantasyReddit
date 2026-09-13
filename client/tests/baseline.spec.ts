import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'
test('market route and responsive baseline', async ({ page }) => {
  await mockApi(page)
  await page.goto('/redditStocks')
  await expect(page.getByRole('heading', { name: 'Reddit stocks' })).toBeVisible()
  await page.screenshot({ path: 'test-results/market-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 800 })
  await page.screenshot({ path: 'test-results/market-mobile.png', fullPage: true })
})
test('private routes require login', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/me', route => route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Login required.' } } }))
  await page.goto('/holdings')
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible()
})
