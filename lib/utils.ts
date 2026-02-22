import Path from 'node:path';

export function pathInProjectRoot(path: string) {
  return Path.join(import.meta.dirname, "..", path);
}

export function joinURLPath(...parts: string[]): string {
  return parts.map((part, index) => {
    if (index > 0) part = part.replace(/^\/+/, "");
    if (index < parts.length - 1) part = part.replace(/\/+$/, "");
    return part;
  }).join("/");
}

export function templateURL(url, variables) {
  return url.replace(/\{([^}]+)\}/g, (_, varName) =>  {
    varName = varName.trim();
    const value = variables[varName];
    if (value === undefined)
      throw new Error(`Missing variable expanding URL: ${JSON.stringify(varName)} in ${JSON.stringify(url)} (have ${JSON.stringify(variables)})`);
    return encodeURIComponent(value);
  })
}
function templateURLGetFields(url: string) {
  return [...url.matchAll(/\{([^}]+)\}/g)].map(x => x[1].trim());
}



export function unicodeCircledNumber(num: number) {
  if (num === 0) return String.fromCharCode(0x24EA);
  return (num >= 1 && num <= 20) ? String.fromCharCode(0x2460 + num - 1) : `(${num})`;
}

const fromHexColour = (hex) : [number, number, number] => {
  const match = /^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`invalid colour in ${JSON.stringify(hex)}`);
  return [match[1], match[2], match[3]].map(x => parseInt(x, 16)) as [number, number, number];
}

export function get(object: any, path: string) {
  const parts = path.split(".");
  let cursor = object;
  parts.forEach(part => {
    if (cursor === undefined) throw new Error(`At ${JSON.stringify(part)}: Can't descend path ${JSON.stringify(path)} in ${JSON.stringify(object)}`);
    cursor = cursor[part];
  });
  return cursor;
}

export const ANSI = {
  reset: "\x1b[0m",
  fg: (r, g, b) => `\x1b[38;2;${r};${g};${b}m`,
  bg: (r, g, b) => `\x1b[48;2;${r};${g};${b}m`,
  wrap(text: string, hexFG, hexBG: string | undefined) {
    if (hexFG) text = ANSI.fg(...fromHexColour(hexFG)) + text;
    if (hexBG) text = ANSI.bg(...fromHexColour(hexBG)) + text;
    return text + ANSI.reset;
  },
};
