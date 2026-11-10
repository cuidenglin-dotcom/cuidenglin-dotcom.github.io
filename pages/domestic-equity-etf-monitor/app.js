'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const daily = document.body.dataset.mode === 'daily';
  const base = new URL(daily ? '../' : './', location.href);
  const state = { summaries: [], rows: [], columns: [], page: 1, sort: 'net_change_100m_yuan', direction: -1, range: 30, request: 0, root: null, date: null };
  const numeric = new Set(['share_balance_shares', 'share_change_100m', 'avg_price_yuan', 'net_change_100m_yuan']);
  const number = value => value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const amount = (value, digits = 4, signed = true) => { const n = number(value); return n === null ? '—' : (signed && n > 0 ? '+' : '') + n.toFixed(digits); };
  const text = (element, value) => { element.textContent = value; return element; };
  const node = (tag, value, className) => { const e = document.createElement(tag); if (value !== undefined) text(e, value); if (className) e.className = className; return e; };
  const color = (e, value) => { const n = number(value); e.classList.toggle('pos', n !== null && n > 0); e.classList.toggle('neg', n !== null && n < 0); };
  const totalLabel = s => s.complete_total ? '完整合计' : '有效样本小计';
  const statusLabel = r => r.status === 'ok' ? '有效' : r.status === 'new_listing_no_change_estimate' ? '上市首日不估算' : '数据缺失或异常';
  const valid = r => r.status === 'ok' && number(r.net_change_100m_yuan) !== null;
  async function fetchJSON(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }
  function showError(message) { text($('error'), message); $('error').hidden = false; }
  function summary() { return state.summaries.find(s => s.date === state.date); }
  function updateSummary() {
    const s = summary();
    text($('amount'), amount(s.estimated_net_100m_yuan, 6)); color($('amount'), s.estimated_net_100m_yuan);
    text($('total-label'), totalLabel(s));
    if (!daily) {
      for (const [id, key] of [['listed', 'listed_etf_count'], ['valid', 'valid_amount_count'], ['exception-count', 'exception_count']]) {
        const n = number(s[key]); text($(id), n === null ? '—' : n.toLocaleString('zh-CN') + ' 只');
      }
    }
    const n = number(s.exception_count);
    text($('notice'), s.complete_total ? `${s.date} · 数据完整，金额为所纳入 ETF 的完整合计。` : `${s.date} · 当日 ETF 总数：${s.listed_etf_count}；有效样本：${s.valid_amount_count}；异常样本：${s.exception_count}。有效样本估算净增减：${amount(s.estimated_net_100m_yuan, 6)} 亿元。金额为有效样本小计，不是全市场合计。`);
  }
  function renderRanks() {
    for (const [id, sign] of [['top', 1], ['bottom', -1]]) {
      const rows = state.rows.filter(r => valid(r) && number(r.net_change_100m_yuan) * sign > 0).sort((a, b) => sign * (number(b.net_change_100m_yuan) - number(a.net_change_100m_yuan))).slice(0, 10);
      const fragment = document.createDocumentFragment();
      rows.forEach((r, i) => { const tr = node('tr'); tr.append(node('td', String(i + 1).padStart(2, '0'))); const name = node('td', r.name); name.append(node('span', r.code, 'code')); const value = node('td', amount(r.net_change_100m_yuan)); color(value, r.net_change_100m_yuan); tr.append(name, value); fragment.append(tr); });
      if (!rows.length) { const tr = node('tr'); const td = node('td', '当日无符合条件的记录'); td.colSpan = 3; tr.append(td); fragment.append(tr); }
      $(id).replaceChildren(fragment);
    }
  }
  function renderDetails() {
    const q = $('search').value.trim().toLowerCase();
    const rows = state.rows.filter(r => (r.code + ' ' + r.name).toLowerCase().includes(q));
    rows.sort((a, b) => {
      if (numeric.has(state.sort)) { const x = number(a[state.sort]), y = number(b[state.sort]); if (x === null) return y === null ? 0 : 1; if (y === null) return -1; return (x - y) * state.direction; }
      return String(a[state.sort] || '').localeCompare(String(b[state.sort] || ''), 'zh-CN') * state.direction;
    });
    const pages = Math.max(1, Math.ceil(rows.length / 50)); state.page = Math.min(state.page, pages);
    text($('result-count'), `匹配 ${rows.length} / ${state.rows.length} 只`);
    text($('page-status'), `第 ${state.page} / ${pages} 页 · 每页 50 条`); $('prev').disabled = state.page === 1; $('next').disabled = state.page === pages;
    const fragment = document.createDocumentFragment();
    rows.slice((state.page - 1) * 50, state.page * 50).forEach(r => {
      const tr = node('tr'); tr.append(node('td', r.code), node('td', r.name));
      const balance = number(r.share_balance_shares);
      tr.append(node('td', amount(balance === null ? null : balance / 1e8, 4, false), 'num'), node('td', amount(r.share_change_100m), 'num'), node('td', amount(r.avg_price_yuan, 4, false), 'num'));
      const value = node('td', amount(r.net_change_100m_yuan), 'num'); color(value, r.net_change_100m_yuan); tr.append(value, node('td', statusLabel(r))); fragment.append(tr);
    });
    if (!rows.length) { const tr = node('tr'), td = node('td', '没有匹配的 ETF'); td.colSpan = 7; tr.append(td); fragment.append(tr); }
    $('detail').replaceChildren(fragment);
    document.querySelectorAll('[data-sort]').forEach(b => b.parentElement.setAttribute('aria-sort', b.dataset.sort === state.sort ? state.direction > 0 ? 'ascending' : 'descending' : 'none'));
  }
  function renderExceptions() {
    const fragment = document.createDocumentFragment();
    const rows = state.rows.filter(r => !valid(r));
    rows.forEach(r => { const e = node('div', undefined, 'exception'); e.append(node('div', `${r.code}　${r.name}`), node('span', statusLabel(r) + (r.listing_date ? ' · 上市日期 ' + r.listing_date : ''), 'small')); fragment.append(e); });
    if (!rows.length) fragment.append(node('p', '所选日期无异常记录。'));
    $('exceptions').replaceChildren(fragment);
  }
  function renderDaily() {
    const fragment = document.createDocumentFragment();
    (state.range === 'all' ? state.summaries : state.summaries.slice(0, 30)).forEach(s => { const tr = node('tr'); const value = node('td', amount(s.estimated_net_100m_yuan), 'num'); color(value, s.estimated_net_100m_yuan); tr.append(node('td', s.date), value, node('td', totalLabel(s))); fragment.append(tr); });
    $('daily-rows').replaceChildren(fragment);
  }
  function drawChart() {
    const canvas = $('chart'); if (!canvas || $('content').hidden) return;
    const ctx = canvas.getContext('2d'), box = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * ratio); canvas.height = Math.round(box.height * ratio); ctx.scale(ratio, ratio);
    const w = box.width, h = box.height, left = 48, right = 10, top = 16, bottom = 28;
    const rows = [...(state.range === 'all' ? state.summaries : state.summaries.slice(0, 30))].reverse();
    const vals = rows.map(r => number(r.estimated_net_100m_yuan)).filter(v => v !== null);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#aaaab2';
    if (!vals.length) { ctx.fillText('暂无可绘制的金额数据', 10, 30); return; }
    let min = Math.min(0, ...vals), max = Math.max(0, ...vals); if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * .08; max += pad; if (min < 0) min -= pad;
    const y = v => top + (max - v) / (max - min) * (h - top - bottom);
    for (let i = 0; i < 4; i++) { const v = min + (max - min) * i / 3, py = y(v); ctx.strokeStyle = '#28282c'; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(w - right, py); ctx.stroke(); ctx.fillStyle = '#aaaab2'; ctx.textAlign = 'right'; ctx.fillText(Math.round(v).toString(), left - 7, py + 4); }
    ctx.strokeStyle = '#55555c'; ctx.beginPath(); ctx.moveTo(left, y(0)); ctx.lineTo(w - right, y(0)); ctx.stroke();
    const step = (w - left - right) / rows.length;
    rows.forEach((r, i) => { const v = number(r.estimated_net_100m_yuan); if (v === null) return; ctx.fillStyle = v < 0 ? '#58d5a4' : '#ff7881'; ctx.fillRect(left + i * step + step * .18, Math.min(y(v), y(0)), Math.max(.6, step * .64), Math.max(1, Math.abs(y(v) - y(0)))); });
    const ticks = w < 500 ? 3 : 5; ctx.fillStyle = '#aaaab2';
    for (let i = 0; i < ticks; i++) { const index = Math.round(i / (ticks - 1) * (rows.length - 1)); ctx.textAlign = i === 0 ? 'left' : i === ticks - 1 ? 'right' : 'center'; ctx.fillText(rows[index].date.slice(5), left + (index + .5) * step, h - 6); }
    text($('chart-desc'), `${rows[0].date} — ${rows[rows.length - 1].date} · ${rows.length} 个交易日 · 缺失金额不绘制`);
    canvas.onpointermove = event => { const index = Math.min(rows.length - 1, Math.max(0, Math.floor((event.clientX - canvas.getBoundingClientRect().left - left) / step))); const s = rows[index]; text($('chart-desc'), `${s.date} · ${amount(s.estimated_net_100m_yuan)} 亿元 · ${totalLabel(s)}`); };
  }
  async function selectDate(date) {
    state.date = date; const request = ++state.request;
    $('error').hidden = true; $('content').hidden = true; $('loading').hidden = false;
    try {
      if (!daily) {
        const day = await fetchJSON(new URL('days/' + date + '.json', state.root));
        const required = ['date','code','name','share_balance_shares','share_change_100m','avg_price_yuan','net_change_100m_yuan','status','listing_date'];
        if (day.date !== date || !Array.isArray(day.columns) || !required.every(c => day.columns.includes(c)) || !Array.isArray(day.rows)) throw new Error('日期数据不一致');
        if (request !== state.request) return;
        state.columns = day.columns; state.rows = day.rows.map(row => Object.fromEntries(day.columns.map((key, i) => [key, row[i] ?? '']))); state.page = 1;
        renderRanks(); renderDetails(); renderExceptions();
      }
      if (request !== state.request) return;
      updateSummary(); $('content').hidden = false; if (daily) renderDaily(); drawChart();
    } catch (error) { if (request === state.request) showError('所选日期数据暂时无法读取，请重新选择日期或稍后刷新。'); }
    finally { if (request === state.request) $('loading').hidden = true; }
  }
  function downloadDay() {
    const escape = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
    const lines = [state.columns, ...state.rows.map(r => state.columns.map(c => r[c]))];
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = node('a'); a.href = url; a.download = 'etf-' + state.date + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function init() {
    try {
      const manifest = await fetchJSON(new URL('manifest.json', base), { cache: 'no-store' });
      if (manifest.version !== 1 || !/^[a-f0-9]{16}$/.test(manifest.release) || manifest.data_root !== 'data/' + manifest.release) throw new Error('发布版本无效');
      state.root = new URL(manifest.data_root + '/', base);
      const data = await fetchJSON(new URL('summary.json', state.root));
      if (data.version !== 1 || data.source_sha256 !== manifest.source_sha256 || data.latest_date !== manifest.latest_date || !Array.isArray(data.summaries) || !Array.isArray(data.dates)) throw new Error('数据版本不一致');
      state.summaries = [...data.summaries].sort((a,b) => b.date.localeCompare(a.date));
      if (!state.summaries.length || !state.summaries.every(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date)) || !data.dates.includes(manifest.latest_date)) throw new Error('日期数据无效');
      const options = state.summaries.map(s => { const o = node('option', s.date); o.value = s.date; return o; }); $('date').replaceChildren(...options); $('date').value = manifest.latest_date; $('date').disabled = false;
      $('date').addEventListener('change', () => selectDate($('date').value));
      const download = daily ? $('download-summary') : $('download-history'); download.href = new URL(daily ? 'daily_amounts.csv' : 'etf_history.csv', state.root).href;
      if (!daily) {
        $('search').addEventListener('input', () => { state.page = 1; renderDetails(); });
        document.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { state.direction = state.sort === b.dataset.sort ? -state.direction : numeric.has(b.dataset.sort) ? -1 : 1; state.sort = b.dataset.sort; state.page = 1; renderDetails(); }));
        $('prev').onclick = () => { state.page--; renderDetails(); }; $('next').onclick = () => { state.page++; renderDetails(); }; $('download-day').onclick = downloadDay;
      }
      document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { state.range = b.dataset.range === 'all' ? 'all' : 30; document.querySelectorAll('[data-range]').forEach(other => other.setAttribute('aria-pressed', String(other === b))); if (daily) renderDaily(); drawChart(); }));
      new ResizeObserver(drawChart).observe($('chart').parentElement);
      await selectDate(manifest.latest_date);
    } catch (error) { $('loading').hidden = true; $('content').hidden = true; showError('数据暂时无法读取，请稍后刷新。若页面刚刚更新，请等待数据发布完成。'); }
  }
  init();
})();
