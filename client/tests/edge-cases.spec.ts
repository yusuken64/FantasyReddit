import { test, expect } from '@playwright/test'
import { account, mockApi, option, post } from './fixtures'

test('same-page exercise replay closes confirmation without another exercise', async ({ page }) => {
  let calls = 0
  await page.route('**/api/options/*/exercise', async route => {
    calls++
    await route.fulfill({ json: calls === 1 ? { success: true, credits: 11000 } : { success: true, credits: 11000, payout: 1000 } })
  })
  await page.goto('/options'); await page.getByRole('button', { name: 'Exercise', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm exercise', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trade outcome unknown' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry same operation' }).click()
  await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Exercise confirmation' })).toHaveCount(0)
  expect(calls).toBe(2)
})
test.beforeEach(async ({ page }) => { await mockApi(page) })

test('slow post lookup cannot overwrite the newest search', async ({ page }) => {
  let release!: () => void
  let started!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const received = new Promise<void>(resolve => { started = resolve })
  await page.route('**/api/market/old123', async route => { started(); await gate; await route.fulfill({ json: { ...post(), symbol: 'old123', title: 'Older result' } }).catch(() => {}) })
  await page.route('**/api/market/new123', route => route.fulfill({ json: { ...post(), symbol: 'new123', title: 'Newest result' } }))
  await page.goto('/redditStocks')
  await page.getByLabel('Reddit post ID').fill('old123'); await page.getByRole('button', { name: 'Find post' }).click(); await received
  await page.getByLabel('Reddit post ID').fill('new123'); await page.getByRole('button', { name: 'Find post' }).click()
  await expect(page.getByRole('heading', { name: 'Newest result' })).toBeVisible()
  release()
  await expect(page.getByRole('heading', { name: 'Older result' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Newest result' })).toBeVisible()
})
test('corrupted recovery storage never issues a request', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('fantasy-reddit-operation-v1', JSON.stringify({ account: 'player1', generation: 0, key: 'invalid', status: 'unknown', path: '/orders', body: { quoteId: 'invalid' }, summary: 'Corrupted' })))
  let calls = 0
  await page.route('**/api/orders', async route => { calls++; await route.abort() })
  await page.goto('/redditStocks')
  await expect(page.getByRole('button', { name: 'Buy shares', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Retry same operation' })).toHaveCount(0)
  expect(calls).toBe(0)
})
test('zero exercise estimate requires confirmation and receipt survives refresh failure', async ({ page }) => {
  let calls = 0
  await page.route('**/api/market/*', route => route.fulfill({ json: { ...post(), price: 40 } }))
  await page.route('**/api/options/*/exercise', async route => {
    calls++; await route.fulfill({ json: { success: true, credits: 10000, payout: 0 } })
  })
  await page.goto('/options'); await page.getByRole('button', { name: 'Exercise', exact: true }).click()
  await expect(page.getByText(/Estimated payout: 0 virtual credits/)).toBeVisible()
  await expect(page.getByText(/Estimated profit after premium: -500 virtual credits/)).toBeVisible()
  expect(calls).toBe(0)
  await page.route('**/api/options?*', route => route.fulfill({ status: 503, json: { error: { message: 'Settlement list unavailable' } } }))
  await page.getByRole('button', { name: 'Confirm exercise', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
  await expect(page.getByText(/Payout: 0 virtual credits/)).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Settlement list unavailable')
  expect(calls).toBe(1)
})
test('put terms never claim negative break-even is attainable', async ({ page }) => {
  await page.route('**/api/options?*', route => route.fulfill({ json: [{ ...option(), option_type: 'PUT', strike: 2, premium: 5 }] }))
  await page.goto('/options')
  await expect(page.getByText(/cannot break even at a nonnegative settlement price/)).toBeVisible()
})
test('quote TTL disables confirmation until a newly reviewed quote', async ({ page }) => {
  await page.clock.install()
  await page.goto('/redditStocks'); await page.getByRole('button', { name: 'Buy shares', exact: true }).click()
  await page.getByRole('button', { name: 'Get quote', exact: true }).click()
  await page.clock.fastForward(31000)
  await expect(page.getByRole('button', { name: 'Confirm order', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'New quote' }).click()
  await expect(page.getByLabel('Shares', { exact: true })).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Get quote', exact: true })).toBeVisible()
})
test('explicit logout clears pending personal recovery', async ({ page }) => {
  let loggedIn = true
  await page.route('**/api/me', route => route.fulfill(loggedIn ? { json: account } : { status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Log in' } } }))
  await page.route('**/api/orders', route => route.abort())
  await page.route('**/api/auth/logout', async route => { loggedIn = false; await route.fulfill({ json: { success: true } }) })
  await page.goto('/redditStocks'); await page.getByRole('button', { name: 'Buy shares', exact: true }).click()
  await page.getByRole('button', { name: 'Get quote', exact: true }).click(); await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trade outcome unknown' })).toBeVisible()
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('fantasy-reddit-operation-v1'))).toBeNull()
})
