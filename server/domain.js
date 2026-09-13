const { randomBytes, createHash, randomUUID } = require('node:crypto');
const MAX = 9007199254740991n;
class AppError extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
const fail = (status, code, message) => { throw new AppError(status, code, message); };
function amount(value) {
  const n = BigInt(value);
  if (n < 0n || n > MAX) fail(400, 'OVERFLOW', 'Amount exceeds the supported integer range.');
  return n;
}
function quantity(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 1000000) fail(400, 'INVALID_QUANTITY', 'Quantity must be an integer from 1 to 1,000,000.');
  return BigInt(value);
}
function symbol(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]{1,10}$/.test(value)) fail(400, 'INVALID_SYMBOL', 'Use a canonical Reddit post ID.');
  return value;
}
function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) fail(400, 'INVALID_ID', 'A valid UUID is required.');
  return value.toLowerCase();
}
function generation(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail(400, 'INVALID_GENERATION', 'Refresh your account before retrying.');
  return BigInt(value);
}
function exact(body, keys) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !keys.includes(k))) fail(400, 'INVALID_INPUT', 'Unexpected request fields.');
}
const token = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(String(value)).digest('hex');
function premium(price, score, type, step, days) {
  if (!['CALL', 'PUT'].includes(type) || ![90, 95, 100, 105, 110].includes(step) || ![1, 3, 7, 30].includes(days)) fail(400, 'INVALID_CONTRACT', 'Select a listed contract and term.');
  const strike = amount((amount(price) * BigInt(step) + 50n) / 100n);
  const intrinsic = type === 'CALL' ? BigInt(price) - strike : strike - BigInt(price);
  const extrinsic = amount(Math.ceil(Math.max(0.1, Math.min(0.5, 0.1 + Number(score) / 100)) * Math.sqrt(days / 365) * Number(price)));
  return { strike, premium: amount((intrinsic > 0n ? intrinsic : 0n) + extrinsic) };
}
function payout(option, price) {
  const diff = option.option_type === 'CALL' ? BigInt(price) - BigInt(option.strike) : BigInt(option.strike) - BigInt(price);
  return amount((diff > 0n ? diff : 0n) * 100n * BigInt(option.quantity));
}
const numericKeys = new Set(['credits','generation','price','quantity','cost','strike','premium','payout','shares','total_spent','holdings_value','portfolio_value','contract_size','total_premium']);
function json(value) {
  return JSON.parse(JSON.stringify(value, (key, v) => {
    if (key === 'score') { const n = Number(v); if (!Number.isSafeInteger(n)) fail(400, 'OVERFLOW', 'Score exceeds supported range.'); return n; }
    return typeof v === 'bigint' || (numericKeys.has(key) && v !== null) ? Number(amount(v)) : v;
  }));
}
module.exports = { MAX, AppError, fail, amount, quantity, symbol, uuid, generation, exact, token, hash, randomUUID, premium, payout, json };
