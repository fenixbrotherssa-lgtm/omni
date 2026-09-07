// ============================================================
//  build.js  -  OMNI CORE Frontend (Electron)
//  CasRodsoft Development
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT = __dirname;
const DIST_SRC = path.join(ROOT, 'dist_src'); // Carpeta temporal ofuscada
const DIST_BIN = path.join(ROOT, 'dist');     // Carpeta final con el .exe compilado

// 1. Lo que se ofusca
const OBFUSCAR = [
    'modules',
    'views',
    'app.js',
    'main.js'
];

// 2. Lo que se copia intacto
const COPIAR_TAL_CUAL = [
    'assets',
    'node_modules',
    'public',
    'estructura.html',
    'index.html',
    'package.json',
    'package-lock.json'
];

const OPCIONES_OFUSCADOR = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.4,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    shuffleStringArray: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false,
};

function limpiarDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

function asegurarDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function copiarDir(src, dest) {
    // fs.cpSync maneja symlinks, permisos y archivos especiales — necesario
    // en macOS, donde node_modules/electron/.../Electron Framework.framework
    // trae symlinks internos que fs.copyFileSync no puede copiar (ENOTSUP).
    fs.cpSync(src, dest, { recursive: true, force: true, dereference: false });
}

function ofuscarDir(src, dest) {
    asegurarDir(dest);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            ofuscarDir(srcPath, destPath);
        } else if (entry.name.endsWith('.js')) {
            try {
                const codigo = fs.readFileSync(srcPath, 'utf8');
                const resultado = JavaScriptObfuscator.obfuscate(codigo, OPCIONES_OFUSCADOR);
                fs.writeFileSync(destPath, resultado.getObfuscatedCode(), 'utf8');
            } catch (err) {
                console.error("  Error ofuscando " + entry.name + ": " + err.message);
                fs.copyFileSync(srcPath, destPath);
            }
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function build() {
    console.log('\n========================================');
    console.log('  OMNI CORE Frontend - Build');
    console.log('========================================\n');

    limpiarDir(DIST_SRC);
    // La 2a variante (local) NO debe borrar lo que dejo la 1a (saas).
    if (process.env.OMNI_NO_CLEAN_DIST !== '1') limpiarDir(DIST_BIN);
    asegurarDir(DIST_SRC);

    console.log('Copiando recursos y modulos...');
    for (const recurso of COPIAR_TAL_CUAL) {
        const src = path.join(ROOT, recurso);
        const dest = path.join(DIST_SRC, recurso);
        if (!fs.existsSync(src)) continue;
        if (fs.statSync(src).isDirectory()) copiarDir(src, dest);
        else fs.copyFileSync(src, dest);
    }

    console.log('Ofuscando codigo fuente...');
    for (const objetivo of OBFUSCAR) {
        const src = path.join(ROOT, objetivo);
        const dest = path.join(DIST_SRC, objetivo);
        if (!fs.existsSync(src)) continue;

        if (fs.statSync(src).isDirectory()) {
            ofuscarDir(src, dest);
        } else {
            try {
                const codigo = fs.readFileSync(src, 'utf8');
                const resultado = JavaScriptObfuscator.obfuscate(codigo, OPCIONES_OFUSCADOR);
                fs.writeFileSync(dest, resultado.getObfuscatedCode(), 'utf8');
            } catch (err) {
                fs.copyFileSync(src, dest);
            }
        }
    }

    // ── config.js ─────────────────────────────────────────────
    //  UN SOLO instalador. Viene apuntado al servidor SaaS del proveedor.
    //  El cliente Local lo cambia con el botón "Configurar servidor" del
    //  login (pantalla previa al inicio de sesión).
    const configJs =
`const CONFIG = {
    ENV: 'production',
    SERVER_ADDRESS: 'omnicore.casrodsoft.com',
    PORT: 3636,

    getApiUrl() {
        const isDomain = this.SERVER_ADDRESS.includes('.') && !/[0-9]$/.test(this.SERVER_ADDRESS);
        const protocol = isDomain ? 'https' : 'http';
        const suffix = isDomain ? '' : \`:\${this.PORT}\`;
        return \`\${protocol}://\${this.SERVER_ADDRESS}\${suffix}/api\`;
    }
};

module.exports = CONFIG;
`;
    fs.writeFileSync(path.join(DIST_SRC, 'config.js'), configJs, 'utf8');
    console.log('config.js incluido (SERVER_ADDRESS=omnicore.casrodsoft.com).');

    // ── Empaquetado con electron-builder ───────────────────────
    //  Windows -> instalador NSIS + electron-updater (latest.yml + .blockmap).
    //  macOS   -> DMG (x64 + arm64), igual patrón.
    //  Se ejecuta DESDE dist_src/ (código ya ofuscado, con su package.json y
    //  node_modules) y la salida va a ../dist.
    //
    //  Para PUBLICAR de una vez al servidor de descargas: exporta
    //    OMNI_PUBLISH=1  y  OMNI_UPDATE_URL=https://tudominio/downloads/omnicore/
    //  (o edita build.publish.url en package.json). Sin esas variables solo
    //  genera los archivos localmente en dist/ (publish never).
    const PLATFORM = process.env.TARGET_PLATFORM || 'win32';
    const flagPlataforma = PLATFORM === 'darwin' ? '--mac' : '--win --x64';
    const publish = process.env.OMNI_PUBLISH === '1' ? 'always' : 'never';
    const urlOverride = process.env.OMNI_UPDATE_URL
        ? ` -c.publish.url=${process.env.OMNI_UPDATE_URL}` : '';
    const outOverride = ' -c.directories.output=../dist';

    console.log(`\nEmpaquetando con electron-builder (${PLATFORM}, publish: ${publish})...`);
    try {
        execSync(
            `npx electron-builder ${flagPlataforma} --publish ${publish}${outOverride}${urlOverride}`,
            { stdio: 'inherit', cwd: DIST_SRC }
        );
        console.log('\nCOMPILACION electron-builder EXITOSA — revisa la carpeta dist/');
    } catch (err) {
        console.error('\nError en electron-builder:', err.message);
        process.exitCode = 1;
    }

    limpiarDir(DIST_SRC);
}

build();