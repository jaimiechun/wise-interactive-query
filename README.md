# WISE Interactive Query Map

An interactive global choropleth map for exploring water insecurity indicators by country, year, and demographic group.

**Live demo:** [GitHub Pages link once deployed]

---

## Features

- 🗺 **Global choropleth map** — color-coded by water insecurity level
- 🔍 **Country search** — type to find and fly to any country
- 🎛 **Filters** — by indicator, year, and demographic group
- 📊 **Country sidebar** — click any country to see detailed stats, demographic breakdown, and a trend chart
- 📥 **Export CSV** — download the current filtered slice

---

## Running Locally

This app requires a simple HTTP server (not just `file://`) because it loads JSON via `fetch`.

```bash
# Option 1 — Python (no install needed)
cd wise-interactive-query
python3 -m http.server 8080
# Open http://localhost:8080

# Option 2 — Node serve
npx serve .
```

---

## Project Structure

```
wise-interactive-query/
├── index.html              # App shell
├── css/style.css           # Design system + layout
├── js/
│   ├── app.js              # Main entry point
│   ├── data.js             # Data loading and querying
│   ├── map.js              # Leaflet choropleth map
│   ├── sidebar.js          # Country detail panel
│   └── filters.js          # Dropdowns + search
└── data/
    ├── countries.geojson   # World country boundaries
    └── wise_data.json      # Water insecurity dataset
```

---

## Swapping in Your Real Data

### 1. Export from R

```r
library(haven)
library(jsonlite)
library(dplyr)

df <- read_dta("your_file.dta") %>%
  rename(
    iso3        = your_iso3_column,
    country     = your_country_name_column,
    year        = your_year_column,
    indicator   = your_indicator_column,   # values: "access", "quality", "affordability", "overall"
    demographic = your_demographic_column, # values: "all", "urban", "rural", "women", "children"
    value       = your_value_column        # numeric 0–100
  ) %>%
  select(iso3, country, year, indicator, demographic, value)

write_json(df, "data/wise_data.json", pretty = FALSE)
```

### 2. Match field names (if your column names differ)

Open `js/data.js` and update the `FIELDS` object at the top:

```js
const FIELDS = {
  iso3:        'your_actual_iso3_col',
  country:     'your_actual_name_col',
  year:        'your_actual_year_col',
  indicator:   'your_actual_indicator_col',
  demographic: 'your_actual_demo_col',
  value:       'your_actual_value_col',
};
```

### 3. ISO3 codes

The GeoJSON uses standard ISO-3166 alpha-3 codes (e.g. `USA`, `KEN`, `BGD`). Make sure your data's `iso3` column uses the same codes.

---

## Deploying to GitHub Pages

```bash
# In your repo settings → Pages → Source: main branch / root
# Your site will be at: https://jaimiechun.github.io/wise-interactive-query/
```

> **Note:** GitHub Pages works fine with this app since it serves static files. No build step needed.

---

## Indicator & Demographic Values

| Filter | Valid values |
|---|---|
| indicator | `overall`, `access`, `quality`, `affordability` |
| demographic | `all`, `urban`, `rural`, `women`, `children` |
| year | any integer year present in your data |
