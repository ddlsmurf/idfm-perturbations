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
```

See [Actions](https://github.com/ddlsmurf/idfm-perturbations/actions) for example runs.

Output structure:
```
dist/calendars/
├── index.html          # Web interface
├── index.json          # Manifest with all lines/stations
├── lines/              # One .ics per line (2000+ files)
│   ├── line_IDFM_C01374.ics
│   └── ...
└── stations/           # One .ics per station (15000+ files)
    ├── stop_area_IDFM_71043.ics
    └── ...
```

## Deployment

The `dist/calendars/` folder can be deployed to any static hosting.

## Project Structure

```
├── .github/workflows/
│   ├── deploy.yml             # Generate + deploy to Cloudflare Pages
│   ├── mapping.yml            # Generate line↔station mapping DB
│   └── cleanup.yml            # Clean up old Pages deployments
├── cache/
│   └── line_station_mapping.db  # Pre-built line↔station mapping
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
│   └── index.ts               # API client
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
