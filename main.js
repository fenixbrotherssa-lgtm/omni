const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// ── Ruta del config.js editable (dirección del backend) ──────
// Empaquetado: la dirección elegida por el usuario vive en userData
// (%APPDATA%\omnicore-frontend\config.js), que SOBREVIVE a las
// actualizaciones. resources\config.js es solo el valor por defecto del
// instalador: cada actualización lo reemplaza (antes eso desconectaba a los
// clientes Local de su servidor). Desarrollo: la raíz del proyecto.
function configPath() {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'config.js')
        : path.join(__dirname, 'config.js');
}

function configPorDefecto() {
    return app.isPackaged ? path.join(process.resourcesPath, 'config.js') : configPath();
}

function leerConfig() {
    for (const p of [configPath(), configPorDefecto()]) {
        try {
            if (fs.existsSync(p)) {
                delete require.cache[require.resolve(p)];
                return require(p);
            }
        } catch (e) { console.error('config.js:', p, e.message); }
    }
    return null;
}

// ── Impresión térmica / cajón (sin cambios) ─────────────────
ipcMain.handle('omni:list-printers', async () => {
    try {
        if (!mainWindow) return [];
        const printers = await mainWindow.webContents.getPrintersAsync();
        return printers.map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault }));
    } catch (e) {
        console.error('omni:list-printers', e.message);
        return [];
    }
});

ipcMain.handle('omni:print-ticket', async (_e, { data, options }) => {
    try {
        const { PosPrinter } = require('electron-pos-printer');
        await PosPrinter.print(data, options);
        return { ok: true };
    } catch (err) {
        console.error('omni:print-ticket', err && err.message || err);
        return { ok: false, error: String(err && err.message || err) };
    }
});

ipcMain.handle('omni:cash-drawer', async (_e, printerName) => {
    try {
        const { PosPrinter } = require('electron-pos-printer');
        await PosPrinter.openCashDrawer(printerName);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
    }
});

// ── Configuración de servidor (dirección del backend) ───────
ipcMain.handle('omni:get-server', () => {
    const c = leerConfig();
    return {
        address: c ? c.SERVER_ADDRESS : 'localhost',
        port: c ? c.PORT : 3636,
        apiUrl: c && c.getApiUrl ? c.getApiUrl() : 'http://localhost:3636/api'
    };
});

// Reescribe config.js con la dirección que el usuario ingresa y reinicia la app.
ipcMain.handle('omni:set-server', (_e, { address, port }) => {
    const dir = String(address || '').trim() || 'localhost';
    const prt = parseInt(port) || 3636;
    const contenido =
`const CONFIG = {
    ENV: 'production',
    SERVER_ADDRESS: ${JSON.stringify(dir)},
    PORT: ${prt},

    getApiUrl() {
        const isDomain = this.SERVER_ADDRESS.includes('.') && !/[0-9]$/.test(this.SERVER_ADDRESS);
        const protocol = isDomain ? 'https' : 'http';
        const suffix = isDomain ? '' : ':' + this.PORT;
        return protocol + '://' + this.SERVER_ADDRESS + suffix + '/api';
    }
};

module.exports = CONFIG;
`;
    try {
        fs.mkdirSync(path.dirname(configPath()), { recursive: true });
        fs.writeFileSync(configPath(), contenido, 'utf8');
        app.relaunch();
        app.exit(0);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

// ── Auto-actualización (electron-updater, solo empaquetado) ─
//  Feed "generic": lee latest.yml del servidor definido en
//  package.json > build.publish.url (o el override de compilación).
function iniciarAutoUpdate(win) {
    if (!app.isPackaged) return;
    let autoUpdater;
    try { ({ autoUpdater } = require('electron-updater')); }
    catch (e) { console.warn('electron-updater no disponible:', e.message); return; }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    const avisar = (estado, extra = {}) => {
        try { win.webContents.send('omni:update-status', { estado, ...extra }); } catch (_) {}
    };

    autoUpdater.on('checking-for-update', () => avisar('buscando'));
    autoUpdater.on('update-available', (info) => avisar('disponible', { version: info.version }));
    autoUpdater.on('update-not-available', () => avisar('al-dia'));
    autoUpdater.on('download-progress', (p) => avisar('descargando', { porcentaje: Math.round(p.percent) }));
    let versionLista = null;
    autoUpdater.on('update-downloaded', (info) => { versionLista = info.version; avisar('listo', { version: info.version }); });
    autoUpdater.on('error', (err) => avisar('error', { mensaje: String(err && err.message || err) }));

    // Aplica la actualización. Con NSIS por-usuario (perMachine:false) el
    // updater reemplaza sin pedir elevación; solo hay que asegurar que la app
    // salga limpia (sin handlers de 'close'/'window-all-closed' que lo impidan).
    function instalarActualizacion() {
        try {
            autoUpdater.autoInstallOnAppQuit = true;
            app.removeAllListeners('window-all-closed');
            BrowserWindow.getAllWindows().forEach(w => {
                try { w.removeAllListeners('close'); w.destroy(); } catch (_) {}
            });
            setImmediate(() => {
                try { autoUpdater.quitAndInstall(); }   // args por defecto: (false, true)
                catch (e) { console.error('quitAndInstall:', e); }
            });
        } catch (e) { console.error('instalarActualizacion:', e); }
    }

    ipcMain.handle('omni:update-check', async () => {
        try {
            const r = await autoUpdater.checkForUpdates();
            // checkForUpdates() SIEMPRE devuelve updateInfo (la versión del feed),
            // aunque sea la misma instalada. Solo reportar si hay una MÁS nueva.
            const hay = !!(r && (r.isUpdateAvailable === true ||
                (r.updateInfo && r.updateInfo.version && r.updateInfo.version !== app.getVersion())));
            return { ok: true, version: hay ? r.updateInfo.version : null };
        } catch (e) { return { ok: false, error: e.message }; }
    });
    ipcMain.on('omni:update-install', () => instalarActualizacion());

    // Actualización SILENCIOSA: chequeo a los ~4s de abrir y luego cada 6 h,
    // descarga en segundo plano y se instala sola al cerrar la app
    // (autoInstallOnAppQuit). Sin notificación nativa de Windows ni avisos:
    // checkForUpdatesAndNotify() mostraba un globo del sistema en cada versión.
    const chequear = () => autoUpdater.checkForUpdates().catch(() => {});
    setTimeout(chequear, 4000);
    setInterval(chequear, 6 * 60 * 60 * 1000);
    ipcMain.handle('omni:update-pending', () => versionLista);
}

function createWindow() {
    const c = leerConfig();
    let apiFinal = 'http://localhost:3636/api';
    if (c && c.getApiUrl) {
        try { apiFinal = c.getApiUrl(); console.log('Configuración cargada:', apiFinal); }
        catch (e) { console.error('getApiUrl:', e.message); }
    } else {
        console.warn('config.js no encontrado en: ' + configPath());
    }

    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'OMNI CORE — Plataforma Contable',
        backgroundColor: '#0a0a0b',
        icon: path.join(__dirname, 'assets/icono.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            devTools: !app.isPackaged,
            additionalArguments: [`--api-url=${apiFinal}`]
        }
    });

    mainWindow = win;
    win.on('closed', () => { mainWindow = null; });

    win.loadFile('index.html');
    win.setMenu(null);

    if (!app.isPackaged) {
        win.webContents.openDevTools();
    } else {
        win.webContents.on('devtools-opened', () => win.webContents.closeDevTools());
    }

    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); return; }
        if (!app.isPackaged) {
            if (((input.control || input.meta) && input.key.toLowerCase() === 'r') || input.key === 'F5') win.reload();
            if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
        } else {
            if (
                (((input.control || input.meta) && input.key.toLowerCase() === 'r') || input.key === 'F5') ||
                (((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12')
            ) event.preventDefault();
        }
    });

    iniciarAutoUpdate(win);
}

// Instancia única: si ya hay una OMNI CORE corriendo, esta se cierra y
// enfoca la existente. Evita que se acumulen procesos ocultos (era la causa
// de "cierra la aplicación" cuando aparentemente no había ninguna abierta).
const _soloUna = app.requestSingleInstanceLock();
if (!_soloUna) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
