// Local presentation choices never replace upstream project identities or event times.
let decorPreview = null;
function plantName(project) { return project?.customName || project?.name || ''; }
function pencilButton(action, attributes = '', label = ui('编辑名称','Edit name')) {
  return `<button type="button" class="pencil-button" data-action="${action}" ${attributes} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15z"/></svg></button>`;
}
function renamePlantModal(projectId) {
  const project = projectById(projectId); if (!project) return;
  openModal(`<div class="modal__heading rename-heading"><h2 data-current-plant-name data-user-content>${escapeHtml(plantName(project))}</h2><button class="icon-button" data-action="close-modal" aria-label="${ui('关闭','Close')}">${icon('close')}</button></div>
    <dl class="rename-current-info"><div><dt>${ui('Codex 项目名：','Codex project name:')}</dt><dd data-codex-project-name data-user-content>${escapeHtml(project.codexProjectId || project.syncProjectKey ? project.name : ui('未关联 Codex 项目','Not linked to a Codex project'))}</dd></div></dl>
    <form id="rename-plant-form" class="form-stack" data-project-id="${escapeHtml(project.id)}"><label>${ui('更改为：','Change to:')}<input name="plantName" maxlength="80" required value="${escapeHtml(plantName(project))}" aria-describedby="rename-description rename-error" /></label><p id="rename-description" class="form-note rename-info-note">${icon('info')}<span>${ui('只会更改园内植物名称，不会更改Codex项目文件夹。','This only changes the plant’s name in the garden. Your Codex project folder will not be renamed.')}</span></p><div id="rename-error" class="form-error" role="alert"></div><div class="modal__footer"><button type="button" class="text-button" data-action="close-modal">${ui('取消','Cancel')}</button><button class="button button--dark" type="submit">${ui('保存','Save')}</button></div></form>`);
  modalRoot.querySelector('input').select();
}
function submitPlantName(form) {
  const project = projectById(form.dataset.projectId); if (!project) return;
  const name = form.elements.plantName.value.trim(), previous = project.customName;
  if (!name || name.length > 80) { form.querySelector('[role="alert"]').textContent=ui('请输入 1–80 个字。','Enter 1–80 characters.'); return; }
  project.customName = name;
  try { saveState(); closeModal(); render(); }
  catch { if (previous === undefined) delete project.customName; else project.customName = previous; form.querySelector('[role="alert"]').textContent=ui('保存失败，请重试。','Could not save. Please retry.'); }
}
function calendarDay(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function stageDateEditor(control) {
  const project = projectById(control.dataset.projectId), key = control.dataset.stage;
  if (!project) return;
  const previousForm=modalRoot.querySelector('#journal-date-form');
  if(previousForm){ previousForm.remove(); render(); control=modalRoot.querySelector(`[data-action="edit-journal-date"][data-stage="${key}"]`); }
  const entry = key === 'seed' ? {at:project.projectCreatedAt || (!project.codexProjectId && !project.syncProjectKey ? project.createdAt : null)} : key === 'seedling' ? {at:project.seedlingUnlockedAt} : project.growthUnlocks?.find(e=>String(e.stage)===key);
  const at = project.journalDates?.[key]?.date || entry?.achievedAt || entry?.at || entry?.observedAt;
  const container = control.closest('.journal-date-line');
  container.innerHTML = `<form id="journal-date-form" class="journal-date-editor" data-project-id="${escapeHtml(project.id)}" data-stage="${escapeHtml(key)}"><label>${ui('日期','Date')}<input name="stageDate" type="date" value="${GardenHistory.validDate(at)?calendarDay(at):''}" max="${calendarDay()}" required aria-describedby="journal-edit-error" /></label><button class="text-button" type="submit">${ui('保存','Save')}</button><button class="text-button" type="button" data-action="cancel-date-edit">${ui('取消','Cancel')}</button><small id="journal-edit-error" role="alert"></small></form>`;
  const input = container.querySelector('input'); input.focus();
  try { input.showPicker(); } catch { /* Native picker can also be opened with its calendar button. */ }
}
function submitJournalDate(form) {
  const project = projectById(form.dataset.projectId); if (!project) return;
  const key = form.dataset.stage, date = form.elements.stageDate.value;
  if (!['seed','seedling',...GardenHistory.unlocked(project,hasUnlockedPlant(project)?stageFor(project):-1).map(e=>String(e.stage))].includes(key)) return;
  const error = form.querySelector('[role="alert"]');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !GardenHistory.validDate(date) || new Date(date).toISOString().slice(0,10)!==date || date>calendarDay()) { error.textContent=ui('请选择今天或之前的日期。','Choose today or an earlier date.'); return; }
  const previous = project.journalDates;
  project.journalDates = {...previous,[key]:{date,editedAt:new Date().toISOString()}};
  try { saveState(); form.remove(); render(); focusJournalDate(key); }
  catch { if (previous === undefined) delete project.journalDates; else project.journalDates=previous; error.textContent=ui('保存失败，请重试。','Could not save. Please retry.'); }
}
function focusJournalDate(key) { modalRoot.querySelector(`[data-action="edit-journal-date"][data-stage="${key}"]`)?.focus({preventScroll:true}); }
function activityHistoryMarkup(projectId) {
  const items=state.activities.filter(e=>e.projectId===projectId).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  const format=at=>GardenHistory.validDate(at)?new Intl.DateTimeFormat(state.language==='en'?'en-CA':'zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(at)):ui('时间未记录','Time not recorded');
  return `<p class="activity-history-count">${ui('共 '+items.length+' 条 · 按本机时区显示',items.length+' records · local time')}</p><ol class="activity-history-list">${items.map(e=>`<li class="activity-history-entry"><span class="activity-row__mark activity-row__mark--${escapeHtml(e.type)}" aria-hidden="true"></span><div><p data-user-content>${escapeHtml(activityDisplayTitle(e))}</p><time datetime="${escapeHtml(e.at)}">${format(e.at)}</time>${e.receivedAt && Date.parse(e.receivedAt)-Date.parse(e.at)>60000?`<small>${ui('同步时间：','Synced: ')}<time datetime="${escapeHtml(e.receivedAt)}">${format(e.receivedAt)}</time></small>`:''}</div></li>`).join('')}</ol>${items.length?'':`<p class="form-note">${ui('还没有记录，项目有进展后会显示在这里。','No records yet. Project activity will appear here.')}</p>`}`;
}
function activityHistoryModal(projectId=activeProject()?.id) {
  const project=projectById(projectId);if(!project)return;
  openModal(`<div class="modal__heading"><div><p class="eyebrow">PROJECT ACTIVITY</p><h2>${ui('全部记录','All activity')}</h2><p data-user-content>${escapeHtml(plantName(project))}</p></div><button class="icon-button" data-action="close-modal" aria-label="${ui('关闭','Close')}">${icon('close')}</button></div><div data-activity-history="${escapeHtml(project.id)}">${activityHistoryMarkup(project.id)}</div><div class="modal__footer"><span></span><button class="button button--dark" data-action="close-modal">${ui('返回温室','Back to garden')}</button></div>`);
}
function previewDecoration(id) {
  const item=decorationFor(id); if(!item || item.pendingArt || !['shelf','prop'].includes(item.slot))return;
  decorPreview={...decorPreview,[item.slot]:id}; closeModal(); render();
}
function decorationPreviewBanner() {
  if (!decorPreview) return '';
  const names=Object.values(decorPreview).map(id=>{const name=decorationFor(id).name;return state.language==='en'?GardenI18n.translate(name):name;}).join(' + ');
  return `<div class="decor-preview-banner" role="status"><span>${ui('预览','Preview')} · ${names}<small>${ui('不消耗灵感','No inspiration spent')}</small></span><button class="text-button" data-action="show-decor">${ui('换一个','Try another')}</button><button class="button button--dark" data-action="end-decor-preview">${ui('结束预览','End preview')}</button></div>`;
}
