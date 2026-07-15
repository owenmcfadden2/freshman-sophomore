(function () {
  'use strict';
 
  var ALL_PLAYERS = [];
  var state = {
    cls: [],
    bin: [],
    pos: [],
    transfer: 'all',
    search: '',
    frMin: { mpg: null, pts: null, reb: null, ast: null, per: null, ws40: null },
    sortKey: 'perDelta',
    sortDir: 'desc',
    page: 1
  };
  var PAGE_SIZE = 25;
  var charts = {};
 
  function round(v, d) {
    if (v === null || v === undefined || isNaN(v)) return null;
    var f = Math.pow(10, d);
    return Math.round(v * f) / f;
  }
 
  function fmtDelta(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '&mdash;';
    var r = round(v, d);
    var sign = r > 0 ? '+' : '';
    return sign + r.toFixed(d);
  }
 
  function deltaClass(v) {
    if (v === null || v === undefined || isNaN(v)) return '';
    return v >= 0 ? 'delta-up' : 'delta-down';
  }
 
  function withDeltas(p) {
    var mpgDelta = (p.fr.mpg != null && p.so.mpg != null) ? p.so.mpg - p.fr.mpg : null;
    var ptsDelta = (p.fr.pts != null && p.so.pts != null) ? p.so.pts - p.fr.pts : null;
    var perDelta = (p.fr.per != null && p.so.per != null) ? p.so.per - p.fr.per : null;
    var ws40Delta = (p.fr.ws40 != null && p.so.ws40 != null) ? p.so.ws40 - p.fr.ws40 : null;
    p.mpgDelta = mpgDelta;
    p.ptsDelta = ptsDelta;
    p.perDelta = perDelta;
    p.ws40Delta = ws40Delta;
    return p;
  }
 
  function loadData() {
    fetch('players.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        ALL_PLAYERS = data.filter(function (p) { return !p.wentProNoSO; }).map(withDeltas);
        init();
      })
      .catch(function (err) {
        document.getElementById('tableBody').innerHTML =
          '<tr><td colspan="10">Could not load players.json &mdash; ' + err + '</td></tr>';
      });
  }
 
  function getFiltered() {
    var fm = state.frMin;
    return ALL_PLAYERS.filter(function (p) {
      if (state.cls.length && state.cls.indexOf(String(p.class)) === -1) return false;
      if (state.bin.length && state.bin.indexOf(p.bin) === -1) return false;
      if (state.pos.length && state.pos.indexOf(p.position) === -1) return false;
      if (state.transfer === 'yes' && !p.transferred) return false;
      if (state.transfer === 'no' && p.transferred) return false;
      if (state.search && p.name.toLowerCase().indexOf(state.search.toLowerCase()) === -1) return false;
      if (fm.mpg !== null && (p.fr.mpg === null || p.fr.mpg < fm.mpg)) return false;
      if (fm.pts !== null && (p.fr.pts === null || p.fr.pts < fm.pts)) return false;
      if (fm.reb !== null && (p.fr.reb === null || p.fr.reb < fm.reb)) return false;
      if (fm.ast !== null && (p.fr.ast === null || p.fr.ast < fm.ast)) return false;
      if (fm.per !== null && (p.fr.per === null || p.fr.per < fm.per)) return false;
      if (fm.ws40 !== null && (p.fr.ws40 === null || p.fr.ws40 < fm.ws40)) return false;
      return true;
    });
  }
 
  function mean(arr) {
    var vals = arr.filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }
 
  function renderStatCards(rows) {
    var n = rows.length;
    var avgMpg = mean(rows.map(function (r) { return r.mpgDelta; }));
    var avgPts = mean(rows.map(function (r) { return r.ptsDelta; }));
    var avgPer = mean(rows.map(function (r) { return r.perDelta; }));
    var goodRows = rows.filter(function (r) { return r.goodSO !== null; });
    var goodPct = goodRows.length ? 100 * goodRows.filter(function (r) { return r.goodSO; }).length / goodRows.length : null;
    var transferPct = n ? 100 * rows.filter(function (r) { return r.transferred; }).length / n : null;
 
    var cards = [
      { label: 'Players', value: n, cls: '' },
      { label: 'Avg MPG change', value: avgMpg === null ? '&mdash;' : fmtDelta(avgMpg, 1), cls: deltaClass(avgMpg) },
      { label: 'Avg PPG change', value: avgPts === null ? '&mdash;' : fmtDelta(avgPts, 1), cls: deltaClass(avgPts) },
      { label: 'Avg PER change', value: avgPer === null ? '&mdash;' : fmtDelta(avgPer, 1), cls: deltaClass(avgPer) },
      { label: 'Became good SO (PER 15+)', value: goodPct === null ? '&mdash;' : round(goodPct, 1) + '%', cls: '' },
      { label: 'Transfer rate', value: transferPct === null ? '&mdash;' : round(transferPct, 1) + '%', cls: '' }
    ];
 
    var html = cards.map(function (c) {
      return '<div class="stat-card"><p class="stat-label">' + c.label + '</p>' +
        '<p class="stat-value ' + c.cls + '">' + c.value + '</p></div>';
    }).join('');
    document.getElementById('statCards').innerHTML = html;
  }
 
  function makeGroupedBarChart(canvasId, frVal, soVal) {
    var ctx = document.getElementById(canvasId);
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Freshman', 'Sophomore'],
        datasets: [{
          data: [round(frVal, 3), round(soVal, 3)],
          backgroundColor: ['#8F98AE', '#C9A227'],
          borderRadius: 4,
          maxBarThickness: 70
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e1e0d9' }, ticks: { color: '#6B6A5F', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: '#1A1A17', font: { size: 12 } } }
        }
      }
    });
  }
 
  function renderCharts(rows) {
    makeGroupedBarChart('chartMPG', mean(rows.map(function (r) { return r.fr.mpg; })), mean(rows.map(function (r) { return r.so.mpg; })));
    makeGroupedBarChart('chartPTS', mean(rows.map(function (r) { return r.fr.pts; })), mean(rows.map(function (r) { return r.so.pts; })));
    makeGroupedBarChart('chartPER', mean(rows.map(function (r) { return r.fr.per; })), mean(rows.map(function (r) { return r.so.per; })));
    makeGroupedBarChart('chartWS40', mean(rows.map(function (r) { return r.fr.ws40; })), mean(rows.map(function (r) { return r.so.ws40; })));
  }
 
  function sortRows(rows) {
    var key = state.sortKey;
    var dir = state.sortDir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name; bv = b.name; return dir * av.localeCompare(bv); }
      if (key === 'class') { av = a.class; bv = b.class; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'position') { av = a.position || ''; bv = b.position || ''; return dir * av.localeCompare(bv); }
      else if (key === 'transferred') { av = a.transferred ? 1 : 0; bv = b.transferred ? 1 : 0; }
      else if (key === 'goodSO') { av = a.goodSO ? 1 : 0; bv = b.goodSO ? 1 : 0; }
      else { av = a[key]; bv = b[key]; }
      av = (av === null || av === undefined) ? -Infinity : av;
      bv = (bv === null || bv === undefined) ? -Infinity : bv;
      return dir * (av - bv);
    });
  }
 
  function renderTable(rows) {
    document.getElementById('tableCount').textContent = rows.length + ' player' + (rows.length === 1 ? '' : 's');
    var sorted = sortRows(rows);
    var totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageRows = sorted.slice(start, start + PAGE_SIZE);
 
    var body = document.getElementById('tableBody');
    var html = '';
    pageRows.forEach(function (p, i) {
      var rid = 'row_' + start + '_' + i;
      html += '<tr>' +
        '<td class="pos-name">' + p.name + '</td>' +
        '<td class="num">' + p.class + '</td>' +
        '<td class="num">' + p.rank + '</td>' +
        '<td>' + (p.position || '&mdash;') + '</td>' +
        '<td class="num ' + deltaClass(p.mpgDelta) + '">' + fmtDelta(p.mpgDelta, 1) + '</td>' +
        '<td class="num ' + deltaClass(p.ptsDelta) + '">' + fmtDelta(p.ptsDelta, 1) + '</td>' +
        '<td class="num ' + deltaClass(p.perDelta) + '">' + fmtDelta(p.perDelta, 1) + '</td>' +
        '<td>' + (p.transferred ? '<span class="tag tag-yes">Transferred</span>' : '<span class="tag tag-no">Stayed</span>') + '</td>' +
        '<td>' + (p.goodSO === true ? '<span class="tag tag-good">Yes</span>' : (p.goodSO === false ? '&mdash;' : '&mdash;')) + '</td>' +
        '<td><button class="expand-btn" data-target="' + rid + '">Detail</button></td>' +
        '</tr>' +
        '<tr class="expand-row" id="' + rid + '" style="display:none;"><td colspan="10">' +
        expandContent(p) +
        '</td></tr>';
    });
    body.innerHTML = html || '<tr><td colspan="10">No players match these filters.</td></tr>';
 
    body.querySelectorAll('.expand-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = document.getElementById(btn.getAttribute('data-target'));
        row.style.display = row.style.display === 'none' ? '' : 'none';
      });
    });
 
    renderPagination(totalPages);
  }
 
  function statLine(label, fr, so, dec) {
    return '<div><span class="k">' + label + '</span>' +
      (fr === null || fr === undefined ? '&mdash;' : fr.toFixed(dec)) + ' &rarr; ' +
      (so === null || so === undefined ? '&mdash;' : so.toFixed(dec)) + '</div>';
  }
 
  function expandContent(p) {
    return '<div class="expand-grid">' +
      '<div><span class="k">School (FR &rarr; SO)</span>' + (p.collegeFR || '&mdash;') + ' &rarr; ' + (p.collegeSO || '&mdash;') + '</div>' +
      statLine('Games', p.fr.games, p.so.games, 0) +
      statLine('2P%', p.fr.twoP, p.so.twoP, 1) +
      statLine('3P%', p.fr.threeP, p.so.threeP, 1) +
      statLine('AST/G', p.fr.ast, p.so.ast, 1) +
      statLine('REB/G', p.fr.reb, p.so.reb, 1) +
      statLine('STL/G', p.fr.stl, p.so.stl, 1) +
      statLine('BLK/G', p.fr.blk, p.so.blk, 1) +
      statLine('TOV/G', p.fr.tov, p.so.tov, 1) +
      statLine('WS/40', p.fr.ws40, p.so.ws40, 2) +
      statLine('OWS/40', p.fr.ows40, p.so.ows40, 2) +
      statLine('DWS/40', p.fr.dws40, p.so.dws40, 2) +
      statLine('WARP/40', p.fr.warp40, p.so.warp40, 2) +
      '<div><span class="k">Career transfers</span>' + (p.careerTTT === null ? '&mdash;' : p.careerTTT) + '</div>' +
      '</div>';
  }
 
  function renderPagination(totalPages) {
    var el = document.getElementById('pagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    var html = '';
    html += '<button ' + (state.page === 1 ? 'disabled' : '') + ' data-page="' + (state.page - 1) + '">&larr;</button>';
    var maxButtons = 7;
    var startP = Math.max(1, state.page - 3);
    var endP = Math.min(totalPages, startP + maxButtons - 1);
    startP = Math.max(1, endP - maxButtons + 1);
    for (var i = startP; i <= endP; i++) {
      html += '<button class="' + (i === state.page ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button ' + (state.page === totalPages ? 'disabled' : '') + ' data-page="' + (state.page + 1) + '">&rarr;</button>';
    el.innerHTML = html;
    el.querySelectorAll('button[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.page = parseInt(btn.getAttribute('data-page'), 10);
        renderAll();
      });
    });
  }
 
  function renderAll() {
    var rows = getFiltered();
    renderStatCards(rows);
    renderCharts(rows);
    renderTable(rows);
  }
 
  function setupChipGroup(id, key) {
    var group = document.getElementById(id);
    group.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        state[key] = chip.getAttribute('data-val');
        state.page = 1;
        renderAll();
      });
    });
  }
 
  function setupMultiChipGroup(id, key) {
    var group = document.getElementById(id);
    var allChip = group.querySelector('.chip[data-val="all"]');
    group.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var val = chip.getAttribute('data-val');
        if (val === 'all') {
          state[key] = [];
          group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
          allChip.classList.add('active');
        } else {
          allChip.classList.remove('active');
          var idx = state[key].indexOf(val);
          if (idx === -1) {
            state[key].push(val);
            chip.classList.add('active');
          } else {
            state[key].splice(idx, 1);
            chip.classList.remove('active');
          }
          if (state[key].length === 0) {
            allChip.classList.add('active');
          }
        }
        state.page = 1;
        renderAll();
      });
    });
  }
 
  function setupSort() {
    document.querySelectorAll('#playerTable thead th[data-key]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = 'desc';
        }
        renderAll();
      });
    });
  }
 
  function setupSearch() {
    var box = document.getElementById('searchBox');
    box.addEventListener('input', function () {
      state.search = box.value;
      state.page = 1;
      renderAll();
    });
  }
 
  var FR_MIN_INPUTS = [
    { id: 'minMPG', key: 'mpg' },
    { id: 'minPPG', key: 'pts' },
    { id: 'minRPG', key: 'reb' },
    { id: 'minAPG', key: 'ast' },
    { id: 'minPER', key: 'per' },
    { id: 'minWS40', key: 'ws40' }
  ];
 
  function setupFrMinFilters() {
    FR_MIN_INPUTS.forEach(function (f) {
      var input = document.getElementById(f.id);
      input.addEventListener('input', function () {
        var v = input.value.trim();
        state.frMin[f.key] = v === '' ? null : parseFloat(v);
        state.page = 1;
        renderAll();
      });
    });
  }
 
  function setupReset() {
    document.getElementById('resetFilters').addEventListener('click', function () {
      state = {
        cls: [], bin: [], pos: [], transfer: 'all', search: '',
        frMin: { mpg: null, pts: null, reb: null, ast: null, per: null, ws40: null },
        sortKey: 'perDelta', sortDir: 'desc', page: 1
      };
      document.getElementById('searchBox').value = '';
      FR_MIN_INPUTS.forEach(function (f) { document.getElementById(f.id).value = ''; });
      document.querySelectorAll('.chip-row').forEach(function (row) {
        row.querySelectorAll('.chip').forEach(function (c, i) { c.classList.toggle('active', i === 0); });
      });
      renderAll();
    });
  }
 
  function init() {
    setupMultiChipGroup('filterClass', 'cls');
    setupMultiChipGroup('filterBin', 'bin');
    setupMultiChipGroup('filterPos', 'pos');
    setupChipGroup('filterTransfer', 'transfer');
    setupSort();
    setupSearch();
    setupFrMinFilters();
    setupReset();
    renderAll();
  }
 
  loadData();
})();