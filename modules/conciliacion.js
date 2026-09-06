const api = require('./api');
const money = n => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 });

const ConciliacionModule = {
    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },

    async init() {
        window.ConciliacionModule = this;
        window.backView = 'dashboard';
        const d = new Date();
        document.getElementById('cn-desde').value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        document.getElementById('cn-hasta').value = d.toISOString().slice(0, 10);
        await this.cargar();
    },

    async cargar() {
        const body = document.getElementById('cn-body');
        body.innerHTML = '<tr><td colspan="7" class="omni-empty">Cargando…</td></tr>';
        const desde = document.getElementById('cn-desde').value;
        const hasta = document.getElementById('cn-hasta').value;
        const pend = document.getElementById('cn-pend').checked ? '&soloPendientes=1' : '';
        try {
            const r = await api.get(`/contabilidad/conciliacion/movimientos?sedeId=${this.getSede()}&desde=${desde}&hasta=${hasta}${pend}`);
            const f = r.data.filas || [];
            document.getElementById('cn-tot').textContent =
                `Libro ${money(r.data.saldoLibro)} · Conciliado ${money(r.data.saldoConciliado)} · Pendiente ${money(r.data.pendiente)}`;
            body.innerHTML = f.length ? f.map(x => `
                <tr class="${x.Conciliado ? 'cn-ok' : ''}">
                    <td><input type="checkbox" ${x.Conciliado ? 'checked' : ''} onclick="ConciliacionModule.toggle(${x.DetalleID}, this.checked)"></td>
                    <td>${x.Numero}</td>
                    <td>${String(x.Fecha).slice(0, 10)}</td>
                    <td>${x.Glosa || ''} <span style="color:#94a3b8">· ${x.Origen}</span></td>
                    <td class="num">${x.Ingreso ? money(x.Ingreso) : ''}</td>
                    <td class="num">${x.Egreso ? money(x.Egreso) : ''}</td>
                    <td style="font-size:.74rem;color:#64748b">${x.RefExtracto || ''}${x.FechaExtracto ? ' · ' + String(x.FechaExtracto).slice(0, 10) : ''}</td>
                </tr>`).join('') : '<tr><td colspan="7" class="omni-empty">Sin movimientos de Bancos en el rango.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="7" class="omni-empty">${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async toggle(detId, on) {
        try {
            if (on) {
                const { value: ref } = await Swal.fire({
                    title: 'Conciliar movimiento', input: 'text',
                    inputPlaceholder: 'Referencia del extracto (opcional)',
                    showCancelButton: true, confirmButtonText: 'Conciliar'
                });
                if (ref === undefined) { this.cargar(); return; }
                await api.post('/contabilidad/conciliacion/marcar', { DetalleID: detId, RefExtracto: ref || null, FechaExtracto: new Date().toISOString().slice(0, 10) });
            } else {
                await api.post('/contabilidad/conciliacion/desmarcar', { DetalleID: detId });
            }
            this.cargar();
        } catch (e) {
            if (window.Toast) window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' });
            this.cargar();
        }
    }
};

module.exports = ConciliacionModule;
