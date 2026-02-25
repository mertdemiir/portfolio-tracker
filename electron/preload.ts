import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportData: (jsonString: string) =>
    ipcRenderer.invoke('export-data', jsonString),
  importData: () => ipcRenderer.invoke('import-data'),
  importCsv: () => ipcRenderer.invoke('import-csv'),
  chooseBackupFolder: () => ipcRenderer.invoke('choose-backup-folder'),
  autoBackup: (jsonString: string, folderPath: string) =>
    ipcRenderer.invoke('auto-backup', jsonString, folderPath),
  savePdf: (pdfArrayBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('save-pdf', pdfArrayBuffer),
})
