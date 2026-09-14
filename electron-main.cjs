const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createGardenBridge } = require('./garden-bridge.cjs');
const { floatingMenuTemplate } = require('./floating-menu.cjs');
const { createGardenStateStore } = require('./garden-state-store.cjs');
const { preferredDisplay, fitBounds } = require('./display-placement.cjs');
const { creationDates } = require('./project-metadata.cjs');
const { readStageEvidence } = require('./garden-history-evidence.cjs');
const { createCompanionSettings } = require('./companion-settings.cjs');
const companionSettings = createCompanionSettings({ root: __dirname, testData: process.env.PROJECT_GARDEN_TEST_DATA });

app.setName('project-garden-desktop');

let bridge;
let gardenStore;
let stageEvidence=[];
let activeWindow;
let windowTransition;
let fullBounds;
let petBounds;
const pendingProgress = new Map();

// This local-first companion does not need GPU rendering. Disabling it keeps the
// app usable on Windows installations without a compatible GPU helper runtime.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');

// Pin the same profile for the desktop shortcut, direct launch and companion.
app.setPath('userData', process.env.PROJECT_GARDEN_TEST_DATA || path.join(app.getPath('appData'), 'project-garden-desktop'));
app.setAppUserModelId('ProjectGarden.Desktop');

// Automatic and manual launches must share one bridge and one data writer.
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
app.on('second-instance', (_event, commandLine) => {
  if (commandLine.includes('--codex-autostart')) return;
  const window = activeWindow;
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

function defaultPetBounds() {
  return fitBounds(gardenDisplay().workArea, true);
}

function gardenDisplay() { return preferredDisplay(screen.getAllDisplays(), screen.getPrimaryDisplay().id); }
function presentWindow(window) {
  if (process.env.PROJECT_GARDEN_TEST_HIDDEN === '1') return;
  // Do not steal focus from a game on the primary display.
  window.showInactive();
}

const createWindow = (compact = false) => {
  const window = new BrowserWindow({
    ...fitBounds(gardenDisplay().workArea, compact, compact ? petBounds : fullBounds),
    minWidth: compact ? 320 : Math.min(640, gardenDisplay().workArea.width),
    minHeight: compact ? 340 : Math.min(580, gardenDisplay().workArea.height),
    frame: !compact,
    transparent: compact,
    resizable: !compact,
    maximizable: !compact,
    hasShadow: !compact,
    show: false,
    backgroundColor: compact ? '#00000000' : '#0c3e3a',
    title: '项目园',
    icon: path.join(__dirname, 'assets', 'garden-app-icon-v1.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  window.__projectGardenCompact = compact;
  if (compact) window.setAlwaysOnTop(true, 'floating');
  window.loadFile(path.join(__dirname, 'index.html'), { query: compact ? { compact: '1' } : {} });
  return window;
};

async function sendProgressToRenderer(progress) {
  if (windowTransition) await windowTransition;
  const window = activeWindow;
  if (!window || window.webContents.isDestroyed()) return Promise.reject(new Error('Open Project Garden to record progress.'));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingProgress.delete(progress.eventId);
      reject(new Error('Project Garden did not confirm the progress in time.'));
    }, 5000);
    pendingProgress.set(progress.eventId, { resolve, reject, timeout });
    window.webContents.send('garden:agent-progress', progress);
  });
}

async function toggleCompact(window) {
  if (!window || window !== activeWindow || windowTransition) return false;
  const compact = !window.__projectGardenCompact;
  windowTransition = (async () => {
    // Drain acknowledged updates before replacing the renderer. New bridge
    // deliveries wait on this transition, so no progress is lost in between.
    while (pendingProgress.size) await new Promise((resolve) => setTimeout(resolve, 25));
    await window.webContents.executeJavaScript('saveState(); true');
    if (compact) fullBounds = window.getNormalBounds();
    else petBounds = window.getBounds();
    const next = createWindow(compact);
    try {
      await new Promise((resolve, reject) => {
        next.once('ready-to-show', resolve);
        next.webContents.once('did-fail-load', (_event, code, description) => reject(new Error(`${code}: ${description}`)));
      });
      activeWindow = next;
      presentWindow(next);
      window.close();
      return compact;
    } catch (error) {
      next.destroy();
      throw error;
    }
  })();
  try { return await windowTransition; }
  finally { windowTransition = null; }
}

ipcMain.handle('window:toggle-compact', (event) => toggleCompact(BrowserWindow.fromWebContents(event.sender)));

function trustedRenderer(event) {
  const sender = BrowserWindow.fromWebContents(event.sender);
  return sender && event.senderFrame === event.sender.mainFrame && event.sender.getURL().split('?')[0] === pathToFileURL(path.join(__dirname,'index.html')).href;
}
ipcMain.on('garden:load-state', (event) => {
  event.returnValue = trustedRenderer(event) && gardenStore
    ? { ...gardenStore.load(), stageEvidence, legacyEventIds: bridge?.getProcessedEventIds() || [] }
    : { blocked: true, error: '存档尚未准备好' };
});
ipcMain.on('garden:save-state', (event, payload) => {
  try {
    if (!trustedRenderer(event) || !gardenStore) throw new Error('无法保存这个窗口的记录');
    const saved = gardenStore.save(payload?.state, payload?.revision);
    event.returnValue = { ok: true, revision: saved.revision, savedAt: saved.savedAt };
  } catch(error) { event.returnValue = { ok: false, error: error.message }; }
});
ipcMain.handle('garden:refresh-sync', () => bridge?.flushOutbox());
ipcMain.handle('garden:project-creation-dates', (_event, ids) => creationDates(path.join(process.env.CODEX_HOME || path.join(app.getPath('home'),'.codex'),'.codex-global-state.json'),ids));

function movePet(window, x, y) {
  const bounds = window.getBounds();
  const area = screen.getDisplayNearestPoint({ x: Math.round(x + bounds.width / 2), y: Math.round(y + bounds.height / 2) }).workArea;
  window.setPosition(Math.round(Math.max(area.x, Math.min(x, area.x + area.width - bounds.width))), Math.round(Math.max(area.y, Math.min(y, area.y + area.height - bounds.height))));
  petBounds = window.getBounds();
}

ipcMain.on('pet:drag', (event, data) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window?.__projectGardenCompact) return;
  if (data?.phase === 'end') { window.__petDrag = null; return; }
  if (!Number.isFinite(data?.x) || !Number.isFinite(data?.y)) return;
  if (data.phase === 'start') window.__petDrag = { x: data.x, y: data.y, bounds: window.getBounds() };
  if (data.phase === 'move' && window.__petDrag) {
    const start = window.__petDrag;
    movePet(window, start.bounds.x + data.x - start.x, start.bounds.y + data.y - start.y);
  }
});

ipcMain.on('pet:nudge', (event, delta) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window?.__projectGardenCompact || !Number.isFinite(delta?.x) || !Number.isFinite(delta?.y)) return;
  const bounds = window.getBounds();
  movePet(window, bounds.x + Math.max(-50, Math.min(50, delta.x)), bounds.y + Math.max(-50, Math.min(50, delta.y)));
});

ipcMain.on('pet:ignore-mouse', (event, ignore) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window?.__projectGardenCompact && !window.__petDrag && !window.__petMenuOpen) window.setIgnoreMouseEvents(ignore === true, { forward: true });
});

ipcMain.on('pet:menu', (event, payload) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window?.__projectGardenCompact || window.__petMenuOpen) return;
  window.__petMenuOpen = true;
  window.setIgnoreMouseEvents(false);
  Menu.buildFromTemplate(floatingMenuTemplate(payload?.projects, payload?.selectedId, {
    expand: () => { void toggleCompact(window); },
    select: (id) => window.webContents.send('pet:select-project', id),
    resetPosition: () => { const bounds = defaultPetBounds(); movePet(window, bounds.x, bounds.y); },
    quit: () => app.quit(),
  }, payload?.language)).popup({ window, callback: () => { window.__petMenuOpen = false; } });
});

ipcMain.on('garden:sync-context', (_event, context) => {
  bridge?.setContext(context);
  if (activeWindow) activeWindow.setTitle(context?.language === 'en' ? 'Project Garden' : '项目园');
});

ipcMain.handle('garden:pending-project-import', () => bridge?.getPendingProjectImport() || null);

ipcMain.on('garden:project-import-applied', (_event, result) => {
  bridge?.confirmProjectImport(result);
});

ipcMain.on('garden:agent-progress-applied', (_event, acknowledgement) => {
  const pending = pendingProgress.get(acknowledgement?.eventId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingProgress.delete(acknowledgement.eventId);
  if (acknowledgement.accepted) pending.resolve({ visualUpdated: true });
  else pending.reject(new Error(acknowledgement.error || 'Project Garden rejected the progress.'));
});

ipcMain.handle('garden:bridge-status', () => bridge?.getStatus() || { ready: false, active: false, habitat: null });
ipcMain.handle('garden:companion-status', () => companionSettings());
ipcMain.handle('garden:companion-set', (_event, enabled) => companionSettings(enabled));

if (hasInstanceLock) app.whenReady().then(async () => {
  gardenStore = createGardenStateStore(app.getPath('userData'));
  stageEvidence=readStageEvidence(path.join(__dirname,'backups'),gardenStore.load().state);
  bridge = createGardenBridge({
    userDataPath: app.getPath('userData'),
    dispatchProgress: sendProgressToRenderer,
  });
  await bridge.start();
  activeWindow = createWindow();
  activeWindow.once('ready-to-show', () => presentWindow(activeWindow));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      activeWindow = createWindow();
      activeWindow.once('ready-to-show', () => presentWindow(activeWindow));
    }
  });
});

app.on('before-quit', () => {
  bridge?.stop();
  for (const pending of pendingProgress.values()) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('Project Garden closed before recording progress.'));
  }
  pendingProgress.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
