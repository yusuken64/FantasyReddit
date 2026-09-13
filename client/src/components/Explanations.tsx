import { credits } from '../data'
export function PricesExplanation() {
  return <section className="explanation" aria-label="How prices work"><h2>How prices work</h2>
    <p>Prices follow Reddit score growth over a measured trailing 15-minute window. Slower growth can lower a price even while the post's score keeps rising.</p>
    <details><summary>See a price and profit example</summary>
      <p>Illustration using a score weight of 5: growth of 10 points per minute gives a price of 60 virtual credits. Slowing to 4 points per minute gives 30. The server's configured weight may differ. Normal prices have a 10-credit floor.</p>
      <p>Buy 3 shares at 30: spend 90 virtual credits. Sell them at 40: receive 120 in proceeds and make 30 profit. Proceeds are not the same as profit.</p>
    </details>
    <details><summary>Why a price may be unavailable</summary>
      <p>A new post needs a measured interval of at least five minutes before trading. Sampling gaps over ten minutes require a new interval. Old prices remain references while collection recovers. Refresh checks for observations; it does not speed collection.</p>
      <p>Confirmed removed posts have a terminal price of zero: shares lose their value and purchases stop. Calls pay zero; puts settle using zero as the underlying price. A temporarily unavailable post is not necessarily removed.</p>
    </details>
  </section>
}
export function OptionsExplanation() {
  return <section className="explanation" aria-label="How options work"><h3>How options work</h3>
    <p>A call pays when the settlement price is above its strike; a put pays when it is below. You pay the premium upfront. Each contract represents 100 shares and settles in virtual credits, without buying or delivering shares. Your maximum loss is the total premium.</p>
    <details><summary>Premium, payout, and break-even example</summary>
      <p>Hypothetical call: strike 50, premium 5 per share, one contract costs 500 virtual credits. A settlement price of 60 pays 1,000, giving 500 profit. Break-even is 55. A put with the same strike and premium breaks even at 45. These examples are not offered quotes.</p>
      <p>Call payout = max(settlement price − strike, 0) × 100 × contracts. Put payout = max(strike − settlement price, 0) × 100 × contracts. Profit = payout − total premium.</p>
    </details>
    <details><summary>Exercise, expiry, and removed posts</summary>
      <p>Exercise ends the contract immediately and can pay zero, losing your premium. At expiry, settlement is automatic using the first valid price observation at or after expiry. Missing observations can delay settlement. The quoted expiry timestamp is authoritative.</p>
      <p>Confirmed removal settles using an underlying price of zero: calls pay zero and puts pay their strike × 100 × contracts.</p>
    </details>
  </section>
}
export function OptionTerms({ type, strike, premium, total }: { type: string; strike: number; premium: number; total: number }) {
  const breakEven = type === 'CALL' ? strike + premium : strike - premium
  return <p>Maximum loss: {credits(total)}. {breakEven < 0 ? 'This put cannot break even at a nonnegative settlement price.' : `Break-even settlement price: ${credits(breakEven)} per share.`}</p>
}
