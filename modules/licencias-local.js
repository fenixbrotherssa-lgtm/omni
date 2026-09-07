const api = require('./api');

// Panel del proveedor: licencias de las instalaciones LOCAL (soporte anual).
// Solo se llega aquí desde la pantalla Licencia, y solo si el usuario es
// "soporte" y esta instancia es la AUTORIDAD (omnicore.casrodsoft.com).
const LicLocalModule = {
    async init() {
        window.LicLocalModule = this;
        window.backView = 'licencia';
        await this.cargar();
    },

    async cargar() {
        const cont = document.getElementById('lic-local-tabla');
        // Aviso si esta instancia no es la autoridad (sus claves no responden check-ins).
        try {
            const info = await api.get('/licencia');
            const av = document.getElementById('lic-local-aviso');
            if (av) av.style.display = info.data && info.data.esAutoridad ? 'none' : '';
        } catch (_) {}
        try {
            const r = await api.get('/licenciamiento/admin');
            const filas = r.data || [];
            if (!filas.length) {
                cont.innerHTML = '<p class="omni-sub" style="margin:0">Todavía no hay licencias. Crea la primera con “Nueva licencia”.</p>';
                return;
            }
            cont.innerHTML = `<div class="lic-scroll"><table class="lic-tbl">
                <thead><tr>
                    <th>Cliente</th><th>Clave</th><th>Situación</th><th>Soporte hasta</th>
                    <th>Empresas</th><th>Máquina</th><th>Último check-in</th><th></th>
                </tr></thead>
                <tbody>${filas.map(f => this._fila(f)).join('')}</tbody>
            </table></div>`;
        } catch (e) {
            cont.innerHTML = `<span class="lic-pill lic-bad">Error</span> ${e.response?.data?.error || e.message}`;
        }
    },

    _fila(f) {
        const sit = f.Situacion === 'vigente'
            ? `<span class="lic-pill lic-ok">Vigente</span>`
            : f.Situacion === 'suspendida'
                ? `<span class="lic-pill lic-gray">Suspendida</span>`
                : `<span class="lic-pill lic-bad">Vencida</span>`;
        const dias = (f.DiasRestantes != null && f.Situacion === 'vigente')
            ? `<div class="omni-sub" style="margin-top:3px">${f.DiasRestantes} día(s)</div>` : '';
        const maq = f.MaquinaHuella
            ? `${f.MaquinaNombre || '—'}<div class="omni-sub" style="margin-top:3px">${String(f.MaquinaHuella).slice(0, 12)}${f.UltimaIP ? ' · ' + f.UltimaIP : ''}</div>`
            : `<span class="omni-sub">sin activar</span>`;
        const chk = f.UltimoCheckin
            ? new Date(f.UltimoCheckin).toLocaleString() + (f.VersionVista ? `<div class="omni-sub" style="margin-top:3px">v${f.VersionVista}</div>` : '')
            : '<span class="omni-sub">nunca</span>';
        const suspBtn = f.Estado === 'suspendida'
            ? `<button class="omni-btn omni-btn-sm" onclick="LicLocalModule.estado(${f.LicenciaID},'activa')"><i class="fas fa-play"></i> Reactivar</button>`
            : `<button class="omni-btn omni-btn-sm" onclick="LicLocalModule.estado(${f.LicenciaID},'suspendida')"><i class="fas fa-pause"></i> Suspender</button>`;
        const emp = f.MaxEmpresas != null
            ? `<b>${f.MaxEmpresas}</b>`
            : `<span class="omni-sub">sin tope</span>`;
        return `<tr>
            <td><b>${this._esc(f.Cliente)}</b>${f.Notas ? `<div class="omni-sub" style="margin-top:3px">${this._esc(f.Notas)}</div>` : ''}</td>
            <td><span class="lic-clave">${f.Clave}</span>
                <button class="omni-btn omni-btn-sm" style="margin-left:6px" onclick="LicLocalModule.copiar('${f.Clave}')"><i class="fas fa-copy"></i></button></td>
            <td>${sit}${dias}</td>
            <td>${String(f.SoporteHasta).slice(0, 10)}</td>
            <td>${emp} <button class="omni-btn omni-btn-sm" onclick="LicLocalModule.limites(${f.LicenciaID}, ${f.MaxEmpresas == null ? 'null' : f.MaxEmpresas})"><i class="fas fa-pen"></i></button></td>
            <td>${maq}</td>
            <td>${chk}</td>
            <td><div class="lic-acts">
                <button class="omni-btn omni-btn-sm omni-btn-primary" onclick="LicLocalModule.renovar(${f.LicenciaID},'${this._esc(f.Cliente)}')"><i class="fas fa-rotate"></i> Renovó</button>
                ${suspBtn}
                ${f.MaquinaHuella ? `<button class="omni-btn omni-btn-sm" onclick="LicLocalModule.desvincular(${f.LicenciaID})"><i class="fas fa-unlink"></i> Liberar máquina</button>` : ''}
                <button class="omni-btn omni-btn-sm" onclick="LicLocalModule.eliminar(${f.LicenciaID},'${this._esc(f.Cliente)}')"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`;
    },

    _esc(s) { return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); },

    async nueva() {
        const { value: v } = await Swal.fire({
            title: 'Nueva licencia Local',
            html: `
                <input id="ll-cliente" class="swal2-input" placeholder="Nombre del cliente">
                <select id="ll-meses" class="swal2-input">
                    <option value="12">12 meses de soporte</option>
                    <option value="6">6 meses</option>
                    <option value="3">3 meses</option>
                    <option value="1">1 mes (prueba)</option>
                </select>
                <input id="ll-maxemp" type="number" min="1" class="swal2-input" placeholder="Máx. empresas (vacío = sin tope)">
                <input id="ll-notas" class="swal2-input" placeholder="Notas (opcional)">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Crear y generar clave',
            preConfirm: () => {
                const cliente = document.getElementById('ll-cliente').value.trim();
                if (!cliente) { Swal.showValidationMessage('El nombre del cliente es obligatorio.'); return false; }
                const me = document.getElementById('ll-maxemp').value.trim();
                return {
                    cliente,
                    meses: parseInt(document.getElementById('ll-meses').value),
                    maxEmpresas: me === '' ? null : parseInt(me),
                    notas: document.getElementById('ll-notas').value.trim() || null
                };
            }
        });
        if (!v) return;
        try {
            const r = await api.post('/licenciamiento/admin', v);
            await Swal.fire({
                icon: 'success',
                title: 'Licencia creada',
                html: `Pega esta clave en el instalador del backend del cliente (campo <b>Clave</b>):
                    <div style="margin-top:12px;font-family:Consolas,monospace;font-size:1.15rem;font-weight:800;color:#1a365d;user-select:all">${r.data.clave}</div>
                    <div class="omni-sub" style="margin-top:10px">Soporte hasta ${r.data.soporteHasta}</div>`,
                confirmButtonText: 'Copiar clave y cerrar'
            }).then(() => this.copiar(r.data.clave));
            this.cargar();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo crear.', 'error');
        }
    },

    async renovar(id, cliente) {
        const { value: meses } = await Swal.fire({
            title: `Renovar soporte — ${cliente}`,
            input: 'select',
            inputOptions: { 12: '+12 meses', 6: '+6 meses', 3: '+3 meses', 1: '+1 mes' },
            inputValue: '12',
            showCancelButton: true,
            confirmButtonText: 'Renovar'
        });
        if (!meses) return;
        try {
            const r = await api.post(`/licenciamiento/admin/${id}/renovar`, { meses: parseInt(meses) });
            window.Toast ? window.Toast.fire({ icon: 'success', title: `Soporte hasta ${r.data.soporteHasta}` }) : Swal.fire('OK', `Soporte hasta ${r.data.soporteHasta}`, 'success');
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo renovar.', 'error'); }
    },

    async estado(id, estado) {
        const txt = estado === 'suspendida' ? 'Suspender esta licencia' : 'Reactivar esta licencia';
        const r = await Swal.fire({ title: txt, text: estado === 'suspendida' ? 'La instalación del cliente bloqueará la app en el próximo check-in (máx. 12 h).' : 'La instalación volverá a operar en el próximo check-in.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí' });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/licenciamiento/admin/${id}/estado`, { estado });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cambiar.', 'error'); }
    },

    async limites(id, actual) {
        const { value: v } = await Swal.fire({
            title: 'Tope de empresas de esta licencia',
            input: 'number',
            inputValue: (actual == null ? '' : actual),
            inputAttributes: { min: 1, placeholder: 'Vacío = sin tope' },
            text: 'Máximo de empresas/sedes que podrá crear esta instalación. Vacío = sin tope.',
            showCancelButton: true,
            confirmButtonText: 'Guardar'
        });
        if (v === undefined) return; // cancelado
        const maxEmpresas = String(v).trim() === '' ? null : parseInt(v);
        if (maxEmpresas !== null && (!Number.isFinite(maxEmpresas) || maxEmpresas < 1)) {
            return Swal.fire('Atención', 'El tope debe ser un número >= 1, o vacío.', 'warning');
        }
        try {
            await api.post(`/licenciamiento/admin/${id}/limites`, { maxEmpresas });
            window.Toast ? window.Toast.fire({ icon: 'success', title: 'Tope actualizado' }) : Swal.fire('OK', 'Tope actualizado', 'success');
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar.', 'error'); }
    },

    async desvincular(id) {
        const r = await Swal.fire({ title: 'Liberar la máquina', text: 'La clave se desamarra del servidor actual y podrá activarse en otro. Úsalo si el cliente cambió de servidor.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Liberar' });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/licenciamiento/admin/${id}/desvincular`);
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Máquina liberada' });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo.', 'error'); }
    },

    async eliminar(id, cliente) {
        const r = await Swal.fire({ title: `Eliminar licencia de ${cliente}`, text: 'Se borra del panel. Si esa instalación sigue activa, en su próximo check-in quedará bloqueada (clave desconocida).', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', confirmButtonColor: '#c0392b' });
        if (!r.isConfirmed) return;
        try {
            await api.delete(`/licenciamiento/admin/${id}`);
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo eliminar.', 'error'); }
    },

    copiar(txt) {
        try {
            navigator.clipboard.writeText(txt);
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Clave copiada' });
        } catch (_) {
            Swal.fire('Clave', txt, 'info');
        }
    }
};

module.exports = LicLocalModule;
