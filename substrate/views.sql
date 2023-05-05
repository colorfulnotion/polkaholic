CREATE MATERIALIZED VIEW  substrate-etl.crypto_ethereum.transactions_summary
OPTIONS (enable_refresh = true, refresh_interval_minutes = 60)
AS (
  SELECT
    date(timestamp) logDT,
    count(*) as numTransactions,
  FROM
    substrate-etl.crypto_ethereum.transactions
  GROUP BY
    logDT
);

select * from `substrate-etl.crypto_ethereum.transactions_summary` order by logDT;
CALL BQ.REFRESH_MATERIALIZED_VIEW('substrate-etl.crypto_ethereum.transactions_summary');

