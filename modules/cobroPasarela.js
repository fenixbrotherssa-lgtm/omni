// ============================================================
//  cobroPasarela.js — helper compartido de cobro por pasarela.
//  Se usa en POS, Cuentas por Cobrar y Caja.
//    const r = await CobroPasarela.iniciar({ monto, concepto, origen, origenId });
//    if (r.aprobado) { ... }
//  Soporta Payphone / Stripe (link + polling) y DeUna (QR + confirmación manual).
// ============================================================
const api = require('./api');

function sedeId() {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return localStorage.getItem('currentSedeId') || u.SedeID || u.sede || 1;
}
const money = n => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let _poll = null, _resolver = null, _clt = null;

function _cerrar(result) {
    if (_poll) { clearInterval(_poll); _poll = null; }
    const ov = document.getElementById('cp-ov');
    if (ov) ov.remove();
    if (_resolver) { const r = _resolver; _resolver = null; r(result || { aprobado: false, cancelado: true }); }
    _clt = null;
}

function _pintar(html) {
    document.getElementById('cp-body').innerHTML = html;
}

async function estado() {
    try { return (await api.get(`/pagos/estado?sedeId=${sedeId()}`)).data; }
    catch { return { habilitada: false }; }
}

// Abre el modal y arranca el cobro. Devuelve Promise<{aprobado,...}>.
function iniciar({ monto, concepto, referencia, email, origen, origenId } = {}) {
    return new Promise(async (resolve) => {
        _resolver = resolve;
        const st = await estado();
        if (!st.habilitada) {
            resolve({ aprobado: false, sinPasarela: true });
            if (window.Toast) window.Toast.fire({ icon: 'info', title: 'Esta empresa no tiene pasarela de pago configurada' });
            return;
        }

        if (document.getElementById('cp-ov')) document.getElementById('cp-ov').remove();
        const ov = document.createElement('div');
        ov.id = 'cp-ov';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,40,.6);display:flex;align-items:center;justify-content:center;z-index:4000;font-family:Inter,Segoe UI,sans-serif';
        ov.innerHTML = `
          <div style="background:#fff;border-radius:16px;width:min(420px,94vw);box-shadow:0 30px 60px rgba(0,0,0,.35);overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#1a365d;color:#fff">
              <b style="letter-spacing:.5px"><i class="fas fa-qrcode"></i> Cobro por ${st.pasarela}</b>
              <button id="cp-x" style="border:none;background:rgba(255,255,255,.15);color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer">✕</button>
            </div>
            <div id="cp-body" style="padding:22px 20px;text-align:center"></div>
          </div>`;
        document.body.appendChild(ov);
        document.getElementById('cp-x').onclick = () => _cerrar({ aprobado: false, cancelado: true });
        ov.onclick = e => { if (e.target === ov) _cerrar({ aprobado: false, cancelado: true }); };

        _pintar('<i class="fas fa-spinner fa-spin" style="font-size:1.6rem;color:#2f7be6"></i><p style="color:#718096;margin-top:10px">Generando cobro…</p>');

        let r;
        try {
            r = (await api.post('/pagos/iniciar', {
                sedeId: sedeId(), monto, concepto: concepto || referencia || 'Cobro',
                referencia: referencia || concepto || '', email: email || null,
                origen: origen || 'MANUAL', origenId: origenId || null
            })).data;
        } catch (e) {
            _pintar(`<p style="color:#c0392b">${e.response?.data?.error || 'No se pudo generar el cobro.'}</p>
                     <button class="omni-btn" style="margin-top:12px" onclick="CobroPasarela._close()">Cerrar</button>`);
            return;
        }

        _clt = r.clientTransactionId;
        const qrData = r.qrPayload || r.payUrl;
        const qrImg = qrData
            ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}" alt="QR" style="width:200px;height:200px;border-radius:12px;border:1px solid #e6e9ef">`
            : '';

        let acciones = `<p style="color:#718096;font-size:.82rem;margin:12px 0 0">Esperando confirmación del pago…<br><i class="fas fa-spinner fa-spin"></i></p>`;
        if (r.manual) {
            acciones = `<p style="color:#718096;font-size:.82rem;margin:12px 0">El cliente escanea el QR y paga el monto en su app.
                Cuando te llegue la notificación de <b>${st.pasarela}</b>, confirma:</p>
                <button class="omni-btn omni-btn-primary" style="width:100%;justify-content:center" onclick="CobroPasarela._manual()">
                  <i class="fas fa-check"></i> Ya recibí el pago (${money(monto)})</button>`;
        }
        _pintar(`
            <div style="font-size:1.3rem;font-weight:900;color:#1a365d;margin-bottom:10px">${money(monto)}</div>
            ${qrImg}
            ${r.payUrl ? `<p style="font-size:.72rem;color:#94a3b8;word-break:break-all;margin:10px 0 0">${r.payUrl}</p>` : ''}
            ${acciones}
            <button class="omni-btn omni-btn-ghost" style="margin-top:14px" onclick="CobroPasarela._close()">Cancelar</button>
        `);

        // Polling
        if (!r.manual) {
            _poll = setInterval(async () => {
                try {
                    const v = (await api.get(`/pagos/verificar/${_clt}`)).data;
                    if (v.Estado === 'APROBADO') {
                        _cerrar({ aprobado: true, clientTransactionId: _clt, authCode: v.CodigoAutorizacion, pasarela: r.pasarela, monto: v.Monto });
                    } else if (['RECHAZADO', 'CANCELADO'].includes(v.Estado)) {
                        _pintar(`<p style="color:#c0392b"><i class="fas fa-times-circle" style="font-size:1.6rem"></i><br>Pago ${v.Estado.toLowerCase()}.</p>
                                 <button class="omni-btn" style="margin-top:12px" onclick="CobroPasarela._close()">Cerrar</button>`);
                        if (_poll) { clearInterval(_poll); _poll = null; }
                    }
                } catch (_) {}
            }, 3000);
        }

        // Socket (si el retorno del cliente llega por ahí)
        if (window.socket) {
            window.socket.on('pago:resultado', p => {
                if (p.clientTransactionId === _clt) {
                    if (p.aprobado) _cerrar({ aprobado: true, clientTransactionId: _clt, authCode: p.authCode, pasarela: r.pasarela, monto: p.monto });
                }
            });
        }
    });
}

const CobroPasarela = {
    iniciar,
    estado,
    _close() { _cerrar({ aprobado: false, cancelado: true }); },
    async _manual() {
        try {
            await api.post(`/pagos/${_clt}/confirmar-manual`, {});
            _cerrar({ aprobado: true, clientTransactionId: _clt, authCode: 'DEUNA-MANUAL', manual: true });
        } catch (e) {
            if (window.Toast) window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'No se pudo confirmar' });
        }
    }
};

if (typeof window !== 'undefined') window.CobroPasarela = CobroPasarela;
module.exports = CobroPasarela;
