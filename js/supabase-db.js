/* ═══════════════════════════════════════════════════════════
   SURA · Transformación Digital
   supabase-db.js — Capa de datos con Supabase
═══════════════════════════════════════════════════════════ */

'use strict';

const SUPABASE_URL = 'https://foyzqrjoixvafajpflng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZveXpxcmpvaXh2YWZhanBmbG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTQ2NDQsImV4cCI6MjA5MTE3MDY0NH0.tRne9bZZahK4de2EjA2IiiUWL-6Mp1Ep0bZUxQML64s';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ──────────────────────────────────────────────────────────
   CACHÉ EN MEMORIA  (db() sigue siendo síncrono para el resto del código)
────────────────────────────────────────────────────────── */
let _cache = { pos: [], responsables: [], projects: [], entries: [] };

function db() { return _cache; }

/* ──────────────────────────────────────────────────────────
   MAPEADORES  Supabase (snake_case) ↔ App (camelCase)
────────────────────────────────────────────────────────── */
function mapPO(r)          { return { id: r.id, name: r.name }; }
function mapResponsable(r) { return { id: r.id, name: r.name }; }
function mapProject(r) {
  return {
    id: r.id, name: r.name, poId: r.po_id,
    year: r.year,
    startQ: r.start_quarter, startS: r.start_sprint,
    endQ:   r.end_quarter,   endS:   r.end_sprint,
  };
}
function mapEntry(r) {
  return {
    id: r.id, projectId: r.project_id, poId: r.po_id,
    year: r.year, quarter: r.quarter, sprint: r.sprint,
    objetivo: r.objetivo, logros: r.logros,
    impedimentos: r.impedimentos, gestiones: r.gestiones,
    responsables: r.responsables,
    porcentaje: r.porcentaje, estado: r.estado,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/* ──────────────────────────────────────────────────────────
   CARGA DE DATOS
────────────────────────────────────────────────────────── */
async function loadData() {
  const [posRes, respRes, projRes, entRes] = await Promise.all([
    _sb.from('pos').select('*').order('name'),
    _sb.from('responsables').select('*').order('name'),
    _sb.from('projects').select('*'),
    _sb.from('entries').select('*'),
  ]);

  if (posRes.error)  console.error('Error cargando pos:',          posRes.error);
  if (respRes.error) console.error('Error cargando responsables:', respRes.error);
  if (projRes.error) console.error('Error cargando projects:',     projRes.error);
  if (entRes.error)  console.error('Error cargando entries:',      entRes.error);

  _cache = {
    pos:          (posRes.data  || []).map(mapPO),
    responsables: (respRes.data || []).map(mapResponsable),
    projects:     (projRes.data || []).map(mapProject),
    entries:      (entRes.data  || []).map(mapEntry),
  };
}

/* ──────────────────────────────────────────────────────────
   AUTENTICACIÓN
────────────────────────────────────────────────────────── */
async function getSession() {
  const { data: { session } } = await _sb.auth.getSession();
  return session;
}

async function signIn(email, password) {
  return _sb.auth.signInWithPassword({ email, password });
}

async function signOut() {
  return _sb.auth.signOut();
}

function onAuthChange(callback) {
  _sb.auth.onAuthStateChange((_event, session) => callback(session));
}

/* ──────────────────────────────────────────────────────────
   PRODUCT OWNERS
────────────────────────────────────────────────────────── */
async function sbInsertPO(name) {
  const { error } = await _sb.from('pos').insert({ name });
  if (error) throw error;
  await loadData();
}

async function sbDeletePO(id) {
  const { error } = await _sb.from('pos').delete().eq('id', id);
  if (error) throw error;
  await loadData();
}

/* ──────────────────────────────────────────────────────────
   RESPONSABLES
────────────────────────────────────────────────────────── */
async function sbInsertResponsable(name) {
  const { error } = await _sb.from('responsables').insert({ name });
  if (error) throw error;
  await loadData();
}

async function sbDeleteResponsable(id) {
  const { error } = await _sb.from('responsables').delete().eq('id', id);
  if (error) throw error;
  await loadData();
}

/* ──────────────────────────────────────────────────────────
   PROYECTOS
────────────────────────────────────────────────────────── */
async function sbInsertProject(p) {
  const { error } = await _sb.from('projects').insert({
    name:         p.name,
    po_id:        p.poId    || null,
    year:         p.year    || null,
    start_quarter: p.startQ || null,
    start_sprint:  p.startS ? parseInt(p.startS) : null,
    end_quarter:   p.endQ   || null,
    end_sprint:    p.endS   ? parseInt(p.endS)   : null,
  });
  if (error) throw error;
  await loadData();
}

async function sbUpdateProject(id, p) {
  const { error } = await _sb.from('projects').update({
    name:         p.name,
    po_id:        p.poId    || null,
    year:         p.year    || null,
    start_quarter: p.startQ || null,
    start_sprint:  p.startS ? parseInt(p.startS) : null,
    end_quarter:   p.endQ   || null,
    end_sprint:    p.endS   ? parseInt(p.endS)   : null,
  }).eq('id', id);
  if (error) throw error;
  await loadData();
}

async function sbDeleteProject(id) {
  const { error } = await _sb.from('projects').delete().eq('id', id);
  if (error) throw error;
  await loadData();
}

/* ──────────────────────────────────────────────────────────
   ENTRADAS DE SPRINT
────────────────────────────────────────────────────────── */
async function sbInsertEntry(e) {
  const { error } = await _sb.from('entries').insert({
    project_id:  e.projectId,
    po_id:       e.poId,
    year:        e.year,
    quarter:     e.quarter,
    sprint:      e.sprint,
    objetivo:    e.objetivo    || null,
    logros:      e.logros      || null,
    impedimentos: e.impedimentos || null,
    gestiones:   e.gestiones   || null,
    responsables: e.responsables || null,
    porcentaje:  e.porcentaje  || 0,
    estado:      e.estado      || 'progreso',
  });
  if (error) throw error;
  await loadData();
}

async function sbUpdateEntry(id, e) {
  const { error } = await _sb.from('entries').update({
    project_id:  e.projectId,
    po_id:       e.poId,
    year:        e.year,
    quarter:     e.quarter,
    sprint:      e.sprint,
    objetivo:    e.objetivo    || null,
    logros:      e.logros      || null,
    impedimentos: e.impedimentos || null,
    gestiones:   e.gestiones   || null,
    responsables: e.responsables || null,
    porcentaje:  e.porcentaje  || 0,
    estado:      e.estado      || 'progreso',
  }).eq('id', id);
  if (error) throw error;
  await loadData();
}

async function sbDeleteEntry(id) {
  const { error } = await _sb.from('entries').delete().eq('id', id);
  if (error) throw error;
  await loadData();
}
