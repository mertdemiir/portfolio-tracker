export interface ElectronAPI {
  exportData: (jsonString: string) => Promise<{ success: boolean; filePath?: string; error?: string; cancelled?: boolean }>;
  importData: () => Promise<{ success: boolean; data?: string; error?: string; cancelled?: boolean }>;
  importCsv: () => Promise<{ success: boolean; data?: string; error?: string; cancelled?: boolean }>;
  chooseBackupFolder: () => Promise<{ success: boolean; folderPath?: string; cancelled?: boolean }>;
  autoBackup: (jsonString: string, folderPath: string) => Promise<{ success: boolean; error?: string }>;
  savePdf: (pdfArrayBuffer: ArrayBuffer) => Promise<{ success: boolean; filePath?: string; error?: string; cancelled?: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
