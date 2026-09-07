const api = require('./api');

// Panel del proveedor: Cuentas SaaS (suscripción). Solo "soporte", solo edición saas.
const CuentasSaasModule = {
    _filas: {},

    async init() {
        window.CuentasSaasModule = this;
        window.backView = 'licencia';
        await this.cargar();
    },

    async cargar() {
        const cont = document.getElementById('cta-tabla');
        try {
            const r = await api.get('/licenciamiento/cuentas');
            const filas = r.data || [];
            this._filas = {};
            filas.forEach(f => { this._filas[f.CuentaID] = f; });
            if (!filas.length) {
                cont.innerHTML = '<p class="omni-sub" style="margin:0">Todavía no hay cuentas. Crea la primera con “Nueva cuenta”.</p>';
                return;
            }
            cont.innerHTML = `<div class="lic-scroll"><table class="lic-tbl">
                <thead><tr>
                    <th>Cuenta</th><th>Empresas</th><th>Periodo</th><th>Pagado hasta</th><th>Estado</th><th></th>
                </tr></thead>
                <tbody>${filas.map(f => this._fila(f)).join('')}</tbody>
            </table></div>`;
        } catch (e) {
            cont.innerHTML = `<span class="lic-pill lic-bad">Error</span> ${e.response?.data?.error || e.message}`;
        }
    },

    _fila(f) {
        const id = f.CuentaID;
        const disp = f.MaxEmpresas != null ? Math.max(0, f.MaxEmpresas - (f.EmpresasActivas || 0)) : null;
        const emp = f.MaxEmpresas != null
            ? `<b>${f.EmpresasActivas || 0} / ${f.MaxEmpresas}</b><div class="omni-sub" style="margin-top:3px">disp. ${disp}</div>`
            : `<b>${f.EmpresasActivas || 0}</b> <span class="omni-sub">sin tope</span>`;
        const sitCls = f.Situacion === 'vigente' || f.Situacion === 'sin_fecha' ? 'lic-ok' : f.Situacion === 'suspendida' ? 'lic-gray' : 'lic-bad';
        const sitTxt = f.Situacion === 'suspendida' ? 'Suspendida' : f.Situacion === 'vencida' ? 'Vencida' : f.Situacion === 'sin_fecha' ? 'Sin fecha' : 'Vigente';
        const pago = f.PagadoHasta
            ? String(f.PagadoHasta).slice(0, 10) + (f.DiasRestantes != null && f.Situacion === 'vigente' ? `<div class="omni-sub" style="margin-top:3px">${f.DiasRestantes} día(s)</div>` : '')
            : '<span class="omni-sub">—</span>';
        const suspBtn = f.Estado === 'suspendida'
            ? `<button class="omni-btn omni-btn-sm" onclick="CuentasSaasModule.estado(${id},'activa')"><i class="fas fa-play"></i> Reactivar</button>`
            : `<button class="omni-btn omni-btn-sm" onclick="CuentasSaasModule.estado(${id},'suspendida')"><i class="fas fa-pause"></i> Suspender</button>`;
        return `<tr>
            <td><b>${this._esc(f.Nombre)}</b><div class="omni-sub" style="margin-top:3px">CuentaID ${id}</div></td>
            <td>${emp} <button class="omni-btn omni-btn-sm" onclick="CuentasSaasModule.limites(${id})"><i class="fas fa-pen"></i></button></td>
            <td>${this._esc(f.Periodo) || '<span class="omni-sub">—</span>'}</td>
            <td>${pago}</td>
            <td><span class="lic-pill ${sitCls}">${sitTxt}</span></td>
            <td><div class="lic-acts">
                <button class="omni-btn omni-btn-sm omni-btn-primary" onclick="CuentasSaasModule.pago(${id})"><i class="fas fa-dollar-sign"></i> Registrar pago</button>
                ${suspBtn}
            </div></td>
        </tr>`;
    },

    _esc(s) { return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); },
    _nombre(id) { return (this._filas[id] && this._filas[id].Nombre) || ('cuenta ' + id); },

    async nueva() {
        const { value: v } = await Swal.fire({
            title: 'Nueva cuenta SaaS',
            html: `
                <input id="cs-nombre" class="swal2-input" placeholder="Nombre de la cuenta / cliente">
                <input id="cs-nemp" type="number" min="1" class="swal2-input" placeholder="N.º de empresas" value="1">
                <select id="cs-periodo" class="swal2-input">
                    <option value="">Periodo (informativo)…</option>
                    <option value="mensual">mensual</option>
                    <option value="quincenal">quincenal</option>
                    <option value="trimestral">trimestral</option>
                    <option value="anual">anual</option>
                </select>
                <input id="cs-pago" type="date" class="swal2-input" title="Pagado hasta">`,
            focusConfirm: false, showCancelButton: true, confirmButtonText: 'Crear cuenta',
            preConfirm: () => {
                const nombre = document.getElementById('cs-nombre').value.trim();
                if (!nombre) { Swal.showValidationMessage('El nombre es obligatorio.'); return false; }
                return {
                    nombre,
                    maxEmpresas: parseInt(document.getElementById('cs-nemp').value) || 1,
                    periodo: document.getElementById('cs-periodo').value || null,
                    pagadoHasta: document.getElementById('cs-pago').value || null,
                    meses: document.getElementById('cs-pago').value ? undefined : 1
                };
            }
        });
        if (!v) return;
        try {
            const r = await api.post('/licenciamiento/cuentas', v);
            await Swal.fire({
                icon: 'success', title: 'Cuenta creada',
                html: `Entrégale estas credenciales al cliente (entra directo, sin activación):
                    <div style="margin-top:12px;font-family:Consolas,monospace;font-size:1.05rem;font-weight:800;color:#1a365d">
                        Usuario: <span style="user-select:all">${this._esc(r.data.usuario)}</span><br>
                        Contraseña: <span style="user-select:all">${this._esc(r.data.password)}</span>
                    </div>
                    <div class="omni-sub" style="margin-top:10px">${r.data.maxEmpresas} empresa(s) · pagado hasta ${r.data.pagadoHasta}</div>`,
                confirmButtonText: 'Copiar credenciales y cerrar'
            }).then(() => { try { navigator.clipboard.writeText(`Usuario: ${r.data.usuario}\nContraseña: ${r.data.password}`); } catch (_) {} });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear.', 'error'); }
    },

    async pago(id) {
        const { value: v } = await Swal.fire({
            title: `Registrar pago — ${this._nombre(id)}`,
            html: `<input id="pg-fecha" type="date" class="swal2-input" title="Pagado hasta (fecha exacta)">
                   <div class="omni-sub" style="margin-top:6px">O suma desde la fecha actual:</div>
                   <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px">
                     <button type="button" class="swal2-styled" style="background:#e2e7ee;color:#3a4a5d" onclick="CuentasSaasModule._quick(${id},{dias:15})">+15 días</button>
                     <button type="button" class="swal2-styled" style="background:#e2e7ee;color:#3a4a5d" onclick="CuentasSaasModule._quick(${id},{meses:1})">+1 mes</button>
                     <button type="button" class="swal2-styled" style="background:#e2e7ee;color:#3a4a5d" onclick="CuentasSaasModule._quick(${id},{meses:3})">+3 meses</button>
                     <button type="button" class="swal2-styled" style="background:#e2e7ee;color:#3a4a5d" onclick="CuentasSaasModule._quick(${id},{meses:12})">+1 año</button>
                   </div>`,
            showCancelButton: true, confirmButtonText: 'Guardar fecha',
            preConfirm: () => {
                const f = document.getElementById('pg-fecha').value;
                if (!f) { Swal.showValidationMessage('Elige una fecha o usa un botón de +.'); return false; }
                return { fecha: f };
            }
        });
        if (!v) return;
        await this._enviarPago(id, v);
    },

    async _quick(id, body) {
        Swal.close();
        await this._enviarPago(id, body);
    },

    async _enviarPago(id, body) {
        try {
            const r = await api.post(`/licenciamiento/cuentas/${id}/pago`, body);
            window.Toast ? window.Toast.fire({ icon: 'success', title: `Pagado hasta ${r.data.pagadoHasta}` }) : Swal.fire('OK', `Pagado hasta ${r.data.pagadoHasta}`, 'success');
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo registrar el pago.', 'error'); }
    },

    async limites(id) {
        const actual = this._filas[id] ? this._filas[id].MaxEmpresas : null;
        const { value: v } = await Swal.fire({
            title: `Empresas de ${this._nombre(id)}`,
            input: 'number', inputValue: (actual == null ? '' : actual),
            inputAttributes: { min: 1 },
            text: 'N.º de empresas activas que permite la cuenta. Efecto inmediato.',
            showCancelButton: true, confirmButtonText: 'Guardar'
        });
        if (v === undefined) return;
        const n = parseInt(v);
        if (!Number.isFinite(n) || n < 1) return Swal.fire('Atención', 'Debe ser un número >= 1.', 'warning');
        try {
            await api.post(`/licenciamiento/cuentas/${id}/limites`, { maxEmpresas: n });
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Guardado' });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar.', 'error'); }
    },

    async estado(id, estado) {
        const txt = estado === 'suspendida' ? 'Suspender esta cuenta' : 'Reactivar esta cuenta';
        const r = await Swal.fire({ title: txt, text: estado === 'suspendida' ? 'El cliente no podrá entrar (nada se borra).' : 'El cliente vuelve a poder entrar.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí' });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/licenciamiento/cuentas/${id}/estado`, { estado });
            this.cargar();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cambiar.', 'error'); }
    }
};

module.exports = CuentasSaasModule;
