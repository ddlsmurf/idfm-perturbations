# IDFM Perturbations to iCal

This is the source that generates [prim2ics.org](https://prim2ics.org/).

Generate iCal calendar feeds for Île-de-France Mobilités (IDFM) transport disruptions.

Subscribe to disruption alerts for any line (Métro, RER, Bus, Tramway) or station in your calendar app.

## Disclaimer

- **Data source**: [IDFM PRIM API](https://prim.iledefrance-mobilites.fr/) (Navitia)
- **Reverse-engineered**: The TypeScript types and data model in this project were reverse-engineered from API responses and may not match official documentation
- **No warranty**: This project is provided as-is with no guarantee of accuracy, completeness, or availability
- **Not affiliated**: This project is not affiliated with IDFM, RATP, SNCF, Navitia, nor anyone else

## Requirements

- Node.js >= 22.18.0
- IDFM PRIM API key (free registration at https://prim.iledefrance-mobilites.fr/)

## Setup

```bash
npm install
```

Set your API key:
```bash
export IDFM_API_KEY="your-api-key-here"
```

## Usage

Generate all calendar feeds:
```bash
make mapping # Updates a local cache with stations-line mappings. Needs a lot of API calls
make generate # Requires the local cache. Updates disturbances.
make serve   # Serves dist/calendars on http://localhost:8000 to try the web interface
```

See [Actions](https://github.com/ddlsmurf/idfm-perturbations/actions) for example runs.

Output structure:
```
dist/calendars/
├── index.html          # Web interface
├── index.json          # Manifest with all lines/stations
├── lines/              # One .ics per line (2000+ files), id without the "line:IDFM:" prefix
│   ├── C01374.ics
│   └── ...
└── stations/           # One .ics per station (15000+ files), id without the "stop_area:IDFM:" prefix
    ├── 71043.ics
    ├── 71043_rail.ics  # Same, minus the disruptions of the station's bus lines
    └── ...
```

`_rail` means "every commercial mode except `Bus`" — there is no rail check, so tramway,
funicular and Orlyval/CDG VAL are all included. The variant is only written where it would
differ from the main feed, i.e. for stations served by buses *and* another mode: a station
with no bus line already has a bus-free `.ics`, and one served only by buses has nothing
left to offer. The web interface hides this behind the "exclude buses" checkbox in the legend
of the stations tab, which switches the subscription and preview links of every station row — falling
back to the plain `.ics` where it is already bus-free, and disabling both buttons for
bus-only stations.

Known limit: a station absent from `cache/line_station_mapping.db` has no known line, so no
variant is written for it, yet its feed can still pick up bus disruptions matched by stop
point instead of by line — the checkbox has no effect on those few stations.

## Deployment

The `dist/calendars/` folder can be deployed to any static hosting.

Deploying replaces the whole site, so generation refuses to leave a partial `dist/calendars`
behind: it prunes feeds earlier runs produced, then fails unless what is on disk is exactly
what it just wrote. Host-side limits, such as the number of files Cloudflare Pages accepts per
deployment, are left to the deploy step, which fails without publishing.

## Project Structure

```
├── .github/workflows/
│   ├── deploy.yml             # Generate + deploy to Cloudflare Pages
│   ├── mapping.yml            # Generate line↔station mapping DB
│   ├── mapping-vote.yml       # Community vote to trigger mapping update
│   └── cleanup.yml            # Clean up old Pages deployments
├── cache/
│   ├── line_station_mapping.db  # Pre-built line↔station mapping
│   └── [README.md](cache/README.md)  # Schema and query documentation
├── lib/
│   ├── client/
│   │   ├── cache.ts           # SQLite cache for API responses
│   │   └── navitia/
│   │       ├── types.ts       # TypeScript types (reverse-engineered)
│   │       └── urls.ts        # API URL helpers
│   ├── generators/
│   │   ├── line.ts            # Line feed generator
│   │   └── station.ts         # Station feed generator
│   ├── ical.ts                # iCal RFC 5545 formatting
│   ├── index.ts               # API client
│   └── shared.ts              # Shared constants (IDFM ID prefixes)
├── scripts/
│   ├── generate-all.ts        # Batch generation script
│   └── generate-line-station-mapping.ts  # Build line↔station mapping
├── templates/
│   └── index.html             # Web interface template
└── MCD.md                     # Data model documentation
```

## Data Model

See [MCD.md](MCD.md) for entity-relationship diagram and field documentation.

Key entities:
- **line** — transport line (Métro 6, RER A, Bus 72...)
- **route** — directed path on a line (towards terminus X)
- **stop_area** — station/stop zone (Châtelet, Gare de Lyon...)
- **stop_point** — specific platform within a stop_area
- **disruption** — service disruption with severity, dates, and affected objects

## API Notes

The IDFM PRIM API is a regional instance of the [Navitia](https://doc.navitia.io/) API.
[Manage quota](https://prim.iledefrance-mobilites.fr/en/apis/idfm-navitia-general-v2).
Some observations:

- Pagination maxes out at `count=1000` per request
- Date format is `YYYYMMDDTHHmmss` (no separators)
- Disruptions are denormalized and duplicated across responses
- The `line_reports` endpoint returns disruptions with full line/route context
- Response structure doesn't always match official Navitia documentation

## License

MIT
