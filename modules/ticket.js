// ============================================================
//  ticket.js — Impresión de ticket térmico de venta (80/58 mm)
//  Lee la config de la empresa (SedeConfig) y arma el ticket
//  en formato electron-pos-printer; imprime vía IPC (main).
// ============================================================
const api = require('./api');

const TicketModule = {
    _cfg: null,

    fmt(n) { return Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

    async _config(sedeId) {
        if (this._cfg && this._cfg._sede === sedeId) return this._cfg;
        try {
            const r = await api.get(`/sedeconfig?sedeId=${sedeId}`);
            this._cfg = { _sede: sedeId, ...(r.data.config || {}) };
        } catch (_) { this._cfg = { _sede: sedeId }; }
        return this._cfg;
    },

    /** ¿La empresa tiene configurada la impresión automática al cerrar venta? */
    async autoImprimir(sedeId) {
        const c = await this._config(sedeId);
        return c.IMPRESORA_AUTO === '1';
    },

    _srvBase() {
        return api.origin();
    },

    /**
     * @param {object} p { venta, detalle, empresa, sedeId }
     *   venta   = cabecera de Venta
     *   detalle = filas de VentaDetalle
     *   empresa = fila de Sedes (NombreComercial, RUC_NIT, Direccion, LogoPath)
     */
    async imprimirVenta({ venta, detalle, empresa, sedeId }) {
        const sid = sedeId || venta.SedeID;
        const cfg = await this._config(sid);
        const ancho = cfg.IMPRESORA_ANCHO === '58' ? '58mm' : '80mm';
        const copies = Math.max(1, parseInt(cfg.IMPRESORA_COPIAS) || 1);
        const printerName = (cfg.IMPRESORA_NOMBRE || '').trim();

        const line = (v, style) => ({ type: 'text', value: v, style: Object.assign({ fontSize: '11px', margin: '0' }, style || {}) });
        const sep = () => line('------------------------------------------', { textAlign: 'center' });

        const data = [];

        if (cfg.TICKET_MOSTRAR_LOGO === '1' && empresa && empresa.LogoPath) {
            data.push({ type: 'image', url: `${this._srvBase()}/uploads/${empresa.LogoPath}`, position: 'center', width: '150px', height: '55px' });
        }
        data.push(line((empresa && empresa.NombreComercial || 'OMNI CORE').toUpperCase(), { textAlign: 'center', fontWeight: '700', fontSize: '15px' }));
        if (empresa && empresa.RazonSocial && empresa.RazonSocial !== empresa.NombreComercial)
            data.push(line(empresa.RazonSocial, { textAlign: 'center', fontSize: '10px' }));
        if (empresa && empresa.RUC_NIT) data.push(line(`RUC/RIMPE: ${empresa.RUC_NIT}`, { textAlign: 'center', fontSize: '10px' }));
        if (empresa && empresa.Direccion) data.push(line(empresa.Direccion, { textAlign: 'center', fontSize: '9px' }));
        if (cfg.TICKET_ENCABEZADO) data.push(line(cfg.TICKET_ENCABEZADO, { textAlign: 'center', fontSize: '10px' }));

        data.push(sep());
        const f = (venta.Fecha || venta.FechaCreacion || '').toString().slice(0, 16).replace('T', ' ');
        data.push(line(`Venta #${venta.Numero}    ${f}`));
        data.push(line(`Cliente: ${venta.ClienteNombre || 'CONSUMIDOR FINAL'}`));
        if (venta.ClienteDoc) data.push(line(`Ident.: ${venta.ClienteDoc}`));
        data.push(line(`Pago: ${venta.FormaPago || '-'}  (${venta.TipoVenta})`));
        if (venta.ReferenciaPago) data.push(line(`Ref: ${venta.ReferenciaPago}`, { fontSize: '10px' }));
        data.push(sep());

        data.push({
            type: 'table',
            style: { width: '100%' },
            tableHeader: ['Cant', 'Detalle', 'Total'],
            tableBody: (detalle || []).map(l => [
                String(l.Cantidad).replace(/\.0+$/, ''),
                l.Descripcion + (Number(l.IvaLinea) ? '' : ' (0%)'),
                this.fmt(l.TotalLinea)
            ]),
            tableHeaderStyle: { fontSize: '10px', fontWeight: '700', borderBottom: '1px solid #000' },
            tableBodyStyle: { fontSize: '10px', verticalAlign: 'top' },
            tableFooterStyle: { fontSize: '10px' }
        });

        data.push(sep());
        data.push(line(`Subtotal:  ${this.fmt(venta.Subtotal)}`, { textAlign: 'right' }));
        if (Number(venta.Descuento) > 0) data.push(line(`Descuento: ${this.fmt(venta.Descuento)}`, { textAlign: 'right' }));
        data.push(line(`IVA:       ${this.fmt(venta.IVA)}`, { textAlign: 'right' }));
        data.push(line(`TOTAL:     ${this.fmt(venta.Total)}`, { textAlign: 'right', fontWeight: '700', fontSize: '14px' }));
        data.push(line(' ', {}));
        if (cfg.TICKET_PIE) data.push(line(cfg.TICKET_PIE, { textAlign: 'center', fontSize: '10px' }));
        data.push(line('Documento sin valor tributario', { textAlign: 'center', fontSize: '9px', color: '#555' }));
        data.push(line(' ', {}));
        data.push(line(' ', {}));

        const options = { preview: false, margin: '0 0 0 0', copies, pageSize: ancho, timeOutPerLine: 600 };
        if (printerName) { options.printerName = printerName; options.silent = true; }
        else { options.preview = true; } // sin impresora configurada -> vista previa para imprimir a mano

        const { ipcRenderer } = require('electron');
        const res = await ipcRenderer.invoke('omni:print-ticket', { data, options });
        if (!res || !res.ok) throw new Error((res && res.error) || 'No se pudo imprimir el ticket');
        return res;
    }
};

module.exports = TicketModule;
