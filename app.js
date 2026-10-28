const fs = require('fs');
const path = require('path');
const api = require('./modules/api');
const { io } = require('socket.io-client');

let ipcRenderer = null;
try { ipcRenderer = require('electron').ipcRenderer; } catch (_) { /* navegador / móvil */ }

const App = {
    user: JSON.parse(localStorage.getItem('user')) || null,
    sedes: [],

    async init() {
        console.log("SystemCore: Iniciando...");
        this.escucharActualizaciones();
        if (!this.user) {
            this.renderView('login', 'app-root');
        } else {
            await this.entrar();
        }
    },

    // ── Empresa activa ────────────────────────────────────────
    //  Un dueño puede tener varias empresas (Sedes). La empresa activa
    //  vive en localStorage('currentSedeId') y TODA la app la usa. Se
    //  muestra siempre (tarjeta en el menú + color en la barra superior)
    //  para que nunca parezca "un solo negocio".

    /** Tras iniciar sesión (o al abrir con sesión guardada): carga las
     *  empresas y, si hay más de una y no hay una válida elegida, pide elegir. */
    async entrar({ nuevaSesion = false } = {}) {
        if (nuevaSesion) localStorage.removeItem('currentSedeId');
        await this.fetchSedes();
        const actual = localStorage.getItem('currentSedeId');
        const valida = actual && this.sedes.some(s => String(s.SedeID) === String(actual));
        if (!valida) localStorage.removeItem('currentSedeId');

        if (this.isSuperAdmin() && this.sedes.length > 1 && !valida) {
            this.renderElegirEmpresa();
            return;
        }
        if (!valida) {
            const propia = this.sedes.find(s => String(s.SedeID) === String(this.user?.SedeID)) || this.sedes[0];
            if (propia) localStorage.setItem('currentSedeId', propia.SedeID);
        }
        if (!window.socket) this.conectarSocket();
        this.renderShell();
    },

    empresaActiva() {
        const id = localStorage.getItem('currentSedeId') || this.user?.SedeID;
        return this.sedes.find(s => String(s.SedeID) === String(id))
            || { SedeID: id, NombreComercial: 'Empresa', RUC_NIT: '' };
    },

    colorEmpresa(sedeId) {
        const paleta = ['#2f7be6', '#16a085', '#8e44ad', '#d35400', '#c0392b', '#2c3e50', '#b7950b', '#00838f'];
        const i = this.sedes.findIndex(s => String(s.SedeID) === String(sedeId));
        return paleta[(i >= 0 ? i : (parseInt(sedeId) || 0)) % paleta.length];
    },

    _srvBase() {
        return ((window.AppConfig && window.AppConfig.apiUrl) || 'http://localhost:3636/api').replace(/\/api\/?$/, '');
    },

    _esc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

    /** Logo de la empresa o, si no tiene, sus iniciales sobre su color. */
    _logoEmpresa(s, tam = 38) {
        const color = this.colorEmpresa(s.SedeID);
        const ini = this._esc(String(s.NombreComercial || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase());
        const caja = `width:${tam}px;height:${tam}px;border-radius:${Math.round(tam / 4)}px;flex-shrink:0;`;
        const iniciales = `<span style="${caja}display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:900;font-size:${Math.round(tam * 0.38)}px">${ini}</span>`;
        if (!s.LogoPath) return iniciales;
        return `<img src="${this._srvBase()}/uploads/${this._esc(s.LogoPath)}" style="${caja}object-fit:cover;background:#fff" onerror="this.outerHTML=${this._esc(JSON.stringify(iniciales))}">`;
    },

    /** Pantalla completa para elegir la empresa (después de iniciar sesión). */
    renderElegirEmpresa() {
        const root = document.getElementById('app-root');
        const tarjetas = this.sedes.map(s => `
            <button class="omni-elige-card" style="--emp:${this.colorEmpresa(s.SedeID)}" onclick="App.elegirEmpresa(${s.SedeID})">
                ${this._logoEmpresa(s, 54)}
                <div><b>${this._esc(s.NombreComercial)}</b>
                <small>${s.RazonSocial && s.RazonSocial !== s.NombreComercial ? this._esc(s.RazonSocial) + ' · ' : ''}RUC ${this._esc(s.RUC_NIT || '—')}</small></div>
                <i class="fas fa-arrow-right"></i>
            </button>`).join('');
        root.innerHTML = `
            <div class="omni-elige">
                <div class="omni-elige-box">
                    <img src="./assets/omnicore-logo.png" alt="OMNI CORE" style="height:44px">
                    <h2>¿Con qué empresa vas a trabajar?</h2>
                    <p>Hola ${this._esc(this.user?.NombreFull || '')}. Tienes ${this.sedes.length} empresas; todo lo que registres quedará en la que elijas. Puedes cambiarla después desde el menú.</p>
                    <div class="omni-elige-grid">${tarjetas}</div>
                    <button class="omni-elige-salir" onclick="App.clearSession()"><i class="fas fa-arrow-right-from-bracket"></i> Salir</button>
                </div>
            </div>
            <style>
                .omni-elige { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(160deg,#0f1e33,#1a3a66); font-family:'Inter','Segoe UI',sans-serif; padding:24px; }
                .omni-elige-box { background:#fff; border-radius:18px; padding:32px 34px; width:100%; max-width:620px; box-shadow:0 20px 60px rgba(0,0,0,.35); text-align:center; }
                .omni-elige-box h2 { margin:14px 0 6px; color:#1a365d; font-size:1.35rem; font-weight:900; }
                .omni-elige-box p { margin:0 0 20px; color:#5b6b80; font-size:.85rem; }
                .omni-elige-grid { display:flex; flex-direction:column; gap:10px; max-height:52vh; overflow-y:auto; padding:2px; }
                .omni-elige-card { display:flex; align-items:center; gap:14px; text-align:left; background:#f7f9fc; border:1px solid #e2e8f0; border-left:5px solid var(--emp); border-radius:12px; padding:12px 16px; cursor:pointer; font-family:inherit; transition:all .15s; }
                .omni-elige-card:hover { background:#eef4ff; transform:translateX(3px); }
                .omni-elige-card > div { flex:1; min-width:0; }
                .omni-elige-card b { display:block; color:#1a365d; font-size:.98rem; font-weight:900; }
                .omni-elige-card small { color:#718096; font-size:.75rem; }
                .omni-elige-card > i { color:var(--emp); }
                .omni-elige-salir { margin-top:18px; background:none; border:none; color:#c0392b; font-weight:800; cursor:pointer; font-size:.8rem; }
            </style>`;
    },

    elegirEmpresa(sedeId) {
        localStorage.setItem('currentSedeId', sedeId);
        if (!window.socket) this.conectarSocket();
        this.renderShell();
        this._avisoEmpresa();
    },

    /** Cambio de empresa desde el menú: actualiza todo y avisa claramente. */
    cambiarEmpresa(sedeId) {
        if (String(sedeId) === String(localStorage.getItem('currentSedeId'))) return;
        localStorage.setItem('currentSedeId', sedeId);
        this._pintarEmpresaActiva();
        this.renderView(this._currentView || 'dashboard', 'viewport');
        this._avisoEmpresa();
    },

    _avisoEmpresa() {
        const e = this.empresaActiva();
        if (window.Toast) window.Toast.fire({ icon: 'info', title: `Ahora trabajas en: ${e.NombreComercial}`, text: e.RUC_NIT ? `RUC ${e.RUC_NIT}` : '' });
    },

    /** Tarjeta de empresa en el menú lateral + color de la barra superior + selector. */
    _pintarEmpresaActiva() {
        const e = this.empresaActiva();
        const color = this.colorEmpresa(e.SedeID);
        document.documentElement.style.setProperty('--omni-emp', color);
        const card = document.getElementById('omni-emp-card');
        if (card) {
            const varias = this.isSuperAdmin() && this.sedes.length > 1;
            card.innerHTML = `
                ${this._logoEmpresa(e, 40)}
                <div class="omni-emp-txt"><small>EMPRESA ACTIVA</small><b title="${this._esc(e.NombreComercial)}">${this._esc(e.NombreComercial)}</b>
                <span>RUC ${this._esc(e.RUC_NIT || '—')}</span></div>
                ${varias ? `<button title="Cambiar de empresa" onclick="App.abrirCambioEmpresa()"><i class="fas fa-right-left"></i></button>` : ''}`;
        }
        const sel = document.getElementById('globalSedeSelector');
        if (sel) sel.value = e.SedeID;
    },

    /** Cambio de empresa desde la tarjeta del menú: lista con logo y RUC. */
    abrirCambioEmpresa() {
        const actual = String(this.empresaActiva().SedeID);
        Swal.fire({
            title: 'Cambiar de empresa', width: 560, showConfirmButton: false, showCloseButton: true,
            html: `<div style="display:flex;flex-direction:column;gap:8px;text-align:left">${this.sedes.map(s => `
                <button onclick="Swal.close();App.cambiarEmpresa(${s.SedeID})" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:inherit;
                    border:1px solid ${String(s.SedeID) === actual ? this.colorEmpresa(s.SedeID) : '#e2e8f0'};border-left:5px solid ${this.colorEmpresa(s.SedeID)};background:${String(s.SedeID) === actual ? '#eef4ff' : '#f7f9fc'}">
                    ${this._logoEmpresa(s, 36)}
                    <span style="flex:1"><b style="display:block;color:#1a365d">${this._esc(s.NombreComercial)}</b><small style="color:#718096">RUC ${this._esc(s.RUC_NIT || '—')}</small></span>
                    ${String(s.SedeID) === actual ? '<small style="color:#2f7be6;font-weight:800">ACTUAL</small>' : ''}
                </button>`).join('')}</div>`
        });
    },

    // ── Auto-actualización del cliente (electron-updater vía main.js) ──
    escucharActualizaciones() {
        if (!ipcRenderer) return;
        // Silencioso: la versión nueva se descarga sola y se instala al cerrar
        // la app. Sin banners. En Licencia se puede instalar al momento.
        ipcRenderer.on('omni:update-status', (_e, d) => {
            if (d.estado === 'listo') this._updateLista = d.version;
            else if (d.estado === 'error') console.warn('Auto-update:', d.mensaje);
        });
    },

    _bannerUpdate() {
        let b = document.getElementById('omni-update-banner');
        if (!b) {
            b = document.createElement('div');
            b.id = 'omni-update-banner';
            b.style.cssText = 'display:none;position:fixed;left:0;right:0;bottom:0;z-index:99999;'
                + 'background:linear-gradient(90deg,#1a365d,#2f7be6);color:#fff;padding:10px 20px;'
                + 'font:600 .82rem Inter,system-ui,sans-serif;align-items:center;justify-content:center;'
                + 'box-shadow:0 -2px 12px rgba(0,0,0,.25)';
            document.body.appendChild(b);
        }
        return b;
    },

    conectarSocket() {
        const baseUrl = (window.AppConfig && window.AppConfig.apiUrl)
            ? window.AppConfig.apiUrl.replace('/api', '')
            : 'http://localhost:3636';
        const sedeId = localStorage.getItem('currentSedeId') || (this.user ? this.user.SedeID : '');

        window.socket = io(baseUrl, {
            query: { sedeId },
            transports: ['websocket'],
            reconnectionDelay: 3000,
            reconnectionAttempts: Infinity
        });

        window.socket.on('connect', () => {
            console.log('🔌 Socket conectado al servidor');
            const ind = document.getElementById('socket-status-indicator');
            if (ind) { ind.style.background = '#27ae60'; ind.title = 'Conectado'; }
        });

        window.socket.on('disconnect', (reason) => {
            console.warn('🔌 Socket desconectado:', reason);
            const ind = document.getElementById('socket-status-indicator');
            if (ind) { ind.style.background = '#e74c3c'; ind.title = 'Sin conexión con servidor'; }
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Sin conexión con el servidor',
                    text: 'Reconectando automáticamente...',
                    icon: 'warning', timer: 4000, timerProgressBar: true,
                    position: 'top-end', toast: true, showConfirmButton: false
                });
            }
        });

        window.socket.on('reconnect', (attempt) => {
            console.log(`🔌 Socket reconectado (intento ${attempt})`);
            const ind = document.getElementById('socket-status-indicator');
            if (ind) { ind.style.background = '#27ae60'; ind.title = 'Conectado'; }
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Conexión restaurada',
                    icon: 'success', timer: 3000, timerProgressBar: true,
                    position: 'top-end', toast: true, showConfirmButton: false
                });
            }
            // Refrescar datos del módulo activo para recuperar cambios perdidos
            if (window.RestauranteModule && typeof window.RestauranteModule.cargarMesas === 'function') {
                window.RestauranteModule.cargarMesas();
                window.RestauranteModule.actualizarBadgeCocina();
            }
        });

        // Buffer global persistente para pedidos Room Service (POS ALIMENTO).
        // Se registra aquí para no perderse eventos al cambiar de módulo.
        if (!window._pedidosPosDesktop) window._pedidosPosDesktop = [];
        if (!window._pedidosPosDesktopEntregados) window._pedidosPosDesktopEntregados = [];

        window.socket.on('cocina:pedido_pos', (data) => {
            window._pedidosPosDesktop.push(data);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: `🔔 ${data.origen} — ROOM SERVICE`,
                    html: `<b>${data.nombreProducto}</b> &nbsp;x${data.cantidad}`,
                    icon: 'info', timer: 6000, timerProgressBar: true,
                    position: 'top-end', toast: true, showConfirmButton: false
                });
            }
            if (window.RestauranteModule && typeof window.RestauranteModule.renderPosDesktop === 'function') {
                window.RestauranteModule._pedidosPos = window._pedidosPosDesktop;
                window.RestauranteModule._pedidosPosEntregados = window._pedidosPosDesktopEntregados;
                const panel = document.getElementById('panel-cocina-desktop');
                if (panel && !panel.classList.contains('hidden')) {
                    window.RestauranteModule.renderPosDesktop();
                }
            }
        });
    },

    isSuperAdmin() {
        return this.user && parseInt(this.user.RolID) === 1;
    },

    async fetchSedes() {
        try {
            const res = await api.get('/admin/sedes');
            const todas = Array.isArray(res.data) ? res.data : [];
            // Un colaborador solo trabaja en su empresa; el administrador ve las de su cuenta.
            this.sedes = this.isSuperAdmin() ? todas
                : todas.filter(s => String(s.SedeID) === String(this.user?.SedeID));
        } catch (err) {
            console.error("Error cargando sedes para selector:", err);
        }
    },

    // UN SOLO selector de empresa: el de la barra superior (id globalSedeSelector).
    // Las vistas que antes dibujaban su propio selector reciben solo una
    // etiqueta con la empresa activa (al cambiar arriba, la vista se recarga).
    renderSedeSelector(containerId, callback, _intentos = 0) {
        const container = document.getElementById(containerId);

        // Si el contenedor no existe aún, reintentar (lag del DOM), con tope
        if (!container) {
            if (_intentos < 40) setTimeout(() => this.renderSedeSelector(containerId, callback, _intentos + 1), 50);
            return;
        }
        if (this.sedes.length === 0) return;

        const e = this.empresaActiva();
        if (containerId !== 'globalSedeContainer') {
            container.innerHTML = `<span class="omni-empchip" style="--emp:${this.colorEmpresa(e.SedeID)}"
                title="Empresa activa. Se cambia desde el menú lateral o la barra superior."><i class="fas fa-building"></i> ${this._esc(e.NombreComercial)}</span>`;
            return;
        }

        if (!this.isSuperAdmin() || this.sedes.length < 2) { container.innerHTML = ''; return; }
        container.innerHTML = `
            <div class="omni-sedepill" title="Empresa activa: todo lo que veas y registres es de esta empresa">
                <i class="fas fa-building"></i>
                <span>Empresa</span>
                <select id="globalSedeSelector">
                    ${this.sedes.map(s => `<option value="${s.SedeID}" ${String(s.SedeID) === String(e.SedeID) ? 'selected' : ''}>${this._esc(s.NombreComercial).toUpperCase()}</option>`).join('')}
                </select>
            </div>`;
        document.getElementById('globalSedeSelector').onchange = (ev) => this.cambiarEmpresa(ev.target.value);
    },

    renderShell() {
        // ACTUALIZAR ESTADO DEL USUARIO DESDE STORAGE
        this.user = JSON.parse(localStorage.getItem('user'));

        // Solo crear socket si no existe — Socket.io maneja la reconexión internamente
        if (!window.socket) {
            this.conectarSocket();
        }

        const admin = this.isSuperAdmin();
        const nav = [
            { grupo: 'RESUMEN', items: [
                ['dashboard', 'Panel general', 'fa-gauge-high'],
                ['kpi', 'Tablero KPI', 'fa-chart-column'],
                ['manual', 'Manual de ayuda', 'fa-circle-question'] ] },
            { grupo: 'CONTABILIDAD', items: [
                ['plancuentas', 'Plan de cuentas', 'fa-sitemap'],
                ['librodiario', 'Libro diario', 'fa-book-open'],
                ['libromayor', 'Libro mayor', 'fa-layer-group'],
                ['balancecomprobacion', 'Balance de comprobación', 'fa-scale-balanced'],
                ['estadosfinancieros', 'Estados financieros', 'fa-file-invoice-dollar'],
                ['conciliacion', 'Conciliación bancaria', 'fa-scale-balanced', true],
                ['dimensiones', 'Dimensiones y períodos', 'fa-diagram-project', true] ] },
            { grupo: 'TRIBUTARIO · SRI', items: [
                ['facturacion', 'Facturación electrónica', 'fa-file-signature'],
                ['ats', 'ATS — Anexo Transaccional', 'fa-file-shield'] ] },
            { grupo: 'COMERCIAL', items: [
                ['pos', 'Punto de venta', 'fa-cart-shopping'],
                ['recurrente', 'Omni Recurrente', 'fa-repeat'],
                ['crm', 'CRM — Clientes', 'fa-address-book'],
                ['cxc', 'Cuentas por cobrar', 'fa-hand-holding-dollar'],
                ['cxp', 'Cuentas por pagar', 'fa-file-invoice'],
                ['caja', 'Caja', 'fa-cash-register'] ] },
            { grupo: 'OPERACIÓN', items: [
                ['inventario', 'Inventario', 'fa-boxes-stacked', true],
                ['activos', 'Activos fijos', 'fa-desktop', true],
                ['personal', 'Personal y nómina', 'fa-id-badge', true],
                ['mantenimiento', 'Mantenimiento', 'fa-tools'] ] },
            { grupo: 'ADMINISTRACIÓN', items: [
                ['usuarios', 'Usuarios', 'fa-users-gear', true],
                ['sedes', 'Empresas', 'fa-building', true],
                ['respaldos', 'Respaldos', 'fa-database', true],
                ['licencia', 'Licencia', 'fa-key', true],
                ['cuentas-saas', 'Cuentas SaaS', 'fa-building-user', 'sop'],
                ['licencias-local', 'Licencias Local', 'fa-key', 'sop'],
                ['auditoria', 'Auditoría', 'fa-shield-halved', true] ] }
        ];
        const soporte = !!(this.user && this.user.EsSoporte);
        const navHtml = nav.map(g => {
            const its = g.items.filter(it => it[3] === 'sop' ? soporte : (!it[3] || admin));
            if (!its.length) return '';
            return `<div class="omni-nav-grp"><span>${g.grupo}</span>${its.map(([v, label, ic]) =>
                `<a class="omni-nav-link" data-view="${v}" onclick="App.renderView('${v}','viewport')"><i class="fas ${ic}"></i>${label}</a>`).join('')}</div>`;
        }).join('');

        document.getElementById('app-root').innerHTML = `
            <div class="omni-app">
                <aside class="omni-side">
                    <div class="omni-brand">
                        <img src="./assets/omnicore-logo.png" alt="OMNI CORE">
                        <div><b>OMNI CORE</b><small>Plataforma Contable</small></div>
                    </div>
                    <div id="omni-emp-card" class="omni-emp"></div>
                    <nav class="omni-nav">${navHtml}</nav>
                    <div class="omni-side-foot">
                        <div class="omni-user">
                            <i class="fas fa-circle-user"></i>
                            <div><b>${this.user && this.user.NombreFull ? this.user.NombreFull : 'Usuario'}</b>
                            <small>${admin ? 'Administrador' : 'Colaborador'}</small></div>
                        </div>
                        <button onclick="App.logout()"><i class="fas fa-arrow-right-from-bracket"></i> Salir</button>
                    </div>
                </aside>
                <main class="omni-main">
                    <header class="omni-topbar">
                        <div id="omni-crumb" class="omni-crumb">Panel general</div>
                        <div class="omni-topbar-r">
                            <div id="globalSedeContainer"></div>
                            <div id="lic-pill-topbar"></div>
                            <span class="omni-conn"><span id="socket-status-indicator"></span> Servidor</span>
                        </div>
                    </header>
                    <div id="viewport"></div>
                </main>
            </div>
            <style>
                .omni-app { display:flex; height:100vh; width:100vw; overflow:hidden; font-family:'Inter','Segoe UI',sans-serif; background:#eef1f5; }
                .omni-side { width:248px; flex-shrink:0; background:linear-gradient(180deg,#0f1e33,#122845); color:#c7d6ea; display:flex; flex-direction:column; }
                .omni-brand { display:flex; align-items:center; gap:11px; padding:20px 18px 16px; border-bottom:1px solid rgba(255,255,255,.07); }
                .omni-brand img { height:34px; width:34px; object-fit:contain; }
                .omni-brand b { display:block; color:#fff; font-size:.95rem; font-weight:900; letter-spacing:2px; }
                .omni-brand small { color:#7fa8d6; font-size:.62rem; letter-spacing:1px; text-transform:uppercase; }
                .omni-emp { display:flex; align-items:center; gap:10px; margin:12px 12px 2px; padding:10px 10px 10px 12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-left:4px solid var(--omni-emp,#2f7be6); border-radius:10px; }
                .omni-emp-txt { flex:1; min-width:0; }
                .omni-emp-txt small { display:block; font-size:.55rem; font-weight:800; letter-spacing:1.2px; color:#7fa8d6; }
                .omni-emp-txt b { display:block; color:#fff; font-size:.82rem; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .omni-emp-txt span { display:block; color:#9fb8d6; font-size:.65rem; }
                .omni-emp button { background:rgba(255,255,255,.1); border:none; color:#fff; width:30px; height:30px; border-radius:8px; cursor:pointer; flex-shrink:0; }
                .omni-emp button:hover { background:var(--omni-emp,#2f7be6); }
                .omni-empchip { display:inline-flex; align-items:center; gap:7px; padding:5px 12px; border-radius:20px; background:#fff; border:1px solid #e0e7f0; border-left:4px solid var(--emp); font-size:.75rem; font-weight:800; color:#1a365d; }
                .omni-empchip i { color:var(--emp); }
                .omni-nav { flex:1; overflow-y:auto; padding:10px 0 20px; }
                .omni-nav::-webkit-scrollbar { width:5px; }
                .omni-nav::-webkit-scrollbar-thumb { background:#2b436a; border-radius:4px; }
                .omni-nav-grp { margin-top:14px; }
                .omni-nav-grp > span { display:block; padding:0 20px 6px; font-size:.58rem; font-weight:800; letter-spacing:1.6px; color:#5f82ad; }
                .omni-nav-link { display:flex; align-items:center; gap:11px; padding:9px 20px; font-size:.8rem; font-weight:600; color:#b8cbe4; cursor:pointer; border-left:3px solid transparent; transition:all .15s; }
                .omni-nav-link i { width:16px; text-align:center; font-size:.85rem; color:#6f93c0; }
                .omni-nav-link:hover { background:rgba(255,255,255,.05); color:#fff; }
                .omni-nav-link.active { background:rgba(47,123,230,.16); border-left-color:#2f7be6; color:#fff; }
                .omni-nav-link.active i { color:#5fa0f0; }
                .omni-side-foot { border-top:1px solid rgba(255,255,255,.07); padding:14px 16px; }
                .omni-user { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
                .omni-user i { font-size:1.6rem; color:#5fa0f0; }
                .omni-user b { display:block; color:#fff; font-size:.78rem; }
                .omni-user small { color:#7fa8d6; font-size:.66rem; text-transform:uppercase; letter-spacing:.5px; }
                .omni-side-foot button { width:100%; background:rgba(231,76,60,.12); color:#ff8b7d; border:none; padding:9px; border-radius:8px; font-weight:800; font-size:.75rem; cursor:pointer; }
                .omni-side-foot button:hover { background:rgba(231,76,60,.22); }
                .omni-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
                .omni-topbar { height:54px; flex-shrink:0; background:#fff; border-bottom:1px solid #e3e8ef; border-top:3px solid var(--omni-emp,#2f7be6); display:flex; align-items:center; justify-content:space-between; padding:0 26px; }
                .omni-crumb { font-size:.9rem; font-weight:800; color:#1a365d; letter-spacing:.5px; }
                .omni-topbar-r { display:flex; align-items:center; gap:16px; }
                .omni-topbar-r #globalSedeContainer { display:flex; align-items:center; }
                .omni-sedepill { display:flex; align-items:center; gap:8px; height:34px; padding:0 12px; background:#f1f5fa; border:1px solid #e0e7f0; border-radius:9px; }
                .omni-sedepill > i { color:#2f7be6; font-size:.8rem; }
                .omni-sedepill > span { font-size:.6rem; font-weight:800; letter-spacing:1px; color:#8b98a8; text-transform:uppercase; }
                .omni-sedepill select { border:none; background:transparent; font-size:.8rem; font-weight:800; color:#1a365d; outline:none; cursor:pointer; max-width:220px; }
                .omni-conn { display:flex; align-items:center; gap:7px; font-size:.68rem; font-weight:800; color:#718096; text-transform:uppercase; }
                #socket-status-indicator { width:9px; height:9px; border-radius:50%; background:#27ae60; box-shadow:0 0 6px rgba(39,174,96,.6); }
                #viewport { flex:1; overflow-y:auto; background:#eef1f5; }
                .omni-licpill { display:flex; align-items:center; gap:6px; height:28px; padding:0 10px; border-radius:7px; font-size:.68rem; font-weight:800; cursor:pointer; text-transform:uppercase; letter-spacing:.4px; }
                .omni-licpill.ok { background:#eaf7ef; color:#1f9d55; }
                .omni-licpill.warn { background:#fff7ea; color:#a9791f; }
                .omni-licpill.bad { background:#fdeceb; color:#c0392b; }
                .omni-licpill:hover { filter:brightness(.96); }
            </style>
        `;
        this._pintarEmpresaActiva();
        this.renderSedeSelector('globalSedeContainer');
        if (this.isSuperAdmin()) this.cargarLicenciaPill();
        this.renderView('dashboard', 'viewport');
    },

    // Aviso NO invasivo en la topbar. Solo en SaaS y solo si la empresa
    // tiene fecha de vencimiento: muestra los días que quedan. En Local
    // no muestra nada (el licenciamiento Local lo maneja el proveedor
    // por fuera). Solo lo ve un administrador.
    async cargarLicenciaPill() {
        const el = document.getElementById('lic-pill-topbar');
        if (!el) return;
        try {
            const r = await api.get('/licencia');
            const d = r.data;
            if (d.edicion !== 'saas' || d.sinVencimiento || d.pagadoHasta == null) { el.innerHTML = ''; return; }

            const dias = d.diasRestantes;
            const texto = dias >= 0 ? `Vence en ${dias} día${dias === 1 ? '' : 's'}` : `Venció hace ${-dias} día${dias === -1 ? '' : 's'}`;
            const clase = dias < 0 ? 'bad' : (dias <= 7 ? 'warn' : 'ok');
            el.innerHTML = `<span class="omni-licpill ${clase}" onclick="App.renderView('licencia','viewport')" title="Ver detalle de licencia"><i class="fas fa-key"></i>${texto}</span>`;
        } catch (e) {
            el.innerHTML = '';
        }
    },

    renderView(viewName, targetId) {
        try {
            const viewPath = path.join(__dirname, 'views', `${viewName}.html`);
            if (!fs.existsSync(viewPath)) throw new Error(`HTML no encontrado: ${viewPath}`);

            const html = fs.readFileSync(viewPath, 'utf8').replace(/^\uFEFF/, '');
            const target = document.getElementById(targetId);

            if (target) {
                target.innerHTML = html;
                this._currentView = viewName;

                const links = document.querySelectorAll('.omni-nav-link');
                let label = null;
                links.forEach(a => {
                    const on = a.dataset.view === viewName;
                    a.classList.toggle('active', on);
                    if (on) label = a.textContent.trim();
                });
                const crumb = document.getElementById('omni-crumb');
                if (crumb) crumb.textContent = label || (viewName.charAt(0).toUpperCase() + viewName.slice(1));

                setTimeout(() => this.loadModuleLogic(viewName), 10);
            }
        } catch (err) {
            console.error("Error en Navegación:", err.message);
        }
    },

    loadModuleLogic(name) {
        const modulePath = path.join(__dirname, 'modules', `${name}.js`);

        // Limpiar listeners del módulo anterior para evitar acumulación
        if (window.socket) {
            window.socket.off('habitacion:cambio');
            window.socket.off('mesa:cambio');
            window.socket.off('parqueadero:cambio');
            window.socket.off('producto:stock');
            window.socket.off('cocina:item_listo');
            window.socket.off('cocina:pedido_nuevo');
            window.socket.off('cocina:estado_cambio');
        }

        try {
            if (!fs.existsSync(modulePath)) return;

            // Limpia TODO el caché de modules/ (no solo el de la vista actual) — muchos
            // módulos de vista (facturacion.js, etc.) hacen require() de sub-módulos
            // propios (notascredito.js, retenciones.js, ...) que si no, quedan atascados
            // con código viejo aunque se renavegue a la vista contenedora.
            const modulesDir = path.join(__dirname, 'modules') + path.sep;
            Object.keys(require.cache).forEach(cachedPath => {
                if (cachedPath.startsWith(modulesDir)) delete require.cache[cachedPath];
            });

            const Module = require(modulePath);

            if (name === 'usuarios' || name === 'admin') {
                window.UsuariosModule = Module;
            } else {
                const globalName = name.charAt(0).toUpperCase() + name.slice(1) + 'Module';
                window[globalName] = Module;
            }

            if (Module && Module.init) {
                Module.init();
            }
        } catch (e) {
            console.error(`❌ CRÍTICO en módulo [${name}]:`, e);
        }
    },

    logout() {
        if(typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¿SALIR DEL SISTEMA?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'SÍ, SALIR',
                cancelButtonText: 'CANCELAR',
                background: '#e0e0e4',
                color: '#2c3e50'
            }).then((result) => { if (result.isConfirmed) this.clearSession(); });
        } else {
            if(confirm("¿Cerrar sesión?")) this.clearSession();
        }
    },

    clearSession() {
        localStorage.clear();
        window.location.reload();
    }
};

App.init();
window.App = App;