import type { Disruption, PTLine } from "../client/navitia/types.ts";
import { createCalendar, disruptionToVEvent, type VEvent, type EventContext } from "../ical.ts";

export function filterDisruptionsForLine(disruptions: Disruption[], lineId: string): Disruption[] {
  return disruptions.filter(d =>
    d.impacted_objects?.some(io =>
      io.pt_object?.embedded_type === "line" && io.pt_object?.line?.id === lineId
    )
  );
}

export function generateLineFeed(
  line: PTLine,
  disruptions: Disruption[],
  timezone: string,
): string {
  const lineDisruptions = filterDisruptionsForLine(disruptions, line.id);
  const context: EventContext = {
    modeName: line.commercial_mode?.name,
    lineCode: line.code,
  };
  const events: VEvent[] = lineDisruptions
    .map(d => disruptionToVEvent(d, context))
    .filter((e): e is VEvent => e !== null);

  const modeName = line.commercial_mode?.name ?? line.physical_modes?.[0]?.name ?? "";
  const networkName = line.network?.name ?? "IDFM";
  const calendarName = `${modeName} ${line.code}`.trim();

  return createCalendar(events, {
    name: `${calendarName} (${networkName}) - Perturbations`,
    description: `Perturbations sur la ligne ${line.name}`,
    timezone,
  });
}
