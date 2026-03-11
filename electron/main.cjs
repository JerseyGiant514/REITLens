'use strict';

const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Window state persistence
// ---------------------------------------------------------------------------
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

const DEFAULT_STATE = {
  x: undefined,
  y: undefined,
  width: 1600,
  height: 1000,
  isMaximized: true,
};

function loadWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return {
        x: typeof data.x === 'number' ? data.x : undefined,
        y: typeof data.y === 'number' ? data.y : undefined,
        width: typeof data.width === 'number' && data.width >= 800 ? data.width : DEFAULT_STATE.width,
        height: typeof data.height === 'number' && data.height >= 600 ? data.height : DEFAULT_STATE.height,
        isMaximized: typeof data.isMaximized === 'boolean' ? data.isMaximized : DEFAULT_STATE.isMaximized,
      };
    }
  } catch {
    // Corrupted or unreadable file -- fall through to defaults
  }
  return { ...DEFAULT_STATE };
}

function saveWindowState(win) {
  if (!win) return;
  try {
    const isMaximized = win.isMaximized();
    // When maximized, persist the *restored* (non-maximized) bounds so the
    // next launch can position the window correctly before re-maximizing.
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Best-effort -- don't crash on write failure
  }
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
let mainWindow;

function createWindow() {
  const isDev = !app.isPackaged;
  const saved = loadWindowState();

  const winOptions = {
    width: saved.width,
    height: saved.height,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#010409',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  };

  // Only set position if we have valid saved coordinates
  if (saved.x !== undefined && saved.y !== undefined) {
    winOptions.x = saved.x;
    winOptions.y = saved.y;
  }

  mainWindow = new BrowserWindow(winOptions);

  mainWindow.once('ready-to-show', () => {
    if (saved.isMaximized && mainWindow.isMaximizable()) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Save window state on close
  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key === 'R') {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('hard-refresh', () => {
    mainWindow?.webContents.reloadIgnoringCache();
  });
}

app.whenReady().then(() => {
  // Bypass CORS for Yahoo Finance and FRED API calls in production
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://query1.finance.yahoo.com/*', 'https://query2.finance.yahoo.com/*', 'https://api.stlouisfed.org/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0';
      details.requestHeaders['Origin'] = 'https://finance.yahoo.com';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://query1.finance.yahoo.com/*', 'https://query2.finance.yahoo.com/*', 'https://api.stlouisfed.org/*'] },
    (details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      responseHeaders['access-control-allow-origin'] = ['*'];
      responseHeaders['access-control-allow-headers'] = ['*'];
      callback({ responseHeaders });
    }
  );

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
