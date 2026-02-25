import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Portfolio Tracker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadFile(path.join(__dirname, '../dist/index.html'))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

// IPC: Export data to file
ipcMain.handle('export-data', async (_event, jsonString: string) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await dialog.showSaveDialog({
      defaultPath: `portfolio-backup-${today}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true }
    }
    await fs.writeFile(result.filePath, jsonString, 'utf-8')
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// IPC: Import data from file
ipcMain.handle('import-data', async () => {
  try {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true }
    }
    const data = await fs.readFile(result.filePaths[0], 'utf-8')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// IPC: Import CSV file
ipcMain.handle('import-csv', async () => {
  try {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true }
    }
    const data = await fs.readFile(result.filePaths[0], 'utf-8')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// IPC: Choose backup folder
ipcMain.handle('choose-backup-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true }
    }
    return { success: true, folderPath: result.filePaths[0] }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// IPC: Auto backup to folder
ipcMain.handle('auto-backup', async (_event, jsonString: string, folderPath: string) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const filename = `auto-backup-${today}.json`
    const filePath = path.join(folderPath, filename)
    await fs.writeFile(filePath, jsonString, 'utf-8')

    // Cleanup: keep only last 10 backups
    const files = await fs.readdir(folderPath)
    const backupFiles = files
      .filter((f) => f.startsWith('auto-backup-') && f.endsWith('.json'))
      .sort()
      .reverse()

    for (const file of backupFiles.slice(10)) {
      await fs.unlink(path.join(folderPath, file))
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// IPC: Save PDF to file
ipcMain.handle('save-pdf', async (_event, pdfArrayBuffer: ArrayBuffer) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await dialog.showSaveDialog({
      defaultPath: `portfolio-report-${today}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true }
    }
    await fs.writeFile(result.filePath, Buffer.from(pdfArrayBuffer))
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
