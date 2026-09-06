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
        const gest = document.getElementById('lic-gestion');
        if (gest) gest.style.display = 'none';
        try {
            const r = await api.get('/licencia');
            const d = r.data;

            if (d.edicion === 'local') {
                el.innerHTML = `
                    <span class="lic-pill lic-ok">Edición Local</span>
                    <div style="margin-top:10px;font-size:.9rem">${d.mensaje}</div>`;
                return;
            }

            // SaaS
            if (d.sinVencimiento) {
                el.innerHTML = `
                    <span class="lic-pill lic-ok">Activa</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${d.empresa || 'Esta empresa'}</b> — sin fecha de vencimiento.</div>`;
            } else if (d.vigente) {
                const clase = d.diasRestantes <= 7 ? 'lic-warn' : 'lic-ok';
                el.innerHTML = `
                    <span class="lic-pill ${clase}">Activa</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${d.empresa || 'Esta empresa'}</b></div>
                    <div class="omni-sub" style="margin-top:6px">Vence el ${d.vigenciaHasta} — quedan ${d.diasRestantes} día(s).</div>`;
            } else {
                el.innerHTML = `
                    <span class="lic-pill lic-bad">Vencida</span>
                    <div style="margin-top:10px;font-size:.9rem"><b>${d.empresa || 'Esta empresa'}</b></div>
                    <div class="omni-sub" style="margin-top:6px;color:#c0392b;font-weight:700">La suscripción venció el ${d.vigenciaHasta}. Contacta a tu proveedor.</div>`;
            }

            // Gestión de la fecha: SOLO para el usuario "soporte" del proveedor.
            if (d.puedeGestionar && gest) {
                gest.style.display = '';
                const inp = document.getElementById('lic-vig-fecha');
                if (inp && d.vigenciaHasta) inp.value = d.vigenciaHasta;
            }
        } catch (e) {
            el.innerHTML = `<span class="lic-pill lic-bad">Error</span> ${e.response?.data?.error || e.message}`;
        }
    },

    // Solo soporte: fija/limpia la fecha de vencimiento de esta empresa.
    async fijarVigencia(modo) {
        const body = {};
        if (modo === 'fecha') {
            const f = document.getElementById('lic-vig-fecha').value;
            if (!f) return Swal.fire('Atención', 'Elige una fecha.', 'warning');
            body.vigenciaHasta = f;
        } else if (modo === 'mas30') { body.dias = 30; }
        else if (modo === 'sinvenc') { body.vigenciaHasta = null; }
        try {
            const r = await api.post('/licencia/vigencia', body);
            window.Toast ? window.Toast.fire({ icon: 'success', title: 'Vigencia actualizada' }) : Swal.fire('OK', 'Vigencia actualizada', 'success');
            this.cargar();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar.', 'error');
        }
    },

    async buscarActualizacion() {
        const el = document.getElementById('upd-body');
        try {
            const r = await api.get('/actualizaciones/check');
            const d = r.data;
            if (!d.configurado) {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b>. No hay servidor de actualizaciones configurado (UPDATE_MANIFEST_URL).`;
            } else if (d.error) {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b>. ${d.error}`;
            } else if (d.hayNueva) {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b> · <span style="color:#c0392b;font-weight:800">hay una nueva: ${d.disponible}</span><br>
                    ${d.notas ? `<span class="omni-sub">${d.notas}</span><br>` : ''}
                    ${d.descargaBackend ? `<a href="#" onclick="event.preventDefault();require('electron').shell.openExternal('${d.descargaBackend}')">Descargar instalador del backend</a><br>` : ''}
                    ${d.descargaCliente ? `<a href="#" onclick="event.preventDefault();require('electron').shell.openExternal('${d.descargaCliente}')">Descargar instalador del cliente</a>` : ''}`;
            } else {
                el.innerHTML = `Versión instalada: <b>${d.actual}</b>. Estás al día.`;
            }
        } catch (e) {
            el.innerHTML = 'No se pudo comprobar actualizaciones.';
        }
    }
};

module.exports = LicenciaModule;
