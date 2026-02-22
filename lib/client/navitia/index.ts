
/*
  Visit https://doc.navitia.io/, select a bit of table in the devtools, and run:

  (function tableToInterface(table) {
    while (table.tagName != 'TABLE') table = table.parentElement;
    let header = table;
    while (header && header.tagName != 'H2') header = header.previousElementSibling;
    header = header ? header.getAttribute("id") : undefined;
    const headerComment = header ? ` See https://doc.navitia.io/#${header}` : "";
    const snakeToCamel = str => str.replace(/^_+/,'').replace( /([-_]\w)/g, g => g[ 1 ].toUpperCase() );
    const snakeToPascal = str => {
      const camelCase = snakeToCamel(str);
      return camelCase[0].toUpperCase() + camelCase.substr(1);
    }
    const rows = [...table.querySelectorAll("tbody tr")].map(row => [...row.querySelectorAll("td")].map(x => x.innerText));
    const k = { int: "number", integer: "number", "iso-date-time": "ISODateTimeString", "iso-date": "ISODateString" };
    function makeTypeOf(x) {
      let xNoArray = x.replace(/\s*array of\s+/i, '');
      const wasArray = xNoArray !== x;
      if (k[xNoArray]) xNoArray = k[xNoArray];
      if (wasArray) xNoArray += "[]";
      return xNoArray;
    }
    const mapURLs = ([url, doc]) => {
      const fields = [...url.matchAll(/\{([^}]+)\}/g)].map(x => x[1].trim());
      const def = `/** ${doc}.${headerComment} *${''}/\n${snakeToCamel(url.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+$/, ''))}: `;
      if (!fields.length) return def + "() => " + JSON.stringify(url) + ',';
      return `${def}(${fields.join(", ")}: string) => Utils.templateURL(${JSON.stringify(url)}, {${fields.join(", ")}}),`;
    };
    const mapFields = ([field, type, doc]) => `/** ${doc} *${''}/\n${field}: ${makeTypeOf(type)};`;
    let mapper = ["no row length ?", "invalid row length (1)", mapURLs, mapFields][rows[0].length];
    return (header ? `/**${headerComment} *${''}/\n` : "") + rows.map(mapper).join("\n");
    // return rows.map(mapper).join("\n");
  })($0);
*/

export * from './types.ts'
export * from './urls.ts'
