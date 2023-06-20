create materialized view contracts.calls_astar
PARTITION BY DATE(block_time)
OPTIONS (enable_refresh = true, refresh_interval_minutes = 1440)
as
SELECT * FROM `substrate-etl.crypto_polkadot.calls2006`
 WHERE call_section = "contracts";

create materialized view contracts.events_astar 
PARTITION BY DATE(block_time)
OPTIONS (enable_refresh = true, refresh_interval_minutes = 1440)
as
SELECT * FROM `substrate-etl.crypto_polkadot.events2006`
 WHERE section = "contracts";

create materialized view contracts.calls_shiden
PARTITION BY DATE(block_time)
OPTIONS (enable_refresh = true, refresh_interval_minutes = 1440)
as
SELECT * FROM `substrate-etl.crypto_kusama.calls2007`
 WHERE call_section = "contracts";

create materialized view contracts.events_shiden
PARTITION BY DATE(block_time)
OPTIONS (enable_refresh = true, refresh_interval_minutes = 1440)
as
SELECT * FROM `substrate-etl.crypto_kusama.events2007`
 WHERE section = "contracts";

create materialized view contracts.calls_shibuya
PARTITION BY DATE(block_time)
OPTIONS (enable_refresh = true, refresh_interval_minutes = 1440)
as
SELECT * FROM `substrate-etl.crypto_shibuya.calls0`
 WHERE call_section = "contracts";

create materialized view contracts.events_shibuya
PARTITION BY DATE(block_time)
as
SELECT * FROM `substrate-etl.crypto_shibuya.events0`
 WHERE section = "contracts";
 

