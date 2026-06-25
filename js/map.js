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

  // Color scale (normalized 0–1 t value)
  const COLOR_STOPS = [
    [0,    '#f0f9ff'],
    [0.1,  '#bae6fd'],
    [0.2,  '#7dd3fc'],
    [0.35, '#38bdf8'],
    [0.5,  '#0ea5e9'],
    [0.65, '#0284c7'],
    [0.8,  '#0369a1'],
    [1.0,  '#1e3a5f'],
  ];

  let _colorMin = 0;
  let _colorMax = 100;

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

    const range = _colorMax - _colorMin;
    const t = range > 0 ? Math.max(0, Math.min(1, (value - _colorMin) / range)) : 0;

    for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
      const [lo, loColor] = COLOR_STOPS[i];
      const [hi, hiColor] = COLOR_STOPS[i + 1];
      if (t <= hi) {
        const frac = (hi - lo) > 0 ? (t - lo) / (hi - lo) : 0;
        return lerpColor(loColor, hiColor, frac);
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
    const iso3 = feature.properties['ISO3166-1-Alpha-3'] || feature.properties.ISO_A3 || feature.properties.iso_a3 || '';
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

  const _indicatorLabels = {
    iwise12:    'IWISE ≥12 (% Water Insecure)',
    any_WI:     'Any Water Insecurity (%)',
    iwisescore: 'Mean IWISE Score',
    INDEX_CR:   'Corruption Index',
    INDEX_LEC:  'Local Economic Confidence Index',
    INDEX_LE:   'Life Evaluation Index',
    INCOME_4:   'Per Capita Income (Intl $)',
  };
  const _pctIndicators = new Set(['iwise12', 'any_WI']);
  const _demoLabels = {
    all: 'All respondents', urban: 'Urban', rural: 'Rural', women: 'Women',
  };

  function _unitFor(indicator) {
    if (_pctIndicators.has(indicator)) return '%';
    if (indicator === 'iwisescore') return ' pts';
    if (indicator === 'INCOME_4') return ' $';
    return '';
  }

  function _showTooltip(e, iso3, country, value, indicator, year, demo) {
    const unit = _unitFor(indicator);
    $tooltip.innerHTML = `
      <div class="tooltip-country">${country}</div>
      <div class="tooltip-value">${value !== null ? value.toFixed(1) + unit : 'No data'}</div>
      <div class="tooltip-label">${_indicatorLabels[indicator] || indicator} · ${_demoLabels[demo] || demo} · ${year}</div>
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
  let _currentFilters = { year: 2025, indicator: 'iwise12', demographic: 'all' };

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
        _applyColors();
        if (_onCountryClick) _onCountryClick(iso3, country);
      },
    });
  }

  // ── Render layer ────────────────────────────────────────
  function renderLayer(geojsonData, slice, filters) {
    _currentSlice = slice;
    _currentFilters = { ...filters };
    const vals = [...slice.values()];
    _colorMin = vals.length ? Math.min(...vals) : 0;
    _colorMax = vals.length ? Math.max(...vals) : 100;

    if (_geojsonLayer) {
      _geojsonLayer.remove();
    }

    _geojsonLayer = L.geoJSON(geojsonData, {
      style: _style,
      onEachFeature: _onEachFeature,
    }).addTo(_map);

    // Apply colors after layer is built (works around Leaflet closure timing)
    _applyColors();
  }

  // ── Apply colors to all layers ──────────────────────────
  function _applyColors() {
    if (!_geojsonLayer) return;
    _geojsonLayer.eachLayer(layer => {
      const iso3 = layer.feature?.properties?.['ISO3166-1-Alpha-3'] || '';
      const isSelected = iso3 === _selectedIso3;
      const value = _currentSlice.get(iso3) ?? null;
      layer.setStyle({
        fillColor: isSelected ? SELECTED_COLOR : getColor(value),
        fillOpacity: 0.82,
        color: isSelected ? '#e879f9' : '#1e3a5f',
        weight: isSelected ? 2 : DEFAULT_WEIGHT,
        opacity: 1,
      });
    });
  }

  // ── Update colors only (no full re-render) ──────────────
  function updateColors(slice, filters) {
    _currentSlice = slice;
    _currentFilters = { ...filters };
    const vals = [...slice.values()];
    _colorMin = vals.length ? Math.min(...vals) : 0;
    _colorMax = vals.length ? Math.max(...vals) : 100;
    _applyColors();
  }

  // ── Fly to country ──────────────────────────────────────
  function flyToCountry(iso3, country) {
    if (!_geojsonLayer) return;
    _geojsonLayer.eachLayer(layer => {
      const fIso3 = layer.feature?.properties?.['ISO3166-1-Alpha-3'] || layer.feature?.properties?.ISO_A3 || layer.feature?.properties?.iso_a3 || '';
      if (fIso3 === iso3) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          _map.flyToBounds(bounds, { padding: [80, 80], duration: 1.2, maxZoom: 6 });
        }
        _selectedIso3 = iso3;
        _applyColors();
        if (_onCountryClick) _onCountryClick(iso3, country);
      }
    });
  }

  // ── Deselect ────────────────────────────────────────────
  function deselect() {
    _selectedIso3 = null;
    _applyColors();
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
