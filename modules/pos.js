const api = require('./api');
const { verAsientosDe } = require('./verAsiento');
const CobroPasarela = require('./cobroPasarela');

const PosModule = {
    items: [],        // { key, ProductoID, Descripcion, Cantidad, PrecioUnitario, AplicaIva }
    _prods: [],       // resultados de búsqueda de productos
    _clis: [],        // resultados de búsqueda de clientes
    cliente: null,    // { ClienteID, NombreFull, Documento }
    pagoQRId: null,
    tarifaIva: 15,
    precioIncluyeIva: true,
    _seq: 0,

    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    _r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; },

    /** Desglose de una línea, idéntico al del backend. */
    _calc(it) {
        const bruto = this._r2(it.Cantidad * it.PrecioUnitario - (it.Descuento || 0));
        const t = this.tarifaIva;
        if (!it.AplicaIva) return { bruto, base: bruto, iva: 0, total: bruto };
        if (this.precioIncluyeIva) {
            const base = this._r2(bruto / (1 + t / 100));
            return { bruto, base, iva: this._r2(bruto - base), total: bruto };
        }
        const iva = this._r2(bruto * t / 100);
        return { bruto, base: bruto, iva, total: this._r2(bruto + iva) };
    },

    async init() {
        window.PosModule = this;
        window.backView = 'dashboard';
        this.items = [];
        this.cliente = null;
        this.pagoQRId = null;
        const q = document.getElementById('pos-q');
        let t = null;
        q.oninput = () => { clearTimeout(t); t = setTimeout(() => this.buscar(q.value), 250); };

        const cli = document.getElementById('pos-cli');
        let tc = null;
        cli.oninput = () => { this.cliente = null; clearTimeout(tc); tc = setTimeout(() => this.autoCliente(cli.value), 250); };

        const chk = document.getElementById('pos-incluye-iva');
        if (chk) {
            chk.checked = this.precioIncluyeIva;
            chk.onchange = () => { this.precioIncluyeIva = chk.checked; this.render(); };
        }
        this.onMetodo();

        try {
            const s = await api.get(`/sede/${this.getSede()}`);
            this.tarifaIva = parseFloat(s.data?.ImpuestoPorcentaje ?? 15);
        } catch (_) {}
        const lbl = document.getElementById('pos-iva-lbl');
        if (lbl) lbl.textContent = `IVA ${this.tarifaIva}%`;
        this.render();
        this.onComprobante();
        this.verificarCaja();
        this.cargarRecientes();
        this.cargarDimensiones();
        CobroPasarela.estado().then(s => { this._pasarelaOk = !!s.habilitada; this.onMetodo(); }).catch(() => {});
    },

    /** Turno de caja del usuario: sin caja abierta no se cobran ventas de contado. */
    async verificarCaja() {
        const pill = document.getElementById('pos-caja-pill');
        const aviso = document.getElementById('pos-caja-aviso');
        try {
            const r = await api.get(`/ventas/caja-actual?sedeId=${this.getSede()}`);
            this.cajaAbierta = !!r.data.abierta;
            if (pill) {
                pill.className = 'pos-caja-pill ' + (this.cajaAbierta ? 'on' : 'off');
                pill.innerHTML = this.cajaAbierta
                    ? `<i class="fas fa-lock-open"></i> Caja #${r.data.cajaId} abierta`
                    : '<i class="fas fa-lock"></i> Caja cerrada';
            }
            if (aviso) aviso.style.display = this.cajaAbierta ? 'none' : 'flex';
        } catch (_) { if (pill) pill.textContent = 'Caja: sin datos'; }
    },

    comprobante() {
        return document.querySelector('input[name="pos-comp"]:checked')?.value || 'RECIBO';
    },

    onComprobante() {
        const fac = this.comprobante() === 'FACTURA';
        const extra = document.getElementById('pos-fac-extra');
        if (extra) extra.style.display = fac ? 'block' : 'none';
        const btn = document.getElementById('pos-reg');
        if (btn) btn.innerHTML = fac
            ? '<i class="fas fa-file-invoice"></i> REGISTRAR Y FACTURAR'
            : '<i class="fas fa-check"></i> REGISTRAR VENTA';
    },

    async cargarDimensiones() {
        try {
            const [cc, pr] = await Promise.all([
                api.get(`/contabilidad/centros-costo?sedeId=${this.getSede()}`),
                api.get(`/contabilidad/proyectos?sedeId=${this.getSede()}`)
            ]);
            const centros = cc.data.centros || [];
            const proys = pr.data.proyectos || [];
            if (!centros.length && !proys.length) return;
            const wrap = document.getElementById('pos-dim-wrap');
            if (wrap) wrap.style.display = 'grid';
            const selCC = document.getElementById('pos-centro');
            if (selCC) selCC.innerHTML = '<option value="">— ninguno —</option>' +
                centros.map(c => `<option value="${c.CentroCostoID}">${c.Codigo} · ${c.Nombre}</option>`).join('');
            const selPR = document.getElementById('pos-proyecto');
            if (selPR) selPR.innerHTML = '<option value="">— ninguno —</option>' +
                proys.map(p => `<option value="${p.ProyectoID}">${p.Codigo} · ${p.Nombre}</option>`).join('');
        } catch (_) {}
    },

    async buscar(q) {
        const box = document.getElementById('pos-result');
        if (!q || q.trim().length < 2) { box.style.display = 'none'; return; }
        try {
            const r = await api.get(`/ventas/productos?sedeId=${this.getSede()}&q=${encodeURIComponent(q.trim())}`);
            this._prods = r.data.productos || [];
            if (!this._prods.length) { box.style.display = 'block'; box.innerHTML = '<div style="cursor:default;color:#a0aab8">Sin coincidencias</div>'; return; }
            box.style.display = 'block';
            box.innerHTML = this._prods.map((p, i) => `
                <div onclick="PosModule.addProducto(${i})">
                    <span>${p.Nombre} <span class="stk">· $${this.fmt(p.PrecioVenta)} ${Number(p.GravaIVA) ? '' : '· <b style=\'color:#1e8e4e\'>0%</b>'}</span></span>
                    <span class="stk">stock ${p.StockActual}</span>
                </div>`).join('');
        } catch (e) { box.style.display = 'none'; }
    },

    addProducto(idx) {
        const p = this._prods[idx];
        if (!p) return;
        this.items.push({
            key: ++this._seq, ProductoID: p.ProductoID, Descripcion: p.Nombre,
            Cantidad: 1, PrecioUnitario: Number(p.PrecioVenta || 0), Descuento: 0,
            AplicaIva: Number(p.GravaIVA) ? true : false
        });
        document.getElementById('pos-q').value = '';
        document.getElementById('pos-result').style.display = 'none';
        this.render();
    },
    addLibre() {
        this.items.push({ key: ++this._seq, ProductoID: null, Descripcion: '', Cantidad: 1, PrecioUnitario: 0, Descuento: 0, AplicaIva: true });
        this.render();
    },
    quitar(key) { this.items = this.items.filter(i => i.key !== key); this.render(); },

    // Actualiza SOLO el modelo + la celda de total de esa fila + los totales.
    // No re-renderiza la tabla, para no perder el foco/cursor mientras se tipea.
    _set(key, campo, val) {
        const it = this.items.find(i => i.key === key);
        if (!it) return;
        if (campo === 'Descripcion') it.Descripcion = val;
        else if (campo === 'AplicaIva') it.AplicaIva = (val === '1' || val === true);
        else it[campo] = parseFloat(val) || 0;

        const c = this._calc(it);
        const cell = document.getElementById(`pos-tl-${key}`);
        if (cell) cell.textContent = this.fmt(c.total);
        if (campo === 'AplicaIva') {
            const sel = document.querySelector(`#pos-items tr[data-key="${key}"] .iva-sel`);
            if (sel) sel.classList.toggle('iva0', !it.AplicaIva);
        }
        this._recalcTotales();
    },

    _recalcTotales() {
        let base15 = 0, base0 = 0, iva = 0, total = 0;
        this.items.forEach(it => {
            const c = this._calc(it);
            if (it.AplicaIva) base15 += c.base; else base0 += c.base;
            iva += c.iva; total += c.total;
        });
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = this.fmt(v); };
        set('pos-base15', base15);
        set('pos-base0', base0);
        set('pos-iva', iva);
        set('pos-total', total);
        const b0row = document.getElementById('pos-base0-row');
        if (b0row) b0row.style.display = base0 > 0 ? 'flex' : 'none';
        document.getElementById('pos-reg').disabled = this.items.length === 0;
    },

    render() {
        const tb = document.getElementById('pos-items');
        if (!this.items.length) {
            tb.innerHTML = '<tr><td colspan="6" class="omni-empty">Agrega productos o un ítem libre.</td></tr>';
            this._recalcTotales();
            return;
        }
        tb.innerHTML = this.items.map(it => {
            const c = this._calc(it);
            return `<tr data-key="${it.key}">
                <td><input class="omni-input" value="${(it.Descripcion || '').replace(/"/g, '&quot;')}" onchange="PosModule._set(${it.key},'Descripcion',this.value)"></td>
                <td><input type="number" min="0" step="1" class="omni-input num" value="${it.Cantidad}" oninput="PosModule._set(${it.key},'Cantidad',this.value)"></td>
                <td><input type="number" min="0" step="0.01" class="omni-input num" value="${it.PrecioUnitario}" oninput="PosModule._set(${it.key},'PrecioUnitario',this.value)"></td>
                <td>
                    <select class="omni-input iva-sel ${it.AplicaIva ? '' : 'iva0'}" onchange="PosModule._set(${it.key},'AplicaIva',this.value)">
                        <option value="1" ${it.AplicaIva ? 'selected' : ''}>IVA ${this.tarifaIva}%</option>
                        <option value="0" ${it.AplicaIva ? '' : 'selected'}>IVA 0%</option>
                    </select>
                </td>
                <td class="num" id="pos-tl-${it.key}">${this.fmt(c.total)}</td>
                <td><button class="omni-btn omni-btn-danger" style="padding:5px 8px" onclick="PosModule.quitar(${it.key})"><i class="fas fa-xmark"></i></button></td>
            </tr>`;
        }).join('');
        this._recalcTotales();
    },

    toggleCredito() {
        const cr = document.getElementById('pos-tipo').value === 'CREDITO';
        document.getElementById('pos-dias-wrap').style.display = cr ? 'flex' : 'none';
        document.getElementById('pos-mp-wrap').style.display = cr ? 'none' : 'flex';
    },

    /* ---------- Cliente ---------- */
    async autoCliente(q) {
        const box = document.getElementById('pos-cli-result');
        if (!q || q.trim().length < 3) { box.style.display = 'none'; return; }
        try {
            const r = await api.get(`/clientes?q=${encodeURIComponent(q.trim())}`);
            this._clis = r.data.clientes || [];
            if (!this._clis.length) { box.style.display = 'none'; return; }
            box.style.display = 'block';
            box.innerHTML = this._clis.map((c, i) => `
                <div onclick="PosModule.pickCliente(${i})">
                    <span>${c.NombreFull || '(sin nombre)'}</span>
                    <span class="stk">${c.Documento || ''}</span>
                </div>`).join('');
        } catch (_) { box.style.display = 'none'; }
    },
    pickCliente(i) {
        const c = this._clis[i]; if (!c) return;
        this.cliente = { ClienteID: c.ClienteID, NombreFull: c.NombreFull, Documento: c.Documento };
        document.getElementById('pos-cli').value = c.NombreFull || '';
        document.getElementById('pos-doc').value = c.Documento || '';
        document.getElementById('pos-cli-result').style.display = 'none';
    },
    limpiarCliente() {
        this.cliente = null;
        document.getElementById('pos-cli').value = '';
        document.getElementById('pos-doc').value = '';
        document.getElementById('pos-cli-result').style.display = 'none';
    },
    async buscarCliente() {
        const raw = document.getElementById('pos-cli').value.trim();
        const doc = document.getElementById('pos-doc').value.trim() || (/^\d{9,13}$/.test(raw) ? raw : '');
        if (doc) {
            try {
                const r = await api.get(`/clientes/documento/${doc}`);
                if (r.data.success) {
                    const c = r.data.cliente;
                    this.cliente = { ClienteID: c.ClienteID || null, NombreFull: c.NombreFull, Documento: c.Documento || doc };
                    document.getElementById('pos-cli').value = c.NombreFull || '';
                    document.getElementById('pos-doc').value = c.Documento || doc;
                    window.Toast.fire({ icon: 'success', title: r.data.source === 'padron' ? 'Encontrado en Padrón Nacional' : 'Cliente en base local' });
                } else {
                    window.Toast.fire({ icon: 'info', title: 'No encontrado', text: 'Escribe el nombre para registrarlo como cliente nuevo.' });
                }
            } catch (_) { window.Toast.fire({ icon: 'error', title: 'Error al buscar' }); }
        } else if (raw.length >= 3) {
            this.autoCliente(raw);
        }
    },

    /* ---------- Método de pago / QR ---------- */
    onMetodo() {
        const m = document.getElementById('pos-mp').value;
        const extra = document.getElementById('pos-pago-extra');
        const qrBtn = document.getElementById('pos-qr-btn');
        const psBtn = document.getElementById('pos-pasarela-btn');
        extra.style.display = (m === '1') ? 'none' : 'block';
        qrBtn.style.display = (m === '5') ? 'flex' : 'none';
        if (psBtn) psBtn.style.display = (m === '5' && this._pasarelaOk) ? 'flex' : 'none';
        if (m === '1') { this.pagoQRId = null; document.getElementById('pos-qr-ok').style.display = 'none'; }
    },

    async cobrarConPasarela() {
        const monto = this._totalActual();
        if (monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Agrega ítems primero' }); return; }
        const r = await CobroPasarela.iniciar({
            monto, concepto: 'Venta POS',
            referencia: `POS-${Date.now().toString(36).toUpperCase()}`,
            email: this.cliente?.Correo || null,
            origen: 'VENTA'
        });
        if (r.aprobado) {
            this._pasarelaPago = { clt: r.clientTransactionId, auth: r.authCode, pasarela: r.pasarela };
            document.getElementById('pos-ref').value = r.authCode || r.clientTransactionId;
            document.getElementById('pos-qr-ref').textContent = `${r.pasarela || 'pasarela'} · ${r.authCode || ''}`;
            document.getElementById('pos-qr-ok').style.display = 'block';
            window.Toast.fire({ icon: 'success', title: 'Pago aprobado por la pasarela' });
        } else if (!r.cancelado && !r.sinPasarela) {
            window.Toast.fire({ icon: 'error', title: 'El pago no se completó' });
        }
    },
    _totalActual() {
        let total = 0;
        this.items.forEach(it => { total += this._calc(it).total; });
        return this._r2(total);
    },
    async generarQrDeuna() {
        const monto = this._totalActual();
        if (monto <= 0) { window.Toast.fire({ icon: 'warning', title: 'Agrega ítems primero' }); return; }
        try {
            const r = await api.post('/ventas/qr', { Monto: monto, Proveedor: 'DEUNA' });
            const d = r.data;
            const res = await Swal.fire({
                title: 'QR Deuna — $ ' + this.fmt(d.monto),
                html: `<img src="${d.qrDataUrl}" style="width:250px;height:250px"><div style="font-size:.8rem;margin-top:8px"><b>Ref:</b> ${d.referencia}</div><div style="font-size:.72rem;color:#718096;margin-top:6px">${d.nota}</div>`,
                showCancelButton: true, confirmButtonText: 'Cliente ya pagó', cancelButtonText: 'Cancelar'
            });
            if (!res.isConfirmed) return;
            await api.post(`/ventas/qr/${d.pagoQRId}/confirmar`, {});
            this.pagoQRId = d.pagoQRId;
            document.getElementById('pos-ref').value = d.referencia;
            document.getElementById('pos-qr-ref').textContent = d.referencia;
            document.getElementById('pos-qr-ok').style.display = 'block';
            window.Toast.fire({ icon: 'success', title: 'Pago QR confirmado' });
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error al generar QR' }); }
    },

    async registrar() {
        const items = this.items
            .filter(i => i.Cantidad > 0)
            .map(i => ({
                ProductoID: i.ProductoID, Descripcion: i.Descripcion || 'Ítem',
                Cantidad: i.Cantidad, PrecioUnitario: i.PrecioUnitario,
                Descuento: i.Descuento || 0, AplicaIva: i.AplicaIva
            }));
        if (!items.length) { window.Toast.fire({ icon: 'warning', title: 'Agrega al menos un ítem' }); return; }
        if (items.some(i => !i.Descripcion.trim())) { window.Toast.fire({ icon: 'warning', title: 'Hay ítems sin descripción' }); return; }

        const tipo = document.getElementById('pos-tipo').value;
        const mpId = parseInt(document.getElementById('pos-mp').value);
        const comprobante = this.comprobante();
        const docCli = document.getElementById('pos-doc').value.trim();
        const nomCli = document.getElementById('pos-cli').value.trim();

        if (tipo === 'CONTADO' && this.cajaAbierta === false) {
            const r = await Swal.fire({ icon: 'warning', title: 'Caja cerrada', text: 'Debe aperturar su turno de caja para cobrar ventas de contado.', showCancelButton: true, confirmButtonText: 'Ir a Caja', cancelButtonText: 'Cancelar' });
            if (r.isConfirmed) App.renderView('caja', 'viewport');
            return;
        }
        if (comprobante === 'FACTURA') {
            if ((!docCli || docCli === '9999999999999') && this._totalActual() > 50) {
                Swal.fire('Datos del cliente', 'El SRI no permite facturar a CONSUMIDOR FINAL por más de $50. Ingrese cédula/RUC y nombre del cliente.', 'warning');
                return;
            }
            if (docCli && docCli !== '9999999999999' && !nomCli) { window.Toast.fire({ icon: 'warning', title: 'Ingrese el nombre del cliente' }); return; }
        }
        const payload = {
            SedeID: this.getSede(),
            ClienteID: this.cliente?.ClienteID || null,
            ClienteNombre: document.getElementById('pos-cli').value.trim() || 'CONSUMIDOR FINAL',
            ClienteDoc: document.getElementById('pos-doc').value.trim() || null,
            TipoVenta: tipo,
            TipoComprobante: comprobante,
            ClienteCorreo: document.getElementById('pos-correo')?.value.trim() || null,
            ClienteDireccion: document.getElementById('pos-dir')?.value.trim() || null,
            PrecioIncluyeIva: this.precioIncluyeIva,
            MetodoPagoID: mpId,
            FormaPago: document.getElementById('pos-mp').selectedOptions[0].text,
            ReferenciaPago: document.getElementById('pos-ref')?.value.trim() || null,
            PagoQRID: this.pagoQRId || null,
            PagoPasarelaCLT: this._pasarelaPago?.clt || null,
            DiasCredito: parseInt(document.getElementById('pos-dias').value) || 30,
            Observacion: document.getElementById('pos-obs').value.trim() || null,
            CentroCostoID: document.getElementById('pos-centro')?.value || null,
            ProyectoID: document.getElementById('pos-proyecto')?.value || null,
            Items: items
        };
        const btn = document.getElementById('pos-reg');
        btn.disabled = true;
        try {
            const r = await api.post('/ventas', payload);

            // Adjuntar comprobante si se seleccionó uno (llamada multipart aparte)
            const file = document.getElementById('pos-voucher')?.files?.[0];
            if (file && r.data.ventaId) {
                try {
                    const fd = new FormData();
                    fd.append('voucher', file);
                    const base = api.base();
                    await window.axios.post(`${base}/ventas/${r.data.ventaId}/voucher`, fd, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                } catch (_) { window.Toast.fire({ icon: 'warning', title: 'Venta OK, pero el comprobante no se pudo subir' }); }
            }

            if (r.data.factura) {
                const f = r.data.factura;
                window.Toast.fire({ icon: 'success', title: `Venta #${r.data.numero} · Factura ${f.numero}`, text: `$${this.fmt(f.total)} — SRI: ${f.estadoSRI}` });
            } else if (r.data.facturaError) {
                Swal.fire({ icon: 'warning', title: `Venta #${r.data.numero} registrada, factura NO emitida`,
                    html: `<div style="text-align:left;font-size:.85rem">${r.data.facturaError}<br><br>La venta, la caja y el inventario ya quedaron registrados. Corrija el problema y use el botón <b>Facturar</b> en "Ventas recientes".</div>` });
            } else {
                window.Toast.fire({ icon: 'success', title: `Venta #${r.data.numero} registrada · $${this.fmt(r.data.total)}` });
            }

            // Impresión automática del ticket si la empresa lo tiene configurado
            try {
                const Ticket = require('./ticket');
                if (r.data.ventaId && await Ticket.autoImprimir(this.getSede())) {
                    await this._imprimirTicket(r.data.ventaId, true);
                }
            } catch (_) {}

            this.items = [];
            this.pagoQRId = null;
            this._pasarelaPago = null;
            this.limpiarCliente();
            document.getElementById('pos-obs').value = '';
            const ref = document.getElementById('pos-ref'); if (ref) ref.value = '';
            ['pos-correo', 'pos-dir'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
            const vf = document.getElementById('pos-voucher'); if (vf) vf.value = '';
            document.getElementById('pos-qr-ok').style.display = 'none';
            this.render();
            this.cargarRecientes();
        } catch (e) {
            const msg = e.response?.data?.error || 'Error al registrar';
            if (/CAJA CERRADA/.test(msg)) this.verificarCaja();
            Swal.fire({ icon: 'error', title: 'No se registró la venta', text: msg });
        } finally { btn.disabled = false; }
    },

    async cargarRecientes() {
        try {
            const r = await api.get(`/ventas?sedeId=${this.getSede()}`);
            const v = r.data.ventas || [];
            const tb = document.getElementById('pos-recent');
            if (!v.length) { tb.innerHTML = '<tr><td colspan="8" class="omni-empty">Sin ventas en el período.</td></tr>'; return; }
            this._recientes = v;
            tb.innerHTML = v.slice(0, 25).map(x => `
                <tr>
                    <td>#${x.Numero}</td>
                    <td>${(x.Fecha || '').slice(0, 10)}</td>
                    <td>${x.ClienteNombre || ''}</td>
                    <td><span class="bdg ${x.TipoVenta === 'CREDITO' ? 'cr' : 'ok'}">${x.TipoVenta}</span></td>
                    <td class="num">${this.fmt(x.Total)}</td>
                    <td>${x.FacturaID
                        ? `<span class="bdg fac" title="${x.FacturaInfo || ''}">${(x.FacturaInfo || 'FACTURA').replace('FAC ', '')}</span>`
                        : (x.TipoComprobante === 'FACTURA' ? '<span class="bdg cr" title="Se pidió factura pero no se emitió">FACTURA PENDIENTE</span>' : '<span class="bdg rec">RECIBO</span>')}</td>
                    <td><span class="bdg ${x.Estado === 'EMITIDA' ? 'ok' : 'no'}">${x.Estado}</span></td>
                    <td style="white-space:nowrap">
                        ${x.FacturaID ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px" title="Ver RIDE (PDF de la factura)" onclick="PosModule.verRide(${x.FacturaID})"><i class="fas fa-file-pdf"></i></button>` : ''}
                        ${!x.FacturaID && x.Estado === 'EMITIDA' ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px;color:#2f7be6" title="Emitir factura electrónica de esta venta" onclick="PosModule.facturar(${x.VentaID})"><i class="fas fa-file-invoice"></i></button>` : ''}
                        <button class="omni-btn omni-btn-ghost" style="padding:5px 9px" title="Imprimir ticket" onclick="PosModule._imprimirTicket(${x.VentaID})"><i class="fas fa-print"></i></button>
                        ${x.AsientoID ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px;color:#2e7d32" title="Ver asiento contable" onclick="PosModule.verAsiento(${x.VentaID})"><i class="fas fa-book"></i></button>` : ''}
                        ${x.Estado === 'EMITIDA' ? `<button class="omni-btn omni-btn-danger" style="padding:5px 9px" onclick="PosModule.anular(${x.VentaID})"><i class="fas fa-ban"></i></button>` : ''}
                    </td>
                </tr>`).join('');
        } catch (_) {}
    },

    verAsiento(ventaId) { verAsientosDe(ventaId, 'VENTA', 'COGS'); },

    async verRide(facturaId) {
        try {
            const r = await api.get(`/facturacion/documento/ride/${facturaId}`);
            if (r.data.success) window.open(`${api.defaults.baseURL.replace('/api', '')}${r.data.pdfUrl}`, '_blank');
        } catch (e) { window.Toast.fire({ icon: 'error', title: 'No se pudo generar el RIDE' }); }
    },

    /** Emite la factura de una venta ya registrada (recibo que el cliente pide facturar o reintento). */
    async facturar(ventaId) {
        const v = (this._recientes || []).find(x => x.VentaID === ventaId) || {};
        const esCF = !v.ClienteDoc || v.ClienteDoc === '9999999999999';
        const esc = t => String(t || '').replace(/"/g, '&quot;');
        const r = await Swal.fire({
            title: `Facturar venta #${v.Numero || ventaId}`,
            html: `<div style="text-align:left;font-size:.8rem;color:#5a6b7d">Total: <b>$${this.fmt(v.Total)}</b> — la factura toma los valores exactos de la venta.</div>
                   <input id="sf-doc" class="swal2-input" placeholder="Cédula / RUC" value="${esCF ? '' : esc(v.ClienteDoc)}">
                   <input id="sf-nom" class="swal2-input" placeholder="Nombre / Razón social" value="${esCF ? '' : esc(v.ClienteNombre)}">
                   <input id="sf-mail" class="swal2-input" placeholder="Correo (opcional)">`,
            showCancelButton: true, confirmButtonText: 'Emitir factura', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const doc = document.getElementById('sf-doc').value.trim() || '9999999999999';
                const nom = document.getElementById('sf-nom').value.trim();
                if (doc !== '9999999999999' && !nom) { Swal.showValidationMessage('Ingrese el nombre del cliente'); return false; }
                if (doc === '9999999999999' && Number(v.Total) > 50) { Swal.showValidationMessage('Consumidor final solo hasta $50'); return false; }
                return { Documento: doc, NombreFull: nom || 'CONSUMIDOR FINAL', Correo: document.getElementById('sf-mail').value.trim() };
            }
        });
        if (!r.isConfirmed) return;
        Swal.fire({ title: 'Emitiendo factura…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await api.post(`/ventas/${ventaId}/facturar`, { Cliente: r.value });
            const f = res.data.factura;
            Swal.fire({ icon: 'success', title: `Factura ${f.numero}`, text: `$${this.fmt(f.total)} — SRI: ${f.estadoSRI}` });
            this.cargarRecientes();
        } catch (e) { Swal.fire('No se emitió la factura', e.response?.data?.error || 'Error', 'error'); }
    },

    async _imprimirTicket(ventaId, silencioso) {
        try {
            const [rv, rs] = await Promise.all([
                api.get(`/ventas/${ventaId}`),
                api.get(`/sede/${this.getSede()}`)
            ]);
            const Ticket = require('./ticket');
            await Ticket.imprimirVenta({
                venta: rv.data.venta, detalle: rv.data.detalle,
                empresa: rs.data, sedeId: this.getSede()
            });
            if (!silencioso) window.Toast.fire({ icon: 'success', title: 'Ticket enviado a impresión' });
        } catch (e) {
            window.Toast.fire({ icon: 'error', title: e.message || 'No se pudo imprimir el ticket' });
        }
    },

    async anular(id) {
        const r = await Swal.fire({ title: '¿Anular venta?', text: 'Se devuelve el stock y, si fue de contado, se registra la devolución del dinero en caja.', input: 'text', inputPlaceholder: 'Motivo (obligatorio)', icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'No',
            inputValidator: v => (!v || v.trim().length < 5) ? 'Indique el motivo (mínimo 5 caracteres)' : undefined });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/ventas/${id}/anular`, { motivo: r.value || '' });
            window.Toast.fire({ icon: 'success', title: 'Venta anulada' });
            this.cargarRecientes();
        } catch (e) { Swal.fire('No se anuló', e.response?.data?.error || 'Error', 'error'); }
    }
};

module.exports = PosModule;
