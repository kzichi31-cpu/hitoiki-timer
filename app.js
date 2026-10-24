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
  $('result-category').textContent = W.categoryLabel(r.category);
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
  $('timer-details').textContent = a ? (exercise ? `${timestamp(a.start)} 運動開始 ／ 元の作業「${W.categoryLabel(state.active.category)}」は一時停止中（実働 ${clock(W.duration(state.active).work)}）` : `${timestamp(a.start)} 開始`) : 'カテゴリを選んで、はじめましょう。';
  $('start').hidden = !!a; $('pause').hidden = !a || paused || !!exercise; $('resume').hidden = !paused || !!exercise; $('stop').hidden = !a || !!exercise;
  $('exercise-start').hidden = !state.active || !!exercise;
  $('exercise-finish').hidden = !exercise;
  $('category').disabled = !!a || locked;
  for (const id of ['start','pause','resume','stop','memo','import-button','exercise-start','exercise-finish']) $(id).disabled = locked;
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
    const records=allRecords().filter(r => W.workIn(r,from,to)>0 || (r.start>=from && r.start<to));
    const button=document.createElement('button'); button.type='button'; button.className='day';
    if(key===$('selected-day').value) button.classList.add('selected');
    if(key===dateKey(new Date())) button.classList.add('today');
    button.setAttribute('aria-pressed', String(key===$('selected-day').value));
    const total=sum(from,to); button.setAttribute('aria-label',`${m}月${day}日 ${hours(total)} ${records.length}回`);
    button.append(String(day));
    const value=document.createElement('span'); value.textContent=total>0 ? hours(total).replace('時間','h ').replace('分','m') : '—';
    const count=document.createElement('span'); count.textContent=records.length ? `${records.length}回` : '　'; button.append(value,count);
    button.onclick=()=>{ $('selected-day').value=key; renderCalendar(); renderRecords(); };
    calendar.append(button);
  }
  $('category-period').textContent=`${y}年${m}月の実働時間（計測中も含む）`;
  const categoryIds = [...new Set([...W.categories, ...allRecords().map(r => W.categoryId(r.category))])];
  const totals=categoryIds.map(category=>({category,value:sum(+start,+end,category)})).sort((a,b)=>b.value-a.value);
  const max=totals[0].value;
  $('category-totals').replaceChildren();
  totals.forEach(t=>{
    const row=document.createElement('div'); row.className='category-row';
    const line=document.createElement('div'); line.className='category-line';
    const label=document.createElement('span');label.textContent=W.categoryLabel(t.category);
    const value=document.createElement('span');value.textContent=hours(t.value);
    const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=`${max?t.value/max*100:0}%`;
    line.append(label,value);bar.append(fill);row.append(line,bar);$('category-totals').append(row);
  });
}
function renderGroupRows(targetId, totals) {
  const target = $(targetId); target.replaceChildren();
  W.groups.forEach(group => {
    const row = document.createElement('div'); row.className = 'group-stat';
    const label = document.createElement('span'); label.textContent = group;
    const value = document.createElement('strong'); value.textContent = clock(totals[group]);
    row.append(label, value); target.append(row);
  });
}
function renderMonthGroups() {
  const [y,m] = $('month').value.split('-').map(Number); if(!y || !m) return;
  const from = +new Date(y,m-1,1), to = +new Date(y,m,1);
  const now = Date.now(), records = allRecords();
  renderGroupRows('month-group-totals', W.groupTotals(records,from,to,now));
  $('group-period').textContent = `${y}年${m}月`;
  $('month-group-total').textContent = '全グループの実働合計：' + clock(records.reduce((n,r)=>n+W.workIn(r,from,to,now),0));
}
function renderRecords() {
  const key=$('selected-day').value; if(!key)return;
  const [from,to]=rangeDay(key);
  const now=Date.now(), all=allRecords();
  renderGroupRows('day-group-totals', W.groupTotals(all,from,to,now));
  $('day-group-total').textContent='全グループの実働合計：'+clock(all.reduce((n,r)=>n+W.workIn(r,from,to,now),0));
  const records=allRecords().filter(r=> W.workIn(r,from,to)>0 || (r.start>=from && r.start<to)).sort((a,b)=>b.start-a.start);
  const target=$('records');target.replaceChildren();
  if(!records.length){const e=document.createElement('p');e.className='empty';e.textContent='この日の記録はまだありません。';target.append(e);return;}
  records.forEach(r=>{
    const d=W.duration(r);const article=document.createElement('article');article.className='record';
    const head=document.createElement('div');head.className='record-head';
    const title=document.createElement('h3');title.textContent=W.categoryLabel(r.category)+(r.end===null?' ・計測中':'');
    const work=document.createElement('strong');work.textContent='当日の実働 '+clock(W.workIn(r,from,to));head.append(title,work);
    const times=document.createElement('p');times.className='muted';times.textContent=`開始 ${timestamp(r.start)} ／ 終了 ${r.end===null?'計測中':timestamp(r.end)}`;
    const detail=document.createElement('p');detail.className='muted';detail.textContent=`記録全体の実働時間：${clock(d.work)}`;
    const memo=document.createElement('p');memo.className='memo';memo.textContent=r.memo;
    article.append(head,times,detail,memo);
    if(r.end!==null){
      const actions=document.createElement('div');actions.className='actions';const edit=document.createElement('button');edit.className='outline';edit.textContent='編集';edit.disabled=locked;edit.onclick=()=>openEdit(r);
      const del=document.createElement('button');del.className='danger';del.textContent='削除';del.disabled=locked || r.id===state.pendingResultId;
      del.onclick=()=>{if(r.id===state.pendingResultId)return;if(!confirm(`${timestamp(r.start)} の「${r.category}」を削除しますか？\n必要な記録は先にバックアップを保存してください。`))return;const next=copy();next.records=next.records.filter(x=>x.id!==r.id);if(save(next)){render();message('記録を削除しました。');}};
      actions.append(edit,del);article.append(actions);
    }
    target.append(article);
  });
}
function render() { renderTimer();renderResult();renderSummary();renderCalendar();renderMonthGroups();renderRecords();lastRender=Date.now(); }
function openEdit(r) {
  $('edit-id').value=r.id;$('edit-category').value=W.categoryId(r.category);$('edit-start').value=localInput(r.start);$('edit-end').value=localInput(r.end);$('edit-work').value=String(W.duration(r).work/60000);$('edit-memo').value=r.memo;$('edit-error').textContent='';$('edit-dialog').showModal();
}
load();
const availableCategories = new Set();
function syncCategoryOptions() {
  const categoryIds = [...W.categories,...allRecords().map(r=>W.categoryId(r.category))];
  categoryIds.forEach(c => {
    if (availableCategories.has(c)) return;
    for (const id of ['category','edit-category']) {
      const o=document.createElement('option');o.value=c;o.textContent=W.categoryLabel(c);$(id).append(o);
    }
    availableCategories.add(c);
  });
}
syncCategoryOptions();
$('month').value=dateKey(new Date()).slice(0,7);$('selected-day').value=dateKey(new Date());
if(state.active){$('category').value=W.categoryId(state.active.category);$('memo').value=state.active.memo;}
$('start').onclick=()=>{if(state.active || pendingResult())return;const next=copy();next.active={id:W.uid(),category:$('category').value,memo:$('memo').value,start:Date.now(),end:null,breaks:[]};if(save(next)){render();message('作業を開始しました。');}};
$('pause').onclick=()=>{if(state.exercise || !state.active || state.active.breaks.at(-1)?.end===null)return;const next=copy();next.active.breaks.push({start:Date.now(),end:null});if(save(next))render();};
$('resume').onclick=()=>{if(state.exercise || state.active?.breaks.at(-1)?.end!==null)return;const next=copy();next.active.breaks.at(-1).end=Date.now();if(save(next))render();};
$('memo').oninput=()=>{if(state.exercise || !state.active)return;const next=copy();next.active.memo=$('memo').value;save(next);};
$('stop').onclick=()=>{if(state.exercise || !state.active)return;const next=copy();const a=next.active;a.end=Date.now();a.memo=$('memo').value;if(a.breaks.at(-1)?.end===null)a.breaks.at(-1).end=a.end;next.records.push(a);next.active=null;next.pendingResultId=a.id;if(save(next)){$('memo').value='';$('selected-day').value=dateKey(new Date(a.start));$('month').value=$('selected-day').value.slice(0,7);render();$('result-title').focus();message('作業を終了し、記録を保存しました。');}};
// 元の作業の停止と運動の開始を、同じ保存処理で確定する。
$('exercise-start').onclick=()=>{
  if(locked || !state.active || state.exercise || pendingResult())return;
  const next=copy(), now=Date.now();
  const resumeParent=next.active.breaks.at(-1)?.end!==null;
  if(resumeParent)next.active.breaks.push({start:now,end:null});
  next.active.memo=$('memo').value;
  next.exercise={resumeParent,record:{id:W.uid(),category:'ストレッチ',memo:'',start:now,end:null,breaks:[]}};
  if(save(next)){render();message('運動を開始しました。元の作業は一時停止しています。');}
};
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
$('edit-cancel').onclick=()=>$('edit-dialog').close();
$('edit-form').onsubmit=e=>{
  e.preventDefault();const next=copy();const r=next.records.find(x=>x.id===$('edit-id').value);if(!r)return;
  try{
    const start=+new Date($('edit-start').value),end=+new Date($('edit-end').value),work=Number($('edit-work').value)*60000;
    if(!Number.isFinite(work)||work<0||work>end-start)throw new Error('実働時間は0以上、開始から終了までの経過時間以内で入力してください。');
    // 秒未満を含む元時刻は、入力に変更がなければ保持する。
    if(localInput(r.start)!==$('edit-start').value || localInput(r.end)!==$('edit-end').value || Math.abs(W.duration(r).work-work)>0.1){r.start=start;r.end=end;r.breaks=[];r.manualBreakMs=end-start-work;}
    r.category=$('edit-category').value;r.memo=$('edit-memo').value;W.validateRecord(r);
    if(save(next)){$('edit-dialog').close();render();message('記録の変更を保存しました。');}
  }catch(error){$('edit-error').textContent=error.message;}
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
    if(save(result.state)){syncCategoryOptions();if(state.active){$('category').value=W.categoryId(state.active.category);$('memo').value=state.active.memo;}render();message(`${result.added}件の記録を復元しました。競合${result.conflicts}件は現在の記録を保持しました。`);}
  }catch(error){message('復元できませんでした。既存の記録は変更していません。\n'+error.message,true);}finally{e.target.value='';}
};
window.addEventListener('storage',e=>{if(e.key===KEY){locked=true;render();message('別の画面でデータが変更されました。上書きを防ぐため操作を停止しました。この画面を再読み込みしてください。',true);}});
setInterval(()=>{renderTimer();if(Date.now()-lastRender>=10000)render();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
render();
