import type { Cache } from "./client/cache.ts";
import * as Utils from "./utils.ts";
export { Utils as Util };
import logger from "./logger.ts";
import type { PagingParameters } from "./client/navitia/urls.ts";


/*
  IDFM PRIM API (Navitia)
  Base URL: https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/
  Auth: APIKey header (get key at https://connect.iledefrance-mobilites.fr/)
*/
const URL_ROOT = "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/";

/** Note parameters are given as singular, and expect the plural to be just an `s` appended.
 * Wont work with the PhysicalMode enum
 */
export function makeNavitiaLineReportsURL(path: [string, string][]) {
  const base = "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports";
  const parts = path.map(([ name, value ]) => `${name}s/${encodeURIComponent(`${name}:${value}`)}`);
  return Utils.joinURLPath(base, ...parts, "line_reports")
}


export class Client {
  private readonly cache: Cache | undefined;
  private _callCount = 0;
  private _cacheHitCount = 0;

  constructor(private readonly options: {
    cache?: Cache,
    authorization: string,
  }) {
    this.cache = this.options.cache;
  }

  get callCount(): number {
    return this._callCount;
  }

  get cacheHitCount(): number {
    return this._cacheHitCount;
  }

  async get(url: string, query: Partial<PagingParameters> = {}) {
    url = Utils.joinURLPath(URL_ROOT, url);
    const queryString = Object.entries(query).map(pair => pair.map(encodeURIComponent).join("=")).join("&")
    if (queryString.length)
      url = url + (url.indexOf("?") > -1 ? "&" : "?") + queryString;

    const log = logger.child({url});
    const cachedValue = await this.cache?.get(url);
    if (cachedValue != undefined) {
      if (cachedValue && typeof cachedValue === 'object' && (cachedValue as any)._cached_error) {
        throw new Error(`${url} Response status: ${(cachedValue as any).status} (cached)`);
      }
      this._cacheHitCount++;
      log.debug("Loaded from cache");
      return cachedValue;
    }
    log.info("Started download");
    this._callCount++;
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        APIKey: this.options.authorization,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        const error = { _cached_error: true, status: 404 };
        if (this.cache) await this.cache.set(url, error);
        throw new Error(`${url} Response status: 404`);
      }
      log.error({response: await response.text()}, `Got response status ${response.status}`);
      throw new Error(`${url} Response status: ${response.status}`);
    }
    const result = await response.json();
    if (this.cache) await this.cache.set(url, result);
    return result;
  }
}