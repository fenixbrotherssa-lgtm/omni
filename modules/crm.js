const api = require('./api');

let _cli = null;          // cliente abierto en el modal
let _tmr = null;          // debounce búsqueda
let _pollTmr = null;      // polling de campañas

function sede() {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return localStorage.getItem('currentSedeId') || u.SedeID || u.sede || null;
}
const money = n => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const CRM = {
    _q: '',
    _sel: new Set(),
    _clientes: [],

    async init() {
        window.CRM = this;
        window.backView = 'dashboard';
        this._sel = new Set();
        await Promise.all([this.cargarStats(), this.cargarClientes('')]);
    },

    tab(name) {
        ['clientes', 'cumpleanos', 'campanas'].forEach(t =>
            document.getElementById('tab-' + t).style.display = t === name ? '' : 'none');
        document.querySelectorAll('.crm-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === name));
        if (name === 'cumpleanos') this.cargarCumpleanos();
        if (name === 'campanas') this.cargarCampanas();
        if (name !== 'campanas' && _pollTmr) { clearInterval(_pollTmr); _pollTmr = null; }
    },

    // ── STATS ────────────────────────────────────────────────────────
    async cargarStats() {
        try {
            const s = sede();
            const r = await api.get(`/crm/stats${s ? '?sedeId=' + s : ''}`);
            const d = r.data;
            const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v ?? '–'; };
            set('sv-total', d.TotalClientes); set('sv-vip', d.TotalVIP);
            set('sv-nuevos', d.ComprasEsteMes); set('sv-cumple', d.CumpleanosSemana);
        } catch (_) {}
    },

    // ── CLIENTES ─────────────────────────────────────────────────────
    onSearch(v) {
        clearTimeout(_tmr);
        _tmr = setTimeout(() => { this._q = v.trim(); this.cargarClientes(this._q); }, 320);
    },

    async cargarClientes(buscar) {
        const body = document.getElementById('crm-body');
        body.innerHTML = '<tr><td colspan="9" class="omni-empty">Cargando…</td></tr>';
        try {
            const qs = new URLSearchParams();
            if (buscar) qs.set('buscar', buscar);
            const s = sede(); if (s) qs.set('sedeId', s);
            const r = await api.get(`/crm/clientes${qs.toString() ? '?' + qs : ''}`);
            let lista = r.data || [];
            const cl = document.getElementById('crm-filtro-clasif').value;
            if (cl) lista = lista.filter(c => c.Clasificacion === cl);
            this._clientes = lista;
            this.renderClientes(lista);
        } catch (e) {
            body.innerHTML = `<tr><td colspan="9" class="omni-empty">Error: ${esc(e.response?.data?.error || e.message)}</td></tr>`;
        }
    },

    renderClientes(lista) {
        const body = document.getElementById('crm-body');
        document.getElementById('crm-count').textContent = `${lista.length} clientes`;
        if (!lista.length) { body.innerHTML = '<tr><td colspan="9" class="omni-empty">Sin resultados.</td></tr>'; return; }
        body.innerHTML = lista.map(c => {
            const saldo = parseFloat(c.SaldoPendiente || 0);
            const ult = c.UltimaCompra ? new Date(c.UltimaCompra).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
            const mail = c.Correo
                ? (c.AceptaPromociones ? `<span class="crm-mail-ok" title="Acepta promociones"><i class="fas fa-circle-check"></i> ${esc(c.Correo)}</span>` : `<span class="crm-mail-no" title="Sin consentimiento">${esc(c.Correo)} · opt-out</span>`)
                : '<span class="crm-mail-no">sin correo</span>';
            return `<tr>
                <td><input type="checkbox" class="crm-row-chk" data-id="${c.ClienteID}" ${this._sel.has(c.ClienteID) ? 'checked' : ''} onclick="CRM.toggleOne(${c.ClienteID}, this.checked)"></td>
                <td class="crm-cli">${esc(c.NombreFull || 'Sin nombre')}<small>${esc(c.Documento || '')}${c.Procedencia ? ' · ' + esc(c.Procedencia) : ''}</small></td>
                <td><span class="crm-badge b-${c.Clasificacion}">${this._lbl(c.Clasificacion)}</span></td>
                <td class="num">${c.TotalCompras}</td>
                <td class="num">${money(c.TotalGastado)}</td>
                <td class="num" style="${saldo > 0 ? 'color:#c0392b;font-weight:800' : 'color:#94a3b8'}">${saldo > 0 ? money(saldo) : '—'}</td>
                <td>${ult}</td>
                <td style="font-size:.74rem">${mail}</td>
                <td><button class="omni-btn omni-btn-ghost" style="padding:6px 10px" onclick="CRM.abrirPerfil(${c.ClienteID})"><i class="fas fa-eye"></i></button></td>
            </tr>`;
        }).join('');
        const all = document.getElementById('crm-check-all');
        if (all) all.checked = lista.length > 0 && lista.every(c => this._sel.has(c.ClienteID));
    },

    toggleAll(on) {
        this._clientes.forEach(c => on ? this._sel.add(c.ClienteID) : this._sel.delete(c.ClienteID));
        document.querySelectorAll('.crm-row-chk').forEach(ch => ch.checked = on);
        this._bulk();
    },
    toggleOne(id, on) { on ? this._sel.add(id) : this._sel.delete(id); this._bulk(); },
    limpiarSeleccion() {
        this._sel.clear();
        document.querySelectorAll('.crm-row-chk').forEach(ch => ch.checked = false);
        const all = document.getElementById('crm-check-all'); if (all) all.checked = false;
        this._bulk();
    },
    _bulk() {
        const n = this._sel.size;
        document.getElementById('crm-sel-n').textContent = n;
        document.getElementById('crm-bulkbar').hidden = n === 0;
        const s = document.getElementById('cdest-sel-n'); if (s) s.textContent = n;
    },
    _lbl(c) { return { VIP: 'VIP', FRECUENTE: 'Frecuente', REGULAR: 'Regular', NUEVO: 'Nuevo', SIN_ACTIVIDAD: 'Sin actividad' }[c] || c; },

    // ── PERFIL ───────────────────────────────────────────────────────
    async abrirPerfil(id) {
        _cli = id;
        document.getElementById('crm-overlay').style.display = 'flex';
        document.getElementById('m-hist-body').innerHTML = '<tr><td colspan="7" class="omni-empty">Cargando…</td></tr>';
        this.mtab('hist');
        try {
            const r = await api.get(`/crm/clientes/${id}`);
            this.renderPerfil(r.data);
        } catch { Swal.fire('Error', 'No se pudo cargar el perfil.', 'error'); this.cerrarModal(); }
    },

    renderPerfil({ perfil, historial, notas, productoTop, saldoPendiente }) {
        const p = perfil;
        document.getElementById('m-avatar').textContent = (p.NombreFull || '?')[0].toUpperCase();
        document.getElementById('m-nombre').textContent = p.NombreFull || 'Sin nombre';
        document.getElementById('m-sub').textContent = [p.Documento, p.Telefono, p.Correo, p.Procedencia].filter(Boolean).join(' · ');
        const b = document.getElementById('m-badge');
        b.textContent = this._lbl(p.Clasificacion); b.className = 'crm-badge b-' + p.Clasificacion;

        const saldo = parseFloat(saldoPendiente || 0);
        document.getElementById('m-kpis').innerHTML = `
            <div class="k"><span>Compras</span><b>${p.TotalCompras}</b></div>
            <div class="k"><span>Gastado</span><b>${money(p.TotalGastado)}</b></div>
            <div class="k"><span>Ticket prom.</span><b>${money(p.TicketPromedio)}</b></div>
            <div class="k"><span>${productoTop ? 'Producto top' : (saldo > 0 ? 'Saldo pend.' : 'Cumpleaños')}</span>
                <b style="font-size:.85rem;${(!productoTop && saldo > 0) ? 'color:#c0392b' : ''}">${esc(productoTop || (saldo > 0 ? money(saldo) : (p.FechaNacimiento ? new Date(p.FechaNacimiento).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—')))}</b></div>`;

        document.getElementById('m-hist-body').innerHTML = (historial && historial.length)
            ? historial.map(h => {
                const anul = (h.Estado || '').toUpperCase().startsWith('ANULAD');
                return `<tr style="${anul ? 'opacity:.5' : ''}">
                    <td><b>${h.Numero ?? h.VentaID}</b></td>
                    <td>${h.Fecha ? new Date(h.Fecha).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : '—'}</td>
                    <td>${esc(h.TipoVenta || '—')}</td>
                    <td class="num">${money(h.Subtotal)}</td>
                    <td class="num">${money(h.IVA)}</td>
                    <td class="num"><b>${money(h.Total)}</b></td>
                    <td>${esc(h.Estado || 'EMITIDA')}</td></tr>`;
            }).join('')
            : '<tr><td colspan="7" class="omni-empty">Sin compras registradas.</td></tr>';

        document.getElementById('m-notas-n').textContent = notas.length ? `(${notas.length})` : '';
        this.renderNotas(notas);

        document.getElementById('e-nombre').value = p.NombreFull || '';
        document.getElementById('e-telefono').value = p.Telefono || '';
        document.getElementById('e-correo').value = p.Correo || '';
        document.getElementById('e-procedencia').value = p.Procedencia || '';
        document.getElementById('e-fnac').value = p.FechaNacimiento ? p.FechaNacimiento.split('T')[0] : '';
        document.getElementById('e-direccion').value = p.Direccion || '';
        document.getElementById('e-promo').checked = p.AceptaPromociones !== false && p.AceptaPromociones !== 0;
        document.getElementById('m-btn-email').style.display = p.Correo ? '' : 'none';
    },

    renderNotas(notas) {
        const el = document.getElementById('notas-lista');
        el.innerHTML = notas.length
            ? notas.map(n => `<div class="crm-note">${esc(n.Nota)}<small><i class="fas fa-user"></i> ${esc(n.NombreUsuario)} · ${new Date(n.FechaCreacion).toLocaleString('es-EC')}</small></div>`).join('')
            : '<p class="omni-empty">Sin notas.</p>';
    },

    mtab(t) {
        ['hist', 'notas', 'datos'].forEach(x => document.getElementById('mt-' + x).style.display = x === t ? '' : 'none');
        document.querySelectorAll('.crm-mtab').forEach(b => b.classList.toggle('is-active', b.dataset.mt === t));
    },

    async guardarCliente() {
        const body = {
            NombreFull: document.getElementById('e-nombre').value.trim(),
            Telefono: document.getElementById('e-telefono').value.trim() || null,
            Correo: document.getElementById('e-correo').value.trim() || null,
            Procedencia: document.getElementById('e-procedencia').value.trim() || null,
            FechaNacimiento: document.getElementById('e-fnac').value || null,
            Direccion: document.getElementById('e-direccion').value.trim() || null,
            AceptaPromociones: document.getElementById('e-promo').checked
        };
        if (!body.NombreFull) return Swal.fire('Atención', 'El nombre no puede estar vacío.', 'warning');
        try {
            await api.put(`/crm/clientes/${_cli}`, body);
            window.Toast ? window.Toast.fire({ icon: 'success', title: 'Datos guardados' }) : Swal.fire('OK', 'Guardado', 'success');
            const r = await api.get(`/crm/clientes/${_cli}`);
            this.renderPerfil(r.data);
            this.cargarClientes(this._q); this.cargarStats();
        } catch { Swal.fire('Error', 'No se pudo guardar.', 'error'); }
    },

    async agregarNota() {
        const nota = document.getElementById('nota-input').value.trim();
        if (!nota) return;
        try {
            await api.post(`/crm/clientes/${_cli}/notas`, { nota });
            document.getElementById('nota-input').value = '';
            const r = await api.get(`/crm/clientes/${_cli}`);
            this.renderNotas(r.data.notas);
            document.getElementById('m-notas-n').textContent = r.data.notas.length ? `(${r.data.notas.length})` : '';
        } catch { Swal.fire('Error', 'No se pudo agregar la nota.', 'error'); }
    },

    async correoIndividual() {
        const { value: form } = await Swal.fire({
            title: 'Enviar correo al cliente', width: 480,
            html: `<div style="text-align:left;font-size:.85rem">
                <label style="font-weight:700;color:#718096;font-size:.7rem;text-transform:uppercase">Tipo</label>
                <select id="s-tipo" class="swal2-input" style="margin-top:4px">
                  <option value="OFERTA">✨ Oferta especial</option>
                  <option value="CUMPLEANOS">🎂 Cumpleaños</option>
                  <option value="BIENVENIDA">🔁 Gracias / vuelve pronto</option>
                  <option value="PERSONALIZADO">✉️ Personalizado</option>
                </select>
                <label style="font-weight:700;color:#718096;font-size:.7rem;text-transform:uppercase">Descuento % (opcional)</label>
                <input id="s-desc" type="number" min="1" max="99" class="swal2-input" style="margin-top:4px">
                <label style="font-weight:700;color:#718096;font-size:.7rem;text-transform:uppercase">Mensaje adicional</label>
                <textarea id="s-msg" class="swal2-textarea" style="margin-top:4px" placeholder="Texto libre…"></textarea>
              </div>`,
            showCancelButton: true, confirmButtonText: 'Enviar',
            preConfirm: () => ({
                tipo: document.getElementById('s-tipo').value,
                descuento: document.getElementById('s-desc').value || null,
                mensajeExtra: document.getElementById('s-msg').value.trim() || null
            })
        });
        if (!form) return;
        try {
            const r = await api.post(`/crm/clientes/${_cli}/email`, { ...form, sedeId: sede() });
            Swal.fire({ icon: 'success', title: 'Correo enviado', text: r.data.message, timer: 2200, showConfirmButton: false });
            const pr = await api.get(`/crm/clientes/${_cli}`);
            this.renderNotas(pr.data.notas);
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo enviar.', 'error'); }
    },

    cerrarModal(e) {
        if (!e || e.target === document.getElementById('crm-overlay')) {
            document.getElementById('crm-overlay').style.display = 'none'; _cli = null;
        }
    },

    // ── CUMPLEAÑOS ───────────────────────────────────────────────────
    async cargarCumpleanos() {
        const el = document.getElementById('crm-cumple');
        el.innerHTML = '<div class="omni-empty">Cargando…</div>';
        try {
            const r = await api.get('/crm/cumpleanos');
            const lista = r.data || [];
            el.innerHTML = lista.length ? lista.map(c => {
                const hoy = c.DiasRestantes === 0;
                const f = c.FechaNacimiento ? new Date(c.FechaNacimiento).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', timeZone: 'UTC' }) : '';
                return `<div class="crm-cumple" onclick="CRM.abrirPerfil(${c.ClienteID})">
                    <div class="d"><b>${hoy ? '🎂' : c.DiasRestantes}</b><span>${hoy ? 'hoy' : 'días'}</span></div>
                    <div><h4>${esc(c.NombreFull)}</h4><p>${esc(c.Documento || '')} · ${f}${c.Telefono ? ' · ' + esc(c.Telefono) : ''}</p>
                    ${c.Correo ? `<p style="color:#2f7be6">${esc(c.Correo)}</p>` : ''}</div></div>`;
            }).join('') : '<div class="omni-empty"><i class="fas fa-circle-check" style="color:#1e8e4e"></i> Sin cumpleaños en los próximos 30 días.</div>';
        } catch { el.innerHTML = '<div class="omni-empty">Error al cargar.</div>'; }
    },

    // ── CAMPAÑAS ─────────────────────────────────────────────────────
    async cargarCampanas() {
        const el = document.getElementById('crm-campanas');
        try {
            const s = sede();
            const r = await api.get(`/crm/campanas${s ? '?sedeId=' + s : ''}`);
            const lista = r.data.campanas || [];
            el.innerHTML = lista.length ? lista.map(c => this._campHtml(c)).join('')
                : '<div class="omni-empty">Aún no has lanzado campañas.</div>';
            const activa = lista.some(c => c.Estado === 'EN_PROCESO');
            if (activa && !_pollTmr) _pollTmr = setInterval(() => this.cargarCampanas(), 4000);
            if (!activa && _pollTmr) { clearInterval(_pollTmr); _pollTmr = null; }
        } catch { el.innerHTML = '<div class="omni-empty">Error al cargar.</div>'; }
    },

    _campHtml(c) {
        const done = c.Enviados + c.Fallidos;
        const pct = c.TotalDestinatarios ? Math.round((done / c.TotalDestinatarios) * 100) : 0;
        return `<div class="crm-camp">
            <div class="crm-camp-h">
                <div><b>${esc(c.Nombre)}</b> <span class="crm-est e-${c.Estado}">${c.Estado.replace('_', ' ')}</span>
                    <div class="meta">${esc(c.Tipo)} · por ${esc(c.NombreUsuario || '—')} · ${new Date(c.FechaInicio).toLocaleString('es-EC')} · pausa ${c.DelaySegundos}s</div></div>
                ${c.Estado === 'EN_PROCESO' ? `<button class="omni-btn omni-btn-ghost" style="padding:6px 12px" onclick="CRM.cancelarCampana(${c.CampanaID})"><i class="fas fa-stop"></i> Detener</button>` : ''}
            </div>
            <div class="crm-bar"><i style="width:${pct}%"></i></div>
            <div class="crm-camp-stats">
                <span><b>${done}</b> / ${c.TotalDestinatarios} procesados</span>
                <span style="color:#1e8e4e"><b>${c.Enviados}</b> enviados</span>
                <span style="color:#c0392b"><b>${c.Fallidos}</b> fallidos</span>
                ${c.Omitidos ? `<span><b>${c.Omitidos}</b> omitidos</span>` : ''}
            </div>
        </div>`;
    },

    async cancelarCampana(id) {
        const r = await Swal.fire({ title: 'Detener campaña', text: 'No se enviarán los correos restantes.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Detener' });
        if (!r.isConfirmed) return;
        try { await api.post(`/crm/campanas/${id}/cancelar`); this.cargarCampanas(); }
        catch { Swal.fire('Error', 'No se pudo detener.', 'error'); }
    },

    // ── WIZARD DE CAMPAÑA ────────────────────────────────────────────
    abrirCampana(desdeSeleccion) {
        document.getElementById('camp-overlay').style.display = 'flex';
        document.getElementById('c-nombre').value = '';
        document.getElementById('c-asunto').value = '';
        document.getElementById('c-desc').value = '';
        document.getElementById('c-msg').value = '';
        document.getElementById('c-tipo').value = 'OFERTA';
        document.getElementById('c-delay').value = '6';
        document.getElementById('cdest-sel-n').textContent = this._sel.size;
        const radio = document.querySelector(`input[name="cdest"][value="${desdeSeleccion && this._sel.size ? 'seleccion' : 'todos'}"]`);
        if (radio) radio.checked = true;
        this._toggleClasifBox();
        this.preview();
        document.querySelectorAll('input[name="cdest"]').forEach(r => r.onchange = () => { this._toggleClasifBox(); this.preview(); });
    },
    _toggleClasifBox() {
        const v = document.querySelector('input[name="cdest"]:checked')?.value;
        document.getElementById('cdest-clasif').hidden = v !== 'clasif';
    },
    cerrarCampana(e) {
        if (!e || e.target === document.getElementById('camp-overlay'))
            document.getElementById('camp-overlay').style.display = 'none';
    },

    _filtro() {
        const v = document.querySelector('input[name="cdest"]:checked')?.value || 'todos';
        const f = {};
        if (v === 'clasif') {
            f.clasificaciones = [...document.querySelectorAll('#cdest-clasif input:checked')].map(x => x.value);
        } else if (v === 'cumple') {
            f.cumpleanosDias = parseInt(document.getElementById('cdest-dias').value) || 7;
        } else if (v === 'seleccion') {
            f.clienteIds = [...this._sel];
        }
        return f;
    },

    async preview() {
        const el = document.getElementById('crm-preview');
        el.textContent = 'Calculando destinatarios…';
        try {
            const r = await api.post('/crm/campanas/preview', { sedeId: sede(), filtro: this._filtro() });
            const d = r.data;
            let txt = `≈ ${d.total} destinatario(s) con correo y consentimiento`;
            if (d.total > d.capados) txt += ` · se enviará a ${d.capados} (tope por campaña)`;
            if (d.muestra && d.muestra.length) txt += `\nEj: ${d.muestra.slice(0, 3).map(m => m.Correo).join(', ')}…`;
            el.textContent = txt;
        } catch (e) {
            el.textContent = 'No se pudo calcular: ' + (e.response?.data?.error || e.message);
        }
    },

    async lanzarCampana() {
        const tipo = document.getElementById('c-tipo').value;
        const filtro = this._filtro();
        const btn = document.getElementById('c-enviar');
        btn.disabled = true;
        try {
            const r = await api.post('/crm/campanas', {
                sedeId: sede(),
                nombre: document.getElementById('c-nombre').value.trim() || null,
                tipo,
                asunto: document.getElementById('c-asunto').value.trim() || null,
                descuento: document.getElementById('c-desc').value || null,
                mensajeExtra: document.getElementById('c-msg').value.trim() || null,
                delaySegundos: parseInt(document.getElementById('c-delay').value) || 6,
                filtro
            });
            const d = r.data;
            this.cerrarCampana();
            Swal.fire({
                icon: 'success', title: 'Campaña lanzada',
                text: `${d.totalDestinatarios} correos en cola` + (d.recortada ? ` (${d.recortada} quedaron fuera por el tope)` : '') + `. Se envían con ${d.delaySegundos}s de pausa entre cada uno.`,
                timer: 4000, showConfirmButton: false
            });
            this.tab('campanas');
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo lanzar la campaña.', 'error');
        } finally { btn.disabled = false; }
    },

    destroy() {
        if (_pollTmr) { clearInterval(_pollTmr); _pollTmr = null; }
        if (_tmr) { clearTimeout(_tmr); _tmr = null; }
    }
};

module.exports = CRM;
