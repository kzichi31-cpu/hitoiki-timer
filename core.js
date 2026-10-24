/* 計測・集計・バックアップの共通処理。ブラウザとNode.jsで利用。 */
(function (root) {
  'use strict';
  const classification = typeof module !== 'undefined' ? require('./categories.js') : root.WorkTimerCategories;
  const { categories, groups, groupOf, categoryLabel, categoryId } = classification;
  const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function duration(r, now = Date.now()) {
    const end = r.end ?? now;
    const span = Math.max(0, end - r.start);
    const rest = r.manualBreakMs != null ? r.manualBreakMs : r.breaks.reduce((n, p) => n + Math.max(0, (p.end ?? end) - p.start), 0);
    return { span, rest, work: Math.max(0, span - rest) };
  }
  function workIn(r, from, to, now = Date.now()) {
    const end = r.end ?? now;
    const span = overlap(r.start, end, from, to);
    if (r.manualBreakMs != null) {
      const d = duration(r, now);
      return d.span ? span * d.work / d.span : 0;
    }
    return Math.max(0, span - r.breaks.reduce((n, p) => n + overlap(p.start, p.end ?? end, from, to), 0));
  }
  function validateRecord(r, active = false) {
    if (!r || typeof r.id !== 'string' || !r.id || (typeof r.category !== 'string' || !r.category.trim()) || typeof r.memo !== 'string' || !Number.isFinite(r.start) || !Number.isFinite(new Date(r.start).getTime())) throw new Error('記録の形式が正しくありません。');
    if (active ? r.end !== null : !Number.isFinite(r.end) || !Number.isFinite(new Date(r.end).getTime()) || r.end < r.start) throw new Error('開始・終了時刻が正しくありません。');
    if (r.start > Date.now() + 1000 || (!active && r.end > Date.now() + 1000)) throw new Error('未来の時刻は登録できません。');
    if (!Array.isArray(r.breaks)) throw new Error('休憩データが正しくありません。');
    let last = r.start;
    r.breaks.forEach((p, i) => {
      if (!p || !Number.isFinite(p.start) || p.start < last || p.start > (r.end ?? Date.now()) || (p.end === null ? !active || i !== r.breaks.length - 1 : !Number.isFinite(p.end) || p.end < p.start || p.end > (r.end ?? Date.now()))) throw new Error('休憩の時刻が正しくありません。');
      last = p.end ?? Infinity;
    });
    if (r.manualBreakMs != null && (!Number.isFinite(r.manualBreakMs) || r.manualBreakMs < 0 || active || r.manualBreakMs > r.end - r.start || r.breaks.length)) throw new Error('休憩時間は拘束時間以内で入力してください。');
    return r;
  }
  function validateState(s) {
    if (!s || s.version !== 1 || !Array.isArray(s.records)) throw new Error('対応するバックアップ形式ではありません。');
    const ids = new Set();
    s.records.forEach(r => { validateRecord(r); if (ids.has(r.id)) throw new Error('記録IDが重複しています。'); ids.add(r.id); });
    if (s.active !== null) { validateRecord(s.active, true); if (ids.has(s.active.id)) throw new Error('計測中のIDが重複しています。'); }
    if (s.exercise != null) {
      const x = s.exercise;
      validateRecord(x.record, true);
      if (!s.active || typeof x.resumeParent !== 'boolean' || x.record.category !== 'ストレッチ' || x.record.breaks.length || x.record.start < s.active.start || s.active.breaks.at(-1)?.end !== null || s.active.breaks.at(-1).start > x.record.start || x.record.id === s.active.id || ids.has(x.record.id)) throw new Error('運動と元の作業の計測状態が正しくありません。');
    }
    if (s.pendingResultId != null && typeof s.pendingResultId !== 'string') throw new Error('結果表示の情報が正しくありません。');
    return s;
  }
  function groupTotals(records, from, to, now = Date.now()) {
    const totals = Object.fromEntries(groups.map(group => [group, 0]));
    records.forEach(r => { totals[groupOf(r.category)] += workIn(r, from, to, now); });
    return totals;
  }
  function merge(current, incoming) {
    validateState(current); validateState(incoming);
    const result = JSON.parse(JSON.stringify(current));
    let added = 0, conflicts = 0;
    incoming.records.forEach(r => {
      const old = result.records.find(x => x.id === r.id) || (result.active?.id === r.id ? result.active : null) || (result.exercise?.record.id === r.id ? result.exercise.record : null);
      if (!old) { result.records.push(r); added++; }
      else if (JSON.stringify(old) !== JSON.stringify(r)) { conflicts++; }
    });
    if (incoming.active) {
      if (!result.active && !result.records.some(r => r.id === incoming.active.id || r.id === incoming.exercise?.record.id)) {
        result.active = incoming.active;
        if (incoming.exercise) result.exercise = incoming.exercise;
      }
      else if (JSON.stringify(result.active) !== JSON.stringify(incoming.active) || JSON.stringify(result.exercise ?? null) !== JSON.stringify(incoming.exercise ?? null)) conflicts++;
    }
    return { state: result, added, conflicts };
  }
  const api = { categories, groups, groupOf, categoryLabel, categoryId, groupTotals, uid, duration, workIn, validateState, validateRecord, merge };
  if (typeof module !== 'undefined') module.exports = api;
  else root.WorkTimer = api;
})(globalThis);
