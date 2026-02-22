import SQLite from "sqlite3";
import { Util, Client } from "../lib/index.ts";
import { CacheDB } from "../lib/client/cache.ts";
import type * as Navitia from "../lib/client/navitia/index.ts";

const LINE_PREFIX = "line:IDFM:";
const STOP_AREA_PREFIX = "stop_area:IDFM:";

function stripLinePrefix(id: string): string {
  if (!id.startsWith(LINE_PREFIX)) {
    throw new Error(`Invalid line ID prefix, expected ${JSON.stringify(LINE_PREFIX)}, got ${JSON.stringify(id)}`);
  }
  return id.slice(LINE_PREFIX.length);
}

function stripStopAreaPrefix(id: string): string {
  if (!id.startsWith(STOP_AREA_PREFIX)) {
    throw new Error(`Invalid stop_area ID prefix, expected ${JSON.stringify(STOP_AREA_PREFIX)}, got ${JSON.stringify(id)}`);
  }
  return id.slice(STOP_AREA_PREFIX.length);
}

const DB_PATH = Util.pathInProjectRoot("cache/line_station_mapping.db");

const IDFM_API_KEY = process.env.IDFM_API_KEY;
if (!IDFM_API_KEY) {
  console.error("Error: IDFM_API_KEY environment variable is required");
  console.error("Get your API key at https://connect.iledefrance-mobilites.fr/");
  process.exit(1);
}

const client = new Client({
  cache: new CacheDB(Util.pathInProjectRoot(".cache.db")),
  authorization: IDFM_API_KEY,
});

async function getAllPages<T>(url: string, field: string): Promise<T[]> {
  const count = 1000;
  let result: T[] = [];
  let start_page = 0;
  let response: any;

  do {
    response = await client.get(url, { start_page, count });
    result = result.concat(response[field] ?? []);
    if (!response.pagination) {
      return result;
    }
    start_page++;
  } while (response.pagination.items_per_page === response.pagination.items_on_page);

  return result;
}

async function getStopAreasForLine(lineId: string): Promise<string[]> {
  const url = `lines/${encodeURIComponent(lineId)}/stop_areas`;
  try {
    const stopAreas = await getAllPages<Navitia.StopArea>(url, "stop_areas");
    return stopAreas.map(sa => sa.id);
  } catch (err) {
    console.error(`  Error fetching stop_areas for ${lineId}: ${(err as Error).message}`);
    return [];
  }
}

function dbRun(db: SQLite.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function dbGet<T>(db: SQLite.Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

/** Fetch route_schedules, return terminus_count for stops that are endpoints at least as often as intermediate. */
async function getTerminiFromSchedules(lineId: string): Promise<Map<string, number>> {
  const url = `lines/${encodeURIComponent(lineId)}/route_schedules`;
  try {
    const resp = await client.get(url) as any;
    const schedules = resp.route_schedules ?? [];
    if (schedules.length === 0) return new Map();

    const endpointCount = new Map<string, number>();
    const intermediateCount = new Map<string, number>();

    for (const schedule of schedules) {
      const rows: any[] = schedule.table?.rows ?? [];
      const stopAreaIds: string[] = [];
      for (const row of rows) {
        const saId: string | undefined = row.stop_point?.stop_area?.id;
        if (!saId) continue;
        if (stopAreaIds[stopAreaIds.length - 1] !== saId) {
          stopAreaIds.push(saId);
        }
      }
      if (stopAreaIds.length === 0) continue;

      const first = stopAreaIds[0], last = stopAreaIds[stopAreaIds.length - 1];
      endpointCount.set(first, (endpointCount.get(first) ?? 0) + 1);
      if (last !== first) {
        endpointCount.set(last, (endpointCount.get(last) ?? 0) + 1);
      }

      for (let i = 1; i < stopAreaIds.length - 1; i++) {
        intermediateCount.set(stopAreaIds[i], (intermediateCount.get(stopAreaIds[i]) ?? 0) + 1);
      }
    }

    // Terminus = endpoint at least as often as intermediate
    // Filters RER turnaround points (endpoint=2, intermediate=10) but keeps
    // bus termini where variant routes overlap (endpoint=1, intermediate=1)
    const result = new Map<string, number>();
    for (const [id, count] of endpointCount) {
      if (count >= (intermediateCount.get(id) ?? 0)) {
        result.set(id, count);
      }
    }
    return result;
  } catch (err) {
    console.error(`  Warning: route_schedules failed for ${lineId}: ${(err as Error).message}`);
    return new Map();
  }
}

async function initDatabase(): Promise<SQLite.Database> {
  return new Promise((resolve, reject) => {
    const db = new SQLite.Database(DB_PATH, async (err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        await dbRun(db, "DROP TABLE IF EXISTS line_stations");
        await dbRun(db, `
          CREATE TABLE line_stations (
            line_id TEXT NOT NULL,
            stop_area_id TEXT NOT NULL,
            terminus_count INTEGER NOT NULL DEFAULT 0
          )
        `);

        await dbRun(db, `
          CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `);

        resolve(db);
      } catch (initErr) {
        reject(initErr);
      }
    });
  });
}

async function main() {
  console.error("=== Line-Station Mapping Generator ===\n");

  const db = await initDatabase();

  // Fetch all lines
  console.error("Fetching lines...");
  const lines = await getAllPages<Navitia.PTLine>("lines", "lines");
  console.error(`  Found ${lines.length} lines\n`);

  // Process each line
  let processedLines = 0;
  let totalRelationships = 0;

  for (const line of lines) {
    processedLines++;
    const progress = `[${processedLines}/${lines.length}]`;

    const stopAreaIds = await getStopAreasForLine(line.id);
    const termini = await getTerminiFromSchedules(line.id);

    if (stopAreaIds.length > 0) {
      for (const stopAreaId of stopAreaIds) {
        const terminusCount = termini.get(stopAreaId) ?? 0;
        await dbRun(db,
          "INSERT INTO line_stations (line_id, stop_area_id, terminus_count) VALUES (?, ?, ?)",
          [stripLinePrefix(line.id), stripStopAreaPrefix(stopAreaId), terminusCount]
        );
      }
      totalRelationships += stopAreaIds.length;
      const terminusCount = [...termini.values()].filter(c => c > 0).length;
      console.error(`${progress} ${line.code || line.name}: ${stopAreaIds.length} stations, ${terminusCount} termini`);
    } else {
      console.error(`${progress} ${line.code || line.name}: no stations`);
    }
  }

  // Store metadata
  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["generated_at", new Date().toISOString()]
  );
  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["line_count", String(lines.length)]
  );

  // Count unique stations
  const result = await dbGet<{ count: number }>(db,
    "SELECT COUNT(DISTINCT stop_area_id) as count FROM line_stations"
  );
  const uniqueStations = result?.count ?? 0;

  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["station_count", String(uniqueStations)]
  );
  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["relationship_count", String(totalRelationships)]
  );
  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["api_call_count", String(client.callCount)]
  );
  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["cache_hit_count", String(client.cacheHitCount)]
  );

  const terminusResult = await dbGet<{ count: number }>(db,
    "SELECT COUNT(*) as count FROM line_stations WHERE terminus_count > 0"
  );
  const terminusEntries = terminusResult?.count ?? 0;

  await dbRun(db,
    "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
    ["terminus_entries", String(terminusEntries)]
  );

  await dbRun(db, "VACUUM");
  db.close();

  console.error("\n=== Summary ===");
  console.error(`Lines processed: ${lines.length}`);
  console.error(`Unique stations: ${uniqueStations}`);
  console.error(`Total relationships: ${totalRelationships}`);
  console.error(`Terminus entries: ${terminusEntries}`);
  console.error(`API calls: ${client.callCount}`);
  console.error(`Cache hits: ${client.cacheHitCount}`);
  console.error(`Database: ${DB_PATH}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
