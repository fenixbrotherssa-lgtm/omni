const api = require('./api');
const { verAsiento, verAsientosDe } = require('./verAsiento');
const CobroPasarela = require('./cobroPasarela');

const CxcModule = {
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
    async _cargarPlan() {
        try {
            const r = await api.get(`/contabilidad/plan?sedeId=${this.getSede()}&soloMovimiento=1`);
            this._plan = r.data.cuentas || [];
        } catch (_) { this._plan = []; }
    },
    // <select> de contrapartida agrupado por tipo. `preferido` = tipo a mostrar primero.
    _contraOptions(preferido) {
        if (!this._plan.length) return '<option value="">(plan de cuentas no disponible)</option>';
        const orden = { INGRESO: 0, GASTO: 1, ACTIVO: 2, PASIVO: 3, PATRIMONIO: 4, ORDEN: 5 };
        if (preferido) orden[preferido] = -1;
        const tipos = [...new Set(this._plan.map(c => c.Tipo))].sort((a, b) => (orden[a] ?? 9) - (orden[b] ?? 9));
        const grupos = tipos.map(t => `<optgroup label="${t}">` +
            this._plan.filter(c => c.Tipo === t).map(c => `<option value="${c.CuentaID}">${c.Codigo} · ${c.Nombre}</option>`).join('') +
            '</optgroup>').join('');
        return `<option value="">— clasificar después —</option>${grupos}`;
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

    async init() {
        window.CxcModule = this;
        window.backView = 'dashboard';
        await Promise.all([this._cargarMetodos(), this._cargarPlan(), this.cargarResumen(), this.cargar()]);
    },

    async cargarResumen() {
        try {
            const r = await api.get(`/cxc/resumen?sedeId=${this.getSede()}`);
            const d = r.data, a = d.aging;
            document.getElementById('cxc-cards').innerHTML = `
                <div class="omni-card"><span>Cartera total</span><b>$ ${this.fmt(d.cartera)}</b></div>
                <div class="omni-card"><span>Por vencer</span><b>$ ${this.fmt(a.porVencer)}</b></div>
                <div class="omni-card hot"><span>1–30 días</span><b>$ ${this.fmt(a.d1_30)}</b></div>
                <div class="omni-card hot"><span>31–60 días</span><b>$ ${this.fmt(a.d31_60)}</b></div>
                <div class="omni-card hot"><span>61–90 días</span><b>$ ${this.fmt(a.d61_90)}</b></div>
                <div class="omni-card hot"><span>+90 días</span><b>$ ${this.fmt(a.d90mas)}</b></div>`;
        } catch (_) {}
    },

    async cargar() {
        const estado = document.getElementById('cxc-estado').value;
        try {
            const r = await api.get(`/cxc?sedeId=${this.getSede()}${estado ? '&estado=' + estado : ''}`);
            this.cuentas = r.data.cuentas || [];
            this.render();
        } catch (e) {
            document.getElementById('cxc-body').innerHTML = `<tr><td colspan="9" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    render() {
        const q = (document.getElementById('cxc-buscar').value || '').toLowerCase();
        const rows = this.cuentas.filter(c => !q || (c.ClienteNombre || '').toLowerCase().includes(q));
        document.getElementById('cxc-count').textContent = `${rows.length} documentos`;
        const body = document.getElementById('cxc-body');
        if (!rows.length) { body.innerHTML = '<tr><td colspan="9" class="omni-empty">Sin cuentas por cobrar.</td></tr>'; return; }
        body.innerHTML = rows.map(c => {
            const venc = c.DiasVencido > 0 && ['PENDIENTE', 'PARCIAL'].includes(c.Estado);
            const cobrable = ['PENDIENTE', 'PARCIAL'].includes(c.Estado);
            return `<tr>
                <td>${c.ClienteNombre}</td>
                <td>${c.DocumentoRef || '—'}</td>
                <td>${(c.FechaEmision || '').slice(0, 10)}</td>
                <td class="${venc ? 'venc' : ''}">${(c.FechaVencimiento || '').slice(0, 10)}</td>
                <td class="${venc ? 'venc' : ''}">${c.DiasVencido > 0 ? '+' + c.DiasVencido : c.DiasVencido}</td>
                <td class="num">${this.fmt(c.MontoOriginal)}</td>
                <td class="num"><b>${this.fmt(c.Saldo)}</b></td>
                <td><span class="bdg ${c.Estado}">${c.Estado}</span></td>
                <td>
                    <button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="CxcModule.ver(${c.CxCID})"><i class="fas fa-eye"></i></button>
                    ${(c.Estado !== 'ANULADA' && (c.AsientoID || c.Origen !== 'MANUAL')) ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px;color:#2e7d32" title="Ver asiento contable" onclick="CxcModule.verAsiento(${c.CxCID})"><i class="fas fa-book"></i></button>` : ''}
                    ${(c.Origen === 'MANUAL' && !c.AsientoID && c.Estado !== 'ANULADA') ? `<button class="omni-btn" style="padding:5px 9px;background:#fff3e0;color:#d35400" title="Falta clasificar la contrapartida contable" onclick="CxcModule.clasificar(${c.CxCID})"><i class="fas fa-scale-unbalanced"></i> Clasificar</button>` : ''}
                    ${cobrable ? `<button class="omni-btn omni-btn-ok" style="padding:5px 9px" onclick="CxcModule.abrirCobro(${c.CxCID})"><i class="fas fa-dollar-sign"></i> Cobrar</button>` : ''}
                    ${cobrable ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px" title="El cliente nos retuvo" onclick="CxcModule.registrarRetencion(${c.CxCID})"><i class="fas fa-receipt"></i> Retención</button>` : ''}
                    ${cobrable && Number(c.Saldo) === Number(c.MontoOriginal) ? `<button class="omni-btn omni-btn-danger" style="padding:5px 9px" onclick="CxcModule.anular(${c.CxCID})"><i class="fas fa-ban"></i></button>` : ''}
                </td>
            </tr>`;
        }).join('');
    },

    _mpOptions() { return this._mp.map(m => `<option value="${m.MetodoID}">${m.Nombre}</option>`).join(''); },
    _esEfectivo(id) {
        const m = this._mp.find(x => String(x.MetodoID) === String(id));
        return m ? /efectivo|caja/i.test(m.Nombre) : String(id) === '1';
    },
    cerrar() { document.getElementById('cxc-modal').style.display = 'none'; },

    abrirNueva() {
        document.getElementById('cxc-modal-title').textContent = 'Nueva cuenta por cobrar';
        const hoy = new Date().toISOString().slice(0, 10);
        const v30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        document.getElementById('cxc-modal-body').innerHTML = `
            <label>Cliente <input id="cx-cli" class="omni-input" placeholder="Nombre del cliente"></label>
            <label>Documento / referencia <input id="cx-ref" class="omni-input" placeholder="Nº factura, etc."></label>
            <label>Fecha de emisión <input id="cx-fe" type="date" class="omni-input" value="${hoy}"></label>
            <label>Fecha de vencimiento <input id="cx-fv" type="date" class="omni-input" value="${v30}"></label>
            <label>Monto <input id="cx-monto" type="number" step="0.01" min="0" class="omni-input" value="0"></label>
            <label>Cuenta de contrapartida (¿de qué es este cobro?)
                <select id="cx-contra" class="omni-input">${this._contraOptions('INGRESO')}</select>
                <small style="text-transform:none;font-weight:500;color:#8b98a8">Si la dejas en "clasificar después" se registra la cuenta por cobrar pero <b>no se genera asiento</b> hasta que la clasifiques.</small>
            </label>
            <label>Observación <input id="cx-obs" class="omni-input"></label>`;
        const ok = document.getElementById('cxc-modal-ok');
        ok.style.display = '';
        ok.innerHTML = '<i class="fas fa-save"></i> Guardar';
        ok.onclick = () => this.guardarNueva();
        document.getElementById('cxc-modal').style.display = 'flex';
    },
    async guardarNueva() {
        const payload = {
            SedeID: this.getSede(),
            ClienteNombre: document.getElementById('cx-cli').value.trim(),
            DocumentoRef: document.getElementById('cx-ref').value.trim() || null,
            FechaEmision: document.getElementById('cx-fe').value,
            FechaVencimiento: document.getElementById('cx-fv').value,
            Monto: parseFloat(document.getElementById('cx-monto').value) || 0,
            ContrapartidaCuentaID: document.getElementById('cx-contra').value || null,
            Observacion: document.getElementById('cx-obs').value.trim() || null
        };
        if (!payload.ClienteNombre || payload.Monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Cliente y monto son obligatorios' }); return; }
        try {
            const r = await api.post('/cxc', payload);
            window.Toast.fire({
                icon: r.data.asientoGenerado ? 'success' : 'info',
                title: r.data.asientoGenerado ? 'Cuenta por cobrar creada' : 'Creada — falta clasificar la contrapartida'
            });
            this.cerrar(); await this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    verAsiento(id) {
        const c = (this.cuentas || []).find(x => x.CxCID === id);
        if (c && c.AsientoID) return verAsiento(c.AsientoID);
        if (c) return verAsientosDe(c.OrigenID || id, c.Origen || 'CXC');
        verAsientosDe(id, 'CXC');
    },
    _verAsientoCobro(asientoId) { verAsiento(asientoId); },

    async clasificar(id) {
        const c = this.cuentas.find(x => x.CxCID === id);
        const r = await Swal.fire({
            title: 'Clasificar cuenta por cobrar',
            html: `<div style="text-align:left;font-size:.85rem">${c.ClienteNombre} — $ ${this.fmt(c.MontoOriginal)}<br>
                   <span style="color:#718096">¿De qué es este cobro? Se genera el asiento: DEBE Clientes / HABER la cuenta que elijas.</span></div>
                   <select id="sw-contra" class="swal2-input" style="display:block">${this._contraOptions('INGRESO')}</select>`,
            showCancelButton: true, confirmButtonText: 'Generar asiento', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const v = document.getElementById('sw-contra').value;
                if (!v) { Swal.showValidationMessage('Elige una cuenta'); return false; }
                return v;
            }
        });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/cxc/${id}/clasificar`, { ContrapartidaCuentaID: r.value });
            window.Toast.fire({ icon: 'success', title: 'Asiento generado' });
            await this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    abrirCobro(id) {
        const c = this.cuentas.find(x => x.CxCID === id);
        document.getElementById('cxc-modal-title').textContent = `Registrar cobro · ${c.ClienteNombre}`;
        document.getElementById('cxc-modal-body').innerHTML = `
            <p style="font-size:.82rem;color:#5a6b7d">Saldo pendiente: <b style="font-family:Consolas">$ ${this.fmt(c.Saldo)}</b></p>
            <label>Monto a cobrar <input id="cb-monto" type="number" step="0.01" min="0" max="${c.Saldo}" class="omni-input" value="${c.Saldo}"></label>
            <label>Fecha <input id="cb-fecha" type="date" class="omni-input" value="${new Date().toISOString().slice(0, 10)}"></label>
            <label>Método de pago <select id="cb-mp" class="omni-input" onchange="CxcModule._toggleCobroExtra()">${this._mpOptions()}</select></label>
            <div id="cb-extra">
                <label>Referencia / N.º de transacción <input id="cb-ref" class="omni-input" placeholder="Nº comprobante"></label>
                <label>Comprobante (foto o PDF) <input id="cb-voucher" type="file" class="omni-input" accept="image/*,application/pdf" style="padding:6px"></label>
            </div>
            <button id="cb-pasarela" class="omni-btn" style="width:100%;justify-content:center;margin-top:8px;background:#1a7a4a;color:#fff;display:none;" onclick="CxcModule.cobrarConPasarela(${id})"><i class="fas fa-credit-card"></i> Cobrar con pasarela</button>`;
        const ok = document.getElementById('cxc-modal-ok');
        ok.style.display = '';
        ok.innerHTML = '<i class="fas fa-check"></i> Registrar cobro';
        ok.onclick = () => this.guardarCobro(id);
        CobroPasarela.estado().then(s => { const b = document.getElementById('cb-pasarela'); if (b && s.habilitada) b.style.display = 'flex'; }).catch(() => {});
        this._toggleCobroExtra();
        document.getElementById('cxc-modal').style.display = 'flex';
    },
    _toggleCobroExtra() {
        const ex = document.getElementById('cb-extra');
        if (ex) ex.style.display = this._esEfectivo(document.getElementById('cb-mp').value) ? 'none' : 'block';
    },

    async registrarRetencion(id) {
        const c = this.cuentas.find(x => x.CxCID === id);
        const { value: v } = await Swal.fire({
            title: 'Retención recibida del cliente', width: 460,
            html: `<div style="text-align:left;font-size:.85rem;color:#5a6b7d">${c.ClienteNombre} — saldo $${this.fmt(c.Saldo)}<br>
                   Baja el saldo y registra el crédito tributario (DEBE crédito ret. renta/IVA · HABER Clientes).</div>
                   <input id="rr-num" class="swal2-input" placeholder="N.º comprobante de retención">
                   <input id="rr-fecha" type="date" class="swal2-input" value="${new Date().toISOString().slice(0, 10)}">
                   <input id="rr-renta" type="number" step="0.01" min="0" class="swal2-input" placeholder="Retención renta $">
                   <input id="rr-iva" type="number" step="0.01" min="0" class="swal2-input" placeholder="Retención IVA $">`,
            showCancelButton: true, confirmButtonText: 'Registrar',
            preConfirm: () => {
                const rr = parseFloat(document.getElementById('rr-renta').value) || 0;
                const ri = parseFloat(document.getElementById('rr-iva').value) || 0;
                if (rr + ri <= 0) { Swal.showValidationMessage('Ingresa al menos un valor'); return false; }
                return { RetRenta: rr, RetIva: ri, NumComprobante: document.getElementById('rr-num').value.trim() || null, Fecha: document.getElementById('rr-fecha').value };
            }
        });
        if (!v) return;
        try {
            const r = await api.post(`/cxc/${id}/retencion`, v);
            window.Toast.fire({ icon: 'success', title: `Retención registrada · saldo $${this.fmt(r.data.saldo)}` });
            this.init();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo registrar', 'error'); }
    },

    async cobrarConPasarela(id) {
        const c = this.cuentas.find(x => x.CxCID === id);
        const monto = parseFloat(document.getElementById('cb-monto').value) || 0;
        if (monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Indica el monto' }); return; }
        const r = await CobroPasarela.iniciar({
            monto, concepto: `Cobro CxC · ${c.ClienteNombre}`,
            referencia: c.DocumentoRef || `CXC-${id}`, origen: 'CXC', origenId: id
        });
        if (!r.aprobado) { if (!r.cancelado && !r.sinPasarela) window.Toast.fire({ icon: 'error', title: 'El pago no se completó' }); return; }
        // registra el cobro con la referencia de la pasarela (el PagosPasarela ya quedó ligado a CXC/id)
        try {
            const res = await api.post(`/cxc/${id}/cobros`, {
                Monto: monto, Fecha: document.getElementById('cb-fecha').value,
                MetodoPagoID: 2, MetodoPago: r.pasarela || 'PASARELA',
                Referencia: r.authCode || r.clientTransactionId
            });
            window.Toast.fire({ icon: 'success', title: `Cobro por ${r.pasarela} registrado · saldo $${this.fmt(res.data.saldo)}` });
            this.cerrar(); this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'El pago se aprobó pero no se pudo registrar el cobro' }); }
    },
    async guardarCobro(id) {
        const mp = document.getElementById('cb-mp');
        const payload = {
            Monto: parseFloat(document.getElementById('cb-monto').value) || 0,
            Fecha: document.getElementById('cb-fecha').value,
            MetodoPagoID: parseInt(mp.value),
            MetodoPago: mp.selectedOptions[0].text,
            Referencia: (document.getElementById('cb-ref')?.value || '').trim() || null
        };
        if (payload.Monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Monto inválido' }); return; }
        try {
            const r = await api.post(`/cxc/${id}/cobros`, payload);
            const file = document.getElementById('cb-voucher')?.files?.[0];
            if (file && r.data.cobroId) {
                try { await this._subirVoucher(`/cxc/cobros/${r.data.cobroId}/voucher`, file); }
                catch (_) { window.Toast.fire({ icon: 'warning', title: 'Cobro OK, pero el comprobante no se subió' }); }
            }
            window.Toast.fire({ icon: 'success', title: `Cobro registrado · saldo $${this.fmt(r.data.saldo)}` });
            this.cerrar(); await this.init();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    async ver(id) {
        try {
            const r = await api.get(`/cxc/${id}`);
            const c = r.data.cuenta, cob = r.data.cobros || [];
            document.getElementById('cxc-modal-title').textContent = `CxC · ${c.ClienteNombre}`;
            document.getElementById('cxc-modal-body').innerHTML = `
                <p style="font-size:.82rem"><b>Documento:</b> ${c.DocumentoRef || '—'} · <b>Origen:</b> ${c.Origen}</p>
                <p style="font-size:.82rem"><b>Emisión:</b> ${(c.FechaEmision || '').slice(0, 10)} · <b>Vence:</b> ${(c.FechaVencimiento || '').slice(0, 10)}</p>
                <p style="font-size:.82rem"><b>Monto:</b> $${this.fmt(c.MontoOriginal)} · <b>Saldo:</b> $${this.fmt(c.Saldo)} · <span class="bdg ${c.Estado}">${c.Estado}</span></p>
                <h4 style="margin:12px 0 4px;color:#1a365d;font-size:.8rem">Cobros (${cob.length})</h4>
                <div class="cob-list">${cob.length ? cob.map(x => `<div><span>${(x.Fecha || '').slice(0, 10)} · ${x.MetodoPago || ''} ${x.Referencia ? '· ' + x.Referencia : ''} ${x.VoucherPath ? `· <a href="#" onclick="event.preventDefault();CxcModule._abrirArchivo('${x.VoucherPath}')" style="color:#2f7be6;font-weight:800">comprobante</a>` : ''} ${x.AsientoID ? `· <a href="#" onclick="event.preventDefault();CxcModule._verAsientoCobro(${x.AsientoID})" style="color:#2e7d32;font-weight:800">asiento</a>` : ''}</span><b style="font-family:Consolas">$ ${this.fmt(x.Monto)}</b></div>`).join('') : '<div style="opacity:.5">Sin cobros</div>'}</div>`;
            const ok = document.getElementById('cxc-modal-ok');
            ok.style.display = 'none';
            document.getElementById('cxc-modal').style.display = 'flex';
            setTimeout(() => { ok.style.display = ''; }, 50);
        } catch (e) { window.Toast.fire({ icon: 'error', title: 'Error' }); }
    },

    async anular(id) {
        const r = await Swal.fire({ title: '¿Anular cuenta por cobrar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'No' });
        if (!r.isConfirmed) return;
        try { await api.post(`/cxc/${id}/anular`, {}); window.Toast.fire({ icon: 'success', title: 'CxC anulada' }); await this.init(); }
        catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    }
};

module.exports = CxcModule;
