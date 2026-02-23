export const LINE_PREFIX = "line:IDFM:";
export const STOP_AREA_PREFIX = "stop_area:IDFM:";

export function stripLinePrefix(id: string): string {
  if (!id.startsWith(LINE_PREFIX)) {
    throw new Error(`Invalid line ID prefix, expected ${JSON.stringify(LINE_PREFIX)}, got ${JSON.stringify(id)}`);
  }
  return id.slice(LINE_PREFIX.length);
}

export function stripStopAreaPrefix(id: string): string {
  if (!id.startsWith(STOP_AREA_PREFIX)) {
    throw new Error(`Invalid stop_area ID prefix, expected ${JSON.stringify(STOP_AREA_PREFIX)}, got ${JSON.stringify(id)}`);
  }
  return id.slice(STOP_AREA_PREFIX.length);
}
