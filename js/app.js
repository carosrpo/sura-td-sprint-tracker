/* ═══════════════════════════════════════════════════════════
   SURA · Transformación Digital
   Seguimiento de Sprints — app.js
═══════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────
   SPRINT CALENDAR  (Q1 2026 fechas verificadas; Q2-Q4 estimadas)
   Sprints de 11 días hábiles en calendario Colombia
────────────────────────────────────────────────────────── */
const CALENDAR = {
  2026: {
    Q1: [
      { s:1, start:'2026-01-29', end:'2026-02-12' },
      { s:2, start:'2026-02-13', end:'2026-02-27' },
      { s:3, start:'2026-03-02', end:'2026-03-16' },
      { s:4, start:'2026-03-17', end:'2026-04-01' },
      { s:5, start:'2026-04-06', end:'2026-04-20' },
    ],
    Q2: [
      { s:1, start:'2026-04-21', end:'2026-05-07' },
      { s:2, start:'2026-05-08', end:'2026-05-23' },
      { s:3, start:'2026-05-26', end:'2026-06-09' },
      { s:4, start:'2026-06-10', end:'2026-06-24' },
      { s:5, start:'2026-06-25', end:'2026-07-09' },
    ],
    Q3: [
      { s:1, start:'2026-07-21', end:'2026-08-04' },
      { s:2, start:'2026-08-10', end:'2026-08-25' },
      { s:3, start:'2026-08-26', end:'2026-09-09' },
      { s:4, start:'2026-09-10', end:'2026-09-24' },
      { s:5, start:'2026-09-25', end:'2026-10-09' },
    ],
    Q4: [
      { s:1, start:'2026-10-13', end:'2026-10-27' },
      { s:2, start:'2026-10-28', end:'2026-11-11' },
      { s:3, start:'2026-11-17', end:'2026-12-01' },
      { s:4, start:'2026-12-02', end:'2026-12-16' },
      { s:5, start:'2026-12-17', end:'2026-12-31' },
    ],
  }
};

/* ──────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────── */
const state = {
  year: 2026,
  quarter: 'Q1',
  sprint: 5,
  filterPO: 'all',
  editingEntryId: null,
};

// Guard: evita que los event listeners se registren más de una vez
let _listenersReady = false;

/* ──────────────────────────────────────────────────────────
   DATABASE  — proporcionado por supabase-db.js
   db(), loadData(), sbInsert*, sbUpdate*, sbDelete* disponibles globalmente
────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}`;
}

function fmtFull(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d)} ${months[parseInt(m)-1]}, ${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sprintInfo(year, quarter, sprint) {
  const qs = CALENDAR[year]?.[quarter];
  if (!qs) return null;
  return qs.find(x => x.s === sprint) || null;
}

function detectCurrentSprint() {
  const t = today();
  for (const year of Object.keys(CALENDAR)) {
    for (const quarter of ['Q1','Q2','Q3','Q4']) {
      for (const sp of (CALENDAR[year][quarter] || [])) {
        if (t >= sp.start && t <= sp.end) {
          return { year: parseInt(year), quarter, sprint: sp.s };
        }
      }
    }
  }
  // Default to last defined
  return { year: 2026, quarter: 'Q1', sprint: 5 };
}

function sprintStatus(sp) {
  const t = today();
  if (!sp) return 'past';
  if (t < sp.start) return 'future';
  if (t > sp.end)   return 'past';
  return 'current';
}

function progressClass(pct) {
  if (pct <= 0)  return 'p0';
  if (pct < 50)  return 'p25';
  if (pct < 75)  return 'p50';
  if (pct < 100) return 'p75';
  return 'p100';
}

function progressColor(pct) {
  if (pct <= 0)  return '#DA1414';
  if (pct < 50)  return '#B95000';
  if (pct < 75)  return '#0B5FFF';
  if (pct < 100) return '#287D3C';
  return '#287D3C';
}

function statusLabel(s) {
  return { progreso:'En progreso', completado:'Completado', bloqueado:'Bloqueado' }[s] || s;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function tagsFromStr(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

/* ──────────────────────────────────────────────────────────
   TOAST
────────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${escHtml(msg)}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 3200);
}

/* ──────────────────────────────────────────────────────────
   CONFIRM DIALOG
────────────────────────────────────────────────────────── */
let confirmCallback = null;
function showConfirm(title, message, onOk) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onOk;
  showModal('modal-confirm');
}

/* ──────────────────────────────────────────────────────────
   MODAL HELPERS
────────────────────────────────────────────────────────── */
function showModal(id) {
  const el = document.getElementById(id);
  el.removeAttribute('hidden');
  el.style.display = 'flex';
}
function hideModal(id) {
  const el = document.getElementById(id);
  el.setAttribute('hidden', '');
  el.style.display = '';
}

/* ──────────────────────────────────────────────────────────
   RENDER: SPRINT NAVIGATOR
────────────────────────────────────────────────────────── */
function renderNavigator() {
  document.getElementById('year-display').textContent = state.year;

  // Quarter tabs
  document.querySelectorAll('.q-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.q === state.quarter);
  });

  // Sprint pills + Consolidado
  const sprintData = CALENDAR[state.year]?.[state.quarter] || [];
  const pillsEl = document.getElementById('sprint-pills');
  const isConsolidado = state.sprint === 'consolidado';

  pillsEl.innerHTML = sprintData.map(sp => {
    const st = sprintStatus(sp);
    const isCurrent = st === 'current';
    const isActive = sp.s === state.sprint;
    return `<button class="sprint-pill${isActive?' active':''}${isCurrent?' is-current':''}" data-s="${sp.s}">Sprint ${sp.s}</button>`;
  }).join('') +
  `<button class="sprint-pill consolidado-pill${isConsolidado?' active':''}" data-s="consolidado">Consolidado</button>`;

  pillsEl.querySelectorAll('.sprint-pill:not(.consolidado-pill)').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sprint = parseInt(btn.dataset.s);
      renderAll();
    });
  });
  pillsEl.querySelector('.consolidado-pill').addEventListener('click', () => {
    state.sprint = 'consolidado';
    renderAll();
  });

  // Date badge
  const badge = document.getElementById('sprint-date-badge');
  if (isConsolidado) {
    const quarterNames = { Q1:'Primer trimestre', Q2:'Segundo trimestre', Q3:'Tercer trimestre', Q4:'Cuarto trimestre' };
    badge.innerHTML = `
      <div class="sprint-date-info">
        <span class="date-range">${quarterNames[state.quarter]} · ${state.year}</span>
        <span class="sprint-status consolidado-badge">Consolidado</span>
      </div>`;
  } else {
    const sp = sprintInfo(state.year, state.quarter, state.sprint);
    if (sp) {
      const st = sprintStatus(sp);
      const labelMap = { current:'En curso', past:'Finalizado', future:'Próximo' };
      badge.innerHTML = `
        <div class="sprint-date-info">
          <span class="date-range">${fmt(sp.start)} — ${fmt(sp.end)}, ${state.year}</span>
          <span class="sprint-status ${st}">S${state.sprint}-${state.quarter}, ${labelMap[st]}</span>
        </div>`;
    } else {
      badge.innerHTML = '';
    }
  }
}

/* ──────────────────────────────────────────────────────────
   RENDER: PO FILTER BAR
────────────────────────────────────────────────────────── */
function renderPOFilter() {
  const { pos } = db();
  const pillsEl = document.getElementById('po-pills');

  const entries = getFilteredEntries('all');
  const activePOIds = new Set(entries.map(e => e.poId));

  let html = `<button class="po-pill${state.filterPO==='all'?' active':''}" data-po="all">Todos</button>`;
  pos.filter(po => activePOIds.has(po.id)).forEach(po => {
    html += `<button class="po-pill${state.filterPO===po.id?' active':''}" data-po="${po.id}">${escHtml(po.name)}</button>`;
  });
  pillsEl.innerHTML = html;

  pillsEl.querySelectorAll('.po-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filterPO = btn.dataset.po;
      renderPOFilter();
      renderDashboard();
    });
  });
}

/* ──────────────────────────────────────────────────────────
   RENDER: STATS BAR
────────────────────────────────────────────────────────── */
function renderStats(entries) {
  const el = document.getElementById('stats-bar');
  if (!entries.length) { el.innerHTML = ''; return; }

  const avg = Math.round(entries.reduce((s, e) => s + (e.porcentaje || 0), 0) / entries.length);
  const completados = entries.filter(e => e.porcentaje === 100).length;
  const bloqueados  = entries.filter(e => e.estado === 'bloqueado').length;

  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${entries.length}</div>
      <div class="stat-label">Proyectos</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#0033A0">${avg}%</div>
      <div class="stat-label">Avance promedio</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#067014">${completados}</div>
      <div class="stat-label">Completados</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:#D12D35">${bloqueados}</div>
      <div class="stat-label">Bloqueados</div>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   RENDER: DASHBOARD CARDS
────────────────────────────────────────────────────────── */
function getFilteredEntries(filterPO) {
  const { entries, projects, pos } = db();
  return entries.filter(e => {
    const isRightSprint = e.year === state.year && e.quarter === state.quarter && e.sprint === state.sprint;
    const passFilter = (filterPO === 'all') || e.poId === filterPO;
    return isRightSprint && passFilter;
  }).map(e => {
    const project = projects.find(p => p.id === e.projectId) || {};
    const po      = pos.find(p => p.id === e.poId) || {};
    return { ...e, projectName: project.name || '—', poName: po.name || '—' };
  });
}

/* ──────────────────────────────────────────────────────────
   RENDER: CONSOLIDADO TRIMESTRAL
────────────────────────────────────────────────────────── */
function renderConsolidado() {
  const { entries, projects, pos } = db();
  const grid  = document.getElementById('cards-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('entry-count');

  // Todas las entradas del trimestre (con filtro de PO si aplica)
  const qEntries = entries.filter(e =>
    e.year === state.year && e.quarter === state.quarter &&
    (state.filterPO === 'all' || e.poId === state.filterPO)
  );

  const projectIds = [...new Set(qEntries.map(e => e.projectId))];

  if (!projectIds.length) {
    grid.innerHTML = '';
    renderStats([]);
    count.textContent = '';
    empty.removeAttribute('hidden');
    return;
  }
  empty.setAttribute('hidden', '');

  // Para cada proyecto: entrada más reciente (mayor sprint) = estado actual
  const latestByProject = projectIds.map(pid => {
    const pEntries = qEntries.filter(e => e.projectId === pid).sort((a, b) => b.sprint - a.sprint);
    const allSprints = [...new Set(qEntries.filter(e => e.projectId === pid).map(e => e.sprint))].sort((a, b) => a - b);
    const project = projects.find(p => p.id === pid) || {};
    const po      = pos.find(p => p.id === pEntries[0].poId) || {};
    return { ...pEntries[0], projectName: project.name || '—', poName: po.name || '—', allSprints };
  });

  // Stats generales con la última entrada de cada proyecto
  renderStats(latestByProject);
  count.textContent = `${projectIds.length} proyecto${projectIds.length !== 1 ? 's' : ''} en ${state.quarter}`;

  // Agrupar por PO
  const poIds = [...new Set(latestByProject.map(e => e.poId))];
  const byPO = poIds.map(poId => {
    const po = pos.find(p => p.id === poId) || { name: '—' };
    const poProjects = latestByProject.filter(e => e.poId === poId);
    const poAvg = Math.round(poProjects.reduce((s, e) => s + (e.porcentaje || 0), 0) / poProjects.length);
    return { po, projects: poProjects, avg: poAvg };
  });

  const statusLabels = { completado:'Completado', bloqueado:'Bloqueado', progreso:'En progreso' };

  grid.innerHTML = `<div class="consolidado-view">
    ${byPO.map(({ po, projects: pList, avg }) => `
      <div class="conso-po-section">
        <div class="conso-po-header">
          <div class="conso-po-info">
            <span class="conso-po-avatar">${escHtml(po.name.charAt(0).toUpperCase())}</span>
            <span class="conso-po-name">${escHtml(po.name)}</span>
          </div>
          <div class="conso-po-meta">
            <span class="conso-po-badge">${pList.length} proyecto${pList.length !== 1 ? 's' : ''}</span>
            <span class="conso-po-avg">${avg}% avance prom.</span>
          </div>
        </div>
        <div class="conso-projects-list">
          ${pList.map(e => {
            const pct   = e.porcentaje || 0;
            const color = progressColor(pct);
            const spLabel = e.allSprints.length === 1
              ? `Sprint ${e.allSprints[0]}`
              : `Sprints ${e.allSprints[0]}–${e.allSprints[e.allSprints.length - 1]}`;
            return `
            <div class="conso-proj-row">
              <div class="conso-proj-main">
                <span class="conso-proj-name">${escHtml(e.projectName)}</span>
                <span class="conso-proj-sprints">${spLabel}</span>
              </div>
              <div class="conso-proj-progress">
                <div class="conso-prog-track">
                  <div class="conso-prog-fill" style="width:${pct}%;background:${color}"></div>
                </div>
                <span class="conso-pct">${pct}%</span>
              </div>
              <span class="conso-status ${e.estado || 'progreso'}">${statusLabels[e.estado] || 'En progreso'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function renderDashboard() {
  if (state.sprint === 'consolidado') { renderConsolidado(); return; }
  const entries = getFilteredEntries(state.filterPO);
  const grid = document.getElementById('cards-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('entry-count');

  renderStats(entries);

  count.textContent = entries.length
    ? `${entries.length} proyecto${entries.length !== 1 ? 's' : ''}`
    : '';

  if (!entries.length) {
    grid.innerHTML = '';
    empty.removeAttribute('hidden');
    return;
  }
  empty.setAttribute('hidden', '');

  grid.innerHTML = entries.map(e => renderCard(e)).join('');

  grid.querySelectorAll('.card-btn[data-action="detail"]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openDetail(btn.dataset.id);
    });
  });
  grid.querySelectorAll('.card-btn[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openForm(btn.dataset.id);
    });
  });
  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function renderCard(e) {
  const pct   = e.porcentaje || 0;
  const cls   = progressClass(pct);
  const tags  = tagsFromStr(e.responsables);
  const hasImp = e.impedimentos && e.impedimentos.trim();

  const tagsHtml = tags.length
    ? `<div class="tag-list">${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>`
    : `<span class="cf-value empty">Sin registrar</span>`;

  return `
  <article class="project-card" data-id="${e.id}" style="cursor:pointer">
    <div class="card-accent ${e.estado || 'progreso'}"></div>
    <div class="card-header">
      <span class="card-po">${escHtml(e.poName)}</span>
      <span class="card-status-chip ${e.estado || 'progreso'}">${statusLabel(e.estado)}</span>
    </div>
    <div class="card-body">
      <div class="card-project-name">${escHtml(e.projectName)}</div>
      <div class="card-progress">
        <div class="prog-header">
          <span class="prog-label">Avance del proyecto</span>
          <span class="prog-pct">${pct}%</span>
        </div>
        <div class="prog-track">
          <div class="prog-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="card-fields">
        <div class="card-field">
          <svg class="cf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div class="cf-content">
            <div class="cf-label">Objetivo del sprint</div>
            <div class="cf-value${!e.objetivo?' empty':''}">${e.objetivo ? escHtml(e.objetivo) : 'Sin registrar'}</div>
          </div>
        </div>
        <div class="card-field">
          <svg class="cf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <div class="cf-content">
            <div class="cf-label">Responsables</div>
            ${tagsHtml}
          </div>
        </div>
        <div class="card-field">
          <svg class="cf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <div class="cf-content">
            <div class="cf-label">Logros obtenidos</div>
            <div class="cf-value${!e.logros?' empty':''}">${e.logros ? escHtml(e.logros) : 'Sin registrar'}</div>
          </div>
        </div>
        ${hasImp ? `
        <div class="card-field">
          <svg class="cf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--warning)"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div class="cf-content">
            <div class="cf-label">Impedimentos</div>
            <div class="cf-value">${escHtml(e.impedimentos)}</div>
          </div>
        </div>` : ''}
      </div>
    </div>
    <div class="card-footer">
      <button class="card-btn" data-action="edit" data-id="${e.id}" onclick="event.stopPropagation()">Editar</button>
      <button class="card-btn primary" data-action="detail" data-id="${e.id}" onclick="event.stopPropagation()">Ver detalle</button>
    </div>
  </article>`;
}

/* ──────────────────────────────────────────────────────────
   DETAIL MODAL
────────────────────────────────────────────────────────── */
function openDetail(entryId) {
  const { entries, projects, pos } = db();
  const e = entries.find(x => x.id === entryId);
  if (!e) return;

  const project = projects.find(p => p.id === e.projectId) || {};
  const po      = pos.find(p => p.id === e.poId) || {};

  document.getElementById('detail-eyebrow').textContent   = `${state.quarter} · Sprint ${e.sprint} · ${state.year}`;
  document.getElementById('detail-title').textContent     = project.name || '—';
  document.getElementById('detail-subtitle').textContent  = `PO: ${po.name || '—'}`;

  const pct   = e.porcentaje || 0;
  const color = progressColor(pct);
  const tags  = tagsFromStr(e.responsables);

  // History across all sprints for this project
  const history = ['Q1','Q2','Q3','Q4'].flatMap(q =>
    [1,2,3,4,5].map(s => {
      const he = entries.find(x => x.projectId === e.projectId && x.year === state.year && x.quarter === q && x.sprint === s);
      return { q, s, pct: he ? (he.porcentaje || 0) : null };
    })
  ).filter(h => h.pct !== null);

  const historyHtml = history.length > 1 ? `
    <div class="detail-history">
      <div class="detail-history-title">Historial de avance — ${state.year}</div>
      <div class="history-bars">
        ${history.map(h => `
          <div class="h-bar">
            <div class="h-bar-val">${h.pct}%</div>
            <div class="h-bar-fill${(h.q===state.quarter&&h.s===state.sprint)?' active':''}" style="height:${Math.max(h.pct,3)}%;background:${progressColor(h.pct)}"></div>
            <div class="h-bar-lbl">${h.q}S${h.s}</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-progress-band">
      <div>
        <div class="detail-pct-big">${pct}%</div>
        <div class="detail-pct-label">Avance del proyecto</div>
        <div class="detail-status-row" style="margin-top:8px">
          <span class="detail-status-chip ${e.estado || 'progreso'}">${statusLabel(e.estado)}</span>
        </div>
      </div>
      <div class="detail-prog-wrap">
        <div style="font-size:12px;color:var(--sura-mid);font-weight:600;margin-bottom:4px;">Progreso acumulado</div>
        <div class="detail-prog-track">
          <div class="detail-prog-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-field full">
        <div class="detail-field-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Objetivo del sprint
        </div>
        <div class="detail-field-value${!e.objetivo?' empty':''}">${e.objetivo ? escHtml(e.objetivo) : 'No registrado'}</div>
      </div>

      <div class="detail-field">
        <div class="detail-field-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Responsables
        </div>
        ${tags.length
          ? `<div class="tag-list">${tags.map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>`
          : `<div class="detail-field-value empty">No registrado</div>`}
      </div>

      <div class="detail-field">
        <div class="detail-field-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
          Logros obtenidos
        </div>
        <div class="detail-field-value${!e.logros?' empty':''}">${e.logros ? escHtml(e.logros) : 'No registrado'}</div>
      </div>

      <div class="detail-field${e.impedimentos?' warn':''}">
        <div class="detail-field-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Impedimentos y novedades
        </div>
        <div class="detail-field-value${!e.impedimentos?' empty':''}">${e.impedimentos ? escHtml(e.impedimentos) : 'Sin impedimentos registrados'}</div>
      </div>

      <div class="detail-field full">
        <div class="detail-field-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Gestiones en curso
        </div>
        <div class="detail-field-value${!e.gestiones?' empty':''}">${e.gestiones ? escHtml(e.gestiones) : 'No aplica'}</div>
      </div>
    </div>

    ${historyHtml}`;

  // Wire footer buttons
  document.getElementById('btn-edit-from-detail').onclick = () => {
    hideModal('modal-detail');
    openForm(entryId);
  };
  document.getElementById('btn-delete-from-detail').onclick = () => {
    showConfirm(
      'Eliminar entrada',
      `¿Eliminar el registro de "${project.name || 'este proyecto'}" del Sprint ${e.sprint} ${state.quarter}? Esta acción no se puede deshacer.`,
      () => {
        deleteEntry(entryId);
        hideModal('modal-detail');
        hideModal('modal-confirm');
      }
    );
  };

  showModal('modal-detail');
}

/* ──────────────────────────────────────────────────────────
   FORM MODAL
────────────────────────────────────────────────────────── */
function openForm(entryId) {
  state.editingEntryId = entryId || null;
  const { entries, projects, pos } = db();

  // Title
  document.getElementById('form-modal-title').textContent =
    entryId ? 'Editar entrada de sprint' : 'Agregar avance';

  // Populate project dropdown
  const projSel = document.getElementById('f-project');
  projSel.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
    projects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  // Populate PO dropdown
  const poSel = document.getElementById('f-po');
  poSel.innerHTML = '<option value="">Selecciona un PO...</option>' +
    pos.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  // Sprint banner (solo en nueva entrada) vs selectores editables (al editar)
  const bannerEl    = document.getElementById('f-sprint-banner');
  const editGrpEl   = document.getElementById('f-sprint-edit-group');

  if (entryId) {
    // Modo edición: ocultar banner, mostrar selectores
    bannerEl.hidden  = true;
    editGrpEl.hidden = false;
  } else {
    // Modo creación: mostrar banner, ocultar selectores
    bannerEl.hidden  = false;
    editGrpEl.hidden = true;
    const sp = sprintInfo(state.year, state.quarter, state.sprint);
    bannerEl.innerHTML = sp
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
         <strong>${state.quarter} · Sprint ${state.sprint} · ${state.year}</strong>&nbsp;—&nbsp;${fmt(sp.start)} al ${fmtFull(sp.end)}`
      : '';
  }

  // Fill form if editing
  const form = document.getElementById('entry-form');
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));

  if (entryId) {
    const e = entries.find(x => x.id === entryId);
    if (e) {
      document.getElementById('f-entry-id').value   = e.id;
      projSel.value = e.projectId || '';
      poSel.value   = e.poId || '';
      // Pre-cargar selectores de sprint con los valores actuales de la entrada
      document.getElementById('f-edit-quarter').value = e.quarter || state.quarter;
      document.getElementById('f-edit-sprint').value  = String(e.sprint || state.sprint);
      document.getElementById('f-edit-year').value    = String(e.year   || state.year);
      document.querySelectorAll('[name="f-estado"]').forEach(r => {
        r.checked = r.value === (e.estado || 'progreso');
      });
      document.getElementById('f-objetivo').value      = e.objetivo    || '';
      document.getElementById('f-responsables').value  = e.responsables|| '';
      document.getElementById('f-logros').value        = e.logros      || '';
      document.getElementById('f-impedimentos').value  = e.impedimentos|| '';
      document.getElementById('f-gestiones').value     = e.gestiones   || '';
      setPct(e.porcentaje || 0);
    }
  } else {
    document.getElementById('f-entry-id').value  = '';
    projSel.value = '';
    poSel.value   = '';
    document.querySelectorAll('[name="f-estado"]').forEach((r,i) => r.checked = i===0);
    document.getElementById('f-objetivo').value     = '';
    document.getElementById('f-responsables').value = '';
    document.getElementById('f-logros').value       = '';
    document.getElementById('f-impedimentos').value = '';
    document.getElementById('f-gestiones').value    = '';
    setPct(0);
  }

  // Inicializar multi-select de responsables
  if (entryId) {
    const e = (db().entries || []).find(x => x.id === entryId);
    selectedResponsables = e ? tagsFromStr(e.responsables) : [];
  } else {
    selectedResponsables = [];
  }
  renderRespDropdown();
  syncRespField();

  showModal('modal-form');

  // Resetear scroll después de que el browser renderice el modal.
  // El browser hace auto-scroll al último elemento con foco; para
  // contrarrestarlo, movemos el foco al primer campo y forzamos scrollTop = 0.
  requestAnimationFrame(() => {
    const formBody = document.querySelector('#modal-form .modal-body');
    if (formBody) {
      formBody.scrollTop = 0;
      // Enfocar el primer campo visible para evitar que el browser haga scroll automático
      const firstField = formBody.querySelector('select, input, textarea');
      if (firstField) firstField.focus({ preventScroll: true });
    }
  });
}

function setPct(val) {
  const v = Math.min(100, Math.max(0, parseInt(val) || 0));
  document.getElementById('f-pct-range').value = v;
  document.getElementById('f-pct-num').value   = v;
  document.getElementById('f-pct-fill').style.width      = v + '%';
  document.getElementById('f-pct-fill').style.background = progressColor(v);
}


async function saveEntry() {
  const projectId = document.getElementById('f-project').value;
  const poId      = document.getElementById('f-po').value;
  const objetivo  = document.getElementById('f-objetivo').value.trim();
  const logros    = document.getElementById('f-logros').value.trim();

  // Validate
  let valid = true;
  const mark = (id) => { document.getElementById(id).classList.add('invalid'); valid = false; };
  if (!projectId) mark('f-project');
  if (!poId)      mark('f-po');
  if (!objetivo)  mark('f-objetivo');
  if (!logros)    mark('f-logros');
  if (!valid) { toast('Completa los campos obligatorios.', 'error'); return; }

  const estado       = document.querySelector('[name="f-estado"]:checked')?.value || 'progreso';
  const responsables = document.getElementById('f-responsables').value.trim();
  const impedimentos = document.getElementById('f-impedimentos').value.trim();
  const gestiones    = document.getElementById('f-gestiones').value.trim();
  const porcentaje   = parseInt(document.getElementById('f-pct-num').value) || 0;
  const existingId   = document.getElementById('f-entry-id').value;

  // Al editar, tomar año/trimestre/sprint de los selectores; al crear, del estado global
  const entryYear    = existingId ? parseInt(document.getElementById('f-edit-year').value)  : state.year;
  const entryQuarter = existingId ? document.getElementById('f-edit-quarter').value          : state.quarter;
  const entrySprint  = existingId ? parseInt(document.getElementById('f-edit-sprint').value) : state.sprint;

  const entry = { projectId, poId, year: entryYear, quarter: entryQuarter, sprint: entrySprint, estado, objetivo, logros, responsables, impedimentos, gestiones, porcentaje };

  try {
    setBtnLoading('btn-save-form', true);
    if (existingId) {
      await sbUpdateEntry(existingId, entry);
    } else {
      await sbInsertEntry(entry);
    }
    hideModal('modal-form');
    renderAll();
    toast(existingId ? 'Entrada actualizada correctamente.' : 'Entrada guardada correctamente.');
  } catch (err) {
    console.error('saveEntry error:', err);
    toast('Error al guardar. Intenta de nuevo.', 'error');
  } finally {
    setBtnLoading('btn-save-form', false);
  }
}

async function deleteEntry(entryId) {
  try {
    await sbDeleteEntry(entryId);
    renderAll();
    toast('Entrada eliminada.', 'info');
  } catch (err) {
    console.error(err);
    toast('Error al eliminar. Intenta de nuevo.', 'error');
  }
}

/* ──────────────────────────────────────────────────────────
   CONFIG MODAL
────────────────────────────────────────────────────────── */
function openConfig() {
  renderConfigPOs();
  renderConfigProjects();
  renderConfigResponsables();
  showModal('modal-config');
}

/* ── Responsables en Configuración ── */
function renderConfigResponsables() {
  const { responsables } = db();
  const list = document.getElementById('resp-list');
  if (!responsables.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:20px 0">No hay responsables registrados aún.</p>';
    return;
  }
  list.innerHTML = responsables.map(r => `
    <div class="cfg-item">
      <span class="cfg-item-name">${escHtml(r.name)}</span>
      <button class="btn-del" data-id="${r.id}" title="Eliminar responsable">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div>`).join('');

  list.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm('Eliminar responsable', '¿Eliminar este responsable de la lista?', async () => {
        try {
          await sbDeleteResponsable(btn.dataset.id);
          renderConfigResponsables();
          hideModal('modal-confirm');
          toast('Responsable eliminado.');
        } catch (err) { toast('Error al eliminar responsable.', 'error'); }
      });
    });
  });
}

/* ── Multi-select de responsables en el formulario ── */
let selectedResponsables = []; // array de names

function renderRespDropdown() {
  const { responsables } = db();
  const menuList = document.getElementById('resp-menu-list');

  if (!responsables.length) {
    menuList.innerHTML = '<div class="resp-empty">Sin responsables en Configuración.</div>';
    return;
  }

  menuList.innerHTML = responsables.map(r => {
    const checked = selectedResponsables.includes(r.name);
    return `
      <label class="resp-option${checked ? ' selected' : ''}" data-name="${escHtml(r.name)}">
        <input type="checkbox" value="${escHtml(r.name)}"${checked ? ' checked' : ''}>
        ${escHtml(r.name)}
      </label>`;
  }).join('');

  menuList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selectedResponsables.includes(cb.value)) selectedResponsables.push(cb.value);
      } else {
        selectedResponsables = selectedResponsables.filter(n => n !== cb.value);
      }
      cb.closest('.resp-option').classList.toggle('selected', cb.checked);
      syncRespField();
    });
  });
}

/* Busca el porcentaje del sprint más reciente anterior al actual para un proyecto */
function getPrevPorcentaje(projectId) {
  const { entries } = db();
  const quarterOrder = { Q1:1, Q2:2, Q3:3, Q4:4 };

  const prev = entries
    .filter(e => e.projectId === projectId)
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (quarterOrder[b.quarter] !== quarterOrder[a.quarter]) return quarterOrder[b.quarter] - quarterOrder[a.quarter];
      return b.sprint - a.sprint;
    });

  if (!prev.length) return null;
  return prev[0].porcentaje ?? null;
}

/* Busca los responsables del sprint más reciente anterior al actual para un proyecto */
function getPrevResponsables(projectId) {
  const { entries } = db();
  const quarterOrder = { Q1:1, Q2:2, Q3:3, Q4:4 };

  // Entradas del mismo proyecto, ordenadas de más reciente a más antigua
  const prev = entries
    .filter(e => e.projectId === projectId)
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      if (quarterOrder[b.quarter] !== quarterOrder[a.quarter]) return quarterOrder[b.quarter] - quarterOrder[a.quarter];
      return b.sprint - a.sprint;
    });

  if (!prev.length) return [];
  return tagsFromStr(prev[0].responsables);
}

function syncRespField() {
  // Actualiza el input hidden
  document.getElementById('f-responsables').value = selectedResponsables.join(', ');

  // Tags con botón de eliminar
  const preview = document.getElementById('f-tags-preview');
  preview.innerHTML = selectedResponsables.map(n => `
    <span class="tag tag-removable">
      ${escHtml(n)}
      <button type="button" class="tag-remove" data-name="${escHtml(n)}" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="10" height="10"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>`).join('');

  // Listener en cada "x"
  preview.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedResponsables = selectedResponsables.filter(n => n !== btn.dataset.name);
      renderRespDropdown(); // sincroniza checkboxes
      syncRespField();
    });
  });

  // Actualiza el label del trigger
  const label = document.getElementById('resp-trigger-label');
  label.textContent = selectedResponsables.length
    ? selectedResponsables.join(', ')
    : 'Selecciona los responsables...';
  label.style.color = selectedResponsables.length ? 'var(--text-dark)' : '';
}

function renderConfigPOs() {
  const { pos } = db();
  const list = document.getElementById('po-list');
  if (!pos.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:20px 0">No hay POs registrados aún.</p>';
    return;
  }
  list.innerHTML = pos.map(po => `
    <div class="cfg-item">
      <span class="cfg-item-name">${escHtml(po.name)}</span>
      <button class="btn-del" data-id="${po.id}" title="Eliminar PO">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div>`).join('');

  list.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const { entries } = db();
      const hasEntries = entries.some(e => e.poId === btn.dataset.id);
      if (hasEntries) {
        toast('Este PO tiene entradas registradas. Elimina primero las entradas.', 'error');
        return;
      }
      showConfirm('Eliminar PO', '¿Eliminar este Product Owner?', async () => {
        try {
          await sbDeletePO(btn.dataset.id);
          renderConfigPOs();
          renderPOFilter();
          hideModal('modal-confirm');
          toast('PO eliminado.');
        } catch (err) { toast('Error al eliminar PO.', 'error'); }
      });
    });
  });
}

function renderConfigProjects() {
  const { projects, pos } = db();

  // Update PO select in add form
  const poSel = document.getElementById('new-project-po-select');
  poSel.innerHTML = '<option value="">Selecciona un PO...</option>' +
    pos.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  // Sync year select default to current state year
  const yearSel = document.getElementById('new-project-year');
  if (yearSel && !yearSel.dataset.userChanged) yearSel.value = String(state.year);

  const list = document.getElementById('project-list');

  if (!projects.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:20px 0">No hay proyectos registrados aún.</p>';
    return;
  }

  // Group projects by year → quarter (using startQ; fallback to current year/Q1)
  const grouped = {};
  projects.forEach(pr => {
    const yr = pr.year || state.year;
    const q  = pr.startQ || 'Q1';
    if (!grouped[yr]) grouped[yr] = { Q1:[], Q2:[], Q3:[], Q4:[] };
    grouped[yr][q].push(pr);
  });

  const years = Object.keys(grouped).sort((a,b) => b - a); // newest first

  list.innerHTML = years.map(yr => {
    const isCurrentYear = parseInt(yr) === state.year;
    const quartersHtml = ['Q1','Q2','Q3','Q4'].map(q => {
      const qProjects = grouped[yr][q];
      const isCurrentQ = isCurrentYear && q === state.quarter;
      const itemsHtml = qProjects.length
        ? qProjects.map(pr => projectItemHtml(pr, pos)).join('')
        : `<div class="cfg-quarter-empty">Sin proyectos en este trimestre</div>`;

      return `
        <div class="cfg-quarter-section">
          <div class="cfg-quarter-header${isCurrentQ ? '' : ' collapsed'}" data-q="${q}-${yr}">
            <span>${q} · ${yr}</span>
            <span class="cfg-quarter-chevron">›</span>
          </div>
          <div class="cfg-quarter-body${isCurrentQ ? '' : ' collapsed'}" id="qbody-${q}-${yr}">
            <div class="cfg-list" id="qlist-${q}-${yr}">${itemsHtml}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="cfg-year-section">
        <div class="cfg-year-header${isCurrentYear ? '' : ' collapsed'}" data-yr="${yr}">
          <span>📅 ${yr}</span>
          <span class="cfg-year-chevron">›</span>
        </div>
        <div class="cfg-year-body${isCurrentYear ? '' : ' collapsed'}" id="yrbody-${yr}">
          ${quartersHtml}
        </div>
      </div>`;
  }).join('');

  // Year accordion toggle
  list.querySelectorAll('.cfg-year-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = document.getElementById(`yrbody-${header.dataset.yr}`);
      header.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });
  });

  // Quarter accordion toggle
  list.querySelectorAll('.cfg-quarter-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = document.getElementById(`qbody-${header.dataset.q}`);
      header.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });
  });

  // Edit & delete buttons
  list.querySelectorAll('.btn-edit-project').forEach(btn => {
    btn.addEventListener('click', () => openEditProject(btn.dataset.id));
  });
  list.querySelectorAll('.btn-delete-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const { entries } = db();
      if (entries.some(e => e.projectId === btn.dataset.id)) {
        toast('Este proyecto tiene entradas registradas. Elimina primero las entradas.', 'error');
        return;
      }
      showConfirm('Eliminar proyecto', '¿Eliminar este proyecto?', async () => {
        try {
          await sbDeleteProject(btn.dataset.id);
          renderConfigProjects();
          hideModal('modal-confirm');
          toast('Proyecto eliminado.');
        } catch (err) { toast('Error al eliminar proyecto.', 'error'); }
      });
    });
  });
}

function projectItemHtml(pr, pos) {
  const po = pos.find(p => p.id === pr.poId) || {};
  const startLabel = pr.startQ && pr.startS ? `${pr.startQ} · S${pr.startS}` : '—';
  const endLabel   = pr.endQ   && pr.endS   ? `${pr.endQ} · S${pr.endS}`   : '—';
  return `
    <div class="cfg-item">
      <div style="flex:1">
        <div class="cfg-item-name">${escHtml(pr.name)}</div>
        <div class="cfg-item-sub">PO: ${escHtml(po.name || '—')}</div>
        <div class="cfg-item-sprint-range">
          <span class="sprint-range-badge">Inicio: ${startLabel}</span>
          <span class="sprint-range-sep">→</span>
          <span class="sprint-range-badge">Fin: ${endLabel}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn-edit-project btn-del" data-id="${pr.id}" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="color:var(--sura-mid)"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-delete-project btn-del" data-id="${pr.id}" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

function openEditProject(projectId) {
  const { projects } = db();
  const pr = projects.find(p => p.id === projectId);
  if (!pr) return;

  document.getElementById('new-project-input').value    = pr.name;
  document.getElementById('new-project-po-select').value= pr.poId  || '';
  document.getElementById('new-project-year').value     = String(pr.year || state.year);
  document.getElementById('new-project-start-q').value  = pr.startQ || 'Q1';
  document.getElementById('new-project-start-s').value  = pr.startS || '1';
  document.getElementById('new-project-end-q').value    = pr.endQ   || 'Q1';
  document.getElementById('new-project-end-s').value    = pr.endS   || '5';

  const btn = document.getElementById('btn-add-project');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar cambios';
  btn.dataset.editingId = projectId;

  // Scroll form into view
  document.getElementById('new-project-input').focus();
  document.querySelector('.cfg-project-form').scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ──────────────────────────────────────────────────────────
   UI HELPERS
────────────────────────────────────────────────────────── */
function setBtnLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.7' : '';
}

/* ──────────────────────────────────────────────────────────
   RENDER ALL
────────────────────────────────────────────────────────── */
function renderAll() {
  renderNavigator();
  renderPOFilter();
  renderDashboard();
}

/* ──────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────── */
async function initApp() {
  // ── Auth: verificar sesión activa ──
  showLoading(true);
  const session = await getSession();
  if (!session) {
    showLoading(false);
    showLoginModal();
    return;
  }
  await startApp(session.user);
}

function showLoading(visible) {
  const el = document.getElementById('app-loading');
  if (el) el.hidden = !visible;
}

function showLoginModal() {
  document.getElementById('modal-login').removeAttribute('hidden');
}

function hideLoginModal() {
  document.getElementById('modal-login').setAttribute('hidden', '');
}

async function startApp(user) {
  // Mostrar nombre del usuario en header
  const profile = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Usuario';
  document.getElementById('header-user-name').textContent = profile;

  // Cargar datos desde Supabase
  showLoading(true);
  try {
    await loadData();
  } catch (err) {
    console.error('Error cargando datos:', err);
    toast('Error al cargar datos. Recarga la página.', 'error');
  } finally {
    showLoading(false);
  }

  // Detect current sprint
  const cur = detectCurrentSprint();
  state.year    = cur.year;
  state.quarter = cur.quarter;
  state.sprint  = cur.sprint;

  // ── Event listeners (solo se registran una vez) ──
  if (!_listenersReady) {
    _listenersReady = true;

  // ── Navigator ──
  document.getElementById('btn-year-prev').addEventListener('click', () => {
    if (CALENDAR[state.year - 1]) { state.year--; renderAll(); }
  });
  document.getElementById('btn-year-next').addEventListener('click', () => {
    if (CALENDAR[state.year + 1]) { state.year++; renderAll(); }
  });
  document.querySelectorAll('.q-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quarter = btn.dataset.q;
      state.sprint  = 1;
      renderAll();
    });
  });

  // ── Header buttons ──
  document.getElementById('btn-new-entry').addEventListener('click', () => openForm());
  document.getElementById('btn-new-entry-empty')?.addEventListener('click', () => openForm());
  document.getElementById('btn-config').addEventListener('click', openConfig);

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut();
    location.reload();
  });

  // ── Detail modal ──
  document.getElementById('btn-close-detail').addEventListener('click',   () => hideModal('modal-detail'));
  document.getElementById('btn-close-detail-f').addEventListener('click', () => hideModal('modal-detail'));
  document.getElementById('modal-detail').addEventListener('click', (ev) => {
    if (ev.target === document.getElementById('modal-detail')) hideModal('modal-detail');
  });

  // ── Form modal ──
  document.getElementById('btn-close-form').addEventListener('click',  () => hideModal('modal-form'));
  document.getElementById('btn-cancel-form').addEventListener('click', () => hideModal('modal-form'));
  document.getElementById('btn-save-form').addEventListener('click', saveEntry);
  document.getElementById('modal-form').addEventListener('click', (ev) => {
    if (ev.target === document.getElementById('modal-form')) hideModal('modal-form');
  });

  // Al seleccionar proyecto: auto-rellenar PO y pre-cargar responsables del sprint anterior
  document.getElementById('f-project').addEventListener('change', (ev) => {
    ev.target.classList.remove('invalid');
    const projectId = ev.target.value;
    if (!projectId) return;

    // Auto-rellenar PO
    const { projects } = db();
    const project = projects.find(p => p.id === projectId);
    if (project && project.poId) {
      const poSel = document.getElementById('f-po');
      poSel.value = project.poId;
      poSel.classList.remove('invalid');
    }

    // Solo en modo nueva entrada (no edición): pre-cargar responsables y porcentaje del sprint anterior
    const isNewEntry = !document.getElementById('f-entry-id').value;
    if (isNewEntry) {
      const prevResps = getPrevResponsables(projectId);
      if (prevResps.length) {
        selectedResponsables = [...prevResps];
        renderRespDropdown();
        syncRespField();
      }
      const prevPct = getPrevPorcentaje(projectId);
      if (prevPct !== null) {
        setPct(prevPct);
      }
    }
  });

  // Remove invalid class on change
  ['f-po','f-objetivo','f-logros'].forEach(id => {
    document.getElementById(id).addEventListener('input', (ev) => ev.target.classList.remove('invalid'));
    document.getElementById(id).addEventListener('change', (ev) => ev.target.classList.remove('invalid'));
  });

  // Percentage sync
  const rangeEl  = document.getElementById('f-pct-range');
  const numEl    = document.getElementById('f-pct-num');
  rangeEl.addEventListener('input', () => setPct(rangeEl.value));
  numEl.addEventListener('input',   () => setPct(numEl.value));

  // Quick add project from form
  document.getElementById('btn-new-project-inline').addEventListener('click', async () => {
    const name = prompt('Nombre del nuevo proyecto:');
    if (!name || !name.trim()) return;
    const { pos } = db();
    if (!pos.length) { toast('Primero agrega un PO en Configuración.', 'error'); return; }
    try {
      await sbInsertProject({ name: name.trim(), poId: '', year: state.year, startQ: state.quarter, startS: 1, endQ: state.quarter, endS: 5 });
      const newProject = db().projects.find(p => p.name === name.trim());
      openForm(state.editingEntryId || undefined);
      if (newProject) setTimeout(() => { document.getElementById('f-project').value = newProject.id; }, 50);
    } catch (err) { toast('Error al agregar proyecto.', 'error'); }
  });

  // ── Config modal ──
  document.getElementById('btn-close-config').addEventListener('click',   () => hideModal('modal-config'));
  document.getElementById('btn-close-config-f').addEventListener('click', () => { hideModal('modal-config'); renderAll(); });
  document.getElementById('modal-config').addEventListener('click', (ev) => {
    if (ev.target === document.getElementById('modal-config')) { hideModal('modal-config'); renderAll(); }
  });

  // Config tabs
  document.querySelectorAll('.cfg-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cfg-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('cfg-panel-pos').hidden          = tab.dataset.tab !== 'pos';
      document.getElementById('cfg-panel-projects').hidden      = tab.dataset.tab !== 'projects';
      document.getElementById('cfg-panel-responsables').hidden  = tab.dataset.tab !== 'responsables';
      // Refrescar la pestaña activa para que siempre tenga datos actualizados
      if (tab.dataset.tab === 'projects')     renderConfigProjects();
      if (tab.dataset.tab === 'responsables') renderConfigResponsables();
      if (tab.dataset.tab === 'pos')          renderConfigPOs();
    });
  });

  // Agregar responsable
  document.getElementById('btn-add-resp').addEventListener('click', async () => {
    const name = document.getElementById('new-resp-input').value.trim();
    if (!name) { toast('Escribe el nombre del responsable.', 'error'); return; }
    const { responsables } = db();
    if (responsables.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      toast('Este responsable ya existe.', 'error'); return;
    }
    try {
      await sbInsertResponsable(name);
      document.getElementById('new-resp-input').value = '';
      renderConfigResponsables();
      toast(`"${name}" agregado como responsable.`);
    } catch (err) { toast('Error al agregar responsable.', 'error'); }
  });
  document.getElementById('new-resp-input').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') document.getElementById('btn-add-resp').click();
  });

  // Multi-select dropdown de responsables en formulario
  const respDropdown = document.getElementById('resp-dropdown');
  const respMenu     = document.getElementById('resp-menu');
  document.getElementById('resp-trigger').addEventListener('click', ev => {
    ev.stopPropagation();
    const isOpen = !respMenu.hidden;
    respMenu.hidden = isOpen;
    respDropdown.classList.toggle('open', !isOpen);
    if (!isOpen) {
      renderRespDropdown(); // refrescar lista al abrir
      respMenu.scrollTop = 0; // siempre desde arriba
    }
  });
  document.addEventListener('click', ev => {
    if (!respDropdown.contains(ev.target)) {
      respMenu.hidden = true;
      respDropdown.classList.remove('open');
    }
  });

  // Add PO
  document.getElementById('btn-add-po').addEventListener('click', async () => {
    const name = document.getElementById('new-po-input').value.trim();
    if (!name) { toast('Escribe el nombre del PO.', 'error'); return; }
    try {
      await sbInsertPO(name);
      document.getElementById('new-po-input').value = '';
      renderConfigPOs();
      toast(`PO "${name}" agregado.`);
    } catch (err) { toast('Error al agregar PO.', 'error'); }
  });
  document.getElementById('new-po-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') document.getElementById('btn-add-po').click();
  });

  // Add / Edit project
  document.getElementById('btn-add-project').addEventListener('click', async () => {
    const name   = document.getElementById('new-project-input').value.trim();
    const poId   = document.getElementById('new-project-po-select').value;
    const year   = parseInt(document.getElementById('new-project-year').value) || state.year;
    const startQ = document.getElementById('new-project-start-q').value;
    const startS = document.getElementById('new-project-start-s').value;
    const endQ   = document.getElementById('new-project-end-q').value;
    const endS   = document.getElementById('new-project-end-s').value;
    if (!name) { toast('Escribe el nombre del proyecto.', 'error'); return; }

    const btn = document.getElementById('btn-add-project');
    const editingId = btn.dataset.editingId;

    try {
      setBtnLoading('btn-add-project', true);
      if (editingId) {
        await sbUpdateProject(editingId, { name, poId, year, startQ, startS, endQ, endS });
        delete btn.dataset.editingId;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar proyecto';
        toast(`Proyecto "${name}" actualizado.`);
      } else {
        await sbInsertProject({ name, poId, year, startQ, startS, endQ, endS });
        toast(`Proyecto "${name}" agregado.`);
      }
      document.getElementById('new-project-input').value = '';
      document.getElementById('new-project-po-select').value = '';
      document.getElementById('new-project-year').value = String(state.year);
      document.getElementById('new-project-start-q').value = 'Q1';
      document.getElementById('new-project-start-s').value = '1';
      document.getElementById('new-project-end-q').value   = 'Q1';
      document.getElementById('new-project-end-s').value   = '5';
      renderConfigProjects();
    } catch (err) {
      toast('Error al guardar proyecto.', 'error');
    } finally {
      setBtnLoading('btn-add-project', false);
    }
  });
  document.getElementById('new-project-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') document.getElementById('btn-add-project').click();
  });

  // ── Confirm modal ──
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => hideModal('modal-confirm'));
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
  });
  document.getElementById('modal-confirm').addEventListener('click', (ev) => {
    if (ev.target === document.getElementById('modal-confirm')) hideModal('modal-confirm');
  });

  // Empty state button (re-bind after renderDashboard clears it)
  document.getElementById('cards-grid').addEventListener('click', () => {});

  } // fin if (!_listenersReady)

  // ── Initial render ──
  renderAll();

  // Si no hay POs aún, abrir configuración automáticamente
  const { pos } = db();
  if (!pos.length) {
    setTimeout(() => {
      toast('Bienvenido. Comienza agregando los POs y proyectos del equipo.', 'info');
      openConfig();
    }, 600);
  }
}

// Cerrar modales con tecla Escape
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  const modals = ['modal-confirm', 'modal-form', 'modal-detail', 'modal-config'];
  for (const id of modals) {
    const el = document.getElementById(id);
    if (el && !el.hidden) {
      hideModal(id);
      break;
    }
  }
});

/* ──────────────────────────────────────────────────────────
   LOGIN
────────────────────────────────────────────────────────── */
function initLogin() {
  const btnLogin    = document.getElementById('btn-login');
  const emailInput  = document.getElementById('login-email');
  const passInput   = document.getElementById('login-password');
  const errorEl     = document.getElementById('login-error');

  async function doLogin() {
    const email    = emailInput.value.trim();
    const password = passInput.value;
    if (!email || !password) { showLoginError('Ingresa tu correo y contraseña.'); return; }
    setBtnLoading('btn-login', true);
    errorEl.hidden = true;
    const { error, data } = await signIn(email, password);
    setBtnLoading('btn-login', false);
    if (error) {
      showLoginError('Correo o contraseña incorrectos.');
    } else {
      hideLoginModal();
      await startApp(data.user);
    }
  }

  function showLoginError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  btnLogin.addEventListener('click', doLogin);
  passInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doLogin(); });
  emailInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') passInput.focus(); });
}

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initApp();
});
