// ============================================================
//  verAsiento.js — helper compartido de trazabilidad contable
//  Muestra el/los asiento(s) de un documento en un modal Swal.
//    verAsiento(asientoId)            -> /contabilidad/asientos/:id
//    verAsientosDe(origen, id, ...)   -> /contabilidad/asientos-de/:origen/:id
// ============================================================
const api = require('./api');

const money = n => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tablaAsiento(a) {
    const filas = (a.lineas || a.detalle || []).map(l => `
        <tr>
            <td style="text-align:left;padding:5px 8px">${l.Codigo} · ${l.CuentaNombre}</td>
            <td style="text-align:right;padding:5px 8px">${Number(l.Debe) ? money(l.Debe) : ''}</td>
            <td style="text-align:right;padding:5px 8px">${Number(l.Haber) ? money(l.Haber) : ''}</td>
        </tr>`).join('');
    const td = a.TotalDebe != null ? a.TotalDebe : (a.lineas || []).reduce((s, l) => s + Number(l.Debe || 0), 0);
    const th = a.TotalHaber != null ? a.TotalHaber : (a.lineas || []).reduce((s, l) => s + Number(l.Haber || 0), 0);
    return `
      <div style="margin-bottom:14px;text-align:left">
        <div style="font-size:13px;margin-bottom:4px">
            <b>Asiento #${a.Numero}</b> · ${a.Origen || ''} ·
            ${a.Fecha ? new Date(a.Fecha).toLocaleDateString('es-EC') : ''} ·
            <span style="font-weight:700">${a.Estado || ''}</span>
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:6px">${a.Glosa || ''}</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:5px 8px">Cuenta</th>
            <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:5px 8px">Debe</th>
            <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:5px 8px">Haber</th>
          </tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr style="font-weight:800;border-top:2px solid #334155">
            <td style="text-align:right;padding:5px 8px">TOTAL</td>
            <td style="text-align:right;padding:5px 8px">${money(td)}</td>
            <td style="text-align:right;padding:5px 8px">${money(th)}</td>
          </tr></tfoot>
        </table>
      </div>`;
}

async function verAsiento(asientoId) {
    if (!asientoId) return;
    try {
        const r = await api.get(`/contabilidad/asientos/${asientoId}`);
        const a = { ...r.data.asiento, lineas: r.data.detalle };
        Swal.fire({ title: 'Asiento contable', html: tablaAsiento(a), width: 640 });
    } catch (e) {
        Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar el asiento.', 'error');
    }
}

// origenes: uno o varios ('VENTA', 'COGS', ...). id = OrigenID del documento.
async function verAsientosDe(id, ...origenes) {
    try {
        const listas = await Promise.all(origenes.map(o =>
            api.get(`/contabilidad/asientos-de/${o}/${id}`).then(r => r.data.asientos || []).catch(() => [])));
        const asientos = [].concat(...listas);
        if (!asientos.length) {
            Swal.fire('Sin asiento', 'Este documento todavía no tiene asiento contable generado.', 'info');
            return;
        }
        Swal.fire({
            title: asientos.length > 1 ? `${asientos.length} asientos del documento` : 'Asiento contable',
            html: asientos.map(tablaAsiento).join('<hr style="border:none;border-top:1px dashed #cbd5e1;margin:10px 0">'),
            width: 660
        });
    } catch (e) {
        Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar el asiento.', 'error');
    }
}

module.exports = { verAsiento, verAsientosDe };
