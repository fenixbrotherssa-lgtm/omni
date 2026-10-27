const api = require('./api');
const { marcarBuscando } = require('./uiLoading');

const RetencionesModule = {
    impuestos: [],
    codigosCache: [],
    itemsLiquidacion: [],
    proveedoresCache: [],

    async init() {
        console.log("📡 Módulo de Retenciones Iniciado (dentro de Facturación)...");
        // El selector de sede es el de Facturación (#globalSedeSelector) — getSedeId() ya lo lee de ahí.
        await this.cargarCodigos();
        await this.cargarHistorial();
        await this.cargarProveedoresCache();
        window.RetencionesModule = this;
    },

    getSedeId() {
        const selector = document.getElementById('globalSedeSelector');
        if (selector) return selector.value;
        const user = JSON.parse(localStorage.getItem('user'));
        return localStorage.getItem('currentSedeId') || (user ? user.SedeID : 1);
    },

    switchTab(tab) {
        const tabs = { emitir: 'retTabEmitir', historial: 'retTabHistorial', compras: 'retTabCompras', liquidacion: 'retTabLiquidacion', proveedores: 'retTabProveedores', codigos: 'retTabCodigos' };
        const btns = { emitir: 'retBtnTabEmitir', historial: 'retBtnTabHistorial', compras: 'retBtnTabCompras', liquidacion: 'retBtnTabLiquidacion', proveedores: 'retBtnTabProveedores', codigos: 'retBtnTabCodigos' };

        Object.keys(tabs).forEach(t => {
            const el = document.getElementById(tabs[t]);
            const btn = document.getElementById(btns[t]);
            if (el) el.classList.toggle('hidden', t !== tab);
            if (btn) btn.classList.toggle('active', t === tab);
        });

        if (tab === 'historial') this.cargarHistorial();
        if (tab === 'compras') { this.cargarCompras(); this.cargarMetodosYRubrosCompra(); }
        if (tab === 'liquidacion') this.cargarHistorialLiquidacion();
        if (tab === 'proveedores') this.buscarProveedores();
        if (tab === 'codigos') this.cargarCodigos();
    },

    // ══════════════════ EMITIR RETENCIÓN ══════════════════

    async cargarCodigos() {
        try {
            const res = await api.get('/codigosretencion');
            this.codigosCache = res.data.codigos || [];

            const select = document.getElementById('retSelectCodigo');
            if (select) {
                select.innerHTML = '<option value="">-- Seleccionar --</option>' +
                    this.codigosCache.map(c => `<option value="${c.CodigoRetencionID}">${c.Tipo} ${c.Codigo} — ${c.Descripcion} (${c.PorcentajeDefault}%)</option>`).join('');
            }

            const tabla = document.getElementById('crTablaBody');
            if (tabla) {
                tabla.innerHTML = this.codigosCache.length
                    ? this.codigosCache.map(c => `
                        <tr>
                            <td>${c.Tipo}</td><td>${c.Codigo}</td><td>${c.Descripcion}</td><td>${c.PorcentajeDefault}%</td>
                            <td><button class="btn-neo btn-danger" style="padding:8px 12px;" onclick="RetencionesModule.eliminarCodigo(${c.CodigoRetencionID})"><i class="fas fa-trash"></i></button></td>
                        </tr>
                    `).join('')
                    : '<tr><td colspan="5" style="text-align:center; opacity:0.5;">Sin códigos registrados.</td></tr>';
            }
        } catch (err) {
            console.error('Error cargando códigos de retención:', err);
        }
    },

    autoLlenarCodigo() {
        const id = parseInt(document.getElementById('retSelectCodigo').value);
        const codigo = this.codigosCache.find(c => c.CodigoRetencionID === id);
        if (codigo) document.getElementById('retDetPct').value = codigo.PorcentajeDefault;
    },

    agregarImpuesto() {
        const select = document.getElementById('retSelectCodigo');
        const id = parseInt(select.value);
        const codigo = this.codigosCache.find(c => c.CodigoRetencionID === id);
        if (!codigo) return Swal.fire('Falta el código', 'Seleccione un código de retención.', 'warning');

        const base = parseFloat(document.getElementById('retDetBase').value);
        const pct  = parseFloat(document.getElementById('retDetPct').value);
        if (!base || base <= 0) return Swal.fire('Base inválida', 'La base imponible debe ser mayor a 0.', 'warning');
        if (pct === undefined || isNaN(pct)) return Swal.fire('Porcentaje inválido', 'Indique el porcentaje a retener.', 'warning');

        this.impuestos.push({
            TipoImpuesto: codigo.Tipo, CodigoRetencion: codigo.Codigo,
            Descripcion: codigo.Descripcion, BaseImponible: base, PorcentajeRetener: pct
        });

        document.getElementById('retDetBase').value = '';
        document.getElementById('retDetPct').value = '';
        select.value = '';
        this.renderImpuestos();
    },

    quitarImpuesto(index) {
        this.impuestos.splice(index, 1);
        this.renderImpuestos();
    },

    renderImpuestos() {
        const body = document.getElementById('retTablaImpuestosBody');
        if (!this.impuestos.length) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; opacity:0.5;">Sin impuestos agregados</td></tr>';
        } else {
            body.innerHTML = this.impuestos.map((imp, i) => {
                const retenido = (imp.BaseImponible * imp.PorcentajeRetener / 100).toFixed(2);
                return `
                    <tr>
                        <td>${imp.TipoImpuesto}</td>
                        <td>${imp.CodigoRetencion}</td>
                        <td>$${imp.BaseImponible.toFixed(2)}</td>
                        <td>${imp.PorcentajeRetener}%</td>
                        <td>$${retenido}</td>
                        <td><button class="btn-neo btn-danger" style="padding:8px 12px;" onclick="RetencionesModule.quitarImpuesto(${i})"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `;
            }).join('');
        }
        const total = this.impuestos.reduce((acc, imp) => acc + (imp.BaseImponible * imp.PorcentajeRetener / 100), 0);
        document.getElementById('retTotalGeneral').textContent = total.toFixed(2);
    },

    async emitir() {
        const documento = document.getElementById('retProvDocumento').value.trim();
        const razonSocial = document.getElementById('retProvRazonSocial').value.trim();
        const periodoFiscal = document.getElementById('retPeriodoFiscal').value.trim();
        const numDocSustento = document.getElementById('retNumDocSustento').value.trim();
        const fechaDocSustento = document.getElementById('retFechaDocSustento').value;

        if (!documento || !razonSocial) return Swal.fire('Faltan datos', 'Documento y Razón Social del proveedor son obligatorios.', 'warning');
        if (!/^\d{2}\/\d{4}$/.test(periodoFiscal)) return Swal.fire('Período inválido', 'El período fiscal debe tener formato MM/YYYY.', 'warning');
        if (!numDocSustento || !fechaDocSustento) return Swal.fire('Faltan datos', 'Complete el número y fecha de la factura del proveedor.', 'warning');
        if (!this.impuestos.length) return Swal.fire('Sin impuestos', 'Agregue al menos un impuesto a retener.', 'warning');

        const lineas = this._lineasCompra || [];
        if (lineas.some(l => !l.ProductoID && !String(l.Descripcion || '').trim()))
            return Swal.fire('Detalle incompleto', 'Hay líneas de gasto/servicio sin descripción.', 'warning');
        if (lineas.some(l => !(l.Cantidad > 0) || (l.ProductoID && !Number.isInteger(l.Cantidad))))
            return Swal.fire('Detalle incompleto', 'Revise las cantidades (los productos de inventario van en unidades enteras).', 'warning');
        const baseTot = (parseFloat(document.getElementById('cpBaseImponible').value) || 0) + (parseFloat(document.getElementById('cpBaseImponible0').value) || 0);
        const invTot = lineas.filter(l => l.ProductoID).reduce((s, l) => s + this._r2(l.Cantidad * l.CostoUnitario), 0);
        if (baseTot - invTot > 0.009 && !document.getElementById('cpContra')?.value)
            return Swal.fire('Falta la cuenta contable', `Hay $${(baseTot - invTot).toFixed(2)} que no son productos de inventario. Elija la cuenta del gasto/activo para que la compra quede contabilizada.`, 'warning');

        const user = JSON.parse(localStorage.getItem('user'));
        const payload = {
            SedeID: this.getSedeId(),
            Detalles: lineas.map(l => ({ ProductoID: l.ProductoID, Descripcion: l.Descripcion, Cantidad: l.Cantidad, CostoUnitario: l.CostoUnitario, AplicaIva: l.AplicaIva })),
            UsuarioID: user ? user.UsuarioID : 1,
            Proveedor: {
                Documento: documento,
                TipoIdentificacion: documento.length === 13 ? '04' : '05',
                RazonSocial: razonSocial,
                Correo: document.getElementById('retProvCorreo').value.trim() || null,
                Telefono: document.getElementById('retProvTelefono').value.trim() || null
            },
            PeriodoFiscal: periodoFiscal,
            NumDocSustento: numDocSustento,
            FechaDocSustento: fechaDocSustento,
            Impuestos: this.impuestos.map(i => ({ TipoImpuesto: i.TipoImpuesto, CodigoRetencion: i.CodigoRetencion, BaseImponible: i.BaseImponible, PorcentajeRetener: i.PorcentajeRetener }))
        };

        try {
            Swal.fire({ title: 'Generando Comprobante de Retención...', text: 'Firmando XML e interactuando con SRI...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await api.post('/retenciones/emitir', payload);
            if (res.data.success) {
                await Swal.fire({ title: '¡RETENCIÓN EMITIDA!', text: `SRI: ${res.data.estadoSRI} | Acceso: ${res.data.claveAcceso}`, icon: 'success', confirmButtonColor: 'var(--hotel-blue)' });
                this.resetFormulario();
                await this.cargarHistorial();
                await this.cargarProveedoresCache();
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'No se pudo emitir', text: err.response?.data?.error || 'Error desconocido' });
        }
    },

    resetFormulario() {
        this.impuestos = [];
        ['retProvSelect','retProvDocumento','retProvRazonSocial','retProvCorreo','retProvTelefono','retPeriodoFiscal','retNumDocSustento','retFechaDocSustento']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        this.renderImpuestos();
    },

    // ══════════════════ HISTORIAL ══════════════════

    async cargarHistorial() {
        try {
            const res = await api.get(`/retenciones/historial/${this.getSedeId()}`);
            this.historialRetencionCache = res.data || [];
            this.renderHistorial();
        } catch (err) {
            console.error('Error cargando historial de retenciones:', err);
        }
    },

    renderHistorial() {
        const body = document.getElementById('retTablaHistorialBody');
        if (!body) return;
        const buscar = (document.getElementById('retHistorialBuscar')?.value || '').trim().toLowerCase();
        const base = this.historialRetencionCache || [];
        const lista = buscar
            ? base.filter(r => (r.ProveedorNombre || '').toLowerCase().includes(buscar) || (r.ProveedorDocumento || '').toLowerCase().includes(buscar) || (r.Secuencial || '').toLowerCase().includes(buscar))
            : base;

        if (!lista.length) {
            body.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:0.5;">${buscar ? `Sin resultados para "${buscar}".` : 'Sin retenciones emitidas.'}</td></tr>`;
            return;
        }
        body.innerHTML = lista.map(r => {
            const badgeClass = r.EstadoSRI === 'AUTORIZADO' ? 'badge-autorizado'
                : r.EstadoSRI === 'FIRMADO' ? 'badge-firmado'
                : r.EstadoSRI === 'RECHAZADO' ? 'badge-rechazado' : 'badge-pendiente';
            return `
                <tr>
                    <td>${r.Secuencial}</td>
                    <td>${r.ProveedorNombre}<br><small style="opacity:0.6;">${r.ProveedorDocumento || ''}</small></td>
                    <td>${r.PeriodoFiscal}</td>
                    <td>$${parseFloat(r.TotalRetenido).toFixed(2)}</td>
                    <td><span class="badge-sri ${badgeClass}">${r.EstadoSRI || 'PENDIENTE'}</span></td>
                    <td>
                        <button class="btn-neo" style="padding:8px 12px;" title="Ver RIDE" onclick="RetencionesModule.verRIDE(${r.RetencionID})"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-neo" style="padding:8px 12px;" title="Enviar correo" onclick="RetencionesModule.enviarCorreo(${r.RetencionID})"><i class="fas fa-envelope"></i></button>
                        ${r.AsientoID ? `<button class="btn-neo" style="padding:8px 12px;color:#2e7d32" title="Ver asiento contable" onclick="RetencionesModule.verAsiento(${r.AsientoID})"><i class="fas fa-book"></i></button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },

    async verRIDE(retencionId) {
        try {
            const res = await api.get(`/retenciones/documento/ride/${retencionId}`);
            if (res.data.success) {
                const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
                window.open(`${base}${res.data.pdfUrl}`, '_blank');
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo generar el RIDE.', 'error');
        }
    },

    verAsientoCompra(compraId, asientoId) { return this.verAsiento(asientoId); },

    async verAsiento(asientoId) {
        try {
            const res = await api.get(`/contabilidad/asientos/${asientoId}`);
            const a = res.data.asiento;
            const filas = (res.data.detalle || []).map(d => `
                <tr>
                    <td style="text-align:left">${d.Codigo} · ${d.CuentaNombre}</td>
                    <td style="text-align:right">${parseFloat(d.Debe) ? '$' + parseFloat(d.Debe).toFixed(2) : ''}</td>
                    <td style="text-align:right">${parseFloat(d.Haber) ? '$' + parseFloat(d.Haber).toFixed(2) : ''}</td>
                </tr>`).join('');
            Swal.fire({
                title: `Asiento #${a.Numero} · ${a.Origen}`,
                html: `
                    <div style="font-size:13px;text-align:left;margin-bottom:6px">
                        <b>Fecha:</b> ${new Date(a.Fecha).toLocaleDateString()} &nbsp;·&nbsp;
                        <b>Estado:</b> ${a.Estado}<br>
                        <b>Glosa:</b> ${a.Glosa || ''}
                    </div>
                    <table class="swal2-table" style="width:100%;font-size:13px;border-collapse:collapse">
                        <thead><tr>
                            <th style="text-align:left;border-bottom:1px solid #ccc">Cuenta</th>
                            <th style="text-align:right;border-bottom:1px solid #ccc">Debe</th>
                            <th style="text-align:right;border-bottom:1px solid #ccc">Haber</th>
                        </tr></thead>
                        <tbody>${filas}</tbody>
                        <tfoot><tr style="font-weight:bold;border-top:2px solid #333">
                            <td style="text-align:right">TOTAL</td>
                            <td style="text-align:right">$${parseFloat(a.TotalDebe).toFixed(2)}</td>
                            <td style="text-align:right">$${parseFloat(a.TotalHaber).toFixed(2)}</td>
                        </tr></tfoot>
                    </table>`,
                width: 620
            });
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo cargar el asiento.', 'error');
        }
    },

    async enviarCorreo(retencionId) {
        const { value: correo } = await Swal.fire({
            title: 'Enviar Comprobante de Retención',
            input: 'email',
            inputPlaceholder: 'correo@ejemplo.com',
            showCancelButton: true,
            confirmButtonText: 'Enviar'
        });
        if (!correo) return;
        try {
            Swal.fire({ title: 'Enviando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await api.post('/retenciones/documento/enviar-correo', { retencionId, correoDestino: correo });
            await Swal.fire('Enviado', 'El correo fue enviado correctamente.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo enviar el correo.', 'error');
        }
    },

    // ══════════════════ SELECTOR DE PROVEEDOR (compartido: Emitir Retención + Compras) ══════════════════

    async cargarProveedoresCache() {
        try {
            const res = await api.get('/proveedores');
            this.proveedoresCache = res.data.proveedores || [];
            const opciones = '<option value="">-- Nuevo proveedor (ingrese los datos abajo) --</option>' +
                this.proveedoresCache.map(p => `<option value="${p.ProveedorID}">${p.RazonSocial} — ${p.Documento}</option>`).join('');
            ['retProvSelect', 'cpProvSelect', 'lcProvSelect'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel) sel.innerHTML = opciones;
            });
        } catch (err) {
            console.error('Error cargando caché de proveedores:', err);
        }
    },

    seleccionarProveedor(prefix, proveedorId) {
        const map = { ret: 'retProv', cp: 'cpProv', lc: 'lcProv' };
        const p = this.proveedoresCache.find(x => x.ProveedorID === parseInt(proveedorId));
        const base = map[prefix];
        if (!p) {
            ['Documento','RazonSocial','Correo','Telefono'].forEach(campo => {
                const el = document.getElementById(`${base}${campo}`);
                if (el) el.value = '';
            });
            return;
        }
        const setVal = (campo, valor) => { const el = document.getElementById(`${base}${campo}`); if (el) el.value = valor || ''; };
        setVal('Documento', p.Documento);
        setVal('RazonSocial', p.RazonSocial);
        setVal('Correo', p.Correo);
        setVal('Telefono', p.Telefono);
    },

    async autoLlenarProveedorPorDocumento(prefix) {
        const map = { ret: 'retProv', cp: 'cpProv', lc: 'lcProv' };
        const base = map[prefix];
        const inputDoc = document.getElementById(`${base}Documento`);
        const doc = inputDoc.value.trim();
        if (!doc) return;

        const enCache = this.proveedoresCache.find(p => p.Documento === doc);
        if (enCache) {
            const sel = document.getElementById(`${prefix}ProvSelect`);
            if (sel) sel.value = enCache.ProveedorID;
            this.seleccionarProveedor(prefix, enCache.ProveedorID);
            return;
        }

        marcarBuscando(inputDoc, true);
        try {
            const res = await api.get(`/proveedores/documento/${doc}`);
            if (res.data.success) {
                const el = document.getElementById(`${base}RazonSocial`);
                if (el) el.value = res.data.proveedor.RazonSocial;
                if (res.data.source === 'padron') {
                    window.Toast.fire({ icon: 'success', title: 'DATOS OBTENIDOS DEL PADRÓN NACIONAL' });
                }
            }
        } catch (_) { /* proveedor nuevo — se auto-crea al registrar */ }
        finally {
            marcarBuscando(inputDoc, false);
        }
    },

    // ══════════════════ COMPRAS / GASTOS ══════════════════

    calcularTotalCompra() {
        const base  = parseFloat(document.getElementById('cpBaseImponible').value)  || 0;
        const base0 = parseFloat(document.getElementById('cpBaseImponible0').value) || 0;
        const iva   = parseFloat(document.getElementById('cpIva').value)            || 0;
        const retIva = parseFloat(document.getElementById('cpRetIva')?.value) || 0;
        const retRenta = parseFloat(document.getElementById('cpRetRenta')?.value) || 0;
        const total = base + base0 + iva;
        document.getElementById('cpTotal').textContent = total.toFixed(2);
        const neto = document.getElementById('cpNeto');
        if (neto) neto.textContent = (total - retIva - retRenta).toFixed(2);
    },

    // ══════════════════ DETALLE DE COMPRA (trazabilidad de inventario) ══════════════════
    _lineasCompra: [],
    _seqLinea: 0,
    _r2(n) { return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100; },

    _initDetalleCompra() {
        const q = document.getElementById('cpProdBuscar');
        if (!q || q._omniInit) return;
        q._omniInit = true;
        let t = null;
        q.oninput = () => { clearTimeout(t); t = setTimeout(() => this.buscarProductoCompra(q.value), 250); };
        ['cpRetIva', 'cpRetRenta'].forEach(id => { const e = document.getElementById(id); if (e) e.oninput = () => this.calcularTotalCompra(); });
        api.get(`/sede/${this.getSedeId()}`).then(r => { this._tarifaIva = parseFloat(r.data?.ImpuestoPorcentaje ?? 15); }).catch(() => { this._tarifaIva = 15; });
        this.renderLineasCompra();
    },

    async buscarProductoCompra(txt) {
        const box = document.getElementById('cpProdResult');
        if (!txt || txt.trim().length < 2) { box.style.display = 'none'; return; }
        try {
            const r = await api.get(`/ventas/productos?sedeId=${this.getSedeId()}&q=${encodeURIComponent(txt.trim())}`);
            this._prodsCompra = (r.data.productos || []).filter(p => p.TipoItem !== 'SERVICIO');
            box.style.display = 'block';
            box.innerHTML = this._prodsCompra.length
                ? this._prodsCompra.map((p, i) => `<div onclick="RetencionesModule.agregarLineaCompra(${i})"><span>${p.Nombre}</span><span style="color:#718096">stock ${p.StockActual} · costo $${Number(p.CostoCompra || 0).toFixed(2)}</span></div>`).join('')
                : '<div style="cursor:default;color:#a0aab8">Sin coincidencias (créelo primero en Inventario)</div>';
        } catch (_) { box.style.display = 'none'; }
    },

    agregarLineaCompra(idx) {
        const p = idx === null ? null : (this._prodsCompra || [])[idx];
        this._lineasCompra.push({
            key: ++this._seqLinea,
            ProductoID: p ? p.ProductoID : null,
            Descripcion: p ? p.Nombre : '',
            Cantidad: 1,
            CostoUnitario: p ? Number(p.CostoCompra || 0) : 0,
            AplicaIva: p ? !!Number(p.GravaIVA ?? 1) : true
        });
        const q = document.getElementById('cpProdBuscar'); if (q) q.value = '';
        const box = document.getElementById('cpProdResult'); if (box) box.style.display = 'none';
        this.renderLineasCompra();
    },

    quitarLineaCompra(key) {
        this._lineasCompra = this._lineasCompra.filter(l => l.key !== key);
        this.renderLineasCompra();
    },

    setLineaCompra(key, campo, val) {
        const l = this._lineasCompra.find(x => x.key === key);
        if (!l) return;
        if (campo === 'Descripcion') l.Descripcion = val;
        else if (campo === 'AplicaIva') l.AplicaIva = val === '1';
        else l[campo] = parseFloat(val) || 0;
        const cell = document.getElementById(`cpSub-${key}`);
        if (cell) cell.textContent = this._r2(l.Cantidad * l.CostoUnitario).toFixed(2);
        this._basesDesdeLineas();
    },

    renderLineasCompra() {
        const tb = document.getElementById('cpDetBody');
        if (!tb) return;
        const ls = this._lineasCompra;
        tb.innerHTML = !ls.length
            ? '<tr><td colspan="6" class="cp-vacio">Sin detalle: ingrese las bases a mano (gasto sin inventario).</td></tr>'
            : ls.map(l => `<tr>
                <td>${l.ProductoID
                    ? `<i class="fas fa-box" style="color:#2f7be6" title="Entra al inventario"></i> ${l.Descripcion}`
                    : `<input class="input-neo" placeholder="Descripción del gasto/servicio" value="${(l.Descripcion || '').replace(/"/g, '&quot;')}" onchange="RetencionesModule.setLineaCompra(${l.key},'Descripcion',this.value)">`}</td>
                <td><input type="number" min="${l.ProductoID ? 1 : 0.01}" step="${l.ProductoID ? 1 : 0.01}" class="input-neo" value="${l.Cantidad}" oninput="RetencionesModule.setLineaCompra(${l.key},'Cantidad',this.value)"></td>
                <td><input type="number" min="0" step="0.0001" class="input-neo" value="${l.CostoUnitario}" oninput="RetencionesModule.setLineaCompra(${l.key},'CostoUnitario',this.value)"></td>
                <td><select class="input-neo" onchange="RetencionesModule.setLineaCompra(${l.key},'AplicaIva',this.value)">
                    <option value="1" ${l.AplicaIva ? 'selected' : ''}>${this._tarifaIva ?? 15}%</option>
                    <option value="0" ${l.AplicaIva ? '' : 'selected'}>0%</option></select></td>
                <td class="num" id="cpSub-${l.key}">${this._r2(l.Cantidad * l.CostoUnitario).toFixed(2)}</td>
                <td><button type="button" class="btn-neo btn-danger" style="padding:6px 9px" onclick="RetencionesModule.quitarLineaCompra(${l.key})"><i class="fas fa-xmark"></i></button></td>
            </tr>`).join('');
        this._basesDesdeLineas();
    },

    /** Con detalle, las bases salen de las líneas (bloqueadas) y el IVA se sugiere con la tarifa vigente. */
    _basesDesdeLineas() {
        const conDet = this._lineasCompra.length > 0;
        const b = document.getElementById('cpBaseImponible'), b0 = document.getElementById('cpBaseImponible0'), iv = document.getElementById('cpIva');
        [b, b0].forEach(e => { if (e) e.readOnly = conDet; });
        if (conDet) {
            const base = this._r2(this._lineasCompra.filter(l => l.AplicaIva).reduce((s, l) => s + this._r2(l.Cantidad * l.CostoUnitario), 0));
            const base0 = this._r2(this._lineasCompra.filter(l => !l.AplicaIva).reduce((s, l) => s + this._r2(l.Cantidad * l.CostoUnitario), 0));
            b.value = base.toFixed(2); b0.value = base0.toFixed(2);
            iv.value = this._r2(base * (this._tarifaIva ?? 15) / 100).toFixed(2);
        }
        this.calcularTotalCompra();
    },

    togglePagoCompra() {
        const activo = document.getElementById('cpRegistrarPago').checked;
        document.getElementById('cpPagoCampos').style.display = activo ? 'flex' : 'none';
    },

    _contraOptions() {
        const p = this._planCompra || [];
        if (!p.length) return '<option value="">(plan de cuentas no disponible)</option>';
        const orden = { GASTO: 0, ACTIVO: 1, PASIVO: 2, INGRESO: 3, PATRIMONIO: 4, ORDEN: 5 };
        const tipos = [...new Set(p.map(c => c.Tipo))].sort((a, b) => (orden[a] ?? 9) - (orden[b] ?? 9));
        return `<option value="">${this._contraPlaceholder || '— seleccione la cuenta —'}</option>` + tipos.map(t =>
            `<optgroup label="${t}">` + p.filter(c => c.Tipo === t).map(c => `<option value="${c.CuentaID}">${c.Codigo} · ${c.Nombre}</option>`).join('') + '</optgroup>'
        ).join('');
    },

    async cargarMetodosYRubrosCompra() {
        try {
            const [resMetodos, resRubros, resPlan, resCC, resPR] = await Promise.all([
                api.get('/catalogos/metodos-pago'),
                api.get('/catalogos/rubros'),
                api.get(`/contabilidad/plan?sedeId=${this.getSedeId()}&soloMovimiento=1`),
                api.get(`/contabilidad/centros-costo?sedeId=${this.getSedeId()}`).catch(() => ({ data: {} })),
                api.get(`/contabilidad/proyectos?sedeId=${this.getSedeId()}`).catch(() => ({ data: {} }))
            ]);
            this.metodosPagoCache = resMetodos.data || [];
            this.rubrosEgresoCache = (resRubros.data || []).filter(r => r.Tipo === 'Egreso');
            this._planCompra = (resPlan.data && resPlan.data.cuentas) || [];
            const selContra = document.getElementById('cpContra');
            if (selContra) selContra.innerHTML = this._contraOptions();
            this._initDetalleCompra();

            const centros = (resCC.data && resCC.data.centros) || [];
            const proys = (resPR.data && resPR.data.proyectos) || [];
            this._centrosCache = centros; this._proysCache = proys;
            if (centros.length || proys.length) {
                const w = document.getElementById('cpDimWrap'); if (w) w.style.display = 'grid';
                const sc = document.getElementById('cpCentro');
                if (sc) sc.innerHTML = '<option value="">— ninguno —</option>' + centros.map(c => `<option value="${c.CentroCostoID}">${c.Codigo} · ${c.Nombre}</option>`).join('');
                const sp = document.getElementById('cpProyecto');
                if (sp) sp.innerHTML = '<option value="">— ninguno —</option>' + proys.map(p => `<option value="${p.ProyectoID}">${p.Codigo} · ${p.Nombre}</option>`).join('');
            }

            const selMetodo = document.getElementById('cpMetodoPago');
            if (selMetodo) {
                selMetodo.innerHTML = this.metodosPagoCache.map(m => `<option value="${m.MetodoID}">${m.Nombre}</option>`).join('');
            }
            const selRubro = document.getElementById('cpRubro');
            if (selRubro) {
                selRubro.innerHTML = this.rubrosEgresoCache.map(r => `<option value="${r.RubroID}" ${r.Nombre.includes('Compra de Insumos') ? 'selected' : ''}>${r.Nombre}</option>`).join('');
            }
        } catch (err) {
            console.error('Error cargando métodos/rubros:', err);
        }
    },

    async cargarCompras() {
        const buscar = document.getElementById('cpBuscar')?.value.trim() || '';
        try {
            const res = await api.get(`/compras/${this.getSedeId()}`, { params: { buscar } });
            const body = document.getElementById('cpTablaBody');
            if (!body) return;
            const lista = res.data.compras || [];
            if (!lista.length) {
                body.innerHTML = '<tr><td colspan="7" style="text-align:center; opacity:0.5;">Sin compras registradas.</td></tr>';
                return;
            }
            body.innerHTML = lista.map(c => {
                const anulada = c.EstadoCompra === 'ANULADA';
                const declarable = c.Autorizacion && String(c.Autorizacion).trim();
                const badgeAts = declarable
                    ? '<span class="badge-sri badge-autorizado">DECLARA</span>'
                    : '<span class="badge-sri badge-pendiente" title="Sin número de autorización SRI">S/COMPROB.</span>';
                const pagadaCxP = c.CxPEstado === 'PAGADA';
                const pago = anulada
                    ? '<span class="badge-sri badge-rechazado">ANULADA</span>'
                    : c.MovimientoID
                    ? `<span class="badge-sri badge-autorizado" title="Movimiento #${c.MovimientoID}${c.CajaPagoID ? ' · caja #' + c.CajaPagoID : ' · banco'}">${c.MetodoPagoNombre || 'PAGADO'}</span>`
                    : pagadaCxP
                    ? '<span class="badge-sri badge-autorizado" title="Pagada desde Cuentas por Pagar">PAGADA (CxP)</span>'
                    : `<span class="badge-sri badge-pendiente" title="Saldo CxP $${Number(c.CxPSaldo || 0).toFixed(2)}">PENDIENTE</span>
                       <button class="btn-neo" style="padding:6px 10px; margin-left:5px; color:var(--hotel-success);" title="Registrar pago" onclick="RetencionesModule.marcarCompraPagada(${c.CompraID})"><i class="fas fa-money-check-alt"></i></button>`;
                return `
                <tr style="${anulada ? 'opacity:.55;' : ''}">
                    <td>${c.ProveedorNombre}<br><small style="opacity:0.6;">${c.ProveedorDocumento} · #${c.CompraID}${c.LineasDetalle ? ` · ${c.LineasDetalle} ítem(s)` : ''}</small></td>
                    <td>${c.Establecimiento}-${c.PuntoEmision}-${c.Secuencial}</td>
                    <td>${this.formatFecha ? this.formatFecha(c.FechaEmision) : String(c.FechaEmision).substring(0,10)}</td>
                    <td>$${parseFloat(c.Total).toFixed(2)}${(Number(c.ValorRetencionIva) + Number(c.ValorRetencionRenta)) > 0 ? `<br><small style="opacity:.65">neto $${(c.Total - c.ValorRetencionIva - c.ValorRetencionRenta).toFixed(2)}</small>` : ''}</td>
                    <td>${anulada ? '<span class="badge-sri badge-rechazado" title="' + (c.MotivoAnulacion || '').replace(/"/g, '&quot;') + '">NO DECLARA</span>' : badgeAts}${anulada ? '' : !c.AsientoID ? `<br><button class="btn-neo" style="padding:5px 9px;margin-top:4px;color:#d35400;background:#fff3e0;" title="Falta clasificar la cuenta contable" onclick="RetencionesModule.clasificarCompra(${c.CompraID})"><i class="fas fa-scale-unbalanced"></i> Clasificar</button>` : `<br><button class="btn-neo" style="padding:5px 9px;margin-top:4px;color:#2e7d32;" title="Ver asiento contable" onclick="RetencionesModule.verAsientoCompra(${c.CompraID}, ${c.AsientoID})"><i class="fas fa-book"></i> Ver asiento</button>`}</td>
                    <td>${pago}</td>
                    <td style="white-space:nowrap">
                        <button class="btn-neo" style="padding:8px 11px;" title="Trazabilidad completa" onclick="RetencionesModule.trazabilidadCompra(${c.CompraID})"><i class="fas fa-route"></i></button>
                        ${anulada ? '' : `<button class="btn-neo btn-danger" style="padding:8px 11px;" title="Anular compra (con reverso)" onclick="RetencionesModule.anularCompra(${c.CompraID})"><i class="fas fa-ban"></i></button>`}
                    </td>
                </tr>
            `;
            }).join('');
        } catch (err) {
            console.error('Error cargando compras:', err);
        }
    },

    async clasificarCompra(compraId) {
        if (!this._planCompra || !this._planCompra.length) await this.cargarMetodosYRubrosCompra();
        const centros = this._centrosCache || [];
        const proys = this._proysCache || [];
        const hayDim = centros.length || proys.length;
        const ccOpts = '<option value="">— sin centro de costo —</option>' + centros.map(c => `<option value="${c.CentroCostoID}">${c.Codigo} · ${c.Nombre}</option>`).join('');
        const prOpts = '<option value="">— sin proyecto —</option>' + proys.map(p => `<option value="${p.ProyectoID}">${p.Codigo} · ${p.Nombre}</option>`).join('');
        const r = await Swal.fire({
            title: 'Clasificar compra',
            html: `<div style="text-align:left;font-size:.85rem;color:#718096">¿Qué se compró? Se genera el asiento (DEBE la cuenta que elijas + IVA / HABER retenciones + Proveedores o Caja).</div>
                   <select id="swc" class="swal2-input" style="display:block">${this._contraOptions()}</select>
                   <div style="text-align:left;font-size:.72rem;color:#8b98a8">Si la compra tiene productos en el detalle, esa parte va a Inventario automáticamente; la cuenta elegida toma el resto.</div>
                   ${hayDim ? `<select id="swcc" class="swal2-input" style="display:block">${ccOpts}</select>
                   <select id="swpr" class="swal2-input" style="display:block">${prOpts}</select>` : ''}`,
            showCancelButton: true, confirmButtonText: 'Generar asiento', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const v = document.getElementById('swc').value;
                return { cuenta: v || null, cc: document.getElementById('swcc')?.value || null, pr: document.getElementById('swpr')?.value || null };
            }
        });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/compras/${compraId}/clasificar`, { ContrapartidaCuentaID: r.value.cuenta, CentroCostoID: r.value.cc, ProyectoID: r.value.pr });
            window.Toast.fire({ icon: 'success', title: 'Asiento generado' });
            this.cargarCompras();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo clasificar.', 'error'); }
    },

    async marcarCompraPagada(compraId) {
        if (!this.metodosPagoCache || !this.metodosPagoCache.length) {
            await this.cargarMetodosYRubrosCompra();
        }
        const optsMetodo = this.metodosPagoCache.map(m => `<option value="${m.MetodoID}">${m.Nombre}</option>`).join('');
        const optsRubro = this.rubrosEgresoCache.map(r => `<option value="${r.RubroID}" ${r.Nombre.includes('Compra de Insumos') ? 'selected' : ''}>${r.Nombre}</option>`).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Marcar Compra como Pagada',
            html: `
                <label class="label-hint" style="text-align:left;">¿De dónde salió el dinero?</label>
                <select id="swMetodoPago" class="swal2-select" style="display:block; width:100%; margin-bottom:12px;">${optsMetodo}</select>
                <label class="label-hint" style="text-align:left;">Rubro Contable</label>
                <select id="swRubro" class="swal2-select" style="display:block; width:100%;">${optsRubro}</select>
            `,
            showCancelButton: true,
            confirmButtonText: 'Registrar Pago',
            preConfirm: () => ({
                MetodoPagoID: parseInt(document.getElementById('swMetodoPago').value),
                RubroID: parseInt(document.getElementById('swRubro').value)
            })
        });
        if (!formValues) return;

        try {
            const rp = await api.post(`/compras/${compraId}/marcar-pagada`, formValues);
            window.Toast.fire({ icon: 'success', title: `Pago registrado · $${Number(rp.data.monto || 0).toFixed(2)}`, text: rp.data.asientoError ? 'Atención: ' + rp.data.asientoError : '' });
            this.cargarCompras();
        } catch (err) {
            Swal.fire('No se registró el pago', err.response?.data?.error || 'No se pudo registrar el pago.', 'error');
        }
    },

    async registrarCompra() {
        const documento = document.getElementById('cpProvDocumento').value.trim();
        const razonSocial = document.getElementById('cpProvRazonSocial').value.trim();
        const numeroComprobante = document.getElementById('cpNumeroComprobante').value.trim();
        const fechaEmision = document.getElementById('cpFechaEmision').value;

        if (!documento || !razonSocial) return Swal.fire('Faltan datos', 'Documento y Razón Social del proveedor son obligatorios.', 'warning');
        if (!numeroComprobante || !fechaEmision) return Swal.fire('Faltan datos', 'Complete el número de comprobante y la fecha de emisión.', 'warning');

        const registrarPago = document.getElementById('cpRegistrarPago').checked;
        if (registrarPago && !document.getElementById('cpMetodoPago').value) {
            return Swal.fire('Falta el método de pago', 'Indique de dónde salió el dinero (efectivo, banco, etc.) o desmarque "¿Ya se pagó?".', 'warning');
        }

        const user = JSON.parse(localStorage.getItem('user'));
        const payload = {
            SedeID: this.getSedeId(),
            UsuarioID: user ? user.UsuarioID : 1,
            Proveedor: {
                Documento: documento,
                TipoIdentificacion: documento.length === 13 ? '04' : '05',
                RazonSocial: razonSocial
            },
            TipoComprobante: document.getElementById('cpTipoComprobante').value,
            NumeroComprobante: numeroComprobante,
            Autorizacion: document.getElementById('cpAutorizacion').value.trim() || null,
            FechaEmision: fechaEmision,
            BaseImponible: parseFloat(document.getElementById('cpBaseImponible').value) || 0,
            BaseImponible0: parseFloat(document.getElementById('cpBaseImponible0').value) || 0,
            IVA: parseFloat(document.getElementById('cpIva').value) || 0,
            ValorRetencionIva: parseFloat(document.getElementById('cpRetIva').value) || 0,
            ValorRetencionRenta: parseFloat(document.getElementById('cpRetRenta').value) || 0,
            FormaPago: document.getElementById('cpFormaPago').value,
            SustentoTributario: document.getElementById('cpSustento').value,
            RegistrarPago: registrarPago,
            MetodoPagoID: registrarPago ? parseInt(document.getElementById('cpMetodoPago').value) : null,
            RubroID: registrarPago ? parseInt(document.getElementById('cpRubro').value) : null,
            ContrapartidaCuentaID: document.getElementById('cpContra')?.value || null,
            CentroCostoID: document.getElementById('cpCentro')?.value || null,
            ProyectoID: document.getElementById('cpProyecto')?.value || null,
            DiasCredito: 30
        };

        try {
            const r = await api.post('/compras', payload);
            if (r.data.asientoError) {
                Swal.fire('Compra registrada sin asiento', `La compra #${r.data.compraId} quedó registrada pero el asiento no se generó: ${r.data.asientoError}. Use "Clasificar" cuando lo corrija.`, 'warning');
            } else {
                window.Toast.fire({ icon: 'success', title: `Compra #${r.data.compraId} registrada y contabilizada`, text: `Neto $${Number(r.data.neto).toFixed(2)}` });
            }
            this._lineasCompra = [];
            this.renderLineasCompra();
            const sc = document.getElementById('cpContra'); if (sc) sc.value = '';
            ['cpProvSelect','cpProvDocumento','cpProvRazonSocial','cpNumeroComprobante','cpAutorizacion','cpFechaEmision','cpBaseImponible','cpBaseImponible0','cpIva','cpRetIva','cpRetRenta']
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            document.getElementById('cpTotal').textContent = '0.00';
            this.cargarCompras();
            this.cargarProveedoresCache();
        } catch (err) {
            Swal.fire('No se registró la compra', err.response?.data?.error || 'No se pudo registrar la compra.', 'error');
        }
    },

    /** Las compras no se borran: se anulan con motivo y reverso de inventario, caja, CxP y asientos. */
    async anularCompra(id) {
        const r = await Swal.fire({
            title: `¿Anular la compra #${id}?`,
            html: '<div style="text-align:left;font-size:.82rem;color:#5a6b7d">Se revierte todo lo que generó: <b>stock</b> de los productos, <b>dinero</b> pagado (reingreso por el mismo medio; en efectivo a su caja abierta), <b>cuenta por pagar</b> y <b>asientos</b>. La compra queda visible como ANULADA, con su motivo.</div>',
            input: 'text', inputPlaceholder: 'Motivo de la anulación (obligatorio)',
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular compra', cancelButtonText: 'Cancelar',
            inputValidator: v => (!v || v.trim().length < 5) ? 'Indique el motivo (mínimo 5 caracteres)' : undefined
        });
        if (!r.isConfirmed) return;
        try {
            const res = await api.post(`/compras/${id}/anular`, { motivo: r.value.trim() });
            Swal.fire({ icon: 'success', title: 'Compra anulada', html: `<div style="text-align:left;font-size:.82rem">${(res.data.reversos || []).map(x => '• ' + x).join('<br>') || 'Sin movimientos que revertir.'}</div>` });
            this.cargarCompras();
        } catch (err) {
            Swal.fire('No se anuló', err.response?.data?.error || 'No se pudo anular.', 'error');
        }
    },

    // Compatibilidad con llamadas antiguas
    eliminarCompra(id) { return this.anularCompra(id); },

    /** Traza completa de una compra: detalle, kardex, pagos/caja, CxP, asientos y retenciones. */
    async trazabilidadCompra(id) {
        try {
            const { data: d } = await api.get(`/compras/detalle/${id}`);
            const c = d.compra;
            const f = n => '$' + Number(n || 0).toFixed(2);
            const fh = x => x ? String(x).replace('T', ' ').slice(0, 16) : '';
            const tabla = (cols, rows) => rows.length
                ? `<table><thead><tr>${cols.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`
                : '<div style="font-size:.75rem;color:#a0aab8;text-align:left">— ninguno —</div>';
            const html = `<div class="cp-traza">
                <div class="kv">
                    <div><b>Proveedor</b>${c.ProveedorNombre}<br><small>${c.ProveedorDocumento}</small></div>
                    <div><b>Comprobante</b>${c.TipoComprobante} · ${c.Establecimiento}-${c.PuntoEmision}-${c.Secuencial}<br><small>${c.Autorizacion ? 'Aut. ' + c.Autorizacion : 'Sin autorización SRI (no va al ATS)'}</small></div>
                    <div><b>Estado</b>${c.EstadoCompra}${c.EstadoCompra === 'ANULADA' ? `<br><small>${fh(c.FechaAnulacion)} · ${c.NombreUsuarioAnula || ''} — ${c.MotivoAnulacion || ''}</small>` : ''}</div>
                    <div><b>Fecha emisión</b>${String(c.FechaEmision).slice(0, 10)}</div>
                    <div><b>Registrada</b>${fh(c.FechaRegistro)} · ${c.NombreUsuario || c.UsuarioRegistro || ''}</div>
                    <div><b>Sustento / forma pago</b>${c.SustentoTributario} / ${c.FormaPago}</div>
                    <div><b>Base IVA / Base 0%</b>${f(c.BaseImponible)} / ${f(c.BaseImponible0)}</div>
                    <div><b>IVA / Total</b>${f(c.IVA)} / ${f(c.Total)}</div>
                    <div><b>Retenciones → Neto</b>${f(Number(c.ValorRetencionIva) + Number(c.ValorRetencionRenta))} → <b style="display:inline;color:#1a365d;font-size:.78rem">${f(d.neto)}</b></div>
                </div>
                <h5>Detalle</h5>${tabla(['Ítem', 'Cant.', 'Costo u.', 'IVA', 'Subtotal'], d.lineas.map(l => [(l.ProductoID ? '📦 ' : '') + (l.ProductoNombre || l.Descripcion), Number(l.Cantidad), f(l.CostoUnitario), l.AplicaIva ? 'Sí' : '0%', f(l.Subtotal)]))}
                <h5>Kardex (inventario)</h5>${tabla(['Fecha', 'Producto', 'Movimiento', 'Cant.', 'Costo u.', 'Saldo'], d.kardex.map(k => [fh(k.FechaMovimiento), k.Producto, k.Origen === 'ANULA_COMPRA' ? 'SALIDA (anulación)' : 'ENTRADA', k.Cantidad, f(k.CostoUnitario), k.StockResultante]))}
                <h5>Dinero (caja / banco)</h5>${tabla(['Mov.', 'Fecha', 'Tipo', 'Medio', 'Caja', 'Monto', 'Detalle'], d.movimientosCaja.map(m => ['#' + m.MovimientoID, fh(m.FechaMovimiento), m.TipoMovimiento, m.Metodo || '', m.CajaID ? '#' + m.CajaID : 'Banco/Admin', f(m.Monto), m.Observacion]))}
                <h5>Cuenta por pagar</h5>${d.cxp ? tabla(['CxP', 'Original', 'Saldo', 'Estado', 'Vence'], [['#' + d.cxp.CxPID, f(d.cxp.MontoOriginal), f(d.cxp.Saldo), d.cxp.Estado, String(d.cxp.FechaVencimiento).slice(0, 10)]]) + tabla(['Pago', 'Fecha', 'Monto', 'Medio', 'Mov. caja', 'Asiento'], d.pagos.map(p => ['#' + p.PagoID, String(p.Fecha).slice(0, 10), f(p.Monto), p.MetodoPago || '', p.CajaMovimientoID ? '#' + p.CajaMovimientoID : '', p.AsientoID ? '#' + p.AsientoID : ''])) : '<div style="font-size:.75rem;color:#a0aab8;text-align:left">Compra de contado (sin CxP)</div>'}
                <h5>Asientos contables</h5>${tabla(['Asiento', 'Fecha', 'Origen', 'Glosa', 'Debe', 'Haber', 'Estado'], d.asientos.map(a => ['N.º ' + a.Numero, String(a.Fecha).slice(0, 10), a.Origen, a.Glosa, f(a.TotalDebe), f(a.TotalHaber), a.Estado]))}
                <h5>Retenciones emitidas</h5>${tabla(['Secuencial', 'Fecha', 'Retenido', 'SRI'], d.retenciones.map(r => ['001-001-' + r.Secuencial, String(r.FechaEmision).slice(0, 10), f(r.TotalRetenido), r.EstadoSRI]))}
            </div>`;
            Swal.fire({ title: `Trazabilidad · Compra #${c.CompraID}`, html, width: 980, confirmButtonText: 'Cerrar' });
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo cargar la trazabilidad.', 'error');
        }
    },

    // ══════════════════ PROVEEDORES ══════════════════

    async buscarProveedores() {
        const buscar = document.getElementById('pvBuscar')?.value.trim() || '';
        try {
            const res = await api.get('/proveedores', { params: { buscar } });
            const body = document.getElementById('pvTablaBody');
            const lista = res.data.proveedores || [];
            if (!lista.length) {
                body.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.5;">Sin proveedores registrados.</td></tr>';
                return;
            }
            body.innerHTML = lista.map(p => `
                <tr>
                    <td>${p.Documento}</td>
                    <td>${p.RazonSocial}</td>
                    <td>${p.Correo || p.Telefono || '--'}</td>
                    <td>
                        <button class="btn-neo" style="padding:8px 12px; color:var(--hotel-blue);" title="Descargar todos sus comprobantes" onclick="RetencionesModule.descargarTodoProveedor(${p.ProveedorID})"><i class="fas fa-file-archive"></i></button>
                        <button class="btn-neo btn-danger" style="padding:8px 12px;" onclick="RetencionesModule.eliminarProveedor(${p.ProveedorID})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Error buscando proveedores:', err);
        }
    },

    async descargarTodoProveedor(proveedorId) {
        try {
            Swal.fire({ title: 'Empaquetando comprobantes...', text: 'Generando XML y PDF de cada documento.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await api.get(`/proveedores/${proveedorId}/descargar-todo`);
            Swal.close();
            if (res.data.success) {
                const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
                window.open(`${base}${res.data.zipUrl}`, '_blank');
            }
        } catch (err) {
            Swal.close();
            Swal.fire('Sin comprobantes', err.response?.data?.error || 'No se pudo generar la descarga.', 'info');
        }
    },

    async crearProveedor() {
        const Documento = document.getElementById('pvDocumento').value.trim();
        const RazonSocial = document.getElementById('pvRazonSocial').value.trim();
        if (!Documento || !RazonSocial) return Swal.fire('Faltan datos', 'Documento y Razón Social son obligatorios.', 'warning');

        try {
            await api.post('/proveedores', {
                Documento, RazonSocial,
                Correo: document.getElementById('pvCorreo').value.trim() || null,
                Telefono: document.getElementById('pvTelefono').value.trim() || null,
                Direccion: document.getElementById('pvDireccion').value.trim() || null
            });
            window.Toast.fire({ icon: 'success', title: 'Proveedor registrado' });
            ['pvDocumento','pvRazonSocial','pvCorreo','pvTelefono','pvDireccion'].forEach(id => document.getElementById(id).value = '');
            this.buscarProveedores();
            this.cargarProveedoresCache();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo crear el proveedor.', 'error');
        }
    },

    async eliminarProveedor(id) {
        const confirm = await Swal.fire({ title: '¿Desactivar proveedor?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, desactivar' });
        if (!confirm.isConfirmed) return;
        try {
            await api.delete(`/proveedores/${id}`);
            this.buscarProveedores();
            this.cargarProveedoresCache();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo desactivar.', 'error');
        }
    },

    // ══════════════════ CÓDIGOS DE RETENCIÓN ══════════════════

    async crearCodigo() {
        const Tipo = document.getElementById('crTipo').value;
        const Codigo = document.getElementById('crCodigo').value.trim();
        const Descripcion = document.getElementById('crDescripcion').value.trim();
        const PorcentajeDefault = parseFloat(document.getElementById('crPorcentaje').value);
        if (!Codigo || !Descripcion || isNaN(PorcentajeDefault)) return Swal.fire('Faltan datos', 'Complete código, descripción y porcentaje.', 'warning');

        try {
            await api.post('/codigosretencion', { Tipo, Codigo, Descripcion, PorcentajeDefault });
            window.Toast.fire({ icon: 'success', title: 'Código agregado' });
            ['crCodigo','crDescripcion','crPorcentaje'].forEach(id => document.getElementById(id).value = '');
            this.cargarCodigos();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo agregar el código.', 'error');
        }
    },

    async eliminarCodigo(id) {
        const confirm = await Swal.fire({ title: '¿Eliminar código?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar' });
        if (!confirm.isConfirmed) return;
        try {
            await api.delete(`/codigosretencion/${id}`);
            this.cargarCodigos();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo eliminar.', 'error');
        }
    },

    // ══════════════════ LIQUIDACIÓN DE COMPRA (SRI '03') ══════════════════

    agregarItemLiquidacion() {
        const desc = document.getElementById('lcDetDesc').value.trim();
        const cant = parseFloat(document.getElementById('lcDetCant').value);
        const precio = parseFloat(document.getElementById('lcDetPrecio').value);
        if (!desc) return Swal.fire('Falta la descripción', 'Ingrese qué se compró.', 'warning');
        if (!cant || cant <= 0) return Swal.fire('Cantidad inválida', 'La cantidad debe ser mayor a 0.', 'warning');
        if (!precio || precio <= 0) return Swal.fire('Precio inválido', 'El precio unitario debe ser mayor a 0.', 'warning');

        this.itemsLiquidacion.push({ Descripcion: desc, Cantidad: cant, PrecioUnitario: precio });

        document.getElementById('lcDetDesc').value = '';
        document.getElementById('lcDetCant').value = '1';
        document.getElementById('lcDetPrecio').value = '';
        this.renderItemsLiquidacion();
    },

    quitarItemLiquidacion(index) {
        this.itemsLiquidacion.splice(index, 1);
        this.renderItemsLiquidacion();
    },

    renderItemsLiquidacion() {
        const body = document.getElementById('lcTablaItemsBody');
        if (!this.itemsLiquidacion.length) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.5;">Sin ítems agregados</td></tr>';
        } else {
            body.innerHTML = this.itemsLiquidacion.map((it, i) => `
                <tr>
                    <td>${it.Descripcion}</td>
                    <td>${it.Cantidad}</td>
                    <td>$${it.PrecioUnitario.toFixed(2)}</td>
                    <td>$${(it.Cantidad * it.PrecioUnitario).toFixed(2)}</td>
                    <td><button class="btn-neo btn-danger" style="padding:8px 12px;" onclick="RetencionesModule.quitarItemLiquidacion(${i})"><i class="fas fa-trash"></i></button></td>
                </tr>
            `).join('');
        }
        const total = this.itemsLiquidacion.reduce((acc, it) => acc + it.Cantidad * it.PrecioUnitario, 0);
        document.getElementById('lcTotalGeneral').textContent = total.toFixed(2);
    },

    async emitirLiquidacion() {
        const documento = document.getElementById('lcProvDocumento').value.trim();
        const razonSocial = document.getElementById('lcProvRazonSocial').value.trim();
        if (!documento || !razonSocial) return Swal.fire('Faltan datos', 'Documento y Razón Social del proveedor son obligatorios.', 'warning');
        if (!this.itemsLiquidacion.length) return Swal.fire('Sin ítems', 'Agregue al menos un ítem comprado.', 'warning');

        const user = JSON.parse(localStorage.getItem('user'));
        const payload = {
            SedeID: this.getSedeId(),
            UsuarioID: user ? user.UsuarioID : 1,
            Proveedor: {
                Documento: documento,
                TipoIdentificacion: documento.length === 13 ? '04' : '05',
                RazonSocial: razonSocial
            },
            Detalles: this.itemsLiquidacion.map(it => ({ Descripcion: it.Descripcion, Cantidad: it.Cantidad, PrecioUnitario: it.PrecioUnitario })),
            FormaPago: document.getElementById('lcFormaPago').value
        };

        try {
            Swal.fire({ title: 'Emitiendo Liquidación de Compra...', text: 'Firmando XML e interactuando con SRI...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await api.post('/liquidacionescompra/emitir', payload);
            if (res.data.success) {
                await Swal.fire({ title: '¡LIQUIDACIÓN EMITIDA!', text: `SRI: ${res.data.estadoSRI} | Acceso: ${res.data.claveAcceso}`, icon: 'success', confirmButtonColor: 'var(--hotel-blue)' });
                this.itemsLiquidacion = [];
                this.renderItemsLiquidacion();
                ['lcProvSelect','lcProvDocumento','lcProvRazonSocial'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                await this.cargarHistorialLiquidacion();
                await this.cargarProveedoresCache();
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'No se pudo emitir', text: err.response?.data?.error || 'Error desconocido' });
        }
    },

    async cargarHistorialLiquidacion() {
        try {
            const res = await api.get(`/liquidacionescompra/historial/${this.getSedeId()}`);
            this.historialLiquidacionCache = res.data || [];
            this.renderHistorialLiquidacion();
        } catch (err) {
            console.error('Error cargando historial de liquidaciones de compra:', err);
        }
    },

    renderHistorialLiquidacion() {
        const body = document.getElementById('lcTablaHistorialBody');
        if (!body) return;
        const buscar = (document.getElementById('lcHistorialBuscar')?.value || '').trim().toLowerCase();
        const base = this.historialLiquidacionCache || [];
        const lista = buscar
            ? base.filter(l => (l.ProveedorNombre || '').toLowerCase().includes(buscar) || (l.ProveedorDocumento || '').toLowerCase().includes(buscar) || (l.Secuencial || '').toLowerCase().includes(buscar))
            : base;

        if (!lista.length) {
            body.innerHTML = `<tr><td colspan="5" style="text-align:center; opacity:0.5;">${buscar ? `Sin resultados para "${buscar}".` : 'Sin liquidaciones emitidas.'}</td></tr>`;
            return;
        }
        body.innerHTML = lista.map(l => {
            const badgeClass = l.EstadoSRI === 'AUTORIZADO' ? 'badge-autorizado'
                : l.EstadoSRI === 'FIRMADO' ? 'badge-firmado'
                : l.EstadoSRI === 'RECHAZADO' ? 'badge-rechazado' : 'badge-pendiente';
            return `
                <tr>
                    <td>${l.Secuencial}</td>
                    <td>${l.ProveedorNombre}<br><small style="opacity:0.6;">${l.ProveedorDocumento || ''}</small></td>
                    <td>$${parseFloat(l.Total).toFixed(2)}</td>
                    <td><span class="badge-sri ${badgeClass}">${l.EstadoSRI || 'PENDIENTE'}</span></td>
                    <td>
                        <button class="btn-neo" style="padding:8px 12px;" title="Ver RIDE" onclick="RetencionesModule.verRIDELiquidacion(${l.LiquidacionCompraID})"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-neo" style="padding:8px 12px;" title="Ver XML" onclick="RetencionesModule.verXMLLiquidacion(${l.LiquidacionCompraID})"><i class="fas fa-code"></i></button>
                        <button class="btn-neo" style="padding:8px 12px;" title="Enviar correo" onclick="RetencionesModule.enviarCorreoLiquidacion(${l.LiquidacionCompraID})"><i class="fas fa-envelope"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async verRIDELiquidacion(liquidacionId) {
        try {
            const res = await api.get(`/liquidacionescompra/documento/ride/${liquidacionId}`);
            if (res.data.success) {
                const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
                window.open(`${base}${res.data.pdfUrl}`, '_blank');
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo generar el RIDE.', 'error');
        }
    },

    async verXMLLiquidacion(liquidacionId) {
        try {
            const res = await api.get(`/liquidacionescompra/documento/xml/${liquidacionId}`);
            if (res.data.success) {
                Swal.fire({
                    icon: 'info', title: 'XML de la Liquidación de Compra', width: 700,
                    html: `<textarea readonly style="width:100%; height:340px; font-family:Consolas,monospace; font-size:10.5px; background:#f1f3f5; border-radius:8px; padding:10px; border:1px solid #ccc;">${res.data.xml.replace(/</g, '&lt;')}</textarea>`
                });
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo obtener el XML.', 'error');
        }
    },

    async enviarCorreoLiquidacion(liquidacionId) {
        const { value: correo } = await Swal.fire({
            title: 'Enviar Liquidación de Compra',
            input: 'email',
            inputPlaceholder: 'correo@ejemplo.com',
            showCancelButton: true,
            confirmButtonText: 'Enviar'
        });
        if (!correo) return;
        try {
            Swal.fire({ title: 'Enviando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await api.post('/liquidacionescompra/documento/enviar-correo', { liquidacionId, correoDestino: correo });
            await Swal.fire('Enviado', 'El correo fue enviado correctamente.', 'success');
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'No se pudo enviar el correo.', 'error');
        }
    }
};

module.exports = RetencionesModule;
