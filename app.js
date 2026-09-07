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
            if (this.isSuperAdmin()) {
                await this.fetchSedes();
            }
            this.conectarSocket();
            this.renderShell();
        }
    },

    // ── Auto-actualización del cliente (electron-updater vía main.js) ──
    escucharActualizaciones() {
        if (!ipcRenderer) return;
        ipcRenderer.on('omni:update-status', (_e, d) => {
            const b = this._bannerUpdate();
            if (d.estado === 'descargando') {
                b.style.display = 'flex';
                b.innerHTML = `<span>Descargando actualización… ${d.porcentaje || 0}%</span>`;
            } else if (d.estado === 'listo') {
                b.style.display = 'flex';
                b.innerHTML = `<span>Versión ${d.version} lista para instalar.</span>
                    <button id="omni-upd-go" style="margin-left:14px;background:#fff;color:#1a365d;border:none;border-radius:7px;padding:5px 12px;font-weight:800;cursor:pointer">Reiniciar e instalar</button>
                    <button id="omni-upd-later" style="margin-left:8px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:7px;padding:5px 12px;font-weight:700;cursor:pointer">Después</button>`;
                document.getElementById('omni-upd-go').onclick = () => ipcRenderer.send('omni:update-install');
                document.getElementById('omni-upd-later').onclick = () => { b.style.display = 'none'; };
            } else if (d.estado === 'error') {
                console.warn('Auto-update:', d.mensaje);
            }
            // 'buscando' / 'al-dia' / 'disponible' -> silencioso (no molesta al usuario)
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
            this.sedes = res.data;
        } catch (err) {
            console.error("Error cargando sedes para selector:", err);
        }
    },

    renderSedeSelector(containerId, callback) {
        const container = document.getElementById(containerId);
        
        // Si el contenedor no existe aún, reintentar en 50ms (Soluciona el lag del DOM)
        if (!container) {
            setTimeout(() => this.renderSedeSelector(containerId, callback), 50);
            return;
        }

        if (!this.isSuperAdmin() || this.sedes.length === 0) return;

        const currentSede = localStorage.getItem('currentSedeId') || (this.user ? this.user.SedeID : null);

        container.innerHTML = `
            <div class="omni-sedepill" title="Empresa / establecimiento operativo">
                <i class="fas fa-building"></i>
                <span>Empresa</span>
                <select id="globalSedeSelector">
                    ${this.sedes.map(s => `<option value="${s.SedeID}" ${s.SedeID == currentSede ? 'selected' : ''}>${s.NombreComercial.toUpperCase()}</option>`).join('')}
                </select>
            </div>`;

        const selector = document.getElementById('globalSedeSelector');
        selector.onchange = (e) => {
            const newSedeId = e.target.value;
            localStorage.setItem('currentSedeId', newSedeId);
            if (callback) callback(newSedeId);
        };
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
                .omni-topbar { height:54px; flex-shrink:0; background:#fff; border-bottom:1px solid #e3e8ef; display:flex; align-items:center; justify-content:space-between; padding:0 26px; }
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
        if (this.isSuperAdmin()) this.renderSedeSelector('globalSedeContainer', () => this.renderView(this._currentView || 'dashboard', 'viewport'));
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