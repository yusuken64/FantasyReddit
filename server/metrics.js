async function gauges(db) {
  return (await db.query(`SELECT
    (SELECT COUNT(*) FROM options o JOIN instruments i ON i.symbol=o.symbol WHERE status='OPEN' AND (expires_at<=SYSUTCDATETIME() OR terminal=1)) AS pendingSettlements,
    (SELECT COUNT(*) FROM instruments i CROSS APPLY(SELECT TOP 1 observed_at FROM observations WHERE symbol=i.symbol ORDER BY observed_at DESC) p
      WHERE terminal=0 AND p.observed_at<DATEADD(minute,-10,SYSUTCDATETIME()) AND
      (EXISTS(SELECT 1 FROM holdings h WHERE h.symbol=i.symbol) OR EXISTS(SELECT 1 FROM options o WHERE o.symbol=i.symbol AND o.status='OPEN'))) AS stalePrices`))[0];
}
module.exports = { gauges };
