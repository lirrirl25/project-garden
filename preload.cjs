const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('projectGardenDesktop', {
  loadState: () => ipcRenderer.sendSync('garden:load-state'),
  saveState: (payload) => ipcRenderer.sendSync('garden:save-state', payload),
  refreshSync: () => ipcRenderer.invoke('garden:refresh-sync'),
  getCompanionStatus: () => ipcRenderer.invoke('garden:companion-status'),
  setCompanionEnabled: (enabled) => ipcRenderer.invoke('garden:companion-set', enabled),
  projectCreationDates: (ids) => ipcRenderer.invoke('garden:project-creation-dates',ids),
  toggleCompact: () => ipcRenderer.invoke('window:toggle-compact'),
  showPetMenu: (payload) => ipcRenderer.send('pet:menu', payload),
  dragPet: (data) => ipcRenderer.send('pet:drag', data),
  nudgePet: (delta) => ipcRenderer.send('pet:nudge', delta),
  ignorePetMouse: (ignore) => ipcRenderer.send('pet:ignore-mouse', ignore),
  onPetProjectSelected: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('pet:select-project', listener);
    return () => ipcRenderer.removeListener('pet:select-project', listener);
  },
  syncContext: (context) => ipcRenderer.send('garden:sync-context', context),
  getBridgeStatus: () => ipcRenderer.invoke('garden:bridge-status'),
  getPendingProjectImport: () => ipcRenderer.invoke('garden:pending-project-import'),
  confirmProjectImport: (result) => ipcRenderer.send('garden:project-import-applied', result),
  confirmAgentProgress: (acknowledgement) => ipcRenderer.send('garden:agent-progress-applied', acknowledgement),
  onAgentProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('garden:agent-progress', listener);
    return () => ipcRenderer.removeListener('garden:agent-progress', listener);
  },
});
