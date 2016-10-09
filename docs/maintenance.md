# Maintenance Tips

## Database Operations

You may regularly want to watch how the database is performing, or prune
invalid data. These snippets may help you with your tasks.

Select all itineraries that don't have a leg:

```sql
SELECT * FROM "Itinerary" WHERE "id" NOT IN (SELECT "itineraryId" FROM "Leg")
```

Find which Postgres Tables are performing badly with queries:

```sql
SELECT relname AS schema,
  CASE seq_scan
    WHEN 0 THEN 100
    ELSE 100.0 * idx_scan/(seq_scan+idx_scan)
  END AS hit_rate,
  pg_relation_size(relid::regclass) AS table_size_bytes,
  seq_scan AS num_sequential_scans, idx_scan AS num_index_scans
FROM pg_stat_all_tables
WHERE schemaname='public' AND pg_relation_size(relid::regclass) > 8192
ORDER BY num_sequential_scans DESC;
```
