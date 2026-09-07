const api = require('./api');
let ipc = null;
try { ipc = require('electron').ipcRenderer; } catch (_) {}

const LicenciaModule = {
    async init() {
        window.LicenciaModule = this;
        window.backView = 'dashboard';
        await this.cargar();
        this.buscarActualizacion();
        this.cargarServidor();
        this.estadoActualizacionApp();
    },

    // ── Servidor (dirección del backend) ──
    async cargarServidor() {
        const el = document.getElementById('srv-body');
        if (!ipc) { if (el) el.textContent = 'Solo disponible en la app de escritorio.'; return; }
        try {
            const s = await ipc.invoke('omni:get-server');
            if (el) el.innerHTML = `Conectado a: <b>${s.apiUrl}</b>`;
            const a = document.getElementById('srv-address'); const p = document.getElementById('srv-port');
            if (a) a.value = s.address || ''; if (p) p.value = s.port || 3636;
        } catch (e) { if (el) el.textContent = 'No se pudo leer la configuración.'; }
    },

    async guardarServidor() {
        if (!ipc) return;
        const address = document.getElementById('srv-address').value.trim();
        const port = document.getElementById('srv-port').value.trim() || '3636';
        if (!address) return Swal.fire('Atención', 'Ingresa la IP o el dominio del servidor.', 'warning');
        const r = await Swal.fire({ title: 'Cambiar servidor y reiniciar', text: `La app se reiniciará y se conectará a ${address}:${port}.`, icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, reiniciar' });
        if (r.isConfirmed) ipc.invoke('omni:set-server', { address, port });
    },

    // ── Actualización de la app de escritorio (electron-updater) ──
    async estadoActualizacionApp() {
        const el = document.getElementById('upd-app-body');
        if (!ipc) { if (el) el.textContent = 'Solo disponible en la app de escritorio.'; return; }
        if (el) el.textContent = 'Automática. Usa el botón para forzar una comprobación ahora.';
    },

    async buscarActualizacionApp() {
        const el = document.getElementById('upd-app-body');
        if (!ipc) return;
        if (el) el.textContent = 'Buscando…';
        try {
            const r = await ipc.invoke('omni:update-check');
            if (!r.ok) { if (el) el.textContent = 'No se pudo comprobar: ' + (r.error || ''); return; }
            if (el) el.textContent = r.version ? `Hay una versión disponible: ${r.version}. Se está descargando…` : 'La app está al día.';
        } catch (e) { if (el) el.textContent = 'No se pudo comprobar actualizaciones de la app.'; }
    },

    async cargar() {
        const el = document.getElementById('lic-card');
        try {
            const r = await api.get('/licencia');
            const d = r.data;
            this._d = d;

            // Paneles del proveedor
            const boxPanel = document.getElementById('lic-box-panel');
            const bCuentas = document.getElementById('lic-btn-cuentas');
            const bLocal = document.getElementById('lic-btn-local');
            const puede = d.puedeGestionar;
            const verCuentas = puede && d.edicion === 'saas';
            const verLocal = puede && d.esAutoridad;
            if (bCuentas) bCuentas.style.display = verCuentas ? '' : 'none';
            if (bLocal) bLocal.style.display = verLocal ? '' : 'none';
            // El recuadro solo si hay al menos un panel para mostrar (en un
            // cliente Local que no es autoridad no aparece nada).
            if (boxPanel) boxPanel.style.display = (verCuentas || verLocal) ? '' : 'none';

            const empEl = document.getElementById('lic-empresas');
            const boxLocal = document.getElementById('lic-box-local');

            if (d.edicion === 'local') {
                if (boxLocal) boxLocal.style.display = '';
                this._pintarLocal({
                    valido: d.activada, motivo: d.motivo, mensaje: d.mensaje,
                    mantenimientoHasta: d.mantenimientoHasta, mantenimientoVigente: d.mantenimientoVigente,
                    verificadoEn: d.verificadoEn, huella: d.huella, servidor: d.servidor
                });
                const mvTxt = d.mantenimientoHasta
                    ? (d.mantenimientoVigente
                        ? `Mantenimiento hasta <b>${String(d.mantenimientoHasta).slice(0, 10)}</b>`
                        : `<span style="color:#c0392b;font-weight:700">Mantenimiento vencido (${String(d.mantenimientoHasta).slice(0, 10)}) — el software funciona igual, pero no recibirá nuevas actualizaciones hasta renovarlo.</span>`)
                    : 'Sin fecha de mantenimiento.';
                if (!d.activada) {
                    el.innerHTML = `<span class="lic-pill lic-bad">Sin activar</span>
                        <div class="omni-sub" style="margin-top:10px;color:#c0392b;font-weight:700">${d.mensaje || 'La licencia aún no se ha activado contra el servidor del proveedor.'}</div>`;
                } else {
                    el.innerHTML = `<span class="lic-pill lic-ok">Licencia perpetua</span>
                        <div style="margin-top:10px;font-size:.9rem">Activada. El software funciona para siempre, con o sin internet.</div>
                        <div class="omni-sub" style="margin-top:6px">${mvTxt}</div>`;
                }
                if (empEl) {
                    if (d.maxEmpresas != null) empEl.innerHTML = `Empresas activas: <b>${d.empresas} / ${d.maxEmpresas}</b> · disponibles: <b>${Math.max(0, d.maxEmpresas - d.empresas)}</b>`;
                    else if (d.empresas != null) empEl.innerHTML = `Empresas activas: <b>${d.empresas}</b> (sin tope)`;
                    else empEl.innerHTML = '';
                }
                return;
            }

            // ── SaaS ──
            if (boxLocal) boxLocal.style.display = 'none';
            const nom = d.cuenta || d.empresa || 'Esta cuenta';
            if (d.estadoCuenta === 'suspendida') {
                el.innerHTML = `<span class="lic-pill lic-bad">Suspendida</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${nom}</b></div>
                    <div class="omni-sub" style="margin-top:6px;color:#c0392b;font-weight:700">Cuenta suspendida por el proveedor.</div>`;
            } else if (d.sinVencimiento) {
                el.innerHTML = `<span class="lic-pill lic-ok">Activa</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${nom}</b> — sin fecha de vencimiento.</div>`;
            } else if (d.vigente) {
                const clase = d.diasRestantes <= 7 ? 'lic-warn' : 'lic-ok';
                el.innerHTML = `<span class="lic-pill ${clase}">Activa</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${nom}</b></div>
                    <div class="omni-sub" style="margin-top:6px">Pagado hasta ${String(d.pagadoHasta).slice(0, 10)} — quedan ${d.diasRestantes} día(s).</div>`;
            } else {
                el.innerHTML = `<span class="lic-pill lic-bad">Vencida</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${nom}</b></div>
                    <div class="omni-sub" style="margin-top:6px;color:#c0392b;font-weight:700">La suscripción venció el ${String(d.pagadoHasta).slice(0, 10)}. Contacta a tu proveedor.</div>`;
            }
            if (empEl) {
                if (d.maxEmpresas != null) empEl.innerHTML = `Empresas activas: <b>${d.empresas} / ${d.maxEmpresas}</b> · disponibles: <b>${Math.max(0, d.maxEmpresas - d.empresas)}</b>`;
                else if (d.empresas != null) empEl.innerHTML = `Empresas activas: <b>${d.empresas}</b> (sin tope)`;
                else empEl.innerHTML = '';
            }
        } catch (e) {
            el.innerHTML = `<span class="lic-pill lic-bad">Error</span> ${e.response?.data?.error || e.message}`;
        }
    },

    // Estado del enlace con el servidor de licencias (solo Local).
    _pintarLocal(loc) {
        const el = document.getElementById('lic-remota');
        if (!el) return;
        const activada = loc && loc.valido === true;
        const cls = activada ? 'lic-ok' : 'lic-bad';
        const txt = activada ? 'Activada (perpetua)'
            : (loc && loc.motivo === 'OTRA_MAQUINA' ? 'Clave en otro servidor'
                : loc && loc.motivo === 'DESCONOCIDA' ? 'Clave no reconocida'
                : loc && loc.motivo === 'SIN_CLAVE' ? 'Sin clave'
                : 'Sin activar');
        el.innerHTML = `<span class="lic-pill ${cls}">${txt}</span>
            <div class="omni-sub" style="margin-top:6px">
                ${loc && loc.mantenimientoHasta ? 'Mantenimiento hasta: <b>' + String(loc.mantenimientoHasta).slice(0, 10) + '</b>' + (loc.mantenimientoVigente ? '' : ' (VENCIDO)') + ' · ' : ''}
                ${loc && loc.verificadoEn ? 'último contacto: ' + new Date(loc.verificadoEn).toLocaleString() : 'sin contacto reciente'}
            </div>
            ${loc && loc.mensaje ? `<div class="omni-sub" style="margin-top:6px;${activada ? '' : 'color:#c0392b;font-weight:700'}">${loc.mensaje}</div>` : ''}
            <div class="omni-sub" style="margin-top:4px;font-size:.7rem">servidor: ${(loc && loc.servidor) || ''}${loc && loc.huella ? ' · máquina: ' + String(loc.huella).slice(0, 12) : ''}</div>`;
    },

    async verificarRemota() {
        const el = document.getElementById('lic-remota');
        if (el) el.innerHTML = 'Sincronizando…';
        try {
            const r = await api.post('/licencia/verificar');
            this._pintarLocal({ ...r.data, servidor: r.data.servidor || '' });
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Sincronizado' });
            this.cargar();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo sincronizar.', 'error');
        }
    },

    async buscarActualizacion() {
        const el = document.getElementById('upd-body');
        try {
            const r = await api.get('/actualizaciones/check');
            const d = r.data;
            if (!d.configurado) {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b>. No hay servidor de actualizaciones configurado.`;
            } else if (d.error) {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b>. ${d.error}`;
            } else if (d.hayNueva) {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b> · <span style="color:#c0392b;font-weight:800">hay una nueva: ${d.disponible}</span><br>
                    ${d.notas ? `<span class="omni-sub">${d.notas}</span><br>` : ''}
                    <button id="upd-btn-aplicar" class="omni-btn omni-btn-primary" style="margin-top:10px" onclick="LicenciaModule.aplicarActualizacion('${d.disponible}')"><i class="fas fa-download"></i> Actualizar ahora</button>
                    <div class="omni-sub" style="margin-top:8px">El servidor también puede actualizarse solo de madrugada (lo activa tu proveedor).</div>`;
            } else {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b>. Estás al día.`;
            }
        } catch (e) {
            el.innerHTML = 'No se pudo comprobar actualizaciones.';
        }
    },

    // Baja y aplica el instalador nuevo del backend. El servicio se
    // autodetiene y vuelve solo en 1-2 min; forzamos re-login.
    async aplicarActualizacion(version) {
        const c = await Swal.fire({
            title: `Actualizar el servidor a ${version}`,
            html: 'El servidor se detendrá y volverá solo en 1-2 minutos. La sesión se cerrará y tendrás que volver a entrar.<br><br>¿Continuar?',
            icon: 'warning', showCancelButton: true,
            confirmButtonText: 'Sí, actualizar ahora', cancelButtonText: 'Cancelar'
        });
        if (!c.isConfirmed) return;

        const btn = document.getElementById('upd-btn-aplicar');
        const el = document.getElementById('upd-body');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Descargando…'; }
        try {
            const r = await api.post('/actualizaciones/aplicar');
            const d = r.data || {};
            if (d.ok) {
                if (el) el.innerHTML = `<b>Actualizando a ${d.version || version}…</b><br><span class="omni-sub">El servidor se reiniciará solo. Vuelve a entrar en un par de minutos.</span>`;
                setTimeout(() => { try { localStorage.clear(); } catch (_) {} location.reload(); }, 90000);
            } else if (d.motivo === 'EN_PROGRESO') {
                Swal.fire('En curso', 'Ya hay una actualización en progreso.', 'info');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Actualizar ahora'; }
            } else {
                Swal.fire('No se pudo', d.mensaje || 'No se pudo iniciar la actualización.', 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Actualizar ahora'; }
            }
        } catch (e) {
            // Si el servicio ya se cayó a mitad, es esperado.
            if (el) el.innerHTML = `<b>Actualización iniciada.</b><br><span class="omni-sub">El servidor se está reiniciando. Vuelve a entrar en un par de minutos.</span>`;
            setTimeout(() => { try { localStorage.clear(); } catch (_) {} location.reload(); }, 90000);
        }
    }
};

module.exports = LicenciaModule;
