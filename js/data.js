/**
 * data.js — Data loading, indexing, and querying helpers
 *
 * When you're ready to use your real data, replace wise_data.json
 * with your exported CSV/JSON and adjust the field names below
 * to match your actual column names.
 */

const DataStore = (() => {
  // ── Internal state ───────────────────────────────────
  let _rawRecords = [];      // full flat array from wise_data.json
  let _index = new Map();    // Map< "iso3|year|indicator|demographic" → value >
  let _countries = [];       // sorted list of { iso3, country } objects
  let _years = [];
  let _indicators = [];
  let _demographics = [];

  // ── Field name mapping ────────────────────────────────
  // Adjust these if your real data uses different column names:
  const FIELDS = {
    iso3:        'iso3',
    country:     'country',
    year:        'year',
    indicator:   'indicator',
    demographic: 'demographic',
    value:       'value',
  };

  // ── Load ─────────────────────────────────────────────
  async function load(url = 'data/wise_data.json') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
    _rawRecords = await res.json();
    _buildIndex();
    return true;
  }

  function _buildIndex() {
    const countryMap = new Map();
    const yearSet = new Set();
    const indSet  = new Set();
    const demoSet = new Set();

    for (const r of _rawRecords) {
      const key = `${r[FIELDS.iso3]}|${r[FIELDS.year]}|${r[FIELDS.indicator]}|${r[FIELDS.demographic]}`;
      _index.set(key, r[FIELDS.value]);

      if (!countryMap.has(r[FIELDS.iso3])) {
        countryMap.set(r[FIELDS.iso3], r[FIELDS.country]);
      }
      yearSet.add(r[FIELDS.year]);
      indSet.add(r[FIELDS.indicator]);
      demoSet.add(r[FIELDS.demographic]);
    }

    _countries = [...countryMap.entries()]
      .map(([iso3, country]) => ({ iso3, country }))
      .sort((a, b) => a.country.localeCompare(b.country));

    _years        = [...yearSet].sort((a, b) => b - a);
    _indicators   = [...indSet];
    _demographics = [...demoSet];
  }

  // ── Query helpers ─────────────────────────────────────

  /** Get a single value. Returns null if not found. */
  function getValue(iso3, year, indicator, demographic) {
    return _index.get(`${iso3}|${year}|${indicator}|${demographic}`) ?? null;
  }

  /**
   * Get a map of iso3 → value for all countries
   * for the given year / indicator / demographic combination.
   */
  function getMapSlice(year, indicator, demographic) {
    const result = new Map();
    for (const { iso3 } of _countries) {
      const v = getValue(iso3, year, indicator, demographic);
      if (v !== null) result.set(iso3, v);
    }
    return result;
  }

  /**
   * Get trend data for a country: array of { year, value } sorted by year.
   */
  function getTrend(iso3, indicator, demographic) {
    return _years
      .slice()
      .sort((a, b) => a - b)
      .map(y => ({ year: y, value: getValue(iso3, y, indicator, demographic) }))
      .filter(d => d.value !== null);
  }

  /**
   * Get all demographic values for a country/year/indicator.
   * Returns array of { demographic, value } sorted by value desc.
   */
  function getDemographicBreakdown(iso3, year, indicator) {
    return _demographics
      .map(d => ({ demographic: d, value: getValue(iso3, year, indicator, d) }))
      .filter(d => d.value !== null)
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Get all indicator values for a country/year/demographic.
   */
  function getIndicatorBreakdown(iso3, year, demographic) {
    return _indicators
      .map(i => ({ indicator: i, value: getValue(iso3, year, i, demographic) }))
      .filter(d => d.value !== null)
      .sort((a, b) => b.value - a.value);
  }

  /** Compute global min/max for the current map slice (for color scale). */
  function getValueRange(year, indicator, demographic) {
    const slice = getMapSlice(year, indicator, demographic);
    let min = Infinity, max = -Infinity;
    for (const v of slice.values()) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  /**
   * Export the current filtered slice as a CSV string.
   */
  function exportCSV(year, indicator, demographic) {
    const rows = [['ISO3', 'Country', 'Year', 'Indicator', 'Demographic', 'Value (%)']];
    for (const { iso3, country } of _countries) {
      const v = getValue(iso3, year, indicator, demographic);
      if (v !== null) rows.push([iso3, country, year, indicator, demographic, v]);
    }
    return rows.map(r => r.join(',')).join('\n');
  }

  /** Search countries by name. Returns max 8 matches. */
  function searchCountries(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return _countries.filter(c => c.country.toLowerCase().includes(q)).slice(0, 8);
  }

  return {
    load,
    getValue,
    getMapSlice,
    getTrend,
    getDemographicBreakdown,
    getIndicatorBreakdown,
    getValueRange,
    exportCSV,
    searchCountries,
    get countries() { return _countries; },
    get years()     { return _years; },
  };
})();
