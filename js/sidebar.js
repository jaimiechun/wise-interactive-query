/**
 * sidebar.js — Country detail panel with stats, demographic bars, and trend chart
 */

const WISESidebar = (() => {
  let _trendChart = null;

  // Label maps
  const INDICATOR_LABELS = {
    overall:       'Overall Index',
    access:        'Access',
    quality:       'Quality',
    affordability: 'Affordability',
  };

  const DEMO_LABELS = {
    all:      'All households',
    urban:    'Urban',
    rural:    'Rural',
    women:    'Women',
    children: 'Children',
  };

  // Bar colors per demographic
  const DEMO_COLORS = {
    all:      '#38bdf8',
    urban:    '#818cf8',
    rural:    '#34d399',
    women:    '#f472b6',
    children: '#fb923c',
  };

  // Bar colors per indicator
  const IND_COLORS = {
    overall:       '#38bdf8',
    access:        '#34d399',
    quality:       '#818cf8',
    affordability: '#fb923c',
  };

  // Country flag emoji helper (uses ISO-2 → emoji conversion)
  function flagEmoji(iso3) {
    const map = {
      AFG:'🇦🇫',ALB:'🇦🇱',DZA:'🇩🇿',AGO:'🇦🇴',ARG:'🇦🇷',ARM:'🇦🇲',AUS:'🇦🇺',AUT:'🇦🇹',
      AZE:'🇦🇿',BGD:'🇧🇩',BLR:'🇧🇾',BEL:'🇧🇪',BEN:'🇧🇯',BTN:'🇧🇹',BOL:'🇧🇴',BIH:'🇧🇦',
      BWA:'🇧🇼',BRA:'🇧🇷',BFA:'🇧🇫',BDI:'🇧🇮',KHM:'🇰🇭',CMR:'🇨🇲',CAN:'🇨🇦',CAF:'🇨🇫',
      TCD:'🇹🇩',CHL:'🇨🇱',CHN:'🇨🇳',COL:'🇨🇴',COD:'🇨🇩',COG:'🇨🇬',CRI:'🇨🇷',CIV:'🇨🇮',
      HRV:'🇭🇷',CUB:'🇨🇺',CZE:'🇨🇿',DNK:'🇩🇰',DOM:'🇩🇴',ECU:'🇪🇨',EGY:'🇪🇬',SLV:'🇸🇻',
      ETH:'🇪🇹',FIN:'🇫🇮',FRA:'🇫🇷',GAB:'🇬🇦',GMB:'🇬🇲',GEO:'🇬🇪',DEU:'🇩🇪',GHA:'🇬🇭',
      GRC:'🇬🇷',GTM:'🇬🇹',GIN:'🇬🇳',GNB:'🇬🇼',HTI:'🇭🇹',HND:'🇭🇳',HUN:'🇭🇺',IND:'🇮🇳',
      IDN:'🇮🇩',IRN:'🇮🇷',IRQ:'🇮🇶',IRL:'🇮🇪',ISR:'🇮🇱',ITA:'🇮🇹',JAM:'🇯🇲',JPN:'🇯🇵',
      JOR:'🇯🇴',KAZ:'🇰🇿',KEN:'🇰🇪',PRK:'🇰🇵',KOR:'🇰🇷',KWT:'🇰🇼',KGZ:'🇰🇬',LAO:'🇱🇦',
      LBN:'🇱🇧',LSO:'🇱🇸',LBR:'🇱🇷',LBY:'🇱🇾',MDG:'🇲🇬',MWI:'🇲🇼',MYS:'🇲🇾',MDV:'🇲🇻',
      MLI:'🇲🇱',MRT:'🇲🇷',MEX:'🇲🇽',MDA:'🇲🇩',MNG:'🇲🇳',MAR:'🇲🇦',MOZ:'🇲🇿',MMR:'🇲🇲',
      NAM:'🇳🇦',NPL:'🇳🇵',NLD:'🇳🇱',NZL:'🇳🇿',NIC:'🇳🇮',NER:'🇳🇪',NGA:'🇳🇬',NOR:'🇳🇴',
      OMN:'🇴🇲',PAK:'🇵🇰',PAN:'🇵🇦',PNG:'🇵🇬',PRY:'🇵🇾',PER:'🇵🇪',PHL:'🇵🇭',POL:'🇵🇱',
      PRT:'🇵🇹',ROU:'🇷🇴',RUS:'🇷🇺',RWA:'🇷🇼',SAU:'🇸🇦',SEN:'🇸🇳',SLE:'🇸🇱',SOM:'🇸🇴',
      ZAF:'🇿🇦',SSD:'🇸🇸',ESP:'🇪🇸',LKA:'🇱🇰',SDN:'🇸🇩',SWZ:'🇸🇿',SWE:'🇸🇪',CHE:'🇨🇭',
      SYR:'🇸🇾',TJK:'🇹🇯',TZA:'🇹🇿',THA:'🇹🇭',TGO:'🇹🇬',TUN:'🇹🇳',TUR:'🇹🇷',TKM:'🇹🇲',
      UGA:'🇺🇬',UKR:'🇺🇦',ARE:'🇦🇪',GBR:'🇬🇧',USA:'🇺🇸',URY:'🇺🇾',UZB:'🇺🇿',VEN:'🇻🇪',
      VNM:'🇻🇳',YEM:'🇾🇪',ZMB:'🇿🇲',ZWE:'🇿🇼',
    };
    return map[iso3] || '🌍';
  }

  // ── Open sidebar ─────────────────────────────────────────
  function open(iso3, countryName, filters) {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('sidebar--hidden');

    // Header
    document.getElementById('sidebar-flag').textContent    = flagEmoji(iso3);
    document.getElementById('sidebar-country').textContent = countryName;

    const { year, indicator, demographic } = filters;
    const demoLabel = DEMO_LABELS[demographic] || demographic;
    const indLabel  = INDICATOR_LABELS[indicator] || indicator;
    document.getElementById('sidebar-meta').textContent =
      `${indLabel} · ${demoLabel} · ${year}`;

    // Main metric
    const value = DataStore.getValue(iso3, year, indicator, demographic);
    document.getElementById('metric-label').textContent = indLabel;
    const $val = document.getElementById('metric-value');
    if (value !== null) {
      $val.innerHTML = `${value.toFixed(1)}<span>%</span>`;
      document.getElementById('metric-bar').style.width = value + '%';
      document.getElementById('metric-sub').textContent =
        `Water insecurity rate — ${year}`;
    } else {
      $val.innerHTML = 'N/A';
      document.getElementById('metric-bar').style.width = '0%';
      document.getElementById('metric-sub').textContent = 'No data available';
    }

    // Demographic breakdown bars
    _renderDemoBars(iso3, year, indicator);

    // Trend chart
    _renderTrendChart(iso3, indicator, demographic, year);

    // Indicator breakdown
    _renderIndicatorBars(iso3, year, demographic, year);
  }

  // ── Close sidebar ────────────────────────────────────────
  function close() {
    document.getElementById('sidebar').classList.add('sidebar--hidden');
  }

  // ── Demographic bars ──────────────────────────────────────
  function _renderDemoBars(iso3, year, indicator) {
    const breakdown = DataStore.getDemographicBreakdown(iso3, year, indicator);
    const max = breakdown.length ? Math.max(...breakdown.map(d => d.value)) : 100;
    const $container = document.getElementById('demo-bars');

    $container.innerHTML = breakdown.map(({ demographic, value }) => {
      const pct = (value / 100) * 100;
      const color = DEMO_COLORS[demographic] || '#38bdf8';
      return `
        <div class="demo-bar-row">
          <div class="demo-bar-label">${DEMO_LABELS[demographic] || demographic}</div>
          <div class="demo-bar-track">
            <div class="demo-bar-fill"
                 style="width:${pct}%; background:${color};"
                 title="${value.toFixed(1)}%"></div>
          </div>
          <div class="demo-bar-val">${value.toFixed(1)}%</div>
        </div>
      `;
    }).join('');
  }

  // ── Trend chart ──────────────────────────────────────────
  function _renderTrendChart(iso3, indicator, demographic, selectedYear) {
    const trend = DataStore.getTrend(iso3, indicator, demographic);
    const labels = trend.map(d => d.year);
    const values = trend.map(d => d.value);

    if (_trendChart) {
      _trendChart.destroy();
      _trendChart = null;
    }

    const ctx = document.getElementById('trend-chart').getContext('2d');

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0,   'rgba(56, 189, 248, 0.4)');
    gradient.addColorStop(1,   'rgba(56, 189, 248, 0.0)');

    _trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          fill: true,
          backgroundColor: gradient,
          borderColor: '#38bdf8',
          borderWidth: 2,
          pointBackgroundColor: labels.map(y => y === selectedYear ? '#f0abfc' : '#38bdf8'),
          pointRadius: labels.map(y => y === selectedYear ? 5 : 3),
          pointHoverRadius: 6,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13,26,46,0.95)',
            titleColor: '#94a3b8',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(56,189,248,0.3)',
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748b', font: { size: 10 } },
          },
          y: {
            min: 0,
            max: 100,
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: v => v + '%',
            },
          },
        },
      },
    });
  }

  // ── Indicator breakdown bars ──────────────────────────────
  function _renderIndicatorBars(iso3, year, demographic, displayYear) {
    document.getElementById('indicator-year').textContent = displayYear;
    const breakdown = DataStore.getIndicatorBreakdown(iso3, year, demographic);
    const $container = document.getElementById('indicator-bars');

    $container.innerHTML = breakdown.map(({ indicator, value }) => {
      const pct = value;
      const color = IND_COLORS[indicator] || '#38bdf8';
      return `
        <div class="demo-bar-row">
          <div class="demo-bar-label">${INDICATOR_LABELS[indicator] || indicator}</div>
          <div class="demo-bar-track">
            <div class="demo-bar-fill"
                 style="width:${pct}%; background:${color};"
                 title="${value.toFixed(1)}%"></div>
          </div>
          <div class="demo-bar-val">${value.toFixed(1)}%</div>
        </div>
      `;
    }).join('');
  }

  // ── Refresh on filter change (country still selected) ─────
  function refresh(iso3, countryName, filters) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('sidebar--hidden')) return;
    open(iso3, countryName, filters);
  }

  return { open, close, refresh };
})();
