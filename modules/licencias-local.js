const api = require('./api');

// Panel del proveedor: licencias LOCAL (perpetua + mantenimiento).
// Solo "soporte", en la instancia AUTORIDAD.
const LicLocalModule = {
    _filas: {},

    async init() {
        window.LicLocalModule = this;
        window.backView = 'licencia';
        await this.cargar();
    },

    async cargar() {
        const cont = document.getElementById('lic-local-tabla');
        try {
            const info = await api.get('/licencia');
            const av = document.getElementById('lic-local-aviso');
            if (av) av.style.display = info.data && info.data.esAutoridad ? 'none' : '';
        } catch (_) {}
        try {
            const r = await api.get('/licenciamiento/admin');
            const filas = r.data || [];
            this._filas = {};
            filas.forEach(f => { this._filas[f.LicenciaID] = f; });
            if (!filas.length) {
                cont.innerHTML = '<p class="omni-sub" style="margin:0">Todavía no hay licencias. Crea la primera con “Nueva licencia”.</p>';
                return;
            }
            cont.innerHTML = `<div class="lic-scroll"><table class="lic-tbl">
                <thead><tr>
                    <th>Cliente</th><th>Clave</th><th>Empresas</th><th>Mantenimiento</th>
                    <th>Máquina</th><th>Último contacto</th><th></th>
                </tr></thead>
                <tbody>${filas.map(f => this._fila(f)).join('')}</tbody>
            </table></div>`;
        } catch (e) {
            cont.innerHTML = `<span class="lic-pill lic-bad">Error</span> ${e.response?.data?.error || e.message}`;
        }
    },

    _fila(f) {
        const id = f.LicenciaID;
        const emp = f.MaxEmpresas != null ? `<b>${f.MaxEmpresas}</b>` : `<span class="omni-sub">sin tope</span>`;
        const mSit = f.MantenimientoSituacion;
        const mant = f.MantenimientoHasta
            ? `<span class="lic-pill ${mSit === 'vigente' ? 'lic-ok' : 'lic-bad'}">${String(f.MantenimientoHasta).slice(0, 10)}</span>`
            : `<span class="lic-pill lic-gray">sin fecha</span>`;
        const maq = f.Activada
            ? `${this._esc(f.MaquinaNombre) || '—'}<div class="omni-sub" style="margin-top:3px">${String(f.MaquinaHuella || '').slice(0, 12)}${f.UltimaIP ? ' · ' + this._esc(f.UltimaIP) : ''}</div>`
            : `<span class="omni-sub">sin activar</span>`;
        const chk = f.UltimoCheckin
            ? new Date(f.UltimoCheckin).toLocaleString() + (f.VersionVista ? `<div class="omni-sub" style="margin-top:3px">v${this._esc(f.VersionVista)}</div>` : '')
            : '<span class="omni-sub">nunca</span>';
        return `<tr>
            <td><b>${this._esc(f.Cliente)}</b>${f.Notas ? `<div class="omni-sub" style="margin-top:3px">${this._esc(f.Notas)}</div>` : ''}</td>
            <td><span class="lic-clave">${this._esc(f.Clave)}</span>
                <button class="omni-btn omni-btn-sm" style="margin-left:6px" onclick="LicLocalModule.copiar(${id})"><i class="fas fa-copy"></i></button></td>
            <td>${emp} <button class="omni-btn omni-btn-sm" onclick="LicLocalModule.limites(${id})"><i class="fas fa-pen"></i></button></td>
            <td>${mant} <button class="omni-btn omni-btn-sm" onclick="LicLocalModule.mantenimiento(${id})"><i class="fas fa-pen"></i></button></td>
            <td>${maq}</td>
            <td>${chk}</td>
            <td><div class="lic-acts">
                ${f.Activada ? `<button class="omni-btn omni-btn-sm" onclick="LicLocalModule.desvincular(${id})"><i class="fas fa-unlink"></i> Liberar máquina</button>` : ''}
                <button class="omni-btn omni-btn-sm" onclick="LicLocalModule.eliminar(${id})"><i class="fas fa-trash"></i></button>
            </div></td>
        </tr>`;
    },

    _esc(s) { return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); },
    _nombre(id) { return (this._filas[id] && this._filas[id].Cliente) || ('licencia ' + id); },

    async nueva() {
        const { value: v } = await Swal.fire({
            title: 'Nueva licencia Local',
            html: `
                <input id="ll-cliente" class="swal2-input" placeholder="Nombre del cliente">
                <input id="ll-nemp" type="number" min="1" class="swal2-input" placeholder="N.º de empresas (slots)">
                <input id="ll-mant" type="date" class="swal2-input" title="Mantenimiento hasta">
                <input id="ll-notas" class="swal2-input" placeholder="Notas (opcional)">`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Crear y generar clave',
            preConfirm: () => {
                const cliente = document.getElementById('ll-cliente').value.trim();
                if (!cliente) { Swal.showValidationMessage('El nombre del cliente es obligatorio.'); return false; }
                const ne = document.getElementById('ll-nemp').value.trim();
                const mh = document.getElementById('ll-mant').value;
                return {
                    cliente,
                    nEmpresas: ne === '' ? null : parseInt(ne),
                    mantenimientoHasta: mh || null,
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
                html: `Pega esta clave en el instalador del backend del cliente:
                    <div style="margin-top:12px;font-family:Consolas,monospace;font-size:1.15rem;font-weight:800;color:#1a365d;user-select:all">${this._esc(r.data.clave)}</div>
                    <div class="omni-sub" style="margin-top:10px">${r.data.nEmpresas ?? 'sin tope'} empresa(s) · mantenimiento hasta ${r.data.mantenimientoHasta}</div>`,
                confirmButtonText: 'Copiar y cerrar'
            }).then(() => { try { navigator.clipboard.writeText(r.data.clave); } catch (_) {} });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear.', 'error'); }
    },

    async limites(id) {
        const actual = this._filas[id] ? this._filas[id].MaxEmpresas : null;
        const { value: v } = await Swal.fire({
            title: `Empresas de ${this._nombre(id)}`,
            input: 'number', inputValue: (actual == null ? '' : actual),
            inputAttributes: { min: 1, placeholder: 'Vacío = sin tope' },
            text: 'N.º de empresas activas que permite esta licencia.',
            showCancelButton: true, confirmButtonText: 'Guardar'
        });
        if (v === undefined) return;
        const n = String(v).trim() === '' ? null : parseInt(v);
        if (n !== null && (!Number.isFinite(n) || n < 1)) return Swal.fire('Atención', 'Debe ser un número >= 1, o vacío.', 'warning');
        try {
            await api.post(`/licenciamiento/admin/${id}/limites`, { nEmpresas: n });
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Guardado' });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar.', 'error'); }
    },

    async mantenimiento(id) {
        const actual = this._filas[id] ? this._filas[id].MantenimientoHasta : null;
        const { value: v } = await Swal.fire({
            title: `Mantenimiento de ${this._nombre(id)}`,
            html: `<input id="mm-fecha" type="date" class="swal2-input" value="${actual ? String(actual).slice(0, 10) : ''}">
                   <div class="omni-sub" style="margin-top:8px">O suma desde la fecha actual:</div>`,
            showDenyButton: true, denyButtonText: '+1 año',
            showCancelButton: true, confirmButtonText: 'Guardar fecha',
            preConfirm: () => ({ fecha: document.getElementById('mm-fecha').value || null })
        });
        let body = null;
        if (v && v.fecha) body = { fecha: v.fecha };
        // Swal deny => +1 año
        else if (v === false) body = { meses: 12 };
        if (!body) return;
        try {
            const r = await api.post(`/licenciamiento/admin/${id}/mantenimiento`, body);
            window.Toast && window.Toast.fire({ icon: 'success', title: `Mantenimiento hasta ${r.data.mantenimientoHasta}` });
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

    async eliminar(id) {
        const r = await Swal.fire({ title: `Eliminar licencia de ${this._nombre(id)}`, text: 'Se borra del panel. La instalación del cliente NO se bloquea (es perpetua), pero si vuelve a activarse la clave será desconocida.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', confirmButtonColor: '#c0392b' });
        if (!r.isConfirmed) return;
        try {
            await api.delete(`/licenciamiento/admin/${id}`);
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo eliminar.', 'error'); }
    },

    copiar(id) {
        const clave = this._filas[id] ? this._filas[id].Clave : '';
        try {
            navigator.clipboard.writeText(clave);
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Clave copiada' });
        } catch (_) { Swal.fire('Clave', clave, 'info'); }
    }
};

module.exports = LicLocalModule;
