# Cache

This folder contains pre-computed data that is expensive to generate.

## Files

- `line_station_mapping.db` - SQLite database mapping lines to stations and vice versa.
  Generated weekly by the `mapping.yml` GitHub Action.

## Usage

IDs are stored without their IDFM prefix (`line:IDFM:` / `stop_area:IDFM:`).

Query lines for a station:
```sql
SELECT line_id FROM line_stations WHERE stop_area_id = '69212';
```

Query stations for a line:
```sql
SELECT stop_area_id FROM line_stations WHERE line_id = 'C01374';
```

## Why no indexes or uniqueness constraints?

The `line_stations` table has no PRIMARY KEY, no UNIQUE constraint, and no indexes.
This seems like bad database practice, but is intentional:

1. **File size**: Indexes add ~60% to the file size (~0.9 MB → ~1.5 MB). Since this file is
   committed to git, smaller is better.

2. **Uniqueness not needed**: The table is rebuilt from scratch on each generation.
   The source API returns consistent data, so duplicates won't occur in practice.

3. **Indexes not needed**: The only consumer (`generate-all.ts`) loads the entire table
   into memory with a full table scan (`SELECT * FROM line_stations`). No WHERE clause
   means no index would be used anyway.

4. **Ad-hoc queries**: If you query this database directly (as shown above), it will be
   slow without indexes. For ~43k rows, this is still sub-second on modern hardware.
   Create indexes locally if needed: `CREATE INDEX idx_stop ON line_stations(stop_area_id);`
