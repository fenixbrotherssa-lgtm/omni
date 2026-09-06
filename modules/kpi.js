const api = require('./api');

const KpiModule = {
    _last: null,

    async init() {
        window.KpiModule = this;
        window.backView = 'dashboard';
        const d = new Date();
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
        document.getElementById('fechaInicioKPI').value = `${y}-${m}-01`;
        document.getElementById('fechaFinKPI').value = `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
        if (App.renderSedeSelector) App.renderSedeSelector('sedeSelectorKPI', () => this.cargarMetricas());
        setTimeout(() => this.cargarMetricas(), 120);
    },

    getSedeId() {
        return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1;
    },
    rango() {
        return {
            sedeId: this.getSedeId(),
            fechaInicio: document.getElementById('fechaInicioKPI').value,
            fechaFin: document.getElementById('fechaFinKPI').value
        };
    },
    money(n) { return '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

    async cargarMetricas() {
        const cards = document.getElementById('kpi-cards');
        cards.innerHTML = '<div class="omni-empty" style="grid-column:1/-1">Cargando...</div>';
        try {
            const res = await api.post('/kpi/dashboard', this.rango());
            this._last = res.data;
            this.render(res.data);
        } catch (e) {
            cards.innerHTML = `<div class="omni-empty" style="grid-column:1/-1">Error: ${e.response?.data?.error || e.message}</div>`;
        }
    },

    render(d) {
        const r = d.resumen;
        const varTxt = r.variacionPct == null ? ''
            : `<small class="${r.variacionPct >= 0 ? 'kpi-up' : 'kpi-down'}">${r.variacionPct >= 0 ? '▲' : '▼'} ${Math.abs(r.variacionPct)}% vs previo</small>`;
        document.getElementById('kpi-cards').innerHTML = `
            <div class="kpi-card"><span>Ventas netas</span><b>${this.money(r.ventasNetas)}</b>${varTxt}</div>
            <div class="kpi-card"><span>Transacciones</span><b>${r.transacciones}</b><small>${r.clientesUnicos} clientes</small></div>
            <div class="kpi-card"><span>Ticket promedio</span><b>${this.money(r.ticketPromedio)}</b></div>
            <div class="kpi-card"><span>Margen bruto</span><b>${this.money(r.margenBruto)}</b><small>${r.margenPct}% · costo ${this.money(r.costoVentas)}</small></div>
            <div class="kpi-card"><span>IVA generado</span><b>${this.money(r.ivaGenerado)}</b><small>base ${this.money(r.baseImponible)}</small></div>
            <div class="kpi-card"><span>MRR recurrente</span><b>${this.money(d.recurrente.mrr)}</b><small>${d.recurrente.activas} suscripciones</small></div>`;

        // Curva de ingresos
        const curva = d.curvaIngresos || [];
        const max = Math.max(1, ...curva.map(c => Number(c.Total)));
        document.getElementById('kpi-curva').innerHTML = curva.length
            ? curva.map(c => `<div class="kpi-bar" style="height:${Math.max(3, (Number(c.Total) / max) * 100)}%" title="${c.Fecha}: ${this.money(c.Total)}"><span>${c.Fecha.slice(5)}</span></div>`).join('')
            : '<div class="omni-empty">Sin ventas en el rango.</div>';

        document.getElementById('kpi-recurrente').innerHTML = `
            <div><span>Suscripciones activas</span><b>${d.recurrente.activas}</b></div>
            <div><span>Ingreso mensual recurrente</span><b>${this.money(d.recurrente.mrr)}</b></div>
            <div><span>Ventas período previo</span><b>${this.money(r.ventasPrevias)}</b></div>`;

        this._miniTabla('kpi-items', d.topItems, x => x.Item, x => `${Number(x.Cantidad)} u · ${this.money(x.Total)}`);
        this._miniTabla('kpi-clientes', d.topClientes, x => x.Cliente, x => `${x.Compras} · ${this.money(x.Total)}`);
        this._miniTabla('kpi-pago', d.porFormaPago, x => x.FormaPago, x => `${x.Cantidad} · ${this.money(x.Total)}`);
        this._miniTabla('kpi-dsem', d.porDiaSemana, x => x.DiaSemana, x => `${x.Cantidad} · ${this.money(x.Total)}`);
    },

    _miniTabla(id, arr, lbl, val) {
        const el = document.getElementById(id);
        if (!arr || !arr.length) { el.innerHTML = '<div class="omni-empty">Sin datos.</div>'; return; }
        el.innerHTML = arr.slice(0, 8).map(x => `<div class="kpi-row"><span>${lbl(x)}</span><b>${val(x)}</b></div>`).join('');
    },

    async detalle(tipo) {
        try {
            const res = await api.post('/kpi/detalle', { ...this.rango(), tipo });
            const filas = res.data.filas || [];
            const cuerpo = filas.map(f => `
                <tr>
                    <td style="text-align:left">${f.Etiqueta}</td>
                    <td style="text-align:right">${f.Transacciones ?? f.Cantidad ?? ''}</td>
                    <td style="text-align:right">${this.money(f.Base)}</td>
                    <td style="text-align:right">${this.money(f.IVA)}</td>
                    <td style="text-align:right">${this.money(f.Total)}</td>
                </tr>`).join('');
            Swal.fire({
                title: `Detalle · ${tipo}`, width: 720,
                html: `<div style="max-height:60vh;overflow:auto"><table style="width:100%;font-size:.8rem;border-collapse:collapse">
                    <thead><tr>
                        <th style="text-align:left;border-bottom:1px solid #ccc">Etiqueta</th>
                        <th style="text-align:right;border-bottom:1px solid #ccc">Cant.</th>
                        <th style="text-align:right;border-bottom:1px solid #ccc">Base</th>
                        <th style="text-align:right;border-bottom:1px solid #ccc">IVA</th>
                        <th style="text-align:right;border-bottom:1px solid #ccc">Total</th>
                    </tr></thead><tbody>${cuerpo || '<tr><td colspan="5" style="text-align:center;color:#888">Sin datos</td></tr>'}</tbody>
                </table></div>`
            });
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar el detalle', 'error'); }
    },

    async exportarPDF() {
        try {
            const res = await api.post('/kpi/exportar-pdf', this.rango(), { responseType: 'arraybuffer' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            window.open(URL.createObjectURL(blob), '_blank');
        } catch (e) { Swal.fire('Error', 'No se pudo generar el PDF', 'error'); }
    },

    exportarCSV() {
        if (!this._last) return;
        const d = this._last;
        const lines = [];
        const push = (titulo, arr, cols) => {
            lines.push(titulo);
            lines.push(cols.join(','));
            arr.forEach(x => lines.push(cols.map(c => `"${String(x[c] ?? '').replace(/"/g, '""')}"`).join(',')));
            lines.push('');
        };
        const r = d.resumen;
        lines.push('RESUMEN');
        Object.entries(r).forEach(([k, v]) => lines.push(`${k},${v}`));
        lines.push('');
        push('CURVA INGRESOS', d.curvaIngresos, ['Fecha', 'Tx', 'Total']);
        push('TOP ITEMS', d.topItems, ['Item', 'Cantidad', 'Total']);
        push('TOP CLIENTES', d.topClientes, ['Cliente', 'Compras', 'Total']);
        push('FORMA DE PAGO', d.porFormaPago, ['FormaPago', 'Cantidad', 'Total']);
        push('DIA DE LA SEMANA', d.porDiaSemana, ['DiaSemana', 'Cantidad', 'Total']);
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `KPI_${this.rango().fechaInicio}_a_${this.rango().fechaFin}.csv`;
        a.click();
    }
};

module.exports = KpiModule;
