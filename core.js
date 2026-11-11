/* 計測・集計・バックアップの共通処理。ブラウザとNode.jsで利用。 */
(function (root) {
  'use strict';
  const classification = typeof module !== 'undefined' ? require('./categories.js') : root.WorkTimerCategories;
  const { categories, groups, groupOf, categoryLabel, categoryId, defaultSettings, defaultGroupSettings, groupLabel } = classification;
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
  // 保存済みの停止区間だけで、新しい日時の実働を確定できるか判定する。
  function editTiming(r, start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('終了時刻は開始時刻以降にしてください。');
    if (start === r.start && end === r.end) return { work: duration(r).work, breaks: r.breaks, manualBreakMs: r.manualBreakMs, needsManual: false };
    const hasStops = duration(r).rest > 0;
    if (hasStops && (r.manualBreakMs != null || start < r.start || end > r.end)) return { needsManual: true };
    const breaks = r.breaks.map(p => ({ start: Math.max(start,p.start), end: Math.min(end,p.end) })).filter(p => p.end > p.start);
    const rest = breaks.reduce((n,p) => n + p.end-p.start,0);
    return { work: end-start-rest, breaks, needsManual: false };
  }
  const allowedGroups = settings => new Set((settings || defaultGroupSettings()).map(g=>g.id));
  function validateRecord(r, active = false, groupSettings = null) {
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
    if (r.group != null && !allowedGroups(groupSettings).has(r.group)) throw new Error('活動グループが正しくありません。');
    return r;
  }
  function validateGroupSettings(settings) {
    if (settings == null) return;
    if (!Array.isArray(settings) || !settings.length) throw new Error('活動グループ設定が正しくありません。');
    const ids=new Set(), labels=new Set();
    settings.forEach(g=>{
      if(!g || typeof g.id!=='string' || !g.id.trim() || ids.has(g.id) || typeof g.label!=='string' || !g.label.trim() || labels.has(g.label.trim()) || typeof g.hidden!=='boolean' || !Number.isSafeInteger(g.order) || g.order<0) throw new Error('活動グループ設定が正しくありません。');
      ids.add(g.id);labels.add(g.label.trim());
    });
    if(!ids.has('その他')) throw new Error('「その他」グループが必要です。');
  }
  function validateCategorySettings(settings, groupSettings = null) {
    if (settings == null) return;
    if (!Array.isArray(settings)) throw new Error('カテゴリ設定が正しくありません。');
    const ids=new Set(), labels=new Set();
    settings.forEach(c=>{
      if(!c || typeof c.id!=='string' || !c.id.trim() || ids.has(c.id) || typeof c.label!=='string' || !c.label.trim() || labels.has(c.label.trim()) || !allowedGroups(groupSettings).has(c.group) || typeof c.hidden!=='boolean' || (c.includeToday != null && typeof c.includeToday!=='boolean') || !Number.isSafeInteger(c.order) || c.order<0) throw new Error('カテゴリ設定が正しくありません。');
      ids.add(c.id);labels.add(c.label.trim());
    });
  }
  function validateState(s) {
    if (!s || s.version !== 1 || !Array.isArray(s.records)) throw new Error('対応するバックアップ形式ではありません。');
    validateGroupSettings(s.groupSettings);
    const groupSettings=s.groupSettings || defaultGroupSettings();
    validateCategorySettings(s.categorySettings,groupSettings);
    const ids = new Set();
    s.records.forEach(r => { validateRecord(r,false,groupSettings); if (ids.has(r.id)) throw new Error('記録IDが重複しています。'); ids.add(r.id); });
    if (s.active !== null) { validateRecord(s.active,true,groupSettings); if (ids.has(s.active.id)) throw new Error('計測中のIDが重複しています。'); }
    if (s.exercise != null) {
      const x = s.exercise;
      validateRecord(x.record,true,groupSettings);
      if (!s.active || typeof x.resumeParent !== 'boolean' || x.record.category !== 'ストレッチ' || x.record.breaks.length || x.record.start < s.active.start || s.active.breaks.at(-1)?.end !== null || s.active.breaks.at(-1).start > x.record.start || x.record.id === s.active.id || ids.has(x.record.id)) throw new Error('運動と元の作業の計測状態が正しくありません。');
    }
    if (s.pendingResultId != null && typeof s.pendingResultId !== 'string') throw new Error('結果表示の情報が正しくありません。');
    return s;
  }
  function groupTotals(records, from, to, now = Date.now(), categorySettings = null, groupSettings = null) {
    const totals = Object.fromEntries((groupSettings || defaultGroupSettings()).map(group => [group.id, 0]));
    records.forEach(r => { const group=r.group || groupOf(r.category,categorySettings);totals[group]=(totals[group]||0)+workIn(r,from,to,now); });
    return totals;
  }
  function merge(current, incoming) {
    validateState(current); validateState(incoming);
    const result = JSON.parse(JSON.stringify(current));
    let added = 0, conflicts = 0;
    const targetGroups=result.groupSettings || defaultGroupSettings(), sourceGroups=incoming.groupSettings || defaultGroupSettings(), groupMap={};
    sourceGroups.forEach(g=>{
      const sameId=targetGroups.find(x=>x.id===g.id), sameLabel=targetGroups.find(x=>x.label===g.label);
      if(sameId)groupMap[g.id]=sameId.id;
      else if(sameLabel)groupMap[g.id]=sameLabel.id;
      else {targetGroups.push({...g,order:targetGroups.length});groupMap[g.id]=g.id;}
    });
    if(result.groupSettings || incoming.groupSettings)result.groupSettings=targetGroups;
    const remapRecord=r=>{const copy=JSON.parse(JSON.stringify(r));if(copy.group)copy.group=groupMap[copy.group]||copy.group;return copy;};
    incoming.records.forEach(r => {
      const mapped=remapRecord(r), old = result.records.find(x => x.id === r.id) || (result.active?.id === r.id ? result.active : null) || (result.exercise?.record.id === r.id ? result.exercise.record : null);
      if (!old) { result.records.push(mapped); added++; }
      else if (JSON.stringify(old) !== JSON.stringify(r)) { conflicts++; }
    });
    if (incoming.active) {
      if (!result.active && !result.records.some(r => r.id === incoming.active.id || r.id === incoming.exercise?.record.id)) {
        result.active = remapRecord(incoming.active);
        if (incoming.exercise) result.exercise = {...incoming.exercise,record:remapRecord(incoming.exercise.record)};
      }
      else if (JSON.stringify(result.active) !== JSON.stringify(incoming.active) || JSON.stringify(result.exercise ?? null) !== JSON.stringify(incoming.exercise ?? null)) conflicts++;
    }
    if (!result.categorySettings && incoming.categorySettings) result.categorySettings = incoming.categorySettings.map(c=>({...c,group:groupMap[c.group]||c.group}));
    return { state: result, added, conflicts };
  }
  const api = { categories, groups, groupOf, categoryLabel, categoryId, defaultSettings, defaultGroupSettings, groupLabel, groupTotals, uid, duration, workIn, editTiming, validateState, validateRecord, validateCategorySettings, validateGroupSettings, merge };
  if (typeof module !== 'undefined') module.exports = api;
  else root.WorkTimer = api;
})(globalThis);
