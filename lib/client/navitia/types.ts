/*

  This is a very incomplete and approximate typing of the API.

  At time of this writing, it does not quite match the documentation, and whilst using
  EU funds with promises of open access, has decided to take another route:
  line_reports_response


*/


/** Format `YYYYMMDDThhmmss`. See https://doc.navitia.io/#datetime . */
export type ISODateTimeParameterString = string;
/** See https://doc.navitia.io/#iso-date-time */
export type ISODateTimeString = string | ISODateTimeParameterString;

/** See https://doc.navitia.io/#iso-date */
export type ISODateString = string;

/** See https://doc.navitia.io/#physical-mode */
export enum PhysicalMode {
  Air = 'physical_mode:Air',
  Boat = 'physical_mode:Boat',
  Bus = 'physical_mode:Bus',
  BusRapidTransit = 'physical_mode:BusRapidTransit',
  Coach = 'physical_mode:Coach',
  Ferry = 'physical_mode:Ferry',
  Funicular = 'physical_mode:Funicular',
  LocalTrain = 'physical_mode:LocalTrain',
  LongDistanceTrain = 'physical_mode:LongDistanceTrain',
  Metro = 'physical_mode:Metro',
  RailShuttle = 'physical_mode:RailShuttle',
  RapidTransit = 'physical_mode:RapidTransit',
  Shuttle = 'physical_mode:Shuttle',
  SuspendedCableCar = 'physical_mode:SuspendedCableCar',
  Taxi = 'physical_mode:Taxi',
  Train = 'physical_mode:Train',
  Tramway = 'physical_mode:Tramway',
}

/** See https://doc.navitia.io/#context */
export interface ResponseContext {
  timezone: string;
  current_datetime: ISODateTimeParameterString;
  // car_direct_path
}

interface CommonResponse {
  /** See https://doc.navitia.io/#paging */
  pagination: {
    items_per_page: number; // Number of items per page
    items_on_page: number; // Number of items on this page
    start_page: number; // The page number
    total_result: number; // Total number of items for this request
  },

  context: ResponseContext;

  /** See https://doc.navitia.io/#link */
  links: (PublicLink | InnerReferenceLink)[],

  // For the lines endpoint, have feed_publishers, disruptions, origins, terminus
}

/** See https://doc.navitia.io/#link */
interface Link {
  rel: string;
  templated: boolean;
}
/** See https://doc.navitia.io/#templated-url */
interface PublicLink extends Link {
  href: string;
}
/** See https://doc.navitia.io/#inner-references */
interface InnerReferenceLink extends Link {
  internal: true;
  id: string;
  // TODO: TODO: Doc weirdness. Check it. about disruptions
}

/** See https://doc.navitia.io/#pt-date-time */
interface PTDateTime {
  // additional_informations: String[] // Other information: TODO enum
  departure_date_time: ISODateTimeString
  arrival_date_time: ISODateTimeString
  links: InnerReferenceLink[] // internal links to notes
}

/** See https://doc.navitia.io/#period */
export interface Period {
  /** Beginning date and time of an activity period */
  begin: ISODateTimeString;
  /** Closing date and time of an activity period */
  end: ISODateTimeString;
}

interface WeekPattern {
  monday, tuesday, wednesday, thursday, friday, saturday, sunday: boolean
}

interface ApplicationPattern {
  /** Inclusive date range (dates only, format YYYYMMDD) during which the pattern may apply */
  application_period: Period;
  /** Flags for each weekday (monday..sunday) when the disruption applies within the application_period */
  week_pattern: WeekPattern;
  // /** Optional list of daily time ranges within selected days; each object has begin and end in HHMMSS */
  // TODO: Doc weirdness. Check it. whats about the objects ending that way and the field type
  // time_slots?: Period[];
}

enum DisruptionStatus { past = "past", active = "active", future = "future", }

enum DisruptionSeverityEffect {
  SIGNIFICANT_DELAYS = 'SIGNIFICANT_DELAYS',
  REDUCED_SERVICE = 'REDUCED_SERVICE',
  NO_SERVICE = 'NO_SERVICE',
  MODIFIED_SERVICE = 'MODIFIED_SERVICE',
  ADDITIONAL_SERVICE = 'ADDITIONAL_SERVICE',
  UNKNOWN_EFFECT = 'UNKNOWN_EFFECT',
  DETOUR = 'DETOUR',
  OTHER_EFFECT = 'OTHER_EFFECT',
}

interface DisruptionSeverity {
  /** HTML color for classification */
  color: string;
  /** given by the agency: 0 is strongest priority. it can be null */
  priority: number;
  /** name of severity */
  name: string;
  /** Normalized value of the effect on the public transport object. See the GTFS RT documentation at https://gtfs.org/reference/realtime/v2/#enum-effect. See also realtime section. */
  effect: DisruptionSeverityEffect;
}

/** See https://doc.navitia.io/#channel */
interface Channel {
  /** Identifier of the address */
  id: string;
  /** Like text/html, you know? Otherwise, take a look at https://www.w3.org/Protocols/rfc1341/4_Content-Type.html */
  content_type: string;
  /** name of the Channel */
  name: string;
}

/** See https://doc.navitia.io/#message */
interface Message {
  /** a message to bring to a traveler */
  text: string;
  /** destination media. Be careful, no normalized enum for now */
  // TODO: Doc weirdness. Check it. is channel or its id ?
  // channel: Channel;
}

/** See https://doc.navitia.io/#network */
interface PTNetwork {
  /** Identifier of the network */
  id: string;
  /** Name of the network */
  name: string;
}

/** See https://doc.navitia.io/#pt-object-embedded-type */
enum PTEmbedType {
  /** a public transport network */
  network = "network",
  /** a public transport branded mode */
  commercial_mode = "commercial_mode",
  /** a public transport line */
  line = "line",
  /** a public transport route */
  route = "route",
  /** a nameable zone, where there are some stop points */
  stop_area = "stop_area",
  /** a location where vehicles can pickup or drop off passengers */
  stop_point = "stop_point",
  /** a trip */
  trip = "trip",
}

/** See https://doc.navitia.io/#trip */
interface Trip {
  id, name: string;
}

/** See https://doc.navitia.io/#public-transport-objects */
interface PTObject {
  /** The id of the embedded object */
  id: string;
  /** The name of the embedded object */
  name: string;
  /** The quality of the object */
  quality: number;
  /** The type of the embedded object */
  embedded_type: PTEmbedType;
  /** Embedded Stop area */
  stop_area: StopArea;
  /** Embedded Stop point */
  stop_point: StopPoint;
  /** Embedded network */
  network: PTNetwork;
  // /** Embedded commercial_mode */
  commercial_mode: CommercialMode;
  // /** Embedded Stop area */
  // stop_area: StopArea; // Well it was there above anyway
  /** Embedded line */
  line: PTLine;
  /** Embedded route */
  route: PTRoute;
  /** Embedded trip */
  trip: Trip;
}

interface CommercialMode {
  id, name: string;
}

/** See https://doc.navitia.io/#line */
export interface PTLine {
  /** Identifier of the line */
  id: string;
  /** Name of the line */
  name: string;
  /** Code name of the line */
  code: string;
  /** Color of the line */
  color: string;
  text_color: string;
  /** Opening hour at format HHMMSS */
  opening_time: string;
  /** Closing hour at format HHMMSS */
  closing_time: string;
  /** Routes of the line */
  routes: PTRoute[];
  /** Commercial mode of the line */
  commercial_mode: CommercialMode;
  /** Physical modes of the line */
  physical_modes: PhysicalMode[];
}

/** See https://doc.navitia.io/#place */
interface Place {
  /** The id of the embedded object */
  id: string;
  /** The name of the embedded object */
  name: string;
  /** The quality of the place */
  quality: number;
  // /** The type of the embedded object */
  embedded_type: "administrative_region" | "stop_area" | "stop_point" | "address" | "poi";
  /** Embedded administrative region */
  administrative_region: AdministrativeRegion;
  /** Embedded Stop area */
  stop_area: StopArea;
  // /** Embedded poi */
  // // poi: poi; // TODO: don't care now
  // /** Embedded address */
  // // address: address; // TODO: don't care now
  /** Embedded Stop point */
  stop_point: StopPoint;
}

/** See https://doc.navitia.io/#route */
interface PTRoute {
  /** Identifier of the route */
  id: string;
  /** Name of the route */
  name: string;
  // /** If the route has frequency or not. Can only be "False", but may be "True" in the future */
  // is_frequence: "False" | "True"; // TODO: Doc weirdness. Check it.
  /** The line of this route */
  line: PTLine;
  /** The direction of this route */
  direction: Place;
}

/** See https://doc.navitia.io/#admin */
interface AdministrativeRegion {
  /** Identifier of the address */
  id: string;
  /** Name of the address */
  name: string;
  /** Label of the administrative region. The name is directly taken from the data whereas the label is something we compute for better traveler information. If you don't know what to display, display the label. */
  label: string;
  /** Coordinates of the address */
  // coord: string; // TODO: Doc weirdness. Check it.
  /** Level of the admin */
  level: number;
  /** Zip code of the admin */
  zip_code: string;
}

/** See https://doc.navitia.io/#stop-area */
export interface StopArea {
  /** Identifier of the stop area */
  id: string;
  /** Name of the stop area */
  name: string;
  /** Label of the stop area. The name is directly taken from the data whereas the label is something we compute for better traveler information. If you don't know what to display, display the label. */
  label: string;
  /** Coordinates of the stop area */
  coord?: { lat: string; lon: string };
  /** Administrative regions of the stop area in which is the stop area */
  administrative_regions: AdministrativeRegion[];
  /** Stop points contained in this stop area */
  stop_points: StopPoint[];
}

/** See https://doc.navitia.io/#stop-point */
export interface StopPoint {
  /** Identifier of the stop point */
  id: string;
  /** Name of the stop point */
  name: string;
  // /** Coordinates of the stop point */
  // coord: coord; // TODO: don't care now
  /** Administrative regions of the stop point in which is the stop point */
  administrative_regions: AdministrativeRegion[];
  /** list of equipment of the stop point */
  equipments: string[];
  /** Stop Area containing this stop point */
  stop_area: StopArea;
}

/** See https://doc.navitia.io/#impacted-stop */
enum ImpactStatus {
  added = "added",
  deleted = "deleted",
  delayed = "delayed",
  unchanged = "unchanged",
}

/** See https://doc.navitia.io/#impacted-stop */
interface ImpactedStop {
  /** The impacted stop point of the trip */
  stop_point: StopPoint;
  /** New departure hour (format HHMMSS) of the trip on this stop point */
  amended_departure_time: string;
  /** New arrival hour (format HHMMSS) of the trip on this stop point */
  amended_arrival_time: string;
  /** Base departure hour (format HHMMSS) of the trip on this stop point */
  base_departure_time: string;
  /** Base arrival hour (format HHMMSS) of the trip on this stop point */
  base_arrival_time: string;
  /** Cause of the modification */
  cause: string;
  /** Deprecated, consider the more accurate departure_status and arrival_status */
  stop_time_effect: ImpactStatus;
  arrival_status: ImpactStatus;
  departure_status: ImpactStatus;
}

/** See https://doc.navitia.io/#impacted-object */
interface ImpactedObject {
  /** The impacted public transport object */
  pt_object: PTObject;
  /** Only for line section impact, the impacted section */
  impacted_section: ImpactedSection;
  /** Only for trip delay, the list of delays, stop by stop */
  impacted_stops: ImpactedStop[];
}

/** See https://doc.navitia.io/#impacted-section */
interface ImpactedSection {
  /** The beginning of the section */
  from: PTObject;
  /** The end of the section. This can be the same as from when only one point is impacted */
  to: PTObject;
  /** The list of impacted routes by the impacted_section */
  routes: PTRoute[];
}

/** See https://doc.navitia.io/#real-time-and-disruption-objects */
export interface Disruption {
  /** Id of the disruption */
  id: string;
  /** state of the disruption. The state is computed using the application_periods of the disruption and the current time of the query. */
  status: DisruptionStatus;
  /** for traceability: Id of original input disruption */
  disruption_id: string;
  /** for traceability: Id of original input impact */
  impact_id: string;
  /** gives some categorization element */
  severity: DisruptionSeverity;
  /** dates where the current disruption is active */
  application_periods: Period[];
  /** Advanced activation patterns combining a date range, week days and optional time slots; complements application_periods */
  application_patterns: ApplicationPattern[];
  /** texts to provide to the traveler */
  messages: Message[];
  /** date_time of last modifications */
  updated_at: ISODateTimeString;
  /** The list of public transport objects which are affected by the disruption */
  impacted_objects: ImpactedObject[];
  /** why is there such a disruption? */
  cause: string;
  /** The category of the disruption, such as "construction works" or "incident" */
  category: string;
  /** The source from which Navitia received the disruption */
  contributor: string;
  /** deprecated */
  uri: string;
  /** deprecated */
  disruption_uri: string;
}