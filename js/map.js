/**
 * map.js — Leaflet choropleth map logic
 */

const WISEMap = (() => {
  let _map = null;
  let _geojsonLayer = null;
  let _currentSlice = new Map();   // iso3 → value
  let _selectedIso3 = null;
  let _onCountryClick = null;      // callback(iso3, country)
  let _geojsonData = null;

  // Color scale thresholds (0–100 scale)
  const COLOR_STOPS = [
    [0,   '#f0f9ff'],
    [10,  '#bae6fd'],
    [20,  '#7dd3fc'],
    [35,  '#38bdf8'],
    [50,  '#0ea5e9'],
    [65,  '#0284c7'],
    [80,  '#0369a1'],
    [100, '#1e3a5f'],
  ];

  const NO_DATA_COLOR  = '#1e293b';
  const HOVER_WEIGHT   = 2;
  const DEFAULT_WEIGHT = 0.5;
  const SELECTED_COLOR = '#f0abfc'; // purple highlight for selected

  // ── Init ────────────────────────────────────────────────
  function init(containerId, onCountryClick) {
    _onCountryClick = onCountryClick;

    _map = L.map(containerId, {
      center: [20, 10],
      zoom: 2.4,
      minZoom: 1.5,
      maxZoom: 8,
      zoomControl: true,
      attributionControl: true,
    });

    // Dark tile layer (CartoDB Dark Matter)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(_map);

    return _map;
  }

  // ── Load GeoJSON ────────────────────────────────────────
  async function loadGeoJSON(url = 'data/countries.geojson') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);
    _geojsonData = await res.json();
    return _geojsonData;
  }

  // ── Color interpolation ─────────────────────────────────
  function getColor(value) {
    if (value === null || value === undefined) return NO_DATA_COLOR;

    // Find surrounding stops
    for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
      const [lo, loColor] = COLOR_STOPS[i];
      const [hi, hiColor] = COLOR_STOPS[i + 1];
      if (value <= hi) {
        const t = (value - lo) / (hi - lo);
        return lerpColor(loColor, hiColor, t);
      }
    }
    return COLOR_STOPS[COLOR_STOPS.length - 1][1];
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lerpColor(a, b, t) {
    const [ar, ag, ab] = hexToRgb(a);
    const [br, bg, bb] = hexToRgb(b);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ── Feature styling ─────────────────────────────────────
  function _style(feature) {
    const iso3 = feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
    const value = _currentSlice.get(iso3) ?? null;
    const isSelected = iso3 === _selectedIso3;

    return {
      fillColor: isSelected ? SELECTED_COLOR : getColor(value),
      fillOpacity: 0.82,
      color: isSelected ? '#e879f9' : '#1e3a5f',
      weight: isSelected ? 2 : DEFAULT_WEIGHT,
      opacity: 1,
    };
  }

  // ── Tooltip ─────────────────────────────────────────────
  const $tooltip = document.getElementById('map-tooltip');

  function _showTooltip(e, iso3, country, value, indicator, year, demo) {
    const labels = {
      overall: 'Overall Index', access: 'Access', quality: 'Quality', affordability: 'Affordability'
    };
    const demoLabels = {
      all: 'All households', urban: 'Urban', rural: 'Rural', women: 'Women', children: 'Children'
    };
    $tooltip.innerHTML = `
      <div class="tooltip-country">${country}</div>
      <div class="tooltip-value">${value !== null ? value.toFixed(1) + '%' : 'No data'}</div>
      <div class="tooltip-label">${labels[indicator] || indicator} · ${demoLabels[demo] || demo} · ${year}</div>
    `;
    $tooltip.style.display = 'block';
    _moveTooltip(e);
  }

  function _moveTooltip(e) {
    const rect = document.getElementById('map-container').getBoundingClientRect();
    let x = e.originalEvent.clientX - rect.left + 14;
    let y = e.originalEvent.clientY - rect.top + 14;
    // keep in bounds
    if (x + 180 > rect.width)  x -= 200;
    if (y + 80  > rect.height) y -= 90;
    $tooltip.style.left = x + 'px';
    $tooltip.style.top  = y + 'px';
  }

  function _hideTooltip() {
    $tooltip.style.display = 'none';
  }

  // ── Event handlers ──────────────────────────────────────
  let _currentFilters = { year: 2023, indicator: 'overall', demographic: 'all' };

  function _onEachFeature(feature, layer) {
    const iso3    = feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
    const country = feature.properties.ADMIN || feature.properties.name || iso3;

    layer.on({
      mouseover(e) {
        if (iso3 !== _selectedIso3) {
          layer.setStyle({ weight: HOVER_WEIGHT, fillOpacity: 0.95 });
        }
        const value = _currentSlice.get(iso3) ?? null;
        _showTooltip(e, iso3, country, value,
          _currentFilters.indicator, _currentFilters.year, _currentFilters.demographic);
      },
      mousemove(e) {
        _moveTooltip(e);
      },
      mouseout() {
        if (iso3 !== _selectedIso3) {
          _geojsonLayer.resetStyle(layer);
        }
        _hideTooltip();
      },
      click() {
        _selectedIso3 = iso3;
        _geojsonLayer.setStyle(_style);   // refresh all styles
        if (_onCountryClick) _onCountryClick(iso3, country);
      },
    });
  }

  // ── Render layer ────────────────────────────────────────
  function renderLayer(geojsonData, slice, filters) {
    _currentSlice = slice;
    _currentFilters = { ...filters };

    if (_geojsonLayer) {
      _geojsonLayer.remove();
    }

    _geojsonLayer = L.geoJSON(geojsonData, {
      style: _style,
      onEachFeature: _onEachFeature,
    }).addTo(_map);
  }

  // ── Update colors only (no full re-render) ──────────────
  function updateColors(slice, filters) {
    _currentSlice = slice;
    _currentFilters = { ...filters };
    if (_geojsonLayer) {
      _geojsonLayer.setStyle(_style);
    }
  }

  // ── Fly to country ──────────────────────────────────────
  function flyToCountry(iso3, country) {
    if (!_geojsonLayer) return;
    _geojsonLayer.eachLayer(layer => {
      const fIso3 = layer.feature?.properties?.ISO_A3 || layer.feature?.properties?.iso_a3 || '';
      if (fIso3 === iso3) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          _map.flyToBounds(bounds, { padding: [80, 80], duration: 1.2, maxZoom: 6 });
        }
        _selectedIso3 = iso3;
        _geojsonLayer.setStyle(_style);
        if (_onCountryClick) _onCountryClick(iso3, country);
      }
    });
  }

  // ── Deselect ────────────────────────────────────────────
  function deselect() {
    _selectedIso3 = null;
    if (_geojsonLayer) _geojsonLayer.setStyle(_style);
  }

  return {
    init,
    loadGeoJSON,
    renderLayer,
    updateColors,
    flyToCountry,
    deselect,
    getColor,
    get geojsonData() { return _geojsonData; },
    get map()         { return _map; },
  };
})();
