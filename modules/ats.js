// ============================================================
//  ats.js — Anexo Transaccional Simplificado (SRI)
//  Frontend del /api/ats intacto. Es la capa "declarada al SRI",
//  distinta de la contabilidad general (Omni Ledger).
// ============================================================
const api = require('./api');

const AtsModule = {
    _preview: null,
    _ats: null,

    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    _srvBase() { return ((window.AppConfig && window.AppConfig.apiUrl) || '').replace(/\/api\/?$/, ''); },

    init() {
        window.AtsModule = this;
        window.backView = 'dashboard';
        const now = new Date();
        const anio = document.getElementById('ats-anio');
        const mes = document.getElementById('ats-mes');
        if (anio && !anio.value) anio.value = now.getFullYear();
        if (mes) { mes.value = now.getMonth() === 0 ? 12 : now.getMonth(); } // por defecto, mes anterior
    },

    async preview() {
        const anio = document.getElementById('ats-anio').value;
        const mes = document.getElementById('ats-mes').value;
        if (!anio || !mes) { window.Toast.fire({ icon: 'warning', title: 'Selecciona año y mes' }); return; }

        this._ats = null;
        document.getElementById('ats-result').style.display = 'none';
        document.getElementById('ats-gen-btn').style.display = 'none';

        try {
            Swal.fire({ title: 'Recopilando ventas y compras del período…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const r = await api.get(`/ats/${anio}/${mes}/preview`, { params: { sedeId: this.getSede() } });
            Swal.close();
            const { resumen, ventas, compras } = r.data;
            this._preview = { anio, mes };

            document.getElementById('ats-cards').style.display = 'grid';
            document.getElementById('ats-cards').innerHTML = `
                <div class="omni-card"><span>Facturas</span><b>${resumen.totalFacturas ?? 0}</b></div>
                <div class="omni-card"><span>Notas de crédito</span><b>${resumen.totalNotasCredito ?? 0}</b></div>
                <div class="omni-card"><span>Notas de débito</span><b>${resumen.totalNotasDebito ?? 0}</b></div>
                <div class="omni-card"><span>Compras declarables</span><b>${resumen.totalCompras ?? 0}</b></div>
                <div class="omni-card ${(resumen.totalComprasSinSustento || 0) > 0 ? 'warn' : ''}"><span>Compras sin sustento SRI</span><b>${resumen.totalComprasSinSustento ?? 0}</b></div>`;

            const tv = document.getElementById('ats-ventas');
            tv.innerHTML = (ventas || []).length ? ventas.map(v => `
                <tr>
                    <td>${v.nombre || '(sin nombre)'}<br><small style="opacity:.6">${v.documento || ''}</small></td>
                    <td>${v.tipoComprobanteLabel || ''}</td>
                    <td class="num">${v.numeroComprobantes}</td>
                    <td class="num">${this.fmt(v.baseImpGrav)}</td>
                    <td class="num">${this.fmt(v.montoIva)}</td>
                </tr>`).join('') : '<tr><td colspan="5" class="omni-empty">Sin ventas en este período.</td></tr>';

            const tc = document.getElementById('ats-compras');
            tc.innerHTML = (compras || []).length ? compras.map(c => `
                <tr class="${c.declarable ? '' : 'ats-nodecl'}" title="${c.declarable ? '' : 'Excluida del ATS: falta autorización/sustento SRI'}">
                    <td>${c.Proveedor}<br><small style="opacity:.6">${c.Documento || ''}</small></td>
                    <td>${c.Comprobante || ''}</td>
                    <td class="num">${this.fmt(c.BaseImponible)}</td>
                    <td class="num">${this.fmt(c.IVA)}</td>
                    <td class="num">${this.fmt(c.ValorRetencionIva)}</td>
                    <td class="num">${this.fmt(c.ValorRetencionRenta)}</td>
                    <td class="num"><b>${this.fmt(c.Total)}</b></td>
                </tr>`).join('') : '<tr><td colspan="7" class="omni-empty">Sin compras en este período.</td></tr>';

            document.getElementById('ats-panels').style.display = 'block';
            document.getElementById('ats-gen-btn').style.display = 'inline-flex';
        } catch (e) {
            Swal.close();
            window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'No se pudo calcular la vista previa' });
        }
    },

    async generar() {
        if (!this._preview) { window.Toast.fire({ icon: 'warning', title: 'Primero genera la vista previa' }); return; }
        const { anio, mes } = this._preview;
        try {
            Swal.fire({ title: 'Generando el archivo del ATS (XML + ZIP)…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const r = await api.post(`/ats/${anio}/${mes}/generar`, { sedeId: this.getSede() });
            Swal.close();
            this._ats = r.data;

            const box = document.getElementById('ats-result');
            box.style.display = 'block';
            box.innerHTML = `
                <div style="font-size:.9rem"><b>Archivo generado:</b> ${r.data.filename}</div>
                <button class="omni-btn omni-btn-ghost" onclick="AtsModule.verXml()"><i class="fas fa-code"></i> Ver XML</button>
                <button class="omni-btn omni-btn-primary" onclick="AtsModule.descargar()"><i class="fas fa-download"></i> Descargar ZIP</button>`;
            box.scrollIntoView({ behavior: 'smooth' });
            window.Toast.fire({ icon: 'success', title: 'ATS generado' });
        } catch (e) {
            Swal.close();
            window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'No se pudo generar el ATS' });
        }
    },

    verXml() {
        if (!this._ats) return;
        Swal.fire({
            icon: 'info', title: 'XML del ATS', width: 760,
            html: `<textarea readonly style="width:100%;height:360px;font-family:Consolas,monospace;font-size:10.5px;background:#f1f3f5;border-radius:8px;padding:10px;border:1px solid #ccc">${(this._ats.xml || '').replace(/</g, '&lt;')}</textarea>`
        });
    },

    descargar() {
        if (!this._ats) return;
        const u = `${this._srvBase()}${this._ats.zipUrl}`;
        try { require('electron').shell.openExternal(u); } catch (_) { window.open(u, '_blank'); }
    }
};

module.exports = AtsModule;
