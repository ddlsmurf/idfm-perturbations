import FS from "node:fs";
import Path from "node:path";
import SQLite from "sqlite3";
import { Util, Client } from "../lib/index.ts";
import { CacheDB } from "../lib/client/cache.ts";
import type * as Navitia from "../lib/client/navitia/index.ts";
import { generateLineFeed, filterDisruptionsForLines } from "../lib/generators/line.ts";
import { generateStationFeed, filterDisruptionsForStopArea } from "../lib/generators/station.ts";

const LINE_PREFIX = "line:IDFM:";
const STOP_AREA_PREFIX = "stop_area:IDFM:";

const TEXT_COLOR_MAP: Record<string, number> = { "000000": 0, "FFFFFF": 1 };

function encodeTextColor(hex: string): number | string {
  return TEXT_COLOR_MAP[hex] ?? hex;
}

function toColumnar(rows: Record<string, any>[]): Record<string, any[]> {
  if (rows.length === 0) return {};
  const keys = Object.keys(rows[0]);
  const result: Record<string, any[]> = {};
  for (const key of keys) {
    result[key] = rows.map(r => r[key]);
  }
  return result;
}

function extractCommune(name: string, label: string): string | undefined {
  const prefix = name + " (";
  if (label.startsWith(prefix) && label.endsWith(")")) {
    return label.slice(prefix.length, -1);
  }
  if (label !== name) return label;
  return undefined;
}

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

const OUTPUT_DIR = Util.pathInProjectRoot("dist/calendars");
const LINES_DIR = Path.join(OUTPUT_DIR, "lines");
const STATIONS_DIR = Path.join(OUTPUT_DIR, "stations");

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

const MAX_PAGES = 200;

async function getAllPages<T>(url: string, field: string): Promise<{
  result: T[];
  disruptions: Navitia.Disruption[];
  context: Navitia.ResponseContext;
}> {
  console.error(`Fetching ${url}...`);
  const count = 1000;
  let result: T[] = [];
  let start_page = 0;
  let response: any;
  let context: Navitia.ResponseContext | undefined = undefined;
  let disruptions: Navitia.Disruption[] = [];

  do {
    response = await client.get(url, { start_page, count });
    const items = response[field] ?? [];
    result = result.concat(items);
    context = response.context ?? context;
    if (response.disruptions) {
      disruptions = disruptions.concat(response.disruptions);
    }
    if (!response.pagination) {
      console.error(`  ${url}: ${result.length} items (no pagination)`);
      return { disruptions, result, context: context! };
    }

    const p = response.pagination;
    const isLastPage = p.items_on_page < p.items_per_page;
    const expectedTotal = p.total_result;

    if (items.length === 0) {
      console.error(`  ${url}: ${result.length} items in ${start_page + 1} pages (empty page, pagination reported ${p.items_on_page}/${p.items_per_page})`);
      return { disruptions, result, context: context! };
    }

    if (isLastPage) {
      const fetchedEnough = result.length >= expectedTotal;
      if (!fetchedEnough) {
        throw new Error(`Unexpected short page: got ${result.length} items but expected ${expectedTotal} (page ${start_page}, ${p.items_on_page}/${p.items_per_page} items)`);
      }
      console.error(`  ${url}: ${result.length} items in ${start_page + 1} pages (total: ${expectedTotal})`);
      return { disruptions, result, context: context! };
    }

    start_page++;
    if (start_page >= MAX_PAGES) {
      throw new Error(`Pagination limit reached: ${MAX_PAGES} pages for ${url} (fetched ${result.length}, expected ${expectedTotal})`);
    }
  } while (true);
}

function ensureDir(dir: string) {
  if (!FS.existsSync(dir)) {
    FS.mkdirSync(dir, { recursive: true });
  }
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const MAPPING_DB_PATH = Util.pathInProjectRoot("cache/line_station_mapping.db");

interface TerminusEntry { id: string; count: number; }

interface MappingData {
  stationLines: Map<string, string[]>;
  lineTermini: Map<string, TerminusEntry[]>;
}

function dbAll<T>(db: SQLite.Database, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => err ? reject(err) : resolve(rows as T[]));
  });
}

function loadMappingData(dbPath: string): Promise<MappingData> {
  return new Promise((resolve, reject) => {
    const db = new SQLite.Database(dbPath, SQLite.OPEN_READONLY, async (err) => {
      if (err) { reject(err); return; }
      try {
        const rows = await dbAll<{ stop_area_id: string; line_id: string }>(
          db, "SELECT stop_area_id, line_id FROM line_stations",
        );
        const stationLines = new Map<string, string[]>();
        for (const row of rows) {
          const fullStopAreaId = STOP_AREA_PREFIX + row.stop_area_id;
          const fullLineId = LINE_PREFIX + row.line_id;
          if (!stationLines.has(fullStopAreaId)) stationLines.set(fullStopAreaId, []);
          stationLines.get(fullStopAreaId)!.push(fullLineId);
        }

        const terminusRows = await dbAll<{ line_id: string; stop_area_id: string; terminus_count: number }>(
          db, "SELECT line_id, stop_area_id, terminus_count FROM line_stations WHERE terminus_count > 0",
        );
        const lineTermini = new Map<string, TerminusEntry[]>();
        for (const row of terminusRows) {
          const fullLineId = LINE_PREFIX + row.line_id;
          const fullStopAreaId = STOP_AREA_PREFIX + row.stop_area_id;
          if (!lineTermini.has(fullLineId)) lineTermini.set(fullLineId, []);
          lineTermini.get(fullLineId)!.push({ id: fullStopAreaId, count: row.terminus_count });
        }

        db.close();
        resolve({ stationLines, lineTermini });
      } catch (queryErr) {
        db.close();
        reject(queryErr);
      }
    });
  });
}

async function main() {
  console.error("=== IDFM Calendar Generator ===\n");

  ensureDir(LINES_DIR);
  ensureDir(STATIONS_DIR);

  // Load line-station mapping if available
  let stationLines: Map<string, string[]> | null = null;
  let lineTermini: Map<string, TerminusEntry[]> | null = null;
  if (FS.existsSync(MAPPING_DB_PATH)) {
    try {
      const mapping = await loadMappingData(MAPPING_DB_PATH);
      stationLines = mapping.stationLines;
      lineTermini = mapping.lineTermini;
      console.error(`Loaded line-station mapping: ${stationLines.size} stations, ${lineTermini.size} lines with termini`);
    } catch (err) {
      console.error(`Warning: could not load ${MAPPING_DB_PATH}: ${(err as Error).message}`);
    }
  } else {
    console.error("Warning: cache/line_station_mapping.db not found, stations will not show line info");
  }

  // Fetch all data
  console.error("Fetching lines...");
  const linesResponse = await getAllPages<Navitia.PTLine>("lines", "lines");
  const lines = linesResponse.result;
  console.error(`  Found ${lines.length} lines`);

  console.error("Fetching stop_areas...");
  const stopAreasResponse = await getAllPages<Navitia.StopArea>("stop_areas", "stop_areas");
  const stopAreas = stopAreasResponse.result;
  console.error(`  Found ${stopAreas.length} stop_areas`);

  console.error("Fetching disruptions via line_reports...");
  const lineReportsResponse = await getAllPages<any>("line_reports/line_reports", "line_reports");
  const allDisruptions = deduplicateById(lineReportsResponse.disruptions);
  console.error(`  Found ${allDisruptions.length} unique disruptions`);

  const timezone = linesResponse.context?.timezone ?? "Europe/Paris";
  console.error(`  Timezone: ${timezone}\n`);

  // Merge RER bus variants: find Bus lines on "RER" network matching an RER line's code
  const rerLines = lines.filter(l => l.commercial_mode?.name === "RER");
  const rerBusVariants = new Set<string>();
  const rerMergeIds = new Map<string, string[]>();
  for (const rer of rerLines) {
    const busVariant = lines.find(l =>
      l.id !== rer.id &&
      l.code === rer.code &&
      l.commercial_mode?.name === "Bus" &&
      l.network?.name === "RER"
    );
    if (busVariant) {
      rerBusVariants.add(busVariant.id);
      rerMergeIds.set(rer.id, [busVariant.id]);
      console.error(`  Merging RER ${rer.code} bus variant ${stripLinePrefix(busVariant.id)} into ${stripLinePrefix(rer.id)}`);
    }
  }
  const filteredLines = lines.filter(l => !rerBusVariants.has(l.id));
  console.error(`  Merged ${rerBusVariants.size} RER bus variants (${lines.length} → ${filteredLines.length} lines)\n`);

  // Generate line feeds
  console.error("Generating line feeds...");
  let lineCount = 0;
  for (const line of filteredLines) {
    const strippedId = stripLinePrefix(line.id);
    const filepath = Path.join(LINES_DIR, strippedId + ".ics");
    const ical = generateLineFeed(line, allDisruptions, timezone, rerMergeIds.get(line.id));
    FS.writeFileSync(filepath, ical, "utf-8");
    lineCount++;
  }
  console.error(`  Generated ${lineCount} line feeds`);

  // Generate station feeds
  console.error("Generating station feeds...");
  let stationCount = 0;
  for (const stopArea of stopAreas) {
    const strippedId = stripStopAreaPrefix(stopArea.id);
    const filepath = Path.join(STATIONS_DIR, strippedId + ".ics");
    const ical = generateStationFeed(stopArea, allDisruptions, timezone);
    FS.writeFileSync(filepath, ical, "utf-8");
    stationCount++;
  }
  console.error(`  Generated ${stationCount} station feeds`);

  // Compute disruption date range (ignore placeholder year 2099)
  const allPeriods = allDisruptions.flatMap(d => d.application_periods ?? []);
  const beginDates = allPeriods.map(p => p.begin).filter(Boolean).sort();
  const endDates = allPeriods
    .map(p => p.end)
    .filter(d => d && !d.startsWith("2099"))
    .sort();
  const oldestDisruption = beginDates[0] ?? null;
  const latestDisruption = endDates[endDates.length - 1] ?? null;

  // Build lookup maps (using filteredLines for manifest indices)
  const lineIdToIndex = new Map<string, number>();
  filteredLines.forEach((l, i) => lineIdToIndex.set(l.id, i));
  for (const [rerId, variantIds] of rerMergeIds) {
    const rerIndex = lineIdToIndex.get(rerId)!;
    for (const vid of variantIds) {
      lineIdToIndex.set(vid, rerIndex);
    }
  }

  const stopAreaName = new Map<string, string>();
  for (const sa of stopAreas) stopAreaName.set(sa.id, sa.name);

  // Build network/mode lookup tables
  const networkSet = [...new Set(filteredLines.map(l => l.network?.name).filter(Boolean))] as string[];
  const modeSet = [...new Set(filteredLines.map(l => l.commercial_mode?.name).filter(Boolean))] as string[];
  const networkIndex = new Map(networkSet.map((n, i) => [n, i]));
  const modeIndex = new Map(modeSet.map((m, i) => [m, i]));

  // Generate index manifest
  const manifest = {
    generated_at: new Date().toISOString(),
    timezone,
    oldest_disruption: oldestDisruption,
    latest_disruption: latestDisruption,
    networks: networkSet,
    modes: modeSet,
    lines: toColumnar(filteredLines.map(l => {
      const allIds = [l.id, ...(rerMergeIds.get(l.id) ?? [])];
      const events = filterDisruptionsForLines(allDisruptions, allIds).length;
      const termini = (lineTermini?.get(l.id) ?? [])
        .sort((a, b) => b.count - a.count)
        .map(e => stopAreaName.get(e.id))
        .filter((name): name is string => !!name);
      const net = l.network?.name;
      const mod = l.commercial_mode?.name;
      return {
        i: stripLinePrefix(l.id),
        c: l.code,
        n: l.name,
        w: net != null ? networkIndex.get(net)! : null,
        m: mod != null ? modeIndex.get(mod)! : null,
        co: l.color,
        tc: encodeTextColor(l.text_color),
        e: events > 0 ? events : null,
        t: termini.length > 0 ? termini : null,
      };
    })),
    stations: toColumnar(stopAreas.map(s => {
      const events = filterDisruptionsForStopArea(allDisruptions, s.id).length;
      return {
        i: stripStopAreaPrefix(s.id),
        n: s.name,
        cm: extractCommune(s.name, s.label) ?? null,
        la: s.coord ? parseFloat(s.coord.lat) : null,
        lo: s.coord ? parseFloat(s.coord.lon) : null,
        e: events > 0 ? events : null,
        l: [...new Set(
          stationLines?.get(s.id)
            ?.map(lineId => lineIdToIndex.get(lineId))
            .filter((idx): idx is number => idx !== undefined)
          ?? []
        )]
          .map(idx => ({ idx, code: filteredLines[idx].code }))
          .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
          .map(x => x.idx),
      };
    })),
    disruptions_count: allDisruptions.length,
  };
  const indexPath = Path.join(OUTPUT_DIR, "index.json");
  FS.writeFileSync(indexPath, JSON.stringify(manifest), "utf-8");
  console.error(`\nWrote manifest to ${indexPath}`);

  // Copy HTML template
  const templatePath = Util.pathInProjectRoot("templates/index.html");
  const htmlOutputPath = Path.join(OUTPUT_DIR, "index.html");
  FS.copyFileSync(templatePath, htmlOutputPath);
  console.error(`Copied index.html`);

  console.error("\n=== Done ===");
  console.error(`API calls: ${client.callCount}`);
  console.error(`Cache hits: ${client.cacheHitCount}`);
  console.error(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
