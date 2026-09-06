const api = require('./api');

const BalancecomprobacionModule = {
    _data: null,
    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    hoy() { return new Date().toISOString().slice(0, 10); },
    primeroMes() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); },
    fmt(n) { const v = Number(n || 0); return v ? v.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; },

    async init() {
        window.BalancecomprobacionModule = this;
        window.backView = 'dashboard';
        document.getElementById('bc-desde').value = this.primeroMes();
        document.getElementById('bc-hasta').value = this.hoy();
        await this.cargar();
    },

    async cargar() {
        const desde = document.getElementById('bc-desde').value;
        const hasta = document.getElementById('bc-hasta').value;
        const body = document.getElementById('bc-body');
        body.innerHTML = '<tr><td colspan="10" class="omni-empty"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';
        try {
            const res = await api.get(`/contabilidad/balance-comprobacion?sedeId=${this.getSede()}&desde=${desde}&hasta=${hasta}`);
            this._data = res.data;
            const cuentas = res.data.cuentas || [];
            if (!cuentas.length) { body.innerHTML = '<tr><td colspan="10" class="omni-empty">Sin movimientos.</td></tr>'; document.getElementById('bc-foot').innerHTML = ''; return; }
            body.innerHTML = cuentas.map(c => `
                <tr>
                    <td class="c">${c.Codigo}</td><td>${c.Nombre}</td>
                    <td class="num">${this.fmt(c.DebeAnt)}</td><td class="num">${this.fmt(c.HaberAnt)}</td>
                    <td class="num">${this.fmt(c.DebePer)}</td><td class="num">${this.fmt(c.HaberPer)}</td>
                    <td class="num">${this.fmt(c.DebeAcum)}</td><td class="num">${this.fmt(c.HaberAcum)}</td>
                    <td class="num">${this.fmt(c.SaldoDeudor)}</td><td class="num">${this.fmt(c.SaldoAcreedor)}</td>
                </tr>`).join('');
            const s = res.data.sumas;
            document.getElementById('bc-foot').innerHTML = `<tr>
                <td colspan="2">TOTALES</td>
                <td class="num">${this.fmt(s.debeAnt)}</td><td class="num">${this.fmt(s.haberAnt)}</td>
                <td class="num">${this.fmt(s.debePer)}</td><td class="num">${this.fmt(s.haberPer)}</td>
                <td class="num">${this.fmt(s.debeAcum)}</td><td class="num">${this.fmt(s.haberAcum)}</td>
                <td class="num">${this.fmt(s.saldoDeudor)}</td><td class="num">${this.fmt(s.saldoAcreedor)}</td>
            </tr>`;
            const cuadraSumas = Math.abs(s.debeAcum - s.haberAcum) < 0.01;
            const cuadraSaldos = Math.abs(s.saldoDeudor - s.saldoAcreedor) < 0.01;
            const est = document.getElementById('bc-estado');
            est.textContent = (cuadraSumas && cuadraSaldos) ? '✔ Balance cuadrado' : '✘ Balance descuadrado';
            est.style.color = (cuadraSumas && cuadraSaldos) ? '#1e8e4e' : '#e74c3c';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="10" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    exportarCSV() {
        if (!this._data) return;
        const h = ['Codigo', 'Cuenta', 'DebeAnterior', 'HaberAnterior', 'DebePeriodo', 'HaberPeriodo', 'DebeAcumulado', 'HaberAcumulado', 'SaldoDeudor', 'SaldoAcreedor'];
        const rows = this._data.cuentas.map(c => [c.Codigo, `"${c.Nombre}"`, c.DebeAnt, c.HaberAnt, c.DebePer, c.HaberPer, c.DebeAcum, c.HaberAcum, c.SaldoDeudor, c.SaldoAcreedor].join(','));
        const s = this._data.sumas;
        rows.push(['', 'TOTALES', s.debeAnt, s.haberAnt, s.debePer, s.haberPer, s.debeAcum, s.haberAcum, s.saldoDeudor, s.saldoAcreedor].join(','));
        const csv = '﻿' + h.join(',') + '\n' + rows.join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `balance_comprobacion_${this._data.desde}_a_${this._data.hasta}.csv`;
        a.click();
    }
};

module.exports = BalancecomprobacionModule;
