/**
 * filters.js — Dropdown and search filter logic
 */

const WISEFilters = (() => {
  let _onFilterChange = null;   // callback(filters)
  let _onSearch       = null;   // callback(iso3, country)
  let _searchDebounce = null;

  const INDICATOR_LABELS = {
    overall: 'Overall Water Insecurity (%)',
    access:  'Access Insecurity (%)',
    quality: 'Quality Insecurity (%)',
    affordability: 'Affordability Insecurity (%)',
  };

  // ── Init ───────────────────────────────────────────────
  function init(onFilterChange, onSearch) {
    _onFilterChange = onFilterChange;
    _onSearch       = onSearch;

    // Dropdowns
    document.getElementById('filter-indicator').addEventListener('change', _handleFilterChange);
    document.getElementById('filter-year').addEventListener('change', _handleFilterChange);
    document.getElementById('filter-demographic').addEventListener('change', _handleFilterChange);

    // Search
    const $input   = document.getElementById('country-search');
    const $results = document.getElementById('search-results');

    $input.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => _handleSearch($input.value), 180);
    });

    $input.addEventListener('keydown', e => {
      const items = $results.querySelectorAll('li');
      const active = $results.querySelector('li.active');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _moveActive(items, active, 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _moveActive(items, active, -1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cur = $results.querySelector('li.active');
        if (cur) cur.click();
      } else if (e.key === 'Escape') {
        _closeDropdown();
      }
    });

    // Close search on outside click
    document.addEventListener('click', e => {
      if (!document.getElementById('search-wrapper').contains(e.target)) {
        _closeDropdown();
      }
    });
  }

  // ── Get current filter values ──────────────────────────
  function getFilters() {
    return {
      indicator:   document.getElementById('filter-indicator').value,
      year:        parseInt(document.getElementById('filter-year').value, 10),
      demographic: document.getElementById('filter-demographic').value,
    };
  }

  // ── Filter change handler ──────────────────────────────
  function _handleFilterChange() {
    const filters = getFilters();

    // Update legend title
    document.getElementById('legend-title').textContent =
      INDICATOR_LABELS[filters.indicator] || filters.indicator;

    if (_onFilterChange) _onFilterChange(filters);
  }

  // ── Search ─────────────────────────────────────────────
  function _handleSearch(query) {
    const $results = document.getElementById('search-results');
    const matches  = DataStore.searchCountries(query);

    if (!matches.length || !query.trim()) {
      _closeDropdown();
      return;
    }

    $results.innerHTML = matches.map(({ iso3, country }) =>
      `<li role="option" data-iso3="${iso3}" data-country="${country}">${country}</li>`
    ).join('');

    $results.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        document.getElementById('country-search').value = li.dataset.country;
        _closeDropdown();
        if (_onSearch) _onSearch(li.dataset.iso3, li.dataset.country);
      });
    });

    $results.classList.add('open');
  }

  function _closeDropdown() {
    document.getElementById('search-results').classList.remove('open');
    document.getElementById('search-results').innerHTML = '';
  }

  function _moveActive(items, current, dir) {
    if (!items.length) return;
    let idx = [...items].indexOf(current);
    idx = (idx + dir + items.length) % items.length;
    items.forEach(i => i.classList.remove('active'));
    items[idx].classList.add('active');
    items[idx].scrollIntoView({ block: 'nearest' });
  }

  return { init, getFilters };
})();
