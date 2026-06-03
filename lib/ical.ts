import type { Disruption } from "./client/navitia/types.ts";

const CRLF = "\r\n";
const PRODID = "-//IDFM Disruptions//ratp_to_ical//FR";

export const MODE_ICON: Record<string, string> = {
  "Métro": "Ⓜ",
  "RER": "ʀᴇʀ",
  "Tramway": "🚊",
  "Bus": "в̲̅υ̲̅ѕ̲̅",
  "TER": "𝓽𝓮𝓻",
  "Train Transilien": "🚆",
  "Funiculaire": "🚡",
  "Orlyval, CDG VAL": "🛧",
};

const EFFECT_FR: Record<string, string> = {
  NO_SERVICE: "Service interrompu",
  REDUCED_SERVICE: "Service réduit",
  SIGNIFICANT_DELAYS: "Retards importants",
  MODIFIED_SERVICE: "Service modifié",
  DETOUR: "Déviation",
  ADDITIONAL_SERVICE: "Service supplémentaire",
  OTHER_EFFECT: "Perturbation",
  UNKNOWN_EFFECT: "Perturbation",
};

export interface EventContext {
  modeName?: string;
  lineCode?: string;
  stationName?: string;
  geo?: { lat: string; lon: string };
}

export interface VEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  allDay?: boolean;
  description?: string;
  categories?: string[];
  url?: string;
  location?: string;
  geo?: { lat: string; lon: string };
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  const MAX_LINE_LENGTH = 75;
  if (line.length <= MAX_LINE_LENGTH) return line;
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > MAX_LINE_LENGTH) {
    parts.push(remaining.slice(0, MAX_LINE_LENGTH));
    remaining = " " + remaining.slice(MAX_LINE_LENGTH);
  }
  parts.push(remaining);
  return parts.join(CRLF);
}

const MS_PER_DAY = 86_400_000;
const MIDNIGHT_SNAP_SECONDS = 300;

export interface DateSegment {
  dtstart: string; // timed: YYYYMMDDTHHmmss ; all-day: YYYYMMDD
  dtend: string;   // timed: YYYYMMDDTHHmmss ; all-day: YYYYMMDD (exclusive)
  allDay: boolean;
}

// Wall-clock (Europe/Paris) datetime parsed into a UTC epoch used purely as a
// day/second counter. No timezone conversion happens: the same wall-clock
// fields are read back out, so DST never enters the arithmetic.
function wallClockToEpochMs(dateTime: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(dateTime);
  if (!m) throw new Error(`Unparseable Navitia datetime: ${JSON.stringify(dateTime)}`);
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

function epochMsToDateTime(epochMs: number): string {
  const dt = new Date(epochMs);
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${p(dt.getUTCFullYear(), 4)}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}` +
    `T${p(dt.getUTCHours())}${p(dt.getUTCMinutes())}${p(dt.getUTCSeconds())}`;
}

function epochMsToDate(epochMs: number): string {
  const dt = new Date(epochMs);
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${p(dt.getUTCFullYear(), 4)}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`;
}

function snapToMidnight(epochMs: number): number {
  const intoDayMs = ((epochMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  const snapMs = MIDNIGHT_SNAP_SECONDS * 1000;
  if (intoDayMs <= snapMs) return epochMs - intoDayMs;
  if (intoDayMs >= MS_PER_DAY - snapMs) return epochMs - intoDayMs + MS_PER_DAY;
  return epochMs;
}

function floorToDayMs(epochMs: number): number {
  return epochMs - (((epochMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
}

// Splits one application period into calendar segments: timed events on partial
// leading/trailing days and a single all-day event spanning the full interior
// days. A span that crosses midnight but covers no full day stays one timed
// event. Near-midnight bounds snap to midnight (see MIDNIGHT_SNAP_SECONDS).
export function splitPeriodIntoSegments(begin: string, end: string): DateSegment[] {
  const beginMs = snapToMidnight(wallClockToEpochMs(begin));
  const endMs = snapToMidnight(wallClockToEpochMs(end));
  if (endMs <= beginMs) {
    throw new Error(`Period end not after start: ${JSON.stringify({ begin, end })}`);
  }

  const beginDayMs = floorToDayMs(beginMs);
  const endDayMs = floorToDayMs(endMs);
  const beginAtMidnight = beginMs === beginDayMs;
  const endAtMidnight = endMs === endDayMs;

  const firstFullDayMs = beginAtMidnight ? beginDayMs : beginDayMs + MS_PER_DAY;
  const lastFullDayInclMs = endDayMs - MS_PER_DAY;
  const hasFullBlock = firstFullDayMs <= lastFullDayInclMs;

  if (!hasFullBlock) {
    return [{ dtstart: epochMsToDateTime(beginMs), dtend: epochMsToDateTime(endMs), allDay: false }];
  }

  const segments: DateSegment[] = [];
  if (!beginAtMidnight) {
    segments.push({ dtstart: epochMsToDateTime(beginMs), dtend: epochMsToDateTime(firstFullDayMs), allDay: false });
  }
  segments.push({ dtstart: epochMsToDate(firstFullDayMs), dtend: epochMsToDate(lastFullDayInclMs + MS_PER_DAY), allDay: true });
  if (!endAtMidnight) {
    segments.push({ dtstart: epochMsToDateTime(endDayMs), dtend: epochMsToDateTime(endMs), allDay: false });
  }
  return segments;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface AffectedStations {
  section?: { from: string; to: string };
  stops?: string[];
}

function getAffectedStations(disruption: Disruption): AffectedStations {
  for (const io of disruption.impacted_objects ?? []) {
    const section = io.impacted_section;
    if (section?.from && section?.to) {
      const fromName = section.from.stop_area?.name ?? section.from.name;
      const toName = section.to.stop_area?.name ?? section.to.name;
      const stops = io.impacted_stops
        ?.map(s => s.stop_point?.name)
        .filter((n): n is string => !!n);
      return {
        section: { from: fromName, to: toName },
        stops: stops?.length ? stops : undefined,
      };
    }
    if (io.impacted_stops?.length) {
      const stops = io.impacted_stops
        .map(s => s.stop_point?.name)
        .filter((n): n is string => !!n);
      if (stops.length) {
        return { stops };
      }
    }
  }
  return {};
}

export function disruptionToVEvent(disruption: Disruption, context?: EventContext): VEvent[] {
  if (!disruption.application_periods?.length) return [];

  const message = disruption.messages?.find(m => m.text)?.text ?? "";
  const effectKey = disruption.severity?.effect ?? "UNKNOWN_EFFECT";
  let effectFr = EFFECT_FR[effectKey];
  if (!effectFr) {
    effectFr = "Perturbation";
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::warning::Unknown disruption effect: ${effectKey} (disruption ${disruption.id})`);
    }
  }
  const cause = disruption.cause ?? "perturbation";

  const { modeName, lineCode, stationName } = context ?? {};
  const affected = getAffectedStations(disruption);
  const modeLabel = modeName ? (MODE_ICON[modeName] ?? modeName) : undefined;

  let summary: string;
  if (modeLabel && lineCode && stationName) {
    summary = `${modeLabel} ${lineCode} @ ${stationName} – ${effectFr}`;
  } else if (modeLabel && lineCode) {
    summary = `${modeLabel} ${lineCode} – ${effectFr}`;
  } else if (lineCode) {
    summary = `[${lineCode}] ${effectFr}`;
  } else {
    summary = effectFr;
  }

  if (affected.section) {
    summary += ` (${affected.section.from} → ${affected.section.to})`;
  }

  let description = stripHtml(message);
  const descParts: string[] = [];
  if (affected.section) {
    descParts.push(`Section: ${affected.section.from} → ${affected.section.to}`);
  }
  if (affected.stops?.length) {
    descParts.push(`Arrêts concernés: ${affected.stops.join(", ")}`);
  }
  if (descParts.length) {
    description = description ? `${descParts.join("\n")}\n\n${description}` : descParts.join("\n");
  }

  let location: string | undefined;
  if (affected.section) {
    location = `${affected.section.from} → ${affected.section.to}`;
  } else if (stationName) {
    location = stationName;
  }

  const categories = [effectKey, cause].filter(Boolean);
  const placed: { segment: DateSegment; uidSuffix: string }[] = [];
  disruption.application_periods.forEach((period, periodIndex) => {
    splitPeriodIntoSegments(period.begin, period.end).forEach((segment, segmentIndex) => {
      placed.push({ segment, uidSuffix: `-${periodIndex}-${segmentIndex}` });
    });
  });

  // Keep the bare disruption id as UID when it maps to a single event (no churn
  // for the common case); otherwise suffix with period/segment indices to stay
  // unique and stable across runs.
  const single = placed.length === 1;
  return placed.map(({ segment, uidSuffix }) => ({
    uid: `${disruption.id}${single ? "" : uidSuffix}@idfm.ratp_to_ical`,
    summary,
    dtstart: segment.dtstart,
    dtend: segment.dtend,
    allDay: segment.allDay,
    description: description || undefined,
    categories,
    location,
    geo: context?.geo,
  }));
}

function veventToIcal(event: VEvent, timezone: string): string {
  const dateProps = event.allDay
    ? [`DTSTART;VALUE=DATE:${event.dtstart}`, `DTEND;VALUE=DATE:${event.dtend}`]
    : [`DTSTART;TZID=${timezone}:${event.dtstart}`, `DTEND;TZID=${timezone}:${event.dtend}`];
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    ...dateProps,
    `SUMMARY:${escapeICalText(event.summary)}`,
    "TRANSP:TRANSPARENT",
    "X-APPLE-DEFAULT-ALARM:FALSE",
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }
  if (event.geo) {
    lines.push(`GEO:${event.geo.lat};${event.geo.lon}`);
  }
  if (event.categories?.length) {
    lines.push(`CATEGORIES:${event.categories.map(escapeICalText).join(",")}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  lines.push("BEGIN:VALARM");
  lines.push("ACTION:NONE");
  lines.push("TRIGGER;VALUE=DURATION:-PT0M");
  lines.push("DESCRIPTION:");
  lines.push("END:VALARM");
  lines.push("END:VEVENT");
  return lines.map(foldLine).join(CRLF);
}

function timezoneComponent(tzid: string): string {
  // Simplified Europe/Paris timezone definition
  if (tzid === "Europe/Paris") {
    return [
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Paris",
      "BEGIN:DAYLIGHT",
      "TZOFFSETFROM:+0100",
      "TZOFFSETTO:+0200",
      "TZNAME:CEST",
      "DTSTART:19700329T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0200",
      "TZOFFSETTO:+0100",
      "TZNAME:CET",
      "DTSTART:19701025T030000",
      "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
      "END:STANDARD",
      "END:VTIMEZONE",
    ].join(CRLF);
  }
  throw new Error(`Unsupported timezone: ${tzid}`);
}

export interface CalendarMetadata {
  name: string;
  description?: string;
  timezone: string;
}

export function createCalendar(events: VEvent[], metadata: CalendarMetadata): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(metadata.name)}`,
  ];
  if (metadata.description) {
    lines.push(`X-WR-CALDESC:${escapeICalText(metadata.description)}`);
  }
  lines.push(`X-WR-TIMEZONE:${metadata.timezone}`);
  lines.push("X-APPLE-DEFAULT-ALARM:FALSE");

  const header = lines.map(foldLine).join(CRLF);
  const tz = timezoneComponent(metadata.timezone);
  events.sort((a, b) => a.dtstart.localeCompare(b.dtstart));
  const eventBlocks = events.map(e => veventToIcal(e, metadata.timezone)).join(CRLF);
  const footer = "END:VCALENDAR";

  return [header, tz, eventBlocks, footer].filter(Boolean).join(CRLF) + CRLF;
}
