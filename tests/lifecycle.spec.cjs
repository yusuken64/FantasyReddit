const { test, expect } = require('@playwright/test');
test('login, deep links, quotes, stock and option trading, reset, logout and deletion', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // The external authorization page is replaced; callback, state consumption and SQL sessions are real.
  await page.route('**/api/auth/reddit', async route => {
    const response = await route.fetch({ maxRedirects: 0 });
    const state = new URL(response.headers().location).searchParams.get('state');
    return route.fulfill({ response, status: 302, headers: { ...response.headers(), location: `http://127.0.0.1:18088/api/auth/reddit/callback?code=test&state=${state}` } });
  });
  await page.goto('/portfolio'); await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Continue with Reddit' }).click();
  await expect(page.getByRole('heading', { name: 'Portfolio', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Portfolio', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Stocks', exact: true }).click();
  await page.getByRole('button', { name: 'Buy shares', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Shares' }).fill('2');
  await page.getByRole('button', { name: 'Get quote' }).click();
  await expect(page.getByText('20 credits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm order' }).click();
  await expect(page.getByText('Browser trader: 9980 credits')).toBeVisible();
  await page.getByRole('link', { name: 'Holdings', exact: true }).click();
  await page.getByRole('button', { name: 'Sell and remove', exact: true }).click();
  await page.getByRole('button', { name: 'Get quote' }).click(); await page.getByRole('button', { name: 'Confirm order' }).click();
  await expect(page.getByText('No holdings yet.')).toBeVisible();
  await expect(page.getByText('Browser trader: 10000 credits')).toBeVisible();
  await page.getByRole('link', { name: 'Stocks', exact: true }).click();
  await page.getByRole('button', { name: 'Buy option', exact: true }).click();
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('PUT');
  await page.getByRole('combobox', { name: 'Term', exact: true }).selectOption('30');
  await page.getByRole('button', { name: 'Get quote' }).click();
  await expect(page.getByText('100 credits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm order' }).click();
  await page.getByRole('link', { name: 'Options', exact: true }).click();
  await expect(page.getByText(/1 contracts · 1 premium per share · 100 total premium/)).toBeVisible();
  await page.getByRole('button', { name: 'Exercise', exact: true }).click(); await expect(page.getByText(/SETTLED/)).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click(); await page.getByLabel('Options only').check();
  await expect(page.getByRole('cell', { name: 'OPTION BUY', exact: true })).toBeVisible(); await expect(page.getByRole('cell', { name: 'OPTION EXERCISE', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await page.getByRole('textbox').fill('RESET'); await page.getByRole('button', { name: 'Reset account' }).click();
  await expect(page.getByRole('status')).toContainText('Account reset to 10,000 credits');
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Continue with Reddit' }).click(); await page.getByRole('link', { name: 'Account', exact: true }).click();
  await page.getByRole('textbox').fill('DELETE'); await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('expired quote reports a recoverable error and leaves the balance unchanged', async ({ page }) => {
  await page.route('**/api/auth/reddit', async route => {
    const response = await route.fetch({ maxRedirects: 0 });
    const state = new URL(response.headers().location).searchParams.get('state');
    return route.fulfill({ response, status: 302, headers: { ...response.headers(), location: `http://127.0.0.1:18088/api/auth/reddit/callback?code=test&state=${state}` } });
  });
  await page.goto('/login'); await page.getByRole('link', { name: 'Continue with Reddit' }).click();
  await page.getByRole('link', { name: 'Stocks', exact: true }).click(); await page.getByRole('button', { name: 'Buy shares', exact: true }).click();
  await page.getByRole('button', { name: 'Get quote' }).click(); await expect(page.getByRole('button', { name: 'Confirm order' })).toBeVisible();
  // Exercise actual server-side TTL rather than moving only the browser clock.
  await new Promise(resolve => setTimeout(resolve, 31000));
  await page.getByRole('button', { name: 'Confirm order' }).click(); await expect(page.getByRole('alert')).toContainText('Quote expired');
  await expect(page.getByText('Browser trader: 10000 credits')).toBeVisible();
  await page.getByRole('button', { name: 'New quote' }).click(); await expect(page.getByRole('button', { name: 'Get quote' })).toBeVisible();
});
