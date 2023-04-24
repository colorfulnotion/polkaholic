CREATE ROW ACCESS POLICY
  block_time_filter
ON
  substrate-el.polkadot_enterprise.transfers
GRANT TO
  ("group:public")
FILTER USING
  (block_time < DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR) AND block_time > DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY))
