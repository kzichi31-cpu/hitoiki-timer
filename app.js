'use strict';
const W = WorkTimer;
const KEY = 'worktimer.v1';
const $ = id => document.getElementById(id);
let state = { version: 1, records: [], active: null };
let locked = false;
let raw = null;
let lastRender = 0;
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localInput = ms => { const d = new Date(ms); return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const clock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const hours = ms => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}時間${pad(m % 60)}分`; };
const timestamp = ms => new Date(ms).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
const timeOnly = ms => new Date(ms).toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
const settings = () => state.categorySettings || W.defaultSettings();
const groupSettings = () => state.groupSettings || W.defaultGroupSettings();
const categoryLabel = id => W.categoryLabel(id, settings());
const groupOf = id => W.groupOf(id, settings());
const groupLabel = id => W.groupLabel(id, groupSettings());
const includedToday = id => settings().find(c=>c.id===W.categoryId(id))?.includeToday !== false;
function message(text, error = false) { $('message').hidden = false; $('message').textContent = text; $('message').classList.toggle('error', error); }
function load() {
  try {
    raw = localStorage.getItem(KEY);
    if (raw) state = W.validateState(JSON.parse(raw));
  } catch (e) {
    locked = true;
    message('保存データを読み込めませんでした。元データを保護するため記録の変更を停止しています。「バックアップを保存」で元データを退避してください。\n' + e.message, true);
  }
}
function save(next) {
  if (locked) { message('保存データの読み込みエラーのため変更できません。バックアップを保存してください。', true); return false; }
  try {
    // 別タブで変更された場合は上書きしない。
    if (localStorage.getItem(KEY) !== raw) { message('別の画面で記録が変更されました。この画面を再読み込みしてから操作してください。', true); return false; }
    W.validateState(next);
    const text = JSON.stringify(next);
    localStorage.setItem(KEY, text);
    raw = text; state = next;
    return true;
  } catch (e) { message('保存できませんでした。画面を閉じる前にバックアップを保存してください。\n' + e.message, true); return false; }
}
const copy = () => JSON.parse(JSON.stringify(state));
function allRecords() { return [...state.records, ...(state.active ? [state.active] : []), ...(state.exercise ? [state.exercise.record] : [])]; }
function rangeDay(key) { const from = new Date(key + 'T00:00:00'); const to = new Date(from); to.setDate(to.getDate() + 1); return [+from, +to]; }
const sum = (from, to, category) => allRecords().filter(r => !category || W.categoryId(r.category) === category).reduce((n,r) => n + W.workIn(r, from, to), 0);
function pendingResult() { return state.records.find(r => r.id === state.pendingResultId); }
function renderResult() {
  const r = pendingResult();
  $('result-card').hidden = !r;
  $('timer-card').hidden = !!r;
  if (!r) return;
  const d = W.duration(r);
  $('result-category').textContent = categoryLabel(r.category);
  $('result-start').textContent = new Date(r.start).toLocaleString('ja-JP');
  $('result-end').textContent = new Date(r.end).toLocaleString('ja-JP');
  $('result-work').textContent = clock(d.work);
  $('result-close').disabled = locked;
}
function renderTimer() {
  const exercise = state.exercise;
  const a = exercise ? exercise.record : state.active;
  const paused = a?.breaks.at(-1)?.end === null;
  $('timer-title').textContent = exercise ? 'ストレッチ＆運動' : 'いまの作業';
  $('timer-status').textContent = exercise ? '運動中' : !a ? '準備中' : paused ? '一時停止中' : '作業中';
  $('timer-clocks').classList.toggle('is-paused', paused);
  $('timer-clocks').classList.toggle('is-working', !!a && !paused);
  const d = a ? W.duration(a) : { work: 0, rest: 0 };
  $('elapsed').textContent = clock(d.work);
  $('timer-details').textContent = a ? (exercise ? `${timestamp(a.start)} 運動開始 ／ 元の作業「${categoryLabel(state.active.category)}」は一時停止中（実働 ${clock(W.duration(state.active).work)}）` : `${timestamp(a.start)} 開始`) : 'カテゴリを選んで、はじめましょう。';
  $('start').hidden = !!a; $('run-actions').hidden = !a || !!exercise; $('finish-actions').hidden = !a || !!exercise; $('modify').hidden = !a || !!exercise;
  $('pause').disabled = locked || !a || paused || !!exercise;
  $('resume').disabled = locked || !a || !paused || !!exercise;
  $('exercise-finish').hidden = !exercise;
  $('category').disabled = !!a || locked;
  for (const id of ['start','stop','discard','modify','memo','import-button','exercise-finish','manage-categories','manage-groups']) $(id).disabled = locked;
  $('timer-form').hidden = !!exercise;
  $('memo').disabled = locked || !!exercise;
  $('import-button').disabled = locked || !!pendingResult();
}
function renderSummary() {
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(today); week.setDate(week.getDate() - (week.getDay() + 6) % 7);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  $('today-total').textContent = hours(sum(+today,+tomorrow));
  $('week-total').textContent = hours(sum(+week,Date.now()));
  $('month-total').textContent = hours(sum(+month,Date.now()));
  $('today-focus-total').textContent = hours(allRecords().filter(r=>includedToday(r.category)).reduce((n,r)=>n+W.workIn(r,+today,+tomorrow),0));
}
function renderCalendar() {
  const [y,m] = $('month').value.split('-').map(Number);
  if (!y || !m) return;
  const start = new Date(y,m-1,1), end = new Date(y,m,1);
  const calendar = $('calendar'); calendar.replaceChildren();
  ['月','火','水','木','金','土','日'].forEach(s => { const e=document.createElement('div'); e.className='weekday'; e.textContent=s; calendar.append(e); });
  for(let n=0;n<(start.getDay()+6)%7;n++) calendar.append(document.createElement('div'));
  for(let day=1;day<=new Date(y,m,0).getDate();day++) {
    const d = new Date(y,m-1,day); const key=dateKey(d); const [from,to]=rangeDay(key);
    const button=document.createElement('button'); button.type='button'; button.className='day';
    if(key===$('selected-day').value) button.classList.add('selected');
    if(key===dateKey(new Date())) button.classList.add('today');
    button.setAttribute('aria-pressed', String(key===$('selected-day').value));
    const total=sum(from,to); button.setAttribute('aria-label',`${m}月${day}日 ${hours(total)}`);
    button.append(String(day));
    const value=document.createElement('span'); value.textContent=total>0 ? hours(total).replace('時間','h ').replace('分','m') : '—';
    button.append(value);
    button.onclick=()=>{ $('selected-day').value=key; renderCalendar(); renderRecords(); $('daily-records-section').scrollIntoView({behavior:'smooth',block:'start'}); };
    calendar.append(button);
  }
  $('category-period').textContent=`${y}年${m}月の実働時間（計測中も含む）`;
  const categoryIds = [...new Set([[...settings()].sort((a,b)=>a.order-b.order).map(c=>c.id), ...allRecords().map(r => W.categoryId(r.category))].flat())];
  const totals=categoryIds.map(category=>({category,value:sum(+start,+end,category)})).sort((a,b)=>b.value-a.value);
  const max=totals[0].value;
  $('category-totals').replaceChildren();
  totals.forEach(t=>{
    const row=document.createElement('div'); row.className='category-row';
    const line=document.createElement('div'); line.className='category-line';
    const label=document.createElement('span');label.textContent=categoryLabel(t.category);
    const value=document.createElement('span');value.textContent=hours(t.value);
    const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=`${max?t.value/max*100:0}%`;
    line.append(label,value);bar.append(fill);row.append(line,bar);$('category-totals').append(row);
  });
}
function renderGroupRows(targetId, totals) {
  const target = $(targetId); target.replaceChildren();
  [...groupSettings()].sort((a,b)=>a.order-b.order).filter(group=>!group.hidden || (totals[group.id]||0)>0).forEach(group => {
    const row = document.createElement('div'); row.className = 'group-stat';
    const label = document.createElement('span'); label.textContent = group.label;
    const value = document.createElement('strong'); value.textContent = clock(totals[group.id]||0);
    row.append(label, value); target.append(row);
  });
}
function renderMonthGroups() {
  const [y,m] = $('month').value.split('-').map(Number); if(!y || !m) return;
  const from = +new Date(y,m-1,1), to = +new Date(y,m,1);
  const now = Date.now(), records = allRecords();
  renderGroupRows('month-group-totals', W.groupTotals(records,from,to,now,settings(),groupSettings()));
  $('group-period').textContent = `${y}年${m}月`;
  $('month-group-total').textContent = '全グループの実働合計：' + clock(records.reduce((n,r)=>n+W.workIn(r,from,to,now),0));
}
function renderRecords() {
  const key=$('selected-day').value; if(!key)return;
  const [from,to]=rangeDay(key);
  const now=Date.now(), all=allRecords();
  renderGroupRows('day-group-totals', W.groupTotals(all,from,to,now,settings(),groupSettings()));
  $('day-group-total').textContent='全グループの実働合計：'+clock(all.reduce((n,r)=>n+W.workIn(r,from,to,now),0));
  const records=allRecords().filter(r=> W.workIn(r,from,to)>0 || (r.start>=from && r.start<to)).sort((a,b)=>b.start-a.start);
  const target=$('records');target.replaceChildren();
  if(!records.length){const e=document.createElement('p');e.className='empty';e.textContent='この日の記録はまだありません。';target.append(e);return;}
  records.forEach(r=>{
    const d=W.duration(r);const article=document.createElement('article');article.className='record';
    const head=document.createElement('div');head.className='record-head';
    const title=document.createElement('h3');title.textContent=categoryLabel(r.category)+(r.end===null?' ・計測中':'');
    const work=document.createElement('strong');work.textContent='実働 '+clock(W.workIn(r,from,to));head.append(title,work);
    const times=document.createElement('p');times.className='record-time';
    const crossesDay=r.end!==null && dateKey(new Date(r.start))!==dateKey(new Date(r.end));
    times.textContent=r.end===null ? `${timeOnly(r.start)}〜計測中` : crossesDay ? `${timestamp(r.start)}〜${timestamp(r.end)}` : `${timeOnly(r.start)}〜${timeOnly(r.end)}`;
    const detail=document.createElement('p');detail.className='muted';detail.textContent=`記録全体の実働時間：${clock(d.work)}`;
    const memo=document.createElement('p');memo.className='memo';memo.textContent=r.memo;
    article.append(head,times);if(crossesDay)article.append(detail);if(r.memo)article.append(memo);
    if(r.end!==null){
      const actions=document.createElement('div');actions.className='actions';const edit=document.createElement('button');edit.className='outline';edit.textContent='編集';edit.disabled=locked;edit.onclick=()=>openEdit(r);
      const del=document.createElement('button');del.className='danger';del.textContent='削除';del.disabled=locked;
      del.onclick=()=>{if(!confirm(`${timestamp(r.start)} の「${r.category}」を削除しますか？\n必要な記録は先にバックアップを保存してください。`))return;const next=copy();next.records=next.records.filter(x=>x.id!==r.id);if(next.pendingResultId===r.id)next.pendingResultId=null;if(save(next)){render();message('記録を削除しました。');}};
      actions.append(edit,del);article.append(actions);
    }
    target.append(article);
  });
}
function render() { renderTimer();renderResult();renderSummary();renderCalendar();renderMonthGroups();renderRecords();lastRender=Date.now(); }
let editSession = null;
function putWork(ms) {
  const seconds=Math.floor(ms/1000);
  $('edit-hours').value=String(Math.floor(seconds/3600));
  $('edit-minutes').value=String(Math.floor(seconds/60)%60);
  $('edit-seconds').value=String(seconds%60);
  editSession.displayed=[$('edit-hours').value,$('edit-minutes').value,$('edit-seconds').value].join(':');
  editSession.exactWork=ms;
}
function readWork() {
  const values=[$('edit-hours').value,$('edit-minutes').value,$('edit-seconds').value];
  const parts=values.map(Number);
  if(values.some(v=>v.trim()==='') || parts.some(n=>!Number.isSafeInteger(n)||n<0) || parts[1]>59 || parts[2]>59) throw new Error('実働時間は整数で入力してください。分・秒は0〜59です。');
  // 未編集の秒未満を保持し、短い過去記録を丸めて書き換えない。
  return !editSession.workTouched && values.join(':')===editSession.displayed ? editSession.exactWork : (parts[0]*3600+parts[1]*60+parts[2])*1000;
}
function updateEditTimes() {
  if(!editSession)return;
  const r=editSession.draft || state.records.find(r=>r.id===editSession.id);if(!r)return;
  $('edit-confirm').checked=false;
  editSession.dates=[$('edit-start').value,$('edit-end').value].join('|');
  try {
    const start=localInput(r.start)===$('edit-start').value?r.start:+new Date($('edit-start').value);
    const end=localInput(r.end)===$('edit-end').value?r.end:+new Date($('edit-end').value);
    const timing=W.editTiming(r,start,end);
    $('edit-confirm-label').hidden=!timing.needsManual;
    $('edit-calculation').textContent=timing.needsManual ? '停止時間を正確に再計算できません。実働時間を手動調整し、確認欄にチェックしてください。保存するまで記録は変わりません。' : '保存済みの計測区間から実働時間を計算しました。必要に応じて手動変更できます。';
    if(!timing.needsManual){putWork(timing.work);editSession.workTouched=false;}
  }catch(error){$('edit-calculation').textContent=error.message;}
}
function editSignature() {
  const fields=['edit-category','edit-start','edit-end','edit-hours','edit-minutes','edit-seconds','edit-memo'];
  let work;try{work=readWork();}catch{work='invalid';}
  return JSON.stringify({values:fields.map(id=>$(id).value),confirmed:!!$('edit-confirm').checked,work});
}
function requestCloseEdit() {
  if(editSession && editSignature()!==editSession.initialForm && !confirm('未保存の変更があります。変更を破棄して閉じますか？'))return;
  if(editSession?.source==='active' && editSession.wasRunning){
    const next=copy();
    if(next.active?.id===editSession.id && next.active.breaks.at(-1)?.end===null)next.active.breaks.at(-1).end=Date.now();
    if(!save(next))return;
  }
  $('edit-dialog').close();editSession=null;
  render();
}
function fillEdit(r, source='saved', wasRunning=false) {
  editSession={id:r.id,workTouched:false,source,wasRunning,draft:source==='active'?r:null};
  $('edit-title').textContent=source==='active'?'保存前に修正':'記録を編集';$('edit-submit').textContent=source==='active'?'修正して保存':'変更を保存';
  $('edit-id').value=r.id;$('edit-category').value=W.categoryId(r.category);$('edit-start').value=localInput(r.start);$('edit-end').value=localInput(r.end);putWork(W.duration(r).work);$('edit-memo').value=r.memo;$('edit-error').textContent='';$('edit-confirm').checked=false;$('edit-confirm-label').hidden=true;$('edit-calculation').textContent='実働時間は時間・分・秒で手動調整できます。';editSession.dates=[$('edit-start').value,$('edit-end').value].join('|');editSession.initialForm=editSignature();$('edit-dialog').scrollTop=0;$('edit-dialog').showModal();
}
function openEdit(r) { fillEdit(r); }
function openActiveEdit(){
  if(!state.active || state.exercise)return;
  const next=copy(), now=Date.now(), wasRunning=next.active.breaks.at(-1)?.end!==null;
  if(wasRunning)next.active.breaks.push({start:now,end:null});
  next.active.memo=$('memo').value;
  if(!save(next))return;
  const draft=JSON.parse(JSON.stringify(state.active));draft.end=now;
  if(draft.breaks.at(-1)?.end===null)draft.breaks.at(-1).end=now;
  fillEdit(draft,'active',wasRunning);
  render();
}

load();
function syncCategoryOptions() {
  const previous=$('category').value;
  for(const target of ['category','edit-category'])$(target).replaceChildren();
  const configured=[...settings()].sort((a,b)=>a.order-b.order);
  const known=new Set(configured.map(c=>c.id));
  const unknown=allRecords().map(r=>W.categoryId(r.category)).filter(id=>!known.has(id)).map((id,order)=>({id,label:id,hidden:true,order:configured.length+order}));
  for(const c of [...configured,...unknown]){
    for(const id of ['category','edit-category']){
      if(id==='category' && c.hidden)continue;
      const o=document.createElement('option');o.value=c.id;o.textContent=c.label;$(id).append(o);
    }
  }
  if([...configured,...unknown].some(c=>c.id===previous && !c.hidden))$('category').value=previous;
}
syncCategoryOptions();
$('month').value=dateKey(new Date()).slice(0,7);$('selected-day').value=dateKey(new Date());
if(state.active){$('category').value=W.categoryId(state.active.category);$('memo').value=state.active.memo;if(state.active.memo)$('memo-details').open=true;}
$('start').onclick=()=>{if(state.active || pendingResult())return;const next=copy(),category=$('category').value;next.active={id:W.uid(),category,group:groupOf(category),memo:$('memo').value,start:Date.now(),end:null,breaks:[]};if(save(next)){render();message('作業を開始しました。');}};
$('pause').onclick=()=>{if(state.exercise || !state.active || state.active.breaks.at(-1)?.end===null)return;const next=copy();next.active.breaks.push({start:Date.now(),end:null});if(save(next))render();};
$('resume').onclick=()=>{if(state.exercise || state.active?.breaks.at(-1)?.end!==null)return;const next=copy();next.active.breaks.at(-1).end=Date.now();if(save(next))render();};
$('memo').oninput=()=>{if(state.exercise || !state.active)return;const next=copy();next.active.memo=$('memo').value;save(next);};
$('stop').onclick=()=>{if(state.exercise || !state.active)return;const next=copy();const a=next.active;a.end=Date.now();a.memo=$('memo').value;if(a.breaks.at(-1)?.end===null)a.breaks.at(-1).end=a.end;next.records.push(a);next.active=null;next.pendingResultId=a.id;if(save(next)){$('memo').value='';$('memo-details').open=false;$('selected-day').value=dateKey(new Date(a.start));$('month').value=$('selected-day').value.slice(0,7);render();$('result-title').focus();message('作業を終了し、記録を保存しました。');}};
$('discard').onclick=()=>{if(!state.active || state.exercise)return;if(!confirm('現在の計測を保存せずに削除しますか？\nこの操作は元に戻せません。'))return;const next=copy();next.active=null;if(save(next)){$('memo').value='';$('memo-details').open=false;render();message('現在の計測を削除しました。');}};
$('modify').onclick=openActiveEdit;
$('exercise-finish').onclick=()=>{
  if(locked || !state.exercise)return;
  const next=copy(), now=Date.now(), exercise=next.exercise;
  exercise.record.end=now;
  next.records.push(exercise.record);
  if(exercise.resumeParent)next.active.breaks.at(-1).end=now;
  next.exercise=null;
  // 保存に成功するまでは、現在の停止状態を一切変更しない。
  if(save(next)){render();message(exercise.resumeParent ? '運動を保存し、元の作業を再開しました。' : '運動を保存しました。元の作業は一時停止中です。');}
};
$('result-close').onclick=()=>{if(!pendingResult())return;const next=copy();next.pendingResultId=null;if(save(next)){render();$('start').focus();message('次の作業を始められます。');}};
$('month').onchange=()=>{if($('month').value){$('selected-day').value=$('month').value+'-01';render();}};
$('selected-day').onchange=()=>{if($('selected-day').value){$('month').value=$('selected-day').value.slice(0,7);render();}};
$('edit-cancel').onclick=requestCloseEdit;
$('edit-close').onclick=requestCloseEdit;
$('edit-dialog').oncancel=event=>{event.preventDefault();requestCloseEdit();};
for(const id of ['edit-start','edit-end']) $(id).oninput=updateEditTimes;
for(const id of ['edit-hours','edit-minutes','edit-seconds']) $(id).oninput=()=>{if(editSession)editSession.workTouched=true;};
$('edit-form').onsubmit=e=>{
  e.preventDefault();if(!editSession)return;const next=copy();const isActive=editSession.source==='active';
  const r=isActive ? JSON.parse(JSON.stringify(editSession.draft)) : next.records.find(x=>x.id===$('edit-id').value);if(!r)return;
  try{
    if(editSession.dates!==[$('edit-start').value,$('edit-end').value].join('|'))updateEditTimes();
    const start=localInput(r.start)===$('edit-start').value?r.start:+new Date($('edit-start').value);
    const end=localInput(r.end)===$('edit-end').value?r.end:+new Date($('edit-end').value);
    const timing=W.editTiming(r,start,end);
    const datesChanged=start!==r.start || end!==r.end;
    const work=readWork();
    if(timing.needsManual && !$('edit-confirm').checked)throw new Error('停止時間を正確に再計算できません。実働時間を手動調整し、確認欄にチェックしてください。');
    if(!Number.isFinite(work)||work<0||work>end-start)throw new Error('実働時間は0以上、開始から終了までの経過時間以内で入力してください。');
    const workChanged=Math.abs(W.duration(r).work-work)>0.1;
    if(datesChanged || workChanged){
      r.start=start;r.end=end;
      if(!timing.needsManual && Math.abs(timing.work-work)<0.1){r.breaks=timing.breaks;if(timing.manualBreakMs!=null)r.manualBreakMs=timing.manualBreakMs;else delete r.manualBreakMs;}
      else {r.breaks=[];r.manualBreakMs=end-start-work;}
    }
    const oldCategory=W.categoryId(r.category);r.category=$('edit-category').value;r.memo=$('edit-memo').value;
    if(isActive || oldCategory!==r.category)r.group=groupOf(r.category);
    W.validateRecord(r);
    if(isActive){
      if(next.active?.id!==r.id)throw new Error('計測状態が変わりました。画面を閉じて再確認してください。');
      next.records.push(r);next.active=null;next.pendingResultId=r.id;
    }
    if(save(next)){$('edit-dialog').close();editSession=null;if(isActive){$('memo').value='';$('memo-details').open=false;$('selected-day').value=dateKey(new Date(r.start));$('month').value=$('selected-day').value.slice(0,7);}render();if(isActive)$('result-title').focus();message(isActive?'修正した記録を保存しました。':'記録の変更を保存しました。');}
  }catch(error){$('edit-error').textContent=error.message;}
};

function categoryStateCopy(){
  const next=copy();
  if(!next.categorySettings)next.categorySettings=W.defaultSettings();
  if(!next.groupSettings)next.groupSettings=W.defaultGroupSettings();
  // 設定変更前の分類を保存し、過去のグループ集計を固定する。
  next.records.forEach(r=>{if(!r.group)r.group=W.groupOf(r.category,next.categorySettings);});
  if(next.active && !next.active.group)next.active.group=W.groupOf(next.active.category,next.categorySettings);
  if(next.exercise?.record && !next.exercise.record.group)next.exercise.record.group=W.groupOf(next.exercise.record.category,next.categorySettings);
  return next;
}
function renderCategoryManager(){
  const target=$('category-list');target.replaceChildren();
  [...settings()].sort((a,b)=>a.order-b.order).forEach((c,index,list)=>{
    const row=document.createElement('div');row.className='manage-row';
    const info=document.createElement('div');const name=document.createElement('strong');name.textContent=c.label+(c.hidden?'（非表示）':'');
    const group=document.createElement('span');group.textContent=groupLabel(c.group);info.append(name,group);
    const actions=document.createElement('div');actions.className='manage-actions';
    const up=document.createElement('button');up.type='button';up.className='soft';up.textContent='上へ';up.disabled=index===0;
    const down=document.createElement('button');down.type='button';down.className='soft';down.textContent='下へ';down.disabled=index===list.length-1;
    const edit=document.createElement('button');edit.type='button';edit.className='outline';edit.textContent='編集';
    up.onclick=()=>moveCategory(c.id,-1);down.onclick=()=>moveCategory(c.id,1);edit.onclick=()=>openCategoryEdit(c.id);
    actions.append(up,down,edit);row.append(info,actions);target.append(row);
  });
}
function moveCategory(id,direction){
  const next=categoryStateCopy(), list=[...next.categorySettings].sort((a,b)=>a.order-b.order), index=list.findIndex(c=>c.id===id), other=index+direction;
  if(index<0 || other<0 || other>=list.length)return;
  [list[index],list[other]]=[list[other],list[index]];list.forEach((c,i)=>c.order=i);next.categorySettings=list;
  if(save(next)){syncCategoryOptions();renderCategoryManager();render();}
}
let categoryEditInitial='';
function openCategoryEdit(id=null){
  const c=id?settings().find(c=>c.id===id):null;
  syncGroupSelect('category-edit-group',c?.group||'その他');
  $('category-edit-title').textContent=c?'カテゴリを編集':'カテゴリを追加';$('category-edit-id').value=c?.id||'';$('category-edit-label').value=c?.label||'';$('category-edit-group').value=c?.group||'その他';$('category-edit-today').checked=c?.includeToday!==false;$('category-edit-hidden').checked=c?.hidden||false;$('category-edit-error').textContent='';
  categoryEditInitial=JSON.stringify([$('category-edit-label').value,$('category-edit-group').value,$('category-edit-today').checked,$('category-edit-hidden').checked]);$('category-edit-dialog').showModal();
}
function closeCategoryEdit(){
  const current=JSON.stringify([$('category-edit-label').value,$('category-edit-group').value,$('category-edit-today').checked,$('category-edit-hidden').checked]);
  if(current!==categoryEditInitial && !confirm('未保存の変更があります。変更を破棄して閉じますか？'))return;
  $('category-edit-dialog').close();
}
$('manage-categories').onclick=()=>{renderCategoryManager();$('category-dialog').showModal();};
$('category-close').onclick=()=>$('category-dialog').close();
$('category-dialog').oncancel=e=>{e.preventDefault();$('category-dialog').close();};
$('category-add').onclick=()=>openCategoryEdit();
$('category-edit-close').onclick=closeCategoryEdit;$('category-edit-cancel').onclick=closeCategoryEdit;
$('category-edit-dialog').oncancel=e=>{e.preventDefault();closeCategoryEdit();};
$('category-edit-form').onsubmit=e=>{
  e.preventDefault();try{
    const next=categoryStateCopy(), id=$('category-edit-id').value, label=$('category-edit-label').value.trim();
    if(!label)throw new Error('カテゴリ名を入力してください。');
    if(next.categorySettings.some(c=>c.label===label && c.id!==id))throw new Error('同じカテゴリ名がすでにあります。');
    if(id){const c=next.categorySettings.find(c=>c.id===id);if(!c)throw new Error('カテゴリが見つかりません。');c.label=label;c.group=$('category-edit-group').value;c.includeToday=$('category-edit-today').checked;c.hidden=$('category-edit-hidden').checked;}
    else next.categorySettings.push({id:'custom-'+W.uid(),label,group:$('category-edit-group').value,includeToday:$('category-edit-today').checked,hidden:$('category-edit-hidden').checked,order:next.categorySettings.length});
    if(save(next)){$('category-edit-dialog').close();syncCategoryOptions();renderCategoryManager();render();message('カテゴリ設定を保存しました。');}
  }catch(error){$('category-edit-error').textContent=error.message;}
};

function syncGroupSelect(targetId,current='その他',exclude=null){
  const target=$(targetId);target.replaceChildren();
  [...groupSettings()].sort((a,b)=>a.order-b.order).filter(g=>g.id!==exclude && (!g.hidden || g.id===current || targetId==='group-delete-target')).forEach(g=>{
    const option=document.createElement('option');option.value=g.id;option.textContent=g.label+(g.hidden?'（非表示）':'');target.append(option);
  });
  if(groupSettings().some(g=>g.id===current && g.id!==exclude))target.value=current;
}
function renderGroupManager(){
  const target=$('group-list');target.replaceChildren();
  [...groupSettings()].sort((a,b)=>a.order-b.order).forEach((g,index,list)=>{
    const row=document.createElement('div');row.className='manage-row'+(g.hidden?' is-hidden':'');
    const info=document.createElement('div');const name=document.createElement('strong');name.textContent=g.label+(g.hidden?'（非表示）':'');
    const count=document.createElement('span');count.textContent=`所属カテゴリ ${settings().filter(c=>c.group===g.id).length}件`;info.append(name,count);
    const actions=document.createElement('div');actions.className='manage-actions';
    const up=document.createElement('button');up.type='button';up.className='soft';up.textContent='上へ';up.disabled=index===0;
    const down=document.createElement('button');down.type='button';down.className='soft';down.textContent='下へ';down.disabled=index===list.length-1;
    const edit=document.createElement('button');edit.type='button';edit.className='outline';edit.textContent='編集';
    up.onclick=()=>moveGroup(g.id,-1);down.onclick=()=>moveGroup(g.id,1);edit.onclick=()=>openGroupEdit(g.id);
    actions.append(up,down,edit);row.append(info,actions);target.append(row);
  });
}
function moveGroup(id,direction){
  const next=categoryStateCopy(),list=[...next.groupSettings].sort((a,b)=>a.order-b.order),index=list.findIndex(g=>g.id===id),other=index+direction;
  if(index<0 || other<0 || other>=list.length)return;
  [list[index],list[other]]=[list[other],list[index]];list.forEach((g,i)=>g.order=i);next.groupSettings=list;
  if(save(next)){renderGroupManager();render();}
}
let groupEditInitial='';
function openGroupEdit(id=null){
  const g=id?groupSettings().find(g=>g.id===id):null,isOther=id==='その他';
  $('group-edit-title').textContent=g?'活動グループを編集':'活動グループを追加';$('group-edit-id').value=g?.id||'';$('group-edit-label').value=g?.label||'';$('group-edit-hidden').checked=g?.hidden||false;$('group-edit-hidden').disabled=isOther;$('group-edit-hidden-label').hidden=isOther;$('group-delete').hidden=!g||isOther;$('group-edit-error').textContent='';
  groupEditInitial=JSON.stringify([$('group-edit-label').value,$('group-edit-hidden').checked]);$('group-edit-dialog').showModal();
}
function closeGroupEdit(){
  const current=JSON.stringify([$('group-edit-label').value,$('group-edit-hidden').checked]);
  if(current!==groupEditInitial && !confirm('未保存の変更があります。変更を破棄して閉じますか？'))return;
  $('group-edit-dialog').close();
}
$('manage-groups').onclick=()=>{renderGroupManager();$('group-dialog').showModal();};
$('group-close').onclick=()=>$('group-dialog').close();$('group-dialog').oncancel=e=>{e.preventDefault();$('group-dialog').close();};
$('group-add').onclick=()=>openGroupEdit();$('group-edit-close').onclick=closeGroupEdit;$('group-edit-cancel').onclick=closeGroupEdit;$('group-edit-dialog').oncancel=e=>{e.preventDefault();closeGroupEdit();};
$('group-edit-form').onsubmit=e=>{
  e.preventDefault();try{
    const next=categoryStateCopy(),id=$('group-edit-id').value,label=$('group-edit-label').value.trim();
    if(!label)throw new Error('活動グループ名を入力してください。');
    if(next.groupSettings.some(g=>g.label===label && g.id!==id))throw new Error('同じ活動グループ名がすでにあります。');
    if(id){const g=next.groupSettings.find(g=>g.id===id);if(!g)throw new Error('活動グループが見つかりません。');g.label=label;g.hidden=id==='その他'?false:$('group-edit-hidden').checked;}
    else next.groupSettings.push({id:'group-'+W.uid(),label,hidden:$('group-edit-hidden').checked,order:next.groupSettings.length});
    if(save(next)){$('group-edit-dialog').close();renderGroupManager();renderCategoryManager();render();message('活動グループ設定を保存しました。');}
  }catch(error){$('group-edit-error').textContent=error.message;}
};
let pendingGroupDeleteId=null;
function groupUsage(next,id){
  const records=[...next.records,...(next.active?[next.active]:[]),...(next.exercise?[next.exercise.record]:[])];
  return {categories:next.categorySettings.filter(c=>c.group===id).length,records:records.filter(r=>r.group===id).length};
}
$('group-delete').onclick=()=>{
  const id=$('group-edit-id').value;if(!id||id==='その他')return;
  const next=categoryStateCopy(),g=next.groupSettings.find(g=>g.id===id);if(!g)return;
  const usage=groupUsage(next,id);
  if(!usage.categories&&!usage.records){
    if(!confirm(`「${g.label}」を完全に削除しますか？`))return;
    next.groupSettings=next.groupSettings.filter(x=>x.id!==id);next.groupSettings.sort((a,b)=>a.order-b.order).forEach((x,i)=>x.order=i);
    if(save(next)){$('group-edit-dialog').close();renderGroupManager();render();message('活動グループを削除しました。');}return;
  }
  pendingGroupDeleteId=id;$('group-delete-summary').textContent=`「${g.label}」は使用中です。\n所属カテゴリ：${usage.categories}件 ／ 記録：${usage.records}件`;
  syncGroupSelect('group-delete-target','その他',id);$('group-delete-error').textContent='';$('group-edit-dialog').close();$('group-delete-dialog').showModal();
};
function closeGroupDelete(){$('group-delete-dialog').close();pendingGroupDeleteId=null;}
$('group-delete-close').onclick=closeGroupDelete;$('group-delete-cancel').onclick=closeGroupDelete;$('group-delete-dialog').oncancel=e=>{e.preventDefault();closeGroupDelete();};
$('group-delete-confirm').onclick=()=>{
  try{
    const id=pendingGroupDeleteId,target=$('group-delete-target').value,next=categoryStateCopy(),g=next.groupSettings.find(g=>g.id===id),replacement=next.groupSettings.find(g=>g.id===target);
    if(!g||!replacement||id===target)throw new Error('移動先の活動グループを選んでください。');
    if(!confirm(`「${g.label}」のカテゴリと記録を「${replacement.label}」へ移動し、元のグループを削除しますか？\nこの操作前にJSONバックアップを保存してください。`))return;
    next.categorySettings.forEach(c=>{if(c.group===id)c.group=target;});next.records.forEach(r=>{if(r.group===id)r.group=target;});if(next.active?.group===id)next.active.group=target;if(next.exercise?.record.group===id)next.exercise.record.group=target;
    next.groupSettings=next.groupSettings.filter(x=>x.id!==id);next.groupSettings.sort((a,b)=>a.order-b.order).forEach((x,i)=>x.order=i);
    if(save(next)){closeGroupDelete();syncCategoryOptions();renderGroupManager();renderCategoryManager();render();message('カテゴリと記録を移動し、活動グループを削除しました。');}
  }catch(error){$('group-delete-error').textContent=error.message;}
};

function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{download(locked && raw ? raw : JSON.stringify(state,null,2),`worktimer-backup-${dateKey(new Date())}-${Date.now()}.json`);message('バックアップの保存を開始しました。ブラウザのダウンロード先を確認してください。');};
$('import-button').onclick=()=>$('import').click();
$('import').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(pendingResult()){message('結果の「確認して閉じる」を押してから復元してください。');e.target.value='';return;}
  try{
    if(file.size>20*1024*1024)throw new Error('ファイルが大きすぎます（上限20MB）。');
    const incoming=W.validateState(JSON.parse(await file.text()));const result=W.merge(state,incoming);
    if(!confirm(`${result.added}件の記録を追加します。\n競合：${result.conflicts}件（現在の記録を優先して保持します）。\n計測中の情報は、現在計測がない場合のみ引き継ぎます。\n元のバックアップファイルは保管してください。復元しますか？`))return;
    if(save(result.state)){syncCategoryOptions();if(state.active){$('category').value=W.categoryId(state.active.category);$('memo').value=state.active.memo;if(state.active.memo)$('memo-details').open=true;}render();message(`${result.added}件の記録を復元しました。競合${result.conflicts}件は現在の記録を保持しました。`);}
  }catch(error){message('復元できませんでした。既存の記録は変更していません。\n'+error.message,true);}finally{e.target.value='';}
};
window.addEventListener('storage',e=>{if(e.key===KEY){locked=true;render();message('別の画面でデータが変更されました。上書きを防ぐため操作を停止しました。この画面を再読み込みしてください。',true);}});
setInterval(()=>{renderTimer();if(Date.now()-lastRender>=10000)render();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
render();
