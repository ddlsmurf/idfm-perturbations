import type { Disruption, StopArea } from "../client/navitia/types.ts";
import { createCalendar, disruptionToVEvent, type VEvent, type EventContext } from "../ical.ts";

function getLineFromDisruption(disruption: Disruption) {
  const lineObject = disruption.impacted_objects?.find(
    io => io.pt_object?.embedded_type === "line"
  );
  return lineObject?.pt_object?.line;
}

export function filterDisruptionsForStopArea(disruptions: Disruption[], stopAreaId: string): Disruption[] {
  return disruptions.filter(d =>
    d.impacted_objects?.some(io => {
      const pt = io.pt_object;
      if (!pt) return false;
      // Direct stop_area match
      if (pt.embedded_type === "stop_area" && pt.stop_area?.id === stopAreaId) return true;
      // stop_point belonging to this stop_area
      if (pt.embedded_type === "stop_point" && pt.stop_point?.stop_area?.id === stopAreaId) return true;
      // Check impacted_section from/to
      if (io.impacted_section) {
        const { from, to } = io.impacted_section;
        if (from?.stop_area?.id === stopAreaId || to?.stop_area?.id === stopAreaId) return true;
      }
      // Check impacted_stops
      if (io.impacted_stops?.some(is => is.stop_point?.stop_area?.id === stopAreaId)) return true;
      return false;
    })
  );
}

export function generateStationFeed(
  stopArea: StopArea,
  disruptions: Disruption[],
  timezone: string,
): string {
  const stationDisruptions = filterDisruptionsForStopArea(disruptions, stopArea.id);
  const events: VEvent[] = stationDisruptions
    .map(d => {
      const line = getLineFromDisruption(d);
      const context: EventContext = {
        modeName: line?.commercial_mode?.name,
        lineCode: line?.code,
        stationName: stopArea.name,
        geo: stopArea.coord,
      };
      return disruptionToVEvent(d, context);
    })
    .filter((e): e is VEvent => e !== null);

  return createCalendar(events, {
    name: `${stopArea.name} - Perturbations IDFM`,
    description: `Perturbations à la station ${stopArea.label ?? stopArea.name}`,
    timezone,
  });
}
