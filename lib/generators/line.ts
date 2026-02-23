import type { Disruption, PTLine } from "../client/navitia/types.ts";
import { createCalendar, disruptionToVEvent, MODE_ICON, type VEvent, type EventContext } from "../ical.ts";

export function filterDisruptionsForLines(disruptions: Disruption[], lineIds: string[]): Disruption[] {
  const idSet = new Set(lineIds);
  return disruptions.filter(d =>
    d.impacted_objects?.some(io =>
      io.pt_object?.embedded_type === "line" && idSet.has(io.pt_object?.line?.id ?? "")
    )
  );
}

export function generateLineFeed(
  line: PTLine,
  disruptions: Disruption[],
  timezone: string,
  mergeLineIds?: string[],
): string {
  const allIds = mergeLineIds ? [line.id, ...mergeLineIds] : [line.id];
  const lineDisruptions = filterDisruptionsForLines(disruptions, allIds);
  const context: EventContext = {
    modeName: line.commercial_mode?.name,
    lineCode: line.code,
  };
  const events: VEvent[] = lineDisruptions
    .map(d => disruptionToVEvent(d, context))
    .filter((e): e is VEvent => e !== null);

  const modeName = line.commercial_mode?.name ?? line.physical_modes?.[0]?.name ?? "";
  const modeLabel = MODE_ICON[modeName] ?? modeName;
  const networkName = line.network?.name ?? "IDFM";
  const OBVIOUS_NETWORK: Record<string, string> = {
    "Métro": "RATP",
    "Bus": "RATP",
    "Tramway": "RATP",
    "Funiculaire": "RATP",
    "RER": "RER",
    "TER": "TER",
    "Train Transilien": "Transilien",
    "Orlyval, CDG VAL": "ADP",
  };
  const networkSuffix = OBVIOUS_NETWORK[modeName] === networkName ? "" : ` (${networkName})`;
  const calendarName = `${modeLabel} ${line.code}`.trim();

  return createCalendar(events, {
    name: `${calendarName}${networkSuffix} - Perturbations`,
    description: `Perturbations sur la ligne ${line.name}`,
    timezone,
  });
}
