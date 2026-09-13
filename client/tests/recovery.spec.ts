import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { account, mockApi, option } from './fixtures'

async function quote(page: Page) {
  await page.goto('/redditStocks')
  await page.getByRole('button', { name: 'Buy shares', exact: true }).click()
  await page.getByRole('button', { name: 'Get quote', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Confirm order', exact: true })).toBeVisible()
}
test.beforeEach(async ({ page }) => { await mockApi(page) })

for (const failure of ['lost', 'unreadable', 'not committed']) {
  test(`${failure} order response recovers the exact request after navigation and reload`, async ({ page }) => {
    const requests: { key: string; body: string | null }[] = []
    let commits = 0
    await page.route('**/api/orders', async route => {
      requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() })
      if (requests.length === 1) {
        if (failure !== 'not committed') commits++
        if (failure === 'unreadable') await route.fulfill({ body: '<html>broken response</html>', contentType: 'text/html' })
        else await route.abort()
      } else { if (!commits) commits++; await route.fulfill({ json: { success: true, credits: 9940 } }) }
    })
    await quote(page)
    await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Trade outcome unknown' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New quote' })).toBeDisabled()
    await page.getByRole('link', { name: 'Holdings', exact: true }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sell shares', exact: true })).toBeDisabled()
    await page.clock.fastForward(31000)
    await page.getByRole('button', { name: 'Retry same operation' }).click()
    await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual(requests[1])
    expect(commits).toBe(1)
  })
}
test('repeated confirmation submits once and receipt survives failed refresh', async ({ page }) => {
  let count = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/orders', async route => { count++; await gate; await route.fulfill({ json: { success: true, credits: 9940 } }) })
  await quote(page)
  await page.route('**/api/me', route => route.fulfill({ status: 503, json: { error: { message: 'Account temporarily unavailable' } } }))
  await page.getByRole('button', { name: 'Confirm order', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(page.getByRole('heading', { name: 'Submitting trade…' })).toBeVisible()
  release()
  await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
  await expect(page.getByText(/Your trade succeeded, but the account refresh failed/)).toBeVisible()
  await page.route('**/api/me', route => route.fulfill({ json: { ...account, credits: 9940 } }))
  await page.getByRole('button', { name: 'Refresh account and positions' }).click()
  await expect(page.getByText(/Your trade succeeded, but the account refresh failed/)).toHaveCount(0)
  expect(count).toBe(1)
})
test('session expiry retains recovery through same-tab login', async ({ page }) => {
  let loggedIn = true, calls = 0
  const keys: string[] = []
  await page.route('**/api/me', route => route.fulfill(loggedIn ? { json: account } : { status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Login required' } } }))
  await page.route('**/api/auth/reddit', async route => { loggedIn = true; await route.fulfill({ status: 302, headers: { location: '/portfolio' } }) })
  await page.route('**/api/orders', async route => {
    keys.push(route.request().headers()['idempotency-key']); calls++
    if (calls === 1) { loggedIn = false; await route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'Session ended' } } }) }
    else await route.fulfill({ json: { success: true, credits: 9940 } })
  })
  await quote(page); await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Continue with Reddit' }).click()
  await page.getByRole('button', { name: 'Retry same operation' }).click()
  await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
  expect(keys[0]).toBe(keys[1])
})
for (const changed of ['generation', 'account']) {
  test(`${changed} change discards incompatible recovery`, async ({ page }) => {
    await page.route('**/api/orders', route => route.abort())
    await quote(page); await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Trade outcome unknown' })).toBeVisible()
    await page.route('**/api/me', route => route.fulfill({ json: { ...account, ...(changed === 'account' ? { id: 'another-player' } : { generation: 1 }) } }))
    await page.reload()
    await expect(page.getByRole('button', { name: 'Buy shares', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Retry same operation' })).toHaveCount(0)
    expect(await page.evaluate(() => sessionStorage.getItem('fantasy-reddit-operation-v1'))).toBeNull()
  })
}
test('storage failure prevents submission', async ({ page }) => {
  let orders = 0
  await page.route('**/api/orders', async route => { orders++; await route.fulfill({ json: { success: true, credits: 9940 } }) })
  await quote(page)
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable') } })
  await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Storage unavailable')
  expect(orders).toBe(0)
})
for (const code of ['QUOTE_EXPIRED', 'PRICE_CHANGED', 'INSUFFICIENT_FUNDS', 'INSUFFICIENT_SHARES', 'HOLDING_LIMIT', 'POSITION_CHANGED', 'ACCOUNT_CHANGED', 'DELISTED']) {
  test(`${code} is a definitive rejection with a route to a new quote`, async ({ page }) => {
    await page.route('**/api/orders', route => route.fulfill({ status: 409, json: { error: { code, message: code } } }))
    await quote(page); await page.getByRole('button', { name: 'Confirm order', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Trade not completed' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(code)
    await expect(page.getByRole('button', { name: 'New quote' })).toBeEnabled()
  })
}
test('exercise is confirmed and its unknown result can be replayed after expiry', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/api/options/*/exercise', async route => {
    requests.push(`${route.request().headers()['idempotency-key']}:${route.request().postData()}`)
    if (requests.length === 1) await route.abort()
    else await route.fulfill({ json: { success: true, credits: 11000, payout: 1000 } })
  })
  await page.goto('/options'); await page.getByRole('button', { name: 'Exercise', exact: true }).click()
  await expect(page.getByText(/Estimated payout: 1,000 virtual credits/)).toBeVisible()
  expect(requests).toHaveLength(0)
  await page.getByRole('button', { name: 'Confirm exercise', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trade outcome unknown' })).toBeVisible()
  await page.route('**/api/options?*', route => route.fulfill({ json: [{ ...option(), expires_at: new Date(Date.now() - 1000).toISOString(), settlement_status: 'PENDING' }] }))
  await page.reload(); await page.getByRole('button', { name: 'Retry same operation' }).click()
  await expect(page.getByRole('heading', { name: 'Trade confirmed' })).toBeVisible()
  expect(requests[0]).toBe(requests[1])
})
