const api = require('./api');

const LibrodiarioModule = {
    cuentasMov: [],
    _detId: null,

    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    esAdmin() { return App.puede('librodiario', 'EDITAR'); },
    hoy() { return new Date().toISOString().slice(0, 10); },
    primeroMes() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); },
    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

    async init() {
        window.LibrodiarioModule = this;
        window.backView = 'dashboard';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = this.esAdmin() ? '' : 'none');
        document.getElementById('ld-desde').value = this.primeroMes();
        document.getElementById('ld-hasta').value = this.hoy();
        document.getElementById('ld-det-anular').onclick = () => this.anular();
        try {
            const res = await api.get(`/contabilidad/plan?sedeId=${this.getSede()}&soloMovimiento=1`);
            this.cuentasMov = res.data.cuentas || [];
        } catch (_) { this.cuentasMov = []; }
        try {
            const [cc, pr] = await Promise.all([
                api.get(`/contabilidad/centros-costo?sedeId=${this.getSede()}`),
                api.get(`/contabilidad/proyectos?sedeId=${this.getSede()}`)
            ]);
            this.centros   = cc.data.centros   || [];
            this.proyectos = pr.data.proyectos || [];
        } catch (_) { this.centros = []; this.proyectos = []; }
        await this.cargar();
    },

    async cargar() {
        const desde = document.getElementById('ld-desde').value;
        const hasta = document.getElementById('ld-hasta').value;
        const origen = document.getElementById('ld-origen').value;
        const cont = document.getElementById('ld-list');
        cont.innerHTML = '<div class="omni-empty"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
        try {
            const res = await api.get(`/contabilidad/libro-diario?sedeId=${this.getSede()}&desde=${desde}&hasta=${hasta}`);
            let asientos = res.data.asientos || [];
            if (origen) asientos = asientos.filter(a => a.Origen === origen);
            document.getElementById('ld-tot').textContent =
                `${asientos.length} asientos · Debe ${this.fmt(res.data.totales.totalDebe)} · Haber ${this.fmt(res.data.totales.totalHaber)}`;
            if (!asientos.length) { cont.innerHTML = '<div class="omni-empty">Sin asientos en el rango.</div>'; return; }
            cont.innerHTML = asientos.map(a => this.cardHtml(a)).join('');
        } catch (e) {
            cont.innerHTML = `<div class="omni-empty">Error: ${e.response?.data?.error || e.message}</div>`;
        }
    },

    cardHtml(a) {
        const f = (a.Fecha || '').slice(0, 10);
        const lineas = (a.lineas || []).map(l => `
            <tr>
                <td class="c">${l.Codigo}</td>
                <td>${l.CuentaNombre}${l.Glosa ? `<br><span class="as-mini">${l.Glosa}</span>` : ''}</td>
                <td class="num">${Number(l.Debe) ? this.fmt(l.Debe) : ''}</td>
                <td class="num">${Number(l.Haber) ? this.fmt(l.Haber) : ''}</td>
            </tr>`).join('');
        return `<div class="as-card">
            <div class="as-card-h" onclick="LibrodiarioModule.verDetalle(${a.AsientoID})">
                <div><b>Asiento #${a.Numero}</b> &nbsp;<span class="as-mini">${f} · <span class="badge b-org">${a.Origen}</span> ${a.Referencia ? '· ' + a.Referencia : ''}</span>
                    <div class="as-mini">${a.Glosa}</div>
                </div>
                <div class="num"><b>${this.fmt(a.TotalDebe)}</b></div>
            </div>
            <div class="as-lines"><table>${lineas}</table></div>
        </div>`;
    },

    async verDetalle(id) {
        this._detId = id;
        try {
            const res = await api.get(`/contabilidad/asientos/${id}`);
            const a = res.data.asiento, det = res.data.detalle || [];
            document.getElementById('ld-det-title').textContent = `Asiento #${a.Numero} · ${(a.Fecha || '').slice(0, 10)}`;
            document.getElementById('ld-det-body').innerHTML = `
                <p class="as-mini"><b>Glosa:</b> ${a.Glosa}</p>
                <p class="as-mini"><b>Origen:</b> ${a.Origen} ${a.Referencia ? '· Ref: ' + a.Referencia : ''} · <b>Estado:</b> ${a.Estado} · Por: ${a.NombreUsuario || '—'}</p>
                <table class="omni-table" style="margin-top:10px">
                    <thead><tr><th>Cuenta</th><th class="num">Debe</th><th class="num">Haber</th></tr></thead>
                    <tbody>${det.map(l => `<tr><td><span class="c">${l.Codigo}</span> ${l.CuentaNombre}${l.Glosa ? `<br><span class="as-mini">${l.Glosa}</span>` : ''}</td><td class="num">${Number(l.Debe) ? this.fmt(l.Debe) : ''}</td><td class="num">${Number(l.Haber) ? this.fmt(l.Haber) : ''}</td></tr>`).join('')}</tbody>
                    <tfoot><tr><td style="text-align:right;font-weight:900">TOTALES</td><td class="num" style="font-weight:900">${this.fmt(a.TotalDebe)}</td><td class="num" style="font-weight:900">${this.fmt(a.TotalHaber)}</td></tr></tfoot>
                </table>`;
            document.getElementById('ld-det-anular').style.display = (App.puede('librodiario', 'TOTAL') && a.Estado !== 'ANULADO') ? '' : 'none';
            document.getElementById('ld-det-modal').style.display = 'flex';
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },
    cerrarDet() { document.getElementById('ld-det-modal').style.display = 'none'; },

    async anular() {
        const r = await Swal.fire({
            title: '¿Anular asiento?', input: 'text', inputPlaceholder: 'Motivo (opcional)',
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'Cancelar'
        });
        if (!r.isConfirmed) return;
        try {
            await api.post(`/contabilidad/asientos/${this._detId}/anular`, { motivo: r.value || '' });
            window.Toast.fire({ icon: 'success', title: 'Asiento anulado' });
            this.cerrarDet(); await this.cargar();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    },

    /* ---------- Nuevo asiento ---------- */
    _optsCuentas() {
        return '<option value="">— cuenta —</option>' +
            this.cuentasMov.map(c => `<option value="${c.CuentaID}">${c.Codigo} · ${c.Nombre}</option>`).join('');
    },
    abrirAsiento() {
        if (!this.cuentasMov.length) { window.Toast.fire({ icon: 'warning', title: 'No hay cuentas de movimiento en el plan' }); return; }
        document.getElementById('as-fecha').value = this.hoy();
        document.getElementById('as-tipo').value = 'MANUAL';
        document.getElementById('as-ref').value = '';
        document.getElementById('as-glosa').value = '';
        const selCC = document.getElementById('as-centro');
        if (selCC) selCC.innerHTML = '<option value="">— ninguno —</option>' +
            (this.centros || []).map(c => `<option value="${c.CentroCostoID}">${c.Codigo} · ${c.Nombre}</option>`).join('');
        const selPR = document.getElementById('as-proyecto');
        if (selPR) selPR.innerHTML = '<option value="">— ninguno —</option>' +
            (this.proyectos || []).map(p => `<option value="${p.ProyectoID}">${p.Codigo} · ${p.Nombre}</option>`).join('');
        document.getElementById('as-lineas').innerHTML = '';
        this.addLinea(); this.addLinea();
        this.recalc();
        document.getElementById('ld-modal').style.display = 'flex';
    },
    cerrarAsiento() { document.getElementById('ld-modal').style.display = 'none'; },
    addLinea() {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><select class="omni-input as-c">${this._optsCuentas()}</select></td>
            <td><input type="number" step="0.01" min="0" class="omni-input as-d num" value="0"></td>
            <td><input type="number" step="0.01" min="0" class="omni-input as-h num" value="0"></td>
            <td><button class="omni-btn omni-btn-danger" style="padding:6px 9px" onclick="this.closest('tr').remove();LibrodiarioModule.recalc()"><i class="fas fa-xmark"></i></button></td>`;
        document.getElementById('as-lineas').appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.oninput = () => this.recalc());
    },
    recalc() {
        let td = 0, th = 0;
        document.querySelectorAll('#as-lineas tr').forEach(tr => {
            td += parseFloat(tr.querySelector('.as-d').value) || 0;
            th += parseFloat(tr.querySelector('.as-h').value) || 0;
        });
        document.getElementById('as-td').textContent = this.fmt(td);
        document.getElementById('as-th').textContent = this.fmt(th);
        const cuadra = Math.abs(td - th) < 0.005 && td > 0;
        const badge = document.getElementById('as-cuadre');
        badge.className = 'badge ' + (cuadra ? 'b-on' : 'b-off');
        badge.textContent = cuadra ? 'Cuadrado' : `Descuadre ${this.fmt(td - th)}`;
        document.getElementById('as-guardar').disabled = !cuadra;
    },
    async guardarAsiento() {
        const Lineas = [];
        document.querySelectorAll('#as-lineas tr').forEach(tr => {
            const cid = tr.querySelector('.as-c').value;
            const d = parseFloat(tr.querySelector('.as-d').value) || 0;
            const h = parseFloat(tr.querySelector('.as-h').value) || 0;
            if (cid && (d > 0 || h > 0)) Lineas.push({ CuentaID: parseInt(cid), Debe: d, Haber: h });
        });
        const glosa = document.getElementById('as-glosa').value.trim();
        if (!glosa) { window.Toast.fire({ icon: 'warning', title: 'Ingresa la glosa' }); return; }
        if (Lineas.length < 2) { window.Toast.fire({ icon: 'warning', title: 'Se requieren al menos 2 líneas con cuenta e importe' }); return; }
        try {
            await api.post('/contabilidad/asientos', {
                SedeID: this.getSede(),
                Fecha: document.getElementById('as-fecha').value,
                TipoDocumento: document.getElementById('as-tipo').value,
                Referencia: document.getElementById('as-ref').value.trim(),
                CentroCostoID: document.getElementById('as-centro')?.value || null,
                ProyectoID: document.getElementById('as-proyecto')?.value || null,
                Glosa: glosa, Lineas
            });
            window.Toast.fire({ icon: 'success', title: 'Asiento registrado' });
            this.cerrarAsiento(); await this.cargar();
        } catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error al registrar' }); }
    }
};

module.exports = LibrodiarioModule;
