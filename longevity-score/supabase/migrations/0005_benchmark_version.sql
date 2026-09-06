-- Results carry the benchmark table they were scored against.
--
-- Percentiles are computed on read from raw_value plus this stamp, never
-- stored as the source of truth. When a recalibrated table ships, existing
-- rows keep scoring against the version they were entered under, so nobody's
-- history moves without being asked. Null means "before versions existed":
-- scored against the current table.
alter table results add column if not exists benchmark_version text;

-- The shuttle's did-not-finish value is 30 s. The range has to reach it.
update test_variants set value_max = 30 where slug = 'agility_5_10_5';
