/**
 * app.js — Main entry point. Wires together data, map, sidebar, and filters.
 */

(async function init() {
  const $loading = document.getElementById('map-loading');

  // ── 1. Init map first (needs DOM to be ready) ──────────
  WISEMap.init('map', (iso3, country) => {
    const filters = WISEFilters.getFilters();
    WISESidebar.open(iso3, country, filters);
    _selectedCountry = { iso3, country };
  });

  // ── 2. Load data & GeoJSON in parallel ─────────────────
  try {
    await Promise.all([
      DataStore.load('data/wise_data.json'),
      WISEMap.loadGeoJSON('data/countries.geojson'),
    ]);
  } catch (err) {
    console.error('Failed to load data:', err);
    $loading.innerHTML = `
      <p style="color:#f87171">⚠ Could not load data files.</p>
      <p style="font-size:12px;color:#64748b;margin-top:8px">
        Make sure you're serving via a local server (e.g. <code>npx serve .</code>)
        and that data/wise_data.json and data/countries.geojson exist.
      </p>
    `;
    return;
  }

  // ── 3. Init filters ────────────────────────────────────
  WISEFilters.init(
    // On filter change → update map + refresh sidebar
    (filters) => {
      _updateMap(filters);
      if (_selectedCountry) {
        WISESidebar.refresh(_selectedCountry.iso3, _selectedCountry.country, filters);
      }
    },
    // On search → fly to country
    (iso3, country) => {
      WISEMap.flyToCountry(iso3, country);
      _selectedCountry = { iso3, country };
    }
  );

  // ── 4. First render ────────────────────────────────────
  const initialFilters = WISEFilters.getFilters();
  const initialSlice   = DataStore.getMapSlice(
    initialFilters.year,
    initialFilters.indicator,
    initialFilters.demographic
  );

  WISEMap.renderLayer(WISEMap.geojsonData, initialSlice, initialFilters);

  // Hide loading
  $loading.classList.add('hidden');
  setTimeout(() => { $loading.style.display = 'none'; }, 400);

  // ── 5. Sidebar close button ────────────────────────────
  document.getElementById('sidebar-close').addEventListener('click', () => {
    WISESidebar.close();
    WISEMap.deselect();
    _selectedCountry = null;
  });

  // ── 6. Export CSV ──────────────────────────────────────
  document.getElementById('btn-export').addEventListener('click', () => {
    const filters = WISEFilters.getFilters();
    const csv     = DataStore.exportCSV(filters.year, filters.indicator, filters.demographic);
    const blob    = new Blob([csv], { type: 'text/csv' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `wise_${filters.indicator}_${filters.year}_${filters.demographic}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Helpers ────────────────────────────────────────────
  let _selectedCountry = null;

  function _updateMap(filters) {
    const slice = DataStore.getMapSlice(filters.year, filters.indicator, filters.demographic);
    WISEMap.updateColors(slice, filters);
  }

})();
