const api = require('./api');

const LibromayorModule = {
    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    hoy() { return new Date().toISOString().slice(0, 10); },
    primeroMes() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); },
    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

    async init() {
        window.LibromayorModule = this;
        window.backView = 'dashboard';
        document.getElementById('lm-desde').value = this.primeroMes();
        document.getElementById('lm-hasta').value = this.hoy();
        try {
            const res = await api.get(`/contabilidad/plan?sedeId=${this.getSede()}&soloMovimiento=1`);
            const sel = document.getElementById('lm-cuenta');
            (res.data.cuentas || []).forEach(c => {
                const o = document.createElement('option');
                o.value = c.CuentaID; o.textContent = `${c.Codigo} · ${c.Nombre}`;
                sel.appendChild(o);
            });
        } catch (_) {}
    },

    async cargar() {
        const cuentaId = document.getElementById('lm-cuenta').value;
        if (!cuentaId) { window.Toast.fire({ icon: 'warning', title: 'Selecciona una cuenta' }); return; }
        const desde = document.getElementById('lm-desde').value;
        const hasta = document.getElementById('lm-hasta').value;
        const body = document.getElementById('lm-body');
        body.innerHTML = '<tr><td colspan="6" class="omni-empty"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';
        try {
            const res = await api.get(`/contabilidad/libro-mayor?sedeId=${this.getSede()}&cuentaId=${cuentaId}&desde=${desde}&hasta=${hasta}`);
            const d = res.data;
            const cab = document.getElementById('lm-cab');
            cab.style.display = 'flex';
            cab.innerHTML = `
                <div><span>Cuenta</span><b>${d.cuenta.Codigo} · ${d.cuenta.Nombre}</b></div>
                <div><span>Naturaleza</span><b>${d.cuenta.Naturaleza}</b></div>
                <div><span>Saldo inicial</span><b>${this.fmt(d.saldoInicial)}</b></div>
                <div><span>Débitos período</span><b>${this.fmt(d.totales.totDebe)}</b></div>
                <div><span>Créditos período</span><b>${this.fmt(d.totales.totHaber)}</b></div>
                <div><span>Saldo final</span><b style="color:#2f7be6">${this.fmt(d.saldoFinal)}</b></div>`;

            let html = `<tr class="lm-ini"><td colspan="5">SALDO INICIAL AL ${desde}</td><td class="num">${this.fmt(d.saldoInicial)}</td></tr>`;
            if (!d.movimientos.length) {
                html += `<tr><td colspan="6" class="omni-empty">Sin movimientos en el período.</td></tr>`;
            } else {
                html += d.movimientos.map(m => `
                    <tr>
                        <td>${(m.Fecha || '').slice(0, 10)}</td>
                        <td>#${m.Numero}</td>
                        <td>${m.Glosa || ''}${m.Referencia ? ` <span style="color:#718096">· ${m.Referencia}</span>` : ''}${m.GlosaLinea ? `<br><span style="color:#718096;font-size:.72rem">${m.GlosaLinea}</span>` : ''}</td>
                        <td class="num">${Number(m.Debe) ? this.fmt(m.Debe) : ''}</td>
                        <td class="num">${Number(m.Haber) ? this.fmt(m.Haber) : ''}</td>
                        <td class="num">${this.fmt(m.SaldoAcumulado)}</td>
                    </tr>`).join('');
            }
            html += `<tr class="lm-fin"><td colspan="3">SALDO FINAL AL ${hasta}</td><td class="num">${this.fmt(d.totales.totDebe)}</td><td class="num">${this.fmt(d.totales.totHaber)}</td><td class="num">${this.fmt(d.saldoFinal)}</td></tr>`;
            body.innerHTML = html;
        } catch (e) {
            body.innerHTML = `<tr><td colspan="6" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    }
};

module.exports = LibromayorModule;
