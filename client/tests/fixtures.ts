import type { Page } from '@playwright/test'
export const account = { id: 'player1', username: 'Player', credits: 10000, generation: 0, csrfToken: 'test-csrf' }
export const post = () => ({ symbol: 'abc123', title: 'A growing conversation', price: 60, terminal: false, observed_at: new Date().toISOString(), stale: false, status: 'ready', momentum: 10 })
export const holding = () => ({ ...post(), shares: 3, total_spent: 90 })
export const option = () => ({ id: '22222222-2222-4222-8222-222222222222', symbol: 'abc123', option_type: 'CALL', strike: 50, premium: 5, total_premium: 500, quantity: 1, contract_size: 100, expires_at: new Date(Date.now() + 86400000).toISOString(), settlement_status: 'OPEN', price: 60, observed_at: new Date().toISOString(), stale: false })
export async function mockApi(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.slice(4)
    let data: unknown
    if (path === '/me') data = account
    else if (path === '/market') data = [post()]
    else if (path.startsWith('/market/')) data = post()
    else if (path === '/holdings') data = [holding()]
    else if (path === '/options') data = [option()]
    else if (path === '/portfolio') data = { credits: 10000, holdings_value: 180, portfolio_value: 10180, stale: false, history: [] }
    else if (path === '/quotes') {
      const body = route.request().postDataJSON()
      data = { id: crypto.randomUUID(), price: 60, cost: body.quantity * (body.action === 'OPTION' ? 500 : 60), expires_at: new Date(Date.now() + 30000).toISOString(), strike: body.action === 'OPTION' ? 50 : null, premium: body.action === 'OPTION' ? 5 : null, contract_size: body.action === 'OPTION' ? 100 : 1, quantity: body.quantity, option_expiry: body.action === 'OPTION' ? new Date(Date.now() + 86400000).toISOString() : null }
    } else if (path === '/orders') data = { success: true, credits: 9940, optionId: null }
    else if (path.endsWith('/exercise')) data = { success: true, credits: 11000, payout: 1000, status: 'SETTLED' }
    else data = []
    await route.fulfill({ json: data })
  })
}
