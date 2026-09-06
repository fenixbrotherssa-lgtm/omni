const api = require('./api');
const { verAsiento, verAsientosDe } = require('./verAsiento');

const CxpModule = {
    cuentas: [],
    _mp: [],     // catálogo real de métodos de pago: [{MetodoID, Nombre}]
    _plan: [],   // cuentas de movimiento para la contrapartida

    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    _apiBase() { return api.base(); },
    _srvBase() { return this._apiBase().replace(/\/api$/, ''); },

    async _cargarMetodos() {
        try {
            const r = await api.get('/catalogos/metodos-pago');
            this._mp = (r.data || []).map(m => ({ MetodoID: m.MetodoID, Nombre: m.Nombre }));
        } catch (_) {
            this._mp = [{ MetodoID: 1, Nombre: 'Efectivo' }, { MetodoID: 2, Nombre: 'Transferencia' }];
        }
    },
    async _subirVoucher(url, file) {
        const fd = new FormData();
        fd.append('voucher', file);
        await window.axios.post(`${this._apiBase()}${url}`, fd, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
    },
    _abrirArchivo(rel) {
        const u = `${this._srvBase()}/uploads/${rel}`;
        try { require('electron').shell.openExternal(u); } catch (_) { window.open(u, '_blank'); }
    },
    async _cargarPlan() {
        try {
            const r = await api.get(`/contabilidad/plan?sedeId=${this.getSede()}&soloMovimiento=1`);
            this._plan = r.data.cuentas || [];
        } catch (_) { this._plan = []; }
    },
    _contraOptions(preferido) {
        if (!this._plan.length) return '<option value="">(plan de cuentas no disponible)</option>';
        const orden = { GASTO: 0, ACTIVO: 1, PASIVO: 2, INGRESO: 3, PATRIMONIO: 4, ORDEN: 5 };
        if (preferido) orden[preferido] = -1;
        const tipos = [...new Set(this._plan.map(c => c.Tipo))].sort((a, b) => (orden[a] ?? 9) - (orden[b] ?? 9));
        const grupos = tipos.map(t => `<optgroup label="${t}">` +
            this._plan.filter(c => c.Tipo === t).map(c => `<option value="${c.CuentaID}">${c.Codigo} · ${c.Nombre}</option>`).join('') +
            '</optgroup>').join('');
        return `<option value="">— clasificar después —</option>${grupos}`;
    },

    async init() {
        window.CxpModule = this;
        window.backView = 'dashboard';
        await Promise.all([this._cargarMetodos(), this._cargarPlan(), this.cargarResumen(), this.cargar()]);
    },

    async cargarResumen() {
        try {
            const r = await api.get(`/cxp/resumen?sedeId=${this.getSede()}`);
            const d = r.data, a = d.aging;
            document.getElementById('cxp-cards').innerHTML = `
                <div class="omni-card"><span>Deuda total</span><b>$ ${this.fmt(d.deuda)}</b></div>
                <div class="omni-card"><span>Por vencer</span><b>$ ${this.fmt(a.porVencer)}</b></div>
                <div class="omni-card hot"><span>1–30 días</span><b>$ ${this.fmt(a.d1_30)}</b></div>
                <div class="omni-card hot"><span>31–60 días</span><b>$ ${this.fmt(a.d31_60)}</b></div>
                <div class="omni-card hot"><span>61–90 días</span><b>$ ${this.fmt(a.d61_90)}</b></div>
                <div class="omni-card hot"><span>+90 días</span><b>$ ${this.fmt(a.d90mas)}</b></div>`;
        } catch (_) {}
    },

    async cargar() {
        const estado = document.getElementById('cxp-estado').value;
        try {
            const r = await api.get(`/cxp?sedeId=${this.getSede()}${estado ? '&estado=' + estado : ''}`);
            this.cuentas = r.data.cuentas || [];
            this.render();
        } catch (e) {
            document.getElementById('cxp-body').innerHTML = `<tr><td colspan="9" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    render() {
        const q = (document.getElementById('cxp-buscar').value || '').toLowerCase();
        const rows = this.cuentas.filter(c => !q || (c.ProveedorNombre || '').toLowerCase().includes(q));
        document.getElementById('cxp-count').textContent = `${rows.length} documentos`;
        const body = document.getElementById('cxp-body');
        if (!rows.length) { body.innerHTML = '<tr><td colspan="9" class="omni-empty">Sin cuentas por pagar.</td></tr>'; return; }
        body.innerHTML = rows.map(c => {
            const venc = c.DiasVencido > 0 && ['PENDIENTE', 'PARCIAL'].includes(c.Estado);
            const pagable = ['PENDIENTE', 'PARCIAL'].includes(c.Estado);
            return `<tr>
                <td>${c.ProveedorNombre}</td>
                <td>${c.DocumentoRef || '—'}</td>
                <td>${(c.FechaEmision || '').slice(0, 10)}</td>
                <td class="${venc ? 'venc' : ''}">${(c.FechaVencimiento || '').slice(0, 10)}</td>
                <td class="${venc ? 'venc' : ''}">${c.DiasVencido > 0 ? '+' + c.DiasVencido : c.DiasVencido}</td>
                <td class="num">${this.fmt(c.MontoOriginal)}</td>
                <td class="num"><b>${this.fmt(c.Saldo)}</b></td>
                <td><span class="bdg ${c.Estado}">${c.Estado}</span></td>
                <td>
                    <button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="CxpModule.ver(${c.CxPID})"><i class="fas fa-eye"></i></button>
                    ${(c.Estado !== 'ANULADA' && (c.AsientoID || c.Origen !== 'MANUAL')) ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px;color:#2e7d32" title="Ver asiento contable" onclick="CxpModule.verAsiento(${c.CxPID})"><i class="fas fa-book"></i></button>` : ''}
                    ${(c.Origen === 'MANUAL' && !c.AsientoID && c.Estado !== 'ANULADA') ? `<button class="omni-btn" style="padding:5px 9px;background:#fff3e0;color:#d35400" title="Falta clasificar la contrapartida contable" onclick="CxpModule.clasificar(${c.CxPID})"><i class="fas fa-scale-unbalanced"></i> Clasificar</button>` : ''}
                    ${pagable ? `<button class="omni-btn omni-btn-ok" style="padding:5px 9px" onclick="CxpModule.abrirPago(${c.CxPID})"><i class="fas fa-dollar-sign"></i> Pagar</button>` : ''}
                    ${pagable && Number(c.Saldo) === Number(c.MontoOriginal) ? `<button class="omni-btn omni-btn-danger" style="padding:5px 9px" onclick="CxpModule.anular(${c.CxPID})"><i class="fas fa-ban"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    _mpOptions() { return this._mp.map(m => `<option value="${m.MetodoID}">${m.Nombre}</option>`).join(''); },
    _esEfectivo(id) {
        const m = this._mp.find(x => String(x.MetodoID) === String(id));
        return m ? /efectivo|caja/i.test(m.Nombre) : String(id) === '1';
    },
    cerrar() { document.getElementById('cxp-modal').style.display = 'none'; },

    abrirNueva() {
        document.getElementById('cxp-modal-title').textContent = 'Nueva cuenta por pagar';
        const hoy = new Date().toISOString().slice(0, 10);
        const v30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        document.getElementById('cxp-modal-body').innerHTML = `
            <label>Proveedor <input id="cp-prov" class="omni-input" placeholder="Nombre del proveedor"></label>
            <label>Documento / referencia <input id="cp-ref" class="omni-input" placeholder="Nº factura, etc."></label>
            <label>Fecha de emisión <input id="cp-fe" type="date" class="omni-input" value="${hoy}"></label>
            <label>Fecha de vencimiento <input id="cp-fv" type="date" class="omni-input" value="${v30}"></label>
            <label>Monto <input id="cp-monto" type="number" step="0.01" min="0" class="omni-input" value="0"></label>
            <label>Cuenta de contrapartida (¿de qué es esta deuda?)
                <select id="cp-contra" class="omni-input">${this._contraOptions('GASTO')}</select>
                <small style="text-transform:none;font-weight:500;color:#8b98a8">Gasto, activo (inventario/equipo), préstamo… Si la dejas en "clasificar después" se registra la deuda pero <b>no se genera asiento</b> hasta que la clasifiques.</small>
            </label>
            <label>Observación <input id="cp-obs" class="omni-input"></label>`;
        const ok = document.getElementById('cxp-modal-ok');
        ok.style.display = '';
        ok.innerHTML = '<i class="fas fa-save"></i> Guardar';
        ok.onclick = () => this.guardarNueva();
        document.getElementById('cxp-modal').style.display = 'flex';
    },
    async guardarNueva() {
        const payload = {
            SedeID: this.getSede(),
            ProveedorNombre: document.getElementById('cp-prov').value.trim(),
            DocumentoRef: document.getElementById('cp-ref').value.trim() || null,
            FechaEmision: document.getElementById('cp-fe').value,
            FechaVencimiento: document.getElementById('cp-fv').value,
            Monto: parseFloat(document.getElementById('cp-monto').value) || 0,
            ContrapartidaCuentaID: document.getElementById('cp-contra').value || null,
            Observacion: document.getElementById('cp-obs').value.trim() || null
        };
        if (!payload.ProveedorNombre || payload.Monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Proveedor y monto son obligatorios' }); return; }
        try {
            const r = await api.post('/cxp', payload);
            window.Toast.fire({
                icon: r.data.asientoGenerado ? 'success' : 'info',
                title: r.data.asientoGenerado ? 'Cuenta por pagar creada' : 'Creada — falta clasificar la contrapartida'
            });
            this.cerrar(); await this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    verAsiento(id) {
        const c = (this.cuentas || []).find(x => x.CxPID === id);
        if (c && c.AsientoID) return verAsiento(c.AsientoID);
        if (c) return verAsientosDe(c.OrigenID || id, c.Origen || 'CXP');
        verAsientosDe(id, 'CXP');
    },
    _verAsientoPago(asientoId) { verAsiento(asientoId); },

    async clasificar(id) {
        const c = this.cuentas.find(x => x.CxPID === id);
        const r = await Swal.fire({
            title: 'Clasificar cuenta por pagar',
            html: `<div style="text-align:left;font-size:.85rem">${c.ProveedorNombre} — $ ${this.fmt(c.MontoOriginal)}<br>
                   <span style="color:#718096">¿De qué es esta deuda? Se genera el asiento: DEBE la cuenta que elijas / HABER Proveedores.</span></div>
                   <select id="sw-contra" class="swal2-input" style="display:block">${this._contraOptions('GASTO')}</select>`,
            showCancelButton: true, confirmButtonText: 'Generar asiento', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const v = document.getElementById('sw-contra').value;
                if (!v) { Swal.showValidationMessage('Elige una cuenta'); return false; }
                return v;
            }
        });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/cxp/${id}/clasificar`, { ContrapartidaCuentaID: r.value });
            window.Toast.fire({ icon: 'success', title: 'Asiento generado' });
            await this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    abrirPago(id) {
        const c = this.cuentas.find(x => x.CxPID === id);
        document.getElementById('cxp-modal-title').textContent = `Registrar pago · ${c.ProveedorNombre}`;
        document.getElementById('cxp-modal-body').innerHTML = `
            <p style="font-size:.82rem;color:#5a6b7d">Saldo pendiente: <b style="font-family:Consolas">$ ${this.fmt(c.Saldo)}</b></p>
            <label>Monto a pagar <input id="pg-monto" type="number" step="0.01" min="0" max="${c.Saldo}" class="omni-input" value="${c.Saldo}"></label>
            <label>Fecha <input id="pg-fecha" type="date" class="omni-input" value="${new Date().toISOString().slice(0, 10)}"></label>
            <label>Método de pago <select id="pg-mp" class="omni-input" onchange="CxpModule._togglePagoExtra()">${this._mpOptions()}</select></label>
            <div id="pg-extra">
                <label>Referencia / N.º de transacción <input id="pg-ref" class="omni-input" placeholder="Nº comprobante"></label>
                <label>Comprobante (foto o PDF) <input id="pg-voucher" type="file" class="omni-input" accept="image/*,application/pdf" style="padding:6px"></label>
            </div>`;
        const ok = document.getElementById('cxp-modal-ok');
        ok.style.display = '';
        ok.innerHTML = '<i class="fas fa-check"></i> Registrar pago';
        ok.onclick = () => this.guardarPago(id);
        this._togglePagoExtra();
        document.getElementById('cxp-modal').style.display = 'flex';
    },
    _togglePagoExtra() {
        const ex = document.getElementById('pg-extra');
        if (ex) ex.style.display = this._esEfectivo(document.getElementById('pg-mp').value) ? 'none' : 'block';
    },
    async guardarPago(id) {
        const mp = document.getElementById('pg-mp');
        const payload = {
            Monto: parseFloat(document.getElementById('pg-monto').value) || 0,
            Fecha: document.getElementById('pg-fecha').value,
            MetodoPagoID: parseInt(mp.value),
            MetodoPago: mp.selectedOptions[0].text,
            Referencia: (document.getElementById('pg-ref')?.value || '').trim() || null
        };
        if (payload.Monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Monto inválido' }); return; }
        try {
            const r = await api.post(`/cxp/${id}/pagos`, payload);
            const file = document.getElementById('pg-voucher')?.files?.[0];
            if (file && r.data.pagoId) {
                try { await this._subirVoucher(`/cxp/pagos/${r.data.pagoId}/voucher`, file); }
                catch (_) { window.Toast.fire({ icon: 'warning', title: 'Pago OK, pero el comprobante no se subió' }); }
            }
            window.Toast.fire({ icon: 'success', title: `Pago registrado · saldo $${this.fmt(r.data.saldo)}` });
            this.cerrar(); await this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    async ver(id) {
        try {
            const r = await api.get(`/cxp/${id}`);
            const c = r.data.cuenta, pg = r.data.pagos || [];
            document.getElementById('cxp-modal-title').textContent = `CxP · ${c.ProveedorNombre}`;
            document.getElementById('cxp-modal-body').innerHTML = `
                <p style="font-size:.82rem"><b>Documento:</b> ${c.DocumentoRef || '—'} · <b>Origen:</b> ${c.Origen}</p>
                <p style="font-size:.82rem"><b>Emisión:</b> ${(c.FechaEmision || '').slice(0, 10)} · <b>Vence:</b> ${(c.FechaVencimiento || '').slice(0, 10)}</p>
                <p style="font-size:.82rem"><b>Monto:</b> $${this.fmt(c.MontoOriginal)} · <b>Saldo:</b> $${this.fmt(c.Saldo)} · <span class="bdg ${c.Estado}">${c.Estado}</span></p>
                <h4 style="margin:12px 0 4px;color:#1a365d;font-size:.8rem">Pagos (${pg.length})</h4>
                <div class="cob-list">${pg.length ? pg.map(x => `<div><span>${(x.Fecha || '').slice(0, 10)} · ${x.MetodoPago || ''} ${x.Referencia ? '· ' + x.Referencia : ''} ${x.VoucherPath ? `· <a href="#" onclick="event.preventDefault();CxpModule._abrirArchivo('${x.VoucherPath}')" style="color:#2f7be6;font-weight:800">comprobante</a>` : ''} ${x.AsientoID ? `· <a href="#" onclick="event.preventDefault();CxpModule._verAsientoPago(${x.AsientoID})" style="color:#2e7d32;font-weight:800">asiento</a>` : ''}</span><b style="font-family:Consolas">$ ${this.fmt(x.Monto)}</b></div>`).join('') : '<div style="opacity:.5">Sin pagos</div>'}</div>`;
            const ok = document.getElementById('cxp-modal-ok');
            ok.style.display = 'none';
            document.getElementById('cxp-modal').style.display = 'flex';
            setTimeout(() => { ok.style.display = ''; }, 50);
        } catch (e) { window.Toast.fire({ icon: 'error', title: 'Error' }); }
    },

    async anular(id) {
        const r = await Swal.fire({ title: '¿Anular cuenta por pagar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'No' });
        if (!r.isConfirmed) return;
        try { await api.post(`/cxp/${id}/anular`, {}); window.Toast.fire({ icon: 'success', title: 'CxP anulada' }); await this.init(); }
        catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    }
};

module.exports = CxpModule;
