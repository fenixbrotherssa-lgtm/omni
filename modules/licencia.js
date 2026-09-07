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
            this._pintarLocal(d.local);

            // Panel de instalaciones Local: solo en la instancia AUTORIDAD y para "soporte".
            const btnPanel = document.getElementById('lic-btn-panel');
            if (btnPanel) btnPanel.style.display = (d.puedeGestionar && d.esAutoridad) ? '' : 'none';

            if (d.edicion === 'local') {
                el.innerHTML = `
                    <span class="lic-pill lic-ok">Edición Local</span>
                    <div style="margin-top:10px;font-size:.9rem">${d.mensaje}</div>`;
                const empL = document.getElementById('lic-empresas');
                if (empL) {
                    if (d.maxEmpresas != null) empL.innerHTML = `Empresas permitidas por la licencia: <b>${d.empresas} / ${d.maxEmpresas}</b>`;
                    else if (d.empresas != null) empL.innerHTML = `Empresas en esta instalación: <b>${d.empresas}</b> (sin tope)`;
                    else empL.innerHTML = '';
                }
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

            // Contador de empresas del plan.
            const emp = document.getElementById('lic-empresas');
            if (emp) {
                if (d.maxEmpresas != null) emp.innerHTML = `Empresas del plan: <b>${d.empresas} / ${d.maxEmpresas}</b>`;
                else if (d.empresas != null) emp.innerHTML = `Empresas de esta cuenta: <b>${d.empresas}</b> (sin tope)`;
                else emp.innerHTML = '';
            }

            // Gestión: SOLO para el usuario "soporte" del proveedor.
            if (d.puedeGestionar && gest) {
                gest.style.display = '';
                const inp = document.getElementById('lic-vig-fecha');
                if (inp && d.vigenciaHasta) inp.value = d.vigenciaHasta;
                const mx = document.getElementById('lic-maxemp');
                if (mx) mx.value = d.maxEmpresas != null ? d.maxEmpresas : '';
            }
        } catch (e) {
            el.innerHTML = `<span class="lic-pill lic-bad">Error</span> ${e.response?.data?.error || e.message}`;
        }
    },

    // Estado del SOPORTE ANUAL (check-in a la autoridad de OMNI CORE, omnicore.casrodsoft.com).
    _pintarLocal(loc) {
        const el = document.getElementById('lic-remota');
        if (!el) return;
        if (!loc || !loc.exigida) {
            el.innerHTML = `<span class="lic-pill lic-ok">Modo libre</span>
                <div class="omni-sub" style="margin-top:6px">Esta instalación no tiene clave de licencia configurada.</div>`;
            return;
        }
        const cls = loc.valido ? (loc.motivo === 'GRACIA' ? 'lic-warn' : 'lic-ok') : 'lic-bad';
        const txt = loc.valido
            ? (loc.motivo === 'GRACIA' ? 'Sin conexión (gracia)' : 'Verificada')
            : (loc.motivo === 'SUSPENDIDA' ? 'Suspendida'
                : loc.motivo === 'OTRA_MAQUINA' ? 'Clave en otro servidor'
                : loc.motivo === 'GRACIA_AGOTADA' ? 'Sin verificar (gracia agotada)'
                : 'Soporte vencido');
        el.innerHTML = `<span class="lic-pill ${cls}">${txt}</span>
            <div class="omni-sub" style="margin-top:6px">
                ${loc.soporteHasta ? 'Soporte hasta: <b>' + String(loc.soporteHasta).slice(0, 10) + '</b> · ' : ''}
                ${loc.verificadoEn ? 'última verificación: ' + new Date(loc.verificadoEn).toLocaleString() : 'nunca verificada'}
            </div>
            ${loc.mensaje ? `<div class="omni-sub" style="margin-top:6px;${loc.valido ? '' : 'color:#c0392b;font-weight:700'}">${loc.mensaje}</div>` : ''}
            <div class="omni-sub" style="margin-top:4px;font-size:.7rem">servidor: ${loc.servidor || ''}${loc.huella ? ' · máquina: ' + loc.huella.slice(0, 12) : ''}</div>`;
    },

    async verificarRemota() {
        const el = document.getElementById('lic-remota');
        if (el) el.innerHTML = 'Verificando…';
        try {
            const r = await api.post('/licencia/verificar');
            this._pintarLocal({ ...r.data, servidor: r.data.servidor || '' });
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Verificado' });
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo verificar.', 'error');
            this.cargar();
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

    // Solo soporte: fija/limpia el tope de empresas de la cuenta SaaS.
    async fijarMaxEmpresas() {
        const raw = document.getElementById('lic-maxemp').value.trim();
        const maxEmpresas = raw === '' ? null : parseInt(raw);
        if (maxEmpresas !== null && (!Number.isFinite(maxEmpresas) || maxEmpresas < 1))
            return Swal.fire('Atención', 'El tope debe ser un número mayor o igual a 1, o vacío para sin tope.', 'warning');
        try {
            await api.post('/licencia/max-empresas', { maxEmpresas });
            window.Toast ? window.Toast.fire({ icon: 'success', title: 'Tope actualizado' }) : Swal.fire('OK', 'Tope actualizado', 'success');
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
