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

const fromHexColour = (hex) : [number, number, number] => {
  const match = /^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`invalid colour in ${JSON.stringify(hex)}`);
  return [match[1], match[2], match[3]].map(x => parseInt(x, 16)) as [number, number, number];
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
