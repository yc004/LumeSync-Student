// ========================================================
// 瀛︾敓绔富杩涚▼
// 鑱岃矗锛氬紑鏈鸿嚜鍚€佹墭鐩樺父椹汇€佽鍫傚紑濮嬫椂鍏ㄥ睆缃《銆侀樆姝㈠叧闂?
// ========================================================
const {
    app, BrowserWindow, Tray, Menu, nativeImage,
    ipcMain, shell, dialog, session, globalShortcut
} = require('electron');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// 1. 鍒ゆ柇褰撳墠鏄惁鏄墦鍖呭悗鐨勭敓浜х幆澧?
const isDev = !app.isPackaged;

// 2. 鍔ㄦ€佽绠?common 鐩綍鐨勮矾寰?
const commonPath = path.join(__dirname, '../common/electron');

const sharedPath = path.join(__dirname, '../shared');

const { loadConfig, saveConfig, getAdminPasswordHash } = require(path.join(commonPath, 'config.js'));
const { Logger } = require(path.join(commonPath, 'logger.js'));

// 鍒濆鍖栨棩蹇楃郴缁?
const logger = new Logger('LumeSync-Student');

// 鍒囨崲 Windows 鎺у埗鍙颁唬鐮侀〉涓?UTF-8锛岃В鍐充腑鏂囦贡鐮?
if (process.platform === 'win32') {
    spawnSync('chcp', ['65001'], { shell: true, stdio: 'ignore' });
}

// 鈹€鈹€ 瀹夎鍚庢湇鍔℃敞鍐岋紙NSIS customInstall 璋冪敤锛夆攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
if (process.argv.includes('--register-service')) {
    // 浠?sc.exe 娉ㄥ唽鑷惎鍔ㄦ湇鍔★紝鎸囧悜褰撳墠 exe
    const exePath = process.execPath;
    spawnSync('sc', [
        'create', 'LumeSyncStudent',
        'binPath=', `"${exePath}"`,
        'start=', 'auto',
        'DisplayName=', 'LumeSync Student Guard Service',
    ], { shell: false, stdio: 'ignore' });
    spawnSync('sc', ['description', 'LumeSyncStudent', 'LumeSync Student Guard Service'], { shell: false, stdio: 'ignore' });
    spawnSync('sc', ['start', 'LumeSyncStudent'], { shell: false, stdio: 'ignore' });
    process.exit(0);
}

// 璁板綍鍚姩淇℃伅
logger.info('BOOT', 'Application started', {
    execPath: process.execPath,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    args: process.argv
});

// 绂佺敤 GPU 纾佺洏缂撳瓨锛岄伩鍏?Windows 涓婂洜缂撳瓨鐩綍閿佸畾瀵艰嚧鐨勫惎鍔ㄦ姤閿?
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');

// 璺宠繃 Windows 绯荤粺鎽勫儚澶存潈闄愬脊绐楋紝閬垮厤棣栨 getUserMedia 绛夊緟 5 绉掕秴鏃?
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

// 璁剧疆浠ｇ悊涓虹郴缁熶唬鐞嗭紝閬垮厤缃戠粶闂
app.commandLine.appendSwitch('no-proxy-server');

// 鎹曡幏鏈鐞嗙殑寮傚父
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT', 'Uncaught Exception', err);
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED', 'Unhandled Promise Rejection', reason);
});

let mainWindow = null;
let adminWindow = null;
let tray = null;
let isClassActive = false;
let forceFullscreen = true; // 璺熻釜鏁欏笀绔殑寮哄埗鍏ㄥ睆璁剧疆
let config = loadConfig();
let retryTimer = null; // 鍚庡彴閲嶈繛瀹氭椂鍣?
const RETRY_INTERVAL_MS = 5000; // 姣?5 绉掗噸璇曚竴娆?
let fullscreenApplyToken = 0;
let allowExitFullscreen = true;
let lastFullscreenToggleAt = 0;
let lastFullscreenToggleEnable = null;

// getUserMedia requires a secure origin. http:// is not considered secure by Chromium,
// so mark the teacher server origin as trusted. Must be set before app.ready.
{
    const _port = config.port || 3000;
    app.commandLine.appendSwitch(
        'unsafely-treat-insecure-origin-as-secure',
        `http://${config.teacherIp}:${_port},http://localhost:${_port},http://127.0.0.1:${_port}`
    );
}

// 鈹€鈹€ 寮€鏈鸿嚜鍚紙榛樿寮€鍚紝鍙湪绠＄悊鍛樿缃腑淇敼锛夆攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// 浣跨敤娉ㄥ唽琛紙Windows锛? 鐧诲綍椤癸紙macOS锛? auto-launch锛圠inux锛?
const { AutoLauncher } = require(path.join(commonPath, 'task-scheduler-autostart.js'));

let autoLauncher = null;

// 搴旂敤鍒濆鍖栧悗鍒涘缓 AutoLauncher 瀹炰緥
function initAutoLauncher() {
    if (!autoLauncher) {
        autoLauncher = new AutoLauncher(
            app.getName(),
            app.getPath('exe')
        );
    }
    return autoLauncher;
}

async function setAutostartRegistry(enable) {
    // 寮€鍙戠幆澧冭烦杩?
    if (!app.isPackaged) {
        logger.info('AUTOSTART', 'Development mode, skipping autostart setup');
        return true;
    }

    const launcher = initAutoLauncher();
    logger.info('AUTOSTART', 'Setting autostart', {
        enable,
        exePath: app.getPath('exe'),
        isPackaged: app.isPackaged
    });

    try {
        await launcher.enable(enable);
        logger.info('AUTOSTART', enable ? 'Autostart enabled' : 'Autostart disabled');
        return true;
    } catch (err) {
        logger.error('AUTOSTART', 'Error setting autostart', err);
        throw new Error('璁剧疆寮€鏈鸿嚜鍚姩澶辫触');
    }
}

async function getAutostartRegistry() {
    // 寮€鍙戠幆澧冭繑鍥?false
    if (!app.isPackaged) {
        logger.info('AUTOSTART', '寮€鍙戞ā寮忥紝鑷惎鍔ㄧ姸鎬? false');
        return false;
    }

    const launcher = initAutoLauncher();
    try {
        const isEnabled = await launcher.isEnabled();
        logger.info('AUTOSTART', 'Checking autostart status', { isEnabled });
        return isEnabled;
    } catch (err) {
        logger.error('AUTOSTART', 'Error checking autostart status', err);
        return false;
    }
}

// 鈹€鈹€ 鍚庡彴杞閲嶈繛 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function startRetrying() {
    if (retryTimer) return; // 宸插湪閲嶈瘯涓?
    retryTimer = setInterval(() => {
        const url = `http://${config.teacherIp}:${config.port || 3000}`;
        const http = require('http');
        const req = http.get(url, (res) => {
            res.resume(); // 娑堣垂鍝嶅簲浣?
            if (res.statusCode < 500) {
                // 鏈嶅姟鍣ㄥ凡灏辩华锛屽仠姝㈤噸璇曞苟鍔犺浇椤甸潰
                stopRetrying();
                if (mainWindow) {
                    mainWindow.loadURL(url).catch(() => {});
                }
            }
        });
        req.setTimeout(2500, () => req.destroy(new Error('timeout')));
        req.on('error', () => {
            // 浠嶇劧鏃犳硶杩炴帴锛岀户缁瓑寰?
        });
    }, RETRY_INTERVAL_MS);
}

function stopRetrying() {
    if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
    }
}

// 鈹€鈹€ 鍒涘缓涓荤獥鍙ｏ紙瀛︾敓璇惧爞绐楀彛锛夆攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function createMainWindow() {
    const url = `http://${config.teacherIp}:${config.port || 3000}`;

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'SyncClassroom Student',
        frame: false,
        resizable: true,
        webPreferences: {
            preload: path.join(commonPath, 'preload.js'),
            contextIsolation: true,
        },
        show: false, // 闈欓粯鍚姩锛岃鍫傚紑濮嬪悗鎵嶆樉绀?
    });
    mainWindow.setMenu(null);
    mainWindow.setSkipTaskbar(true);
    mainWindow.webContents.on('render-process-gone', (_, details) => {
        logger.error('WINDOW', 'Render process gone', details);
        const recentlyToggled = (Date.now() - lastFullscreenToggleAt) < 3000;
        if (recentlyToggled && lastFullscreenToggleEnable === false) {
            allowExitFullscreen = false;
            logger.warn('WINDOW', 'Disable exit fullscreen due to render crash after leaving fullscreen');
        }
        if (isClassActive) {
            try {
                setTimeout(() => {
                    try { mainWindow && mainWindow.reload(); } catch (_) {}
                }, 500);
            } catch (_) {}
        }
    });
    mainWindow.webContents.on('unresponsive', () => {
        logger.warn('WINDOW', 'WebContents unresponsive');
    });
    mainWindow.webContents.on('responsive', () => {
        logger.info('WINDOW', 'WebContents responsive');
    });

    mainWindow.loadURL(url).catch(() => {
        // 杩炴帴澶辫触鏃舵樉绀虹绾挎彁绀洪〉锛屽苟寮€濮嬪悗鍙伴噸杩?
        mainWindow.loadFile(path.join(sharedPath, 'offline.html'));
        startRetrying();
    });

    // 椤甸潰鎴愬姛鍔犺浇鏃跺仠姝㈤噸璇?
    mainWindow.webContents.on('did-navigate', (_, navUrl) => {
        if (!navUrl.startsWith('file://')) {
            stopRetrying();
        }
    });

    // 闃绘鍏抽棴锛氳鍫傝繘琛屼腑瀹屽叏闃绘锛屽钩鏃舵渶灏忓寲鍒版墭鐩?
    mainWindow.on('close', (e) => {
        e.preventDefault();
        if (isClassActive) {
            if (forceFullscreen) {
                mainWindow.show();
                mainWindow.setSkipTaskbar(true);
                applyFullscreenState(true);
            }
            return;
        }
        mainWindow.hide();
    });

    // Win+D / 绯荤粺鏈€灏忓寲锛氳鍫傛ā寮忎笅绔嬪嵆鎭㈠
    mainWindow.on('minimize', () => {
        if (isClassActive && forceFullscreen) {
            setImmediate(() => {
                mainWindow.restore();
                applyFullscreenState(true);
            });
        }
    });

    // 澶辩劍鏃讹紙鍒囨崲鍒板叾浠栫獥鍙ｏ級锛氳鍫傛ā寮忎笅鎶㈠洖鐒︾偣
    mainWindow.on('blur', () => {
        if (isClassActive && forceFullscreen) {
            // 鐭殏寤惰繜锛岄伩鍏嶄笌绠＄悊鍛樼獥鍙ｅ啿绐?
            setTimeout(() => {
                if (!adminWindow || !adminWindow.isFocused()) {
                    mainWindow && mainWindow.focus();
                }
            }, 200);
        }
    });

    // 闃绘 Alt+F4 / 绯荤粺鍏抽棴
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.alt && input.key === 'F4') {
            event.preventDefault();
        }
        // 闃绘 Win 閿粍鍚堬紙閮ㄥ垎绯荤粺蹇嵎閿級
        if (input.meta) {
            event.preventDefault();
        }
    });

    // 绐楀彛鏈€澶у寲/杩樺師浜嬩欢锛堥€氱煡娓叉煋杩涚▼锛?
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-maximized');
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-unmaximized');
    });
}

function applyFullscreenState(enable) {
    if (!mainWindow) return;
    const token = ++fullscreenApplyToken;
    lastFullscreenToggleAt = Date.now();
    lastFullscreenToggleEnable = !!enable;
    try {
        mainWindow.setSkipTaskbar(true);
        mainWindow.show();
        if (enable) {
            try { mainWindow.setFullScreen(true); } catch (_) {}
            try { mainWindow.setAlwaysOnTop(true, 'screen-saver'); } catch (_) {}
        } else {
            try { mainWindow.setAlwaysOnTop(false); } catch (_) {}
            if (allowExitFullscreen) {
                setTimeout(() => {
                    if (!mainWindow) return;
                    if (!isClassActive) return;
                    if (token !== fullscreenApplyToken) return;
                    try { mainWindow.setFullScreen(false); } catch (_) {}
                }, 180);
            }
        }
        mainWindow.focus();
    } catch (err) {
        logger.error('WINDOW', 'applyFullscreenState failed', { enable, error: err?.message || String(err) });
    }
}

// 鈹€鈹€ 璇惧爞寮€濮嬶細鎸夎缃喅瀹氭槸鍚﹀叏灞忕疆椤?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function enterClassMode() {
    isClassActive = true;
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.setSkipTaskbar(true);
    mainWindow.focus();
    if (forceFullscreen) {
        applyFullscreenState(true);
    }
}

// 鈹€鈹€ 璇惧爞缁撴潫锛氭仮澶嶆櫘閫氱獥鍙?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function exitClassMode() {
    isClassActive = false;
    if (!mainWindow) return;
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
}

// 鈹€鈹€ 绠＄悊鍛橀厤缃獥鍙?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function openAdminWindow() {
    if (adminWindow) { adminWindow.focus(); return; }
    adminWindow = new BrowserWindow({
        width: 480,
        height: 420,
        title: 'Admin Settings',
        resizable: false,
        modal: false,
        webPreferences: {
            preload: path.join(commonPath, 'preload.js'),
            contextIsolation: true,
        },
    });
    adminWindow.loadFile(path.join(sharedPath, 'admin.html'));
    adminWindow.on('closed', () => { adminWindow = null; });
    adminWindow.setMenu(null);
    // 濮嬬粓缃《锛岀‘淇濆叏灞忚鍫傛ā寮忎笅涔熻兘鐪嬪埌绠＄悊鍛樼獥鍙?
    adminWindow.setAlwaysOnTop(true, 'screen-saver');
}

// 鈹€鈹€ 绯荤粺鎵樼洏 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function createTray() {
    logger.info('TRAY', 'Creating system tray');

    // 鍔ㄦ€佽绠楁墭鐩樺浘鏍囪矾寰?
    // 寮€鍙戠幆澧? apps/student/electron/main.js -> ../../../shared/assets/tray-icon.png
    // 鐢熶骇鐜: 浣跨敤 app.getAppPath() 鑾峰彇搴旂敤璺緞锛岀劧鍚庡畾浣嶅埌鍏变韩璧勬簮
    const iconPath = isDev
        ? path.join(sharedPath, 'assets', 'tray-icon.png')
        : path.join(app.getAppPath(), 'shared', 'assets', 'tray-icon.png');
    logger.debug('TRAY', 'Tray icon path', { iconPath, exists: require('fs').existsSync(iconPath), isDev });

    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip('SyncClassroom Student');
    logger.info('TRAY', 'Tray created successfully');

    const menu = Menu.buildFromTemplate([
        { label: 'Show Window', click: () => mainWindow && mainWindow.show() },
        { label: 'Toggle DevTools', click: () => {
            if (mainWindow && mainWindow.webContents) {
                try {
                    if (mainWindow.webContents.isDevToolsOpened()) {
                        mainWindow.webContents.closeDevTools();
                    } else {
                        mainWindow.webContents.openDevTools({ mode: 'detach' });
                    }
                } catch (err) {
                    logger.error('TRAY', 'Failed to toggle devtools', err);
                }
            }
        }},
        { label: 'Admin Settings...', click: openAdminWindow },
        { type: 'separator' },
        {
            label: 'Exit (Admin Password Required)',
            click: () => {
                // 閫€鍑轰篃闇€瑕佸瘑鐮侀獙璇?
                openAdminWindow();
            }
        },
    ]);
    tray.setContextMenu(menu);
    tray.on('double-click', () => mainWindow && mainWindow.show());

    logger.info('TRAY', 'Tray menu set up complete');
}

// 鈹€鈹€ IPC 澶勭悊 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
ipcMain.on('class-started', (_, opts) => {
    // opts 鍙惡甯?{ forceFullscreen } 瑕嗙洊褰撳墠鏍囧織
    if (opts && typeof opts.forceFullscreen === 'boolean') {
        forceFullscreen = opts.forceFullscreen;
    }
    enterClassMode();
});
ipcMain.on('class-ended', () => exitClassMode());

// 鏁欏笀绔繙绋嬫帶鍒跺叏灞忓紑鍏筹紙璇惧爞杩涜涓湁鏁堬級
ipcMain.on('set-fullscreen', (_, enable) => {
    forceFullscreen = enable; // 濮嬬粓鏇存柊鏍囧織锛屼緵 enterClassMode 浣跨敤
    if (!mainWindow || !isClassActive) return;
    applyFullscreenState(!!enable);
});

ipcMain.handle('get-config', () => ({ ...config, adminPasswordHash: undefined }));

ipcMain.handle('save-config', async (_, newConfig) => {
    logger.info('CONFIG', 'save-config called', { hasQuitFlag: !!newConfig._quit, keys: Object.keys(newConfig) });

    // 鐗规畩鏍囧織锛氱鐞嗗憳璇锋眰閫€鍑?
    // 鍙湁褰?newConfig 鍙湁 _quit 涓€涓睘鎬ф椂鎵嶈涓烘槸閫€鍑鸿姹?
    if (Object.keys(newConfig).length === 1 && newConfig._quit) {
        logger.info('CONFIG', 'Quit requested via save-config');
        app.exit(0);
        return true;
    }

    // 绉婚櫎 _quit 灞炴€э紙濡傛灉鏈夛級锛岄槻姝㈡薄鏌撻厤缃?
    const { _quit, ...cleanConfig } = newConfig;
    const oldTeacherIp = config.teacherIp;
    const oldPort = config.port || 3000;

    config = { ...config, ...cleanConfig };
    const ok = saveConfig(config);

    if (ok && mainWindow) {
        logger.info('CONFIG', 'Config saved, preparing to reload window', {
            oldIp: oldTeacherIp,
            newIp: config.teacherIp,
            port: config.port
        });

        stopRetrying();
        const url = `http://${config.teacherIp}:${config.port || 3000}`;

        // 鍙湁褰?IP 鎴栫鍙ｆ敼鍙樻椂鎵嶉噸鏂板姞杞?
        if (oldTeacherIp !== config.teacherIp || oldPort !== config.port) {
            logger.info('CONFIG', 'IP or port changed, reloading window');
            try {
                // 鍏堝仠姝㈠綋鍓嶅鑸紝閬垮厤 ERR_ABORTED
                mainWindow.webContents.stop();
                // 绛夊緟涓€灏忔鏃堕棿璁╁仠姝㈡搷浣滃畬鎴?
                await new Promise(resolve => setTimeout(resolve, 50));
                // 鍔犺浇鏂?URL
                await mainWindow.loadURL(url);
                logger.info('CONFIG', 'Window reloaded successfully');
            } catch (err) {
                // 杩炴帴琚嫆缁濇槸姝ｅ父鎯呭喌锛堟湇鍔″櫒鏈惎鍔級锛屽彧璁板綍涓鸿鍛?
                if (err.message && err.message.includes('ERR_CONNECTION_REFUSED')) {
                    logger.warn('CONFIG', 'Server not available, showing offline page');
                } else {
                    logger.error('CONFIG', 'Failed to load URL, showing offline page', err);
                }
                try {
                    await mainWindow.loadFile(path.join(sharedPath, 'offline.html'));
                    startRetrying();
                } catch (loadErr) {
                    logger.error('CONFIG', 'Failed to load offline page', loadErr);
                }
            }
        } else {
            logger.info('CONFIG', 'IP and port unchanged, no reload needed');
        }
    }
    return ok;
});

ipcMain.handle('verify-password', (_, pwd) => {
    const hash = crypto.createHash('sha256').update(pwd).digest('hex');
    const expected = getAdminPasswordHash(config);
    if (hash === expected) return { ok: true };
    return { ok: false };
});

ipcMain.handle('get-role', () => 'student');

// 瀛︾敓绔笉闇€瑕佽鍫傝缃紙鏁欏笀绔笓鐢級锛岃繑鍥?null 閬垮厤 IPC 鎶ラ敊
ipcMain.handle('get-settings', () => null);
ipcMain.handle('save-settings', () => null);

// 鏁欏笀绔繙绋嬫帹閫佹柊绠＄悊鍛樺瘑鐮?hash
ipcMain.on('set-admin-password', (_, hash) => {
    config = { ...config, adminPasswordHash: hash };
    saveConfig(config);
    console.log('[admin] password updated remotely');
});

ipcMain.handle('get-autostart', async () => {
    return await getAutostartRegistry();
});

ipcMain.handle('set-autostart', async (_, enable) => {
    try {
        await setAutostartRegistry(enable);
        return { success: true };
    } catch (err) {
        logger.error('AUTOSTART', 'Failed to set autostart via IPC', err);
        return { success: false, error: err.message };
    }
});

// 鎵嬪姩閲嶈瘯锛坥ffline.html 鎸夐挳瑙﹀彂锛?
ipcMain.on('manual-retry', () => {
    stopRetrying();
    const url = `http://${config.teacherIp}:${config.port || 3000}`;
    if (mainWindow) {
        mainWindow.loadURL(url).catch(() => {
            mainWindow.loadFile(path.join(sharedPath, 'offline.html'));
            startRetrying();
        });
    }
});

// IPC: 绐楀彛鎺у埗
ipcMain.on('minimize-window', () => {
    if (!mainWindow) return;
    mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    if (!mainWindow) return;
    if (isClassActive) {
        return;
    }
    mainWindow.close();
});

ipcMain.on('toggle-devtools', () => {
    if (!mainWindow) return;
    try {
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    } catch (err) {
        logger.error('IPC', 'Failed to toggle devtools', err);
    }
});

// 鈹€鈹€ 搴旂敤鐢熷懡鍛ㄦ湡 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
app.whenReady().then(async () => {
    logger.info('APP', 'App is ready, initializing');
    logger.info('APP', 'Creating main window');

    // Allow camera/microphone access for course interactions
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowed = ['media', 'camera', 'microphone', 'display-capture', 'videoCapture', 'audioCapture'];
        callback(allowed.includes(permission));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        const allowed = ['media', 'camera', 'microphone', 'display-capture', 'videoCapture', 'audioCapture'];
        return allowed.includes(permission);
    });

    createMainWindow();

    logger.info('APP', 'Creating system tray');
    createTray();

    if (globalShortcut) {
        const accelerator = 'CommandOrControl+Shift+D';
        const ok = globalShortcut.register(accelerator, () => {
            if (!mainWindow) return;
            try {
                if (mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.closeDevTools();
                } else {
                    mainWindow.webContents.openDevTools({ mode: 'detach' });
                }
            } catch (_) {}
        });
        logger.info('APP', 'Debug shortcut registered', { accelerator, ok: !!ok });
    }

    logger.info('APP', 'App initialization complete');

    // 妫€鏌ヨ嚜鍚姩鐘舵€?
    try {
        const autostartEnabled = await getAutostartRegistry();
        logger.info('AUTOSTART', 'Startup complete, autostart status', {
            enabled: autostartEnabled
        });
    } catch (err) {
        logger.warn('AUTOSTART', 'Failed to check autostart status', err);
    }
});

// 闃绘鎵€鏈夌獥鍙ｅ叧闂椂閫€鍑?
app.on('window-all-closed', (e) => {
    logger.info('APP', 'window-all-closed event, preventing exit');
    e.preventDefault();
});

app.on('will-quit', () => {
    try { globalShortcut && globalShortcut.unregisterAll(); } catch (_) {}
});

// 闃绘绯荤粺绾ч€€鍑猴紙濡傛敞閿€鏃讹級鈥斺€旀櫘閫氱敤鎴锋棤娉曢€氳繃浠诲姟绠＄悊鍣ㄧ粨鏉?Electron 杩涚▼
// 鐪熸鐨勯槻鏉€闇€閰嶅悎 Windows 鏈嶅姟瀹堟姢锛堣 service-install.js锛?
app.on('before-quit', (e) => {
    logger.info('APP', 'before-quit event', { isClassActive });
    if (isClassActive) {
        logger.info('APP', 'Preventing quit because class is active');
        e.preventDefault();
    }
});

