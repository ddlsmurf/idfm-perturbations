import type { ISODateTimeParameterString, ISODateTimeString } from "./types.ts";
import * as Utils from "../../utils.ts";

export const base = "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/";

export const pathFor = {
  /** List of the areas covered by navitia. See https://doc.navitia.io/#coverage. */
  coverage: () => "",
  /** Information about a specific region. See https://doc.navitia.io/#coverage. */
  coverageRegionId: (region_id: string) => Utils.templateURL("/{region_id}/", {region_id}),
  /** Information about a specific region, navitia guesses the region from coordinates. See https://doc.navitia.io/#coverage. */
  coverageLonLat: (lon, lat: string) => Utils.templateURL("/{lon_lat}/", {lon_lat: `${lon};${lat}`}),
};

/** See https://doc.navitia.io/#paging */
export interface PagingParameters {
  start_page: number; // The page number
  count: number; // Number of items per page
}

/** See https://doc.navitia.io/#shared-parameters */
export interface SharedParameters extends PagingParameters {
  /** This tiny parameter can expand Navitia power by making it more wordy. As it is valuable on every API,
   * take a look at https://doc.navitia.io/#depth .
   */
  depth?: number;
  /** It allows you to request navitia for specific pickup lines. It refers to the odt section. */
  odt_level?: string;
  /** If you specify coords in your filter, you can modify the radius used for the proximity search. */
  distance?: number;
  /** If given, add a filter on the vehicle journeys that has the given value as headsign (on vehicle journey itself or at a stop time). */
  headsign?: string;

  /** To be used only on "vehicle_journeys" and "disruptions" collection, to filter on a period. Both parameters "until" and "since" are optional. */
  since?: ISODateTimeString;
  until?: ISODateTimeString;

  /** By default geojson part of an object are returned in navitia's responses, this parameter allows you to remove them. */
  disable_geojson?: boolean;

  /** By default disruptions are also present in navitia's responses on apis "PtRef", "pt_objects" and "places_nearby". This parameter allows you to remove them. */
  disable_disruption?: boolean;

  /** A date time with the format YYYYMMDDThhmmss, considered local to the coverage being used. See https://doc.navitia.io/#datetime . */
  datetime: ISODateTimeParameterString;

  /** See https://doc.navitia.io/#filter */
  filter?: {
    collection_name, code_type, code_value: string;
  };
}

/** See https://doc.navitia.io/#filter and {@link SharedParameters.filter} */
const sharedParamsFilterToString = (filter: NonNullable<SharedParameters['filter']>) =>
  `${filter.collection_name}.has_code(${filter.code_type},${filter.code_value})`;
