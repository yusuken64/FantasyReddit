const { advance, INTERVAL_MS } = require('../module/momentum');
const scenarios = {
  sustained: [0, 50, 100, 150, 200, 250, 300],
  slowdown: [0, 50, 100, 150, 150, 150, 150],
  burst: [0, 0, 0, 150, 150, 150, 150],
  revival: [0, 0, 0, 0, 50, 100, 150],
};
for (const [name, scores] of Object.entries(scenarios)) {
  let state = { observations: [] };
  const rows = scores.map((score, i) => {
    state = advance(state.observations, score, i * INTERVAL_MS);
    const rate = i ? (score - scores[i - 1]) / 5 : null;
    return { minute: i * 5, score,
      legacyAt24Hours: rate === null ? null : Math.max(10, Math.round(10 + 5 * rate / Math.log(26 + i / 12))),
      momentumPrice: state.price };
  });
  console.log(name);
  console.table(rows);
}
