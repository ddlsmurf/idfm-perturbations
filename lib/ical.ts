import type { Disruption } from "./client/navitia/types.ts";

const CRLF = "\r\n";
const PRODID = "-//IDFM Disruptions//ratp_to_ical//FR";

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

function formatICalDateTime(dateStr: string): string {
  // Input: YYYYMMDDTHHmmss (Navitia format)
  // Output: YYYYMMDDTHHmmss (already correct for iCal)
  return dateStr;
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

export function disruptionToVEvent(disruption: Disruption, context?: EventContext): VEvent | null {
  if (!disruption.application_periods?.length) return null;

  const period = disruption.application_periods[0];
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

  let summary: string;
  if (modeName && lineCode && stationName) {
    summary = `${modeName} ${lineCode} @ ${stationName} – ${effectFr}`;
  } else if (modeName && lineCode) {
    summary = `${modeName} ${lineCode} – ${effectFr}`;
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

  return {
    uid: `${disruption.id}@idfm.ratp_to_ical`,
    summary,
    dtstart: formatICalDateTime(period.begin),
    dtend: formatICalDateTime(period.end),
    description: description || undefined,
    categories: [effectKey, cause].filter(Boolean),
    location,
    geo: context?.geo,
  };
}

function veventToIcal(event: VEvent, timezone: string): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;TZID=${timezone}:${event.dtstart}`,
    `DTEND;TZID=${timezone}:${event.dtend}`,
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
