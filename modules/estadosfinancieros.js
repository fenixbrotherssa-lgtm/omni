const api = require('./api');

const EstadosfinancierosModule = {
    _t: 'er',
    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    hoy() { return new Date().toISOString().slice(0, 10); },
    primeroMes() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); },
    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

    async init() {
        window.EstadosfinancierosModule = this;
        window.backView = 'dashboard';
        document.getElementById('ef-desde').value = this.primeroMes();
        document.getElementById('ef-hasta').value = this.hoy();
        await this.cargar();
    },

    async pdf() {
        const desde = document.getElementById('ef-desde').value;
        const hasta = document.getElementById('ef-hasta').value;
        const url = this._t === 'er'
            ? `/contabilidad/estado-resultados/pdf?sedeId=${this.getSede()}&desde=${desde}&hasta=${hasta}`
            : `/contabilidad/balance-general/pdf?sedeId=${this.getSede()}&hasta=${hasta}`;
        try {
            const res = await window.axios.get(api.base() + url,
                { responseType: 'blob', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank');
        } catch (e) { Swal.fire('Error', 'No se pudo generar el PDF', 'error'); }
    },

    tab(t) {
        this._t = t;
        document.querySelectorAll('.ef-tab').forEach(b => b.classList.toggle('active', b.dataset.t === t));
        document.getElementById('ef-desde-wrap').style.display = (t === 'er') ? 'flex' : 'none';
        this.cargar();
    },

    async cargar() {
        const out = document.getElementById('ef-out');
        out.innerHTML = '<div class="omni-empty"><i class="fas fa-spinner fa-spin"></i> Generando...</div>';
        try {
            if (this._t === 'er') await this._estadoResultados(out);
            else await this._balanceGeneral(out);
        } catch (e) {
            out.innerHTML = `<div class="omni-empty">Error: ${e.response?.data?.error || e.message}</div>`;
        }
    },

    _lista(items) {
        if (!items.length) return '<div class="ef-row" style="opacity:.5">— sin movimientos —</div>';
        return items.map(i => `<div class="ef-row"><span><span class="c">${i.Codigo}</span>${i.Nombre}</span><span class="v">${this.fmt(i.Valor)}</span></div>`).join('');
    },

    async _estadoResultados(out) {
        const desde = document.getElementById('ef-desde').value;
        const hasta = document.getElementById('ef-hasta').value;
        const res = await api.get(`/contabilidad/estado-resultados?sedeId=${this.getSede()}&desde=${desde}&hasta=${hasta}`);
        const d = res.data;
        const utilClass = d.utilidad >= 0 ? 'ef-util-pos' : 'ef-util-neg';
        out.innerHTML = `
            <div class="ef-card" style="min-width:520px">
                <h3>ESTADO DE RESULTADOS · ${desde} a ${hasta}</h3>
                <div class="grp-h">Ingresos</div>
                ${this._lista(d.ingresos)}
                <div class="ef-sub"><span>Total Ingresos</span><span>${this.fmt(d.totalIngresos)}</span></div>
                <div class="grp-h">Costos y Gastos</div>
                ${this._lista(d.gastos)}
                <div class="ef-sub"><span>Total Costos y Gastos</span><span>${this.fmt(d.totalGastos)}</span></div>
                <div class="ef-total"><span>${d.utilidad >= 0 ? 'UTILIDAD DEL EJERCICIO' : 'PÉRDIDA DEL EJERCICIO'}</span><span class="${utilClass}">${this.fmt(d.utilidad)}</span></div>
            </div>`;
    },

    async _balanceGeneral(out) {
        const hasta = document.getElementById('ef-hasta').value;
        const res = await api.get(`/contabilidad/balance-general?sedeId=${this.getSede()}&hasta=${hasta}`);
        const d = res.data;
        const resClass = d.resultadoEjercicio >= 0 ? 'ef-util-pos' : 'ef-util-neg';
        out.innerHTML = `
            <div class="ef-card">
                <h3>ACTIVOS · al ${hasta}</h3>
                ${this._lista(d.activo)}
                <div class="ef-total"><span>TOTAL ACTIVO</span><span>${this.fmt(d.totalActivo)}</span></div>
            </div>
            <div class="ef-card">
                <h3>PASIVO Y PATRIMONIO · al ${hasta}</h3>
                <div class="grp-h">Pasivos</div>
                ${this._lista(d.pasivo)}
                <div class="ef-sub"><span>Total Pasivo</span><span>${this.fmt(d.totalPasivo)}</span></div>
                <div class="grp-h">Patrimonio</div>
                ${this._lista(d.patrimonio)}
                <div class="ef-row"><span>Resultado del ejercicio</span><span class="v ${resClass}">${this.fmt(d.resultadoEjercicio)}</span></div>
                <div class="ef-sub"><span>Total Patrimonio</span><span>${this.fmt(d.totalPatrimonio + d.resultadoEjercicio)}</span></div>
                <div class="ef-total"><span>TOTAL PASIVO + PATRIMONIO</span><span>${this.fmt(d.totalPasivoPatrimonio)}</span></div>
                <div class="ef-flag" style="color:${d.cuadra ? '#1e8e4e' : '#e74c3c'}">
                    ${d.cuadra ? '✔ El balance cuadra (Activo = Pasivo + Patrimonio)' : '✘ El balance NO cuadra — revisar asientos'}
                </div>
            </div>`;
    }
};

module.exports = EstadosfinancierosModule;
