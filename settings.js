const startupPreference = { enabled: false, supported: false, loaded: false, busy: false, error: false };
function startupControlMarkup() {
  return `<div class="startup-control"><span id="startup-label">${ui('随 Codex 启动','Launch with Codex')}</span><button type="button" id="codex-startup" class="startup-toggle" role="switch" aria-labelledby="startup-label" aria-checked="${startupPreference.enabled}" data-action="toggle-startup" disabled><span aria-hidden="true"></span></button><button type="button" class="startup-help" data-action="show-startup-help" aria-label="${ui('关于随 Codex 启动','About launch with Codex')}">?</button><span class="startup-status" data-startup-status role="status" aria-live="polite"></span></div>`;
}
function updateStartupControl() {
  const toggle = document.querySelector('#codex-startup');
  if (!toggle) return;
  toggle.setAttribute('aria-checked', String(startupPreference.enabled));
  toggle.disabled = startupPreference.busy || !startupPreference.loaded || !startupPreference.supported || startupPreference.error;
  toggle.setAttribute('aria-busy', String(startupPreference.busy));
  const message = startupPreference.error ? ui('无法确认启动设置，请点问号重试。','Could not confirm startup settings. Use the help button to retry.')
    : startupPreference.busy ? ui('正在读取或保存启动设置…','Reading or saving startup settings…')
    : !startupPreference.supported ? ui('请在 Windows 桌面版中设置。','Use the Windows desktop app to change this setting.')
    : startupPreference.enabled ? ui('随 Codex 启动已开启。','Launch with Codex is enabled.') : ui('随 Codex 启动已关闭。','Launch with Codex is disabled.');
  toggle.title = message;
  document.querySelector('[data-startup-status]').textContent = message;
  document.querySelector('.startup-control').classList.toggle('has-error', startupPreference.error);
}
async function refreshStartupControl(force = false) {
  updateStartupControl();
  if (startupPreference.busy || (startupPreference.loaded && !force)) return;
  startupPreference.busy = true;
  updateStartupControl();
  try {
    const result = await window.projectGardenDesktop?.getCompanionStatus?.();
    startupPreference.enabled = Boolean(result?.enabled);
    startupPreference.supported = Boolean(result?.supported);
    startupPreference.error = false;
  } catch { startupPreference.error = true; }
  finally { startupPreference.loaded = true; startupPreference.busy = false; updateStartupControl(); }
}
async function toggleStartupPreference() {
  if (startupPreference.busy || !startupPreference.supported || startupPreference.error) return;
  startupPreference.busy = true;
  updateStartupControl();
  try {
    const result = await window.projectGardenDesktop.setCompanionEnabled(!startupPreference.enabled);
    startupPreference.enabled = Boolean(result.enabled);
    startupPreference.supported = Boolean(result.supported);
  } catch { startupPreference.error = true; }
  finally {
    startupPreference.busy = false;
    updateStartupControl();
    if (startupPreference.error) startupHelpModal();
    else document.querySelector('#codex-startup')?.focus({ preventScroll: true });
  }
}
function startupHelpModal() {
  openModal(`<div class="modal__heading"><div><p class="eyebrow">PROJECT GARDEN</p><h2>${ui('随 Codex 启动','Launch with Codex')}</h2></div><button type="button" class="icon-button" data-action="close-modal" aria-label="${ui('关闭','Close')}">${icon('close')}</button></div><div class="startup-description"><p>${ui('开启后，打开 Codex 桌面窗口时会自动打开项目园。','When enabled, opening a Codex desktop window automatically opens Project Garden.')}</p><p>${ui('手动关闭项目园后，它会等到下次打开 Codex 再启动。关闭开关后，你仍可通过桌面快捷方式打开项目园。','If you close the garden yourself, it waits until you next open Codex. With the switch off, you can still open the garden from its desktop shortcut.')}</p><p>${ui('新安装默认关闭；此设置仅影响这台电脑，不影响植物和存档。','Off by default on a fresh install. This setting applies only to this computer and does not change your plants or saves.')}</p>${startupPreference.error ? `<p role="alert">${ui('无法确认当前设置。检查是否另有一份项目园管理启动设置后，再试一次。','Could not confirm the current setting. Check whether another installation manages startup, then try again.')}</p><button type="button" class="button button--dark" data-action="retry-startup">${ui('重新读取','Retry')}</button>` : ''}</div>`);
}
