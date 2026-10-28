const api = require('./api');

const RecurrenteModule = {

    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    esAdmin() { return App.puede('recurrente', 'TOTAL'); },   // catálogo de ítems
    money(n) { return '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },

    async init() {
        window.RecurrenteModule = this;
        window.backView = 'dashboard';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = this.esAdmin() ? '' : 'none');
        await this.cargarResumen();
        this.tab('subs');
    },

    tab(name) {
        ['subs', 'items'].forEach(t => document.getElementById('rc-' + t).style.display = t === name ? '' : 'none');
        document.querySelectorAll('.rc-tab').forEach(b => b.classList.toggle('rc-active', b.dataset.tab === name));
        if (name === 'subs') this.cargarSubs();
        if (name === 'items') this.cargarItems();
    },

    async cargarResumen() {
        try {
            const r = await api.get(`/recurrente/resumen?sedeId=${this.getSede()}`);
            const d = r.data;
            document.getElementById('rc-activas').textContent  = d.activas;
            document.getElementById('rc-mrr').textContent      = this.money(d.mrr);
            document.getElementById('rc-hoy').textContent      = d.porFacturarHoy;
            document.getElementById('rc-cobrar').textContent   = this.money(d.porCobrar);
            document.getElementById('rc-diferido').textContent = this.money(d.saldoDiferido);
        } catch (_) {}
    },

    // ── SUSCRIPCIONES ────────────────────────────────────────────────
    async cargarSubs() {
        const body = document.getElementById('rc-sub-body');
        body.innerHTML = '<tr><td colspan="7" class="omni-empty">Cargando...</td></tr>';
        const estado = document.getElementById('rc-sub-estado').value;
        try {
            const r = await api.get(`/recurrente/suscripciones?sedeId=${this.getSede()}${estado ? '&estado=' + estado : ''}`);
            const lista = r.data.suscripciones || [];
            document.getElementById('rc-sub-count').textContent = `${lista.length} suscripciones`;
            const pill = { ACTIVA: 'on', PAUSADA: 'pa', CANCELADA: 'of' };
            body.innerHTML = lista.length ? lista.map(s => {
                const venc = new Date(s.ProximaFacturacion) <= new Date();
                return `
                <tr>
                    <td><b>${s.Descripcion}</b>${s.ReconoceDiferido ? ' <span class="rc-pill di">diferido</span>' : ''}
                        ${s.ItemNombre ? `<br><span class="omni-sub">${s.ItemNombre}</span>` : ''}</td>
                    <td style="font-size:.82rem">${s.ClienteNombre || '—'}</td>
                    <td><b>${this.money(s.MontoPeriodo)}</b>${s.GravaIVA ? '<br><span class="omni-sub">+ IVA</span>' : ''}</td>
                    <td style="font-size:.8rem">${s.Periodicidad}</td>
                    <td style="font-size:.8rem;${venc && s.Estado === 'ACTIVA' ? 'color:#d35400;font-weight:800' : ''}">${String(s.ProximaFacturacion).slice(0, 10)}</td>
                    <td><span class="rc-pill ${pill[s.Estado] || 'of'}">${s.Estado}</span></td>
                    <td>
                        ${s.Estado === 'ACTIVA' ? `<button class="omni-btn" style="padding:5px 9px" onclick="RecurrenteModule.facturarAhora(${s.SuscripcionID})"><i class="fas fa-file-invoice-dollar"></i> Facturar</button>` : ''}
                        <button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="RecurrenteModule.verSuscripcion(${s.SuscripcionID})"><i class="fas fa-list"></i></button>
                        ${s.Estado !== 'CANCELADA' ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="RecurrenteModule.cambiarEstado(${s.SuscripcionID}, '${s.Estado}')"><i class="fas fa-sliders"></i></button>` : ''}
                    </td>
                </tr>`;
            }).join('') : '<tr><td colspan="7" class="omni-empty">Sin suscripciones. Crea la primera.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="7" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async nuevaSuscripcion() {
        let items = [];
        try { items = (await api.get(`/recurrente/items?sedeId=${this.getSede()}&tipo=SUSCRIPCION`)).data.items || []; } catch (_) {}
        const optItems = '<option value="">— sin ítem del catálogo —</option>' +
            items.map(i => `<option value="${i.ItemID}" data-precio="${i.PrecioBase}" data-iva="${i.GravaIVA ? 1 : 0}" data-per="${i.Periodicidad || 'MENSUAL'}">${i.Codigo} · ${i.Nombre}</option>`).join('');
        const hoy = new Date().toISOString().slice(0, 10);
        const { value: v } = await Swal.fire({
            title: 'Nueva suscripción',
            width: 560,
            html: `
              <div style="text-align:left;font-size:.85rem">
                <label>Ítem del catálogo</label>
                <select id="r-item" class="swal2-input" onchange="(function(s){var o=s.options[s.selectedIndex];if(o.dataset.precio){document.getElementById('r-monto').value=o.dataset.precio;document.getElementById('r-per').value=o.dataset.per;document.getElementById('r-iva').checked=o.dataset.iva==='1';}})(this)">${optItems}</select>
                <label>Descripción *</label>
                <input id="r-desc" class="swal2-input" placeholder="Ej: Plan Pro — Cliente X">
                <label>Cliente (nombre)</label>
                <input id="r-cli" class="swal2-input" placeholder="Nombre del cliente">
                <label>Monto por período *</label>
                <input id="r-monto" type="number" step="0.01" class="swal2-input" placeholder="0.00">
                <label>Periodicidad</label>
                <select id="r-per" class="swal2-input"><option value="MENSUAL">Mensual</option><option value="TRIMESTRAL">Trimestral</option><option value="ANUAL">Anual</option></select>
                <label>Inicio / próxima facturación *</label>
                <input id="r-ini" type="date" class="swal2-input" value="${hoy}">
                <label style="display:block;margin-top:6px"><input type="checkbox" id="r-iva" checked> Grava IVA</label>
                <label style="display:block"><input type="checkbox" id="r-dif"> Cobro por adelantado con ingreso diferido (devengo mensual)</label>
              </div>`,
            showCancelButton: true, confirmButtonText: 'Crear',
            preConfirm: () => {
                const desc = document.getElementById('r-desc').value.trim();
                const monto = parseFloat(document.getElementById('r-monto').value);
                const ini = document.getElementById('r-ini').value;
                if (!desc || !monto || !ini) { Swal.showValidationMessage('Descripción, monto y fecha son obligatorios'); return false; }
                return {
                    ItemID: document.getElementById('r-item').value || null,
                    Descripcion: desc,
                    ClienteNombre: document.getElementById('r-cli').value.trim() || null,
                    MontoPeriodo: monto,
                    Periodicidad: document.getElementById('r-per').value,
                    FechaInicio: ini, ProximaFacturacion: ini,
                    GravaIVA: document.getElementById('r-iva').checked,
                    ReconoceDiferido: document.getElementById('r-dif').checked
                };
            }
        });
        if (!v) return;
        try {
            await api.post('/recurrente/suscripciones', { ...v, SedeID: this.getSede() });
            window.Toast.fire({ icon: 'success', title: 'Suscripción creada' });
            this.cargarSubs(); this.cargarResumen();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear', 'error'); }
    },

    async facturarAhora(id) {
        const r = await Swal.fire({
            title: 'Facturar período actual', icon: 'question',
            text: 'Se generará el ciclo, su asiento contable y la cuenta por cobrar.',
            showCancelButton: true, confirmButtonText: 'Facturar'
        });
        if (!r.isConfirmed) return;
        try {
            const g = await api.post(`/recurrente/suscripciones/${id}/generar-ciclo`, {});
            const cicloId = g.data.ciclo.CicloID;
            const f = await api.post(`/recurrente/ciclos/${cicloId}/facturar`, {});
            window.Toast.fire({ icon: 'success', title: f.data.diferido ? 'Facturado (ingreso diferido)' : 'Facturado' });
            this.cargarSubs(); this.cargarResumen();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo facturar', 'error'); }
    },

    async correrFacturacion() {
        const r = await Swal.fire({
            title: 'Facturar todas las vencidas', icon: 'warning',
            text: 'Genera y factura el ciclo de cada suscripción activa con fecha de facturación vencida.',
            showCancelButton: true, confirmButtonText: 'Ejecutar'
        });
        if (!r.isConfirmed) return;
        try {
            const res = await api.post(`/recurrente/correr-facturacion`, { SedeID: this.getSede() });
            const errs = (res.data.resultados || []).filter(x => x.error).length;
            Swal.fire('Listo', `${res.data.procesadas} suscripción(es) procesadas${errs ? `, ${errs} con error` : ''}.`, errs ? 'warning' : 'success');
            this.cargarSubs(); this.cargarResumen();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'Falló la corrida', 'error'); }
    },

    async cambiarEstado(id, actual) {
        const { value: nuevo } = await Swal.fire({
            title: 'Estado de la suscripción',
            input: 'select',
            inputValue: actual,
            inputOptions: { ACTIVA: 'Activa', PAUSADA: 'Pausada', CANCELADA: 'Cancelada' },
            showCancelButton: true, confirmButtonText: 'Guardar'
        });
        if (!nuevo || nuevo === actual) return;
        try {
            await api.put(`/recurrente/suscripciones/${id}`, { Estado: nuevo });
            window.Toast.fire({ icon: 'success', title: 'Actualizada' });
            this.cargarSubs(); this.cargarResumen();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo actualizar', 'error'); }
    },

    async verSuscripcion(id) {
        try {
            const r = await api.get(`/recurrente/suscripciones/${id}`);
            const s = r.data.suscripcion;
            const ciclos = r.data.ciclos || [];
            const filas = ciclos.length ? ciclos.map(c => `
                <tr>
                    <td>${String(c.PeriodoDesde).slice(0, 10)} → ${String(c.PeriodoHasta).slice(0, 10)}</td>
                    <td style="text-align:right">${this.money(c.Total)}</td>
                    <td>${c.Estado}${s.ReconoceDiferido ? ` (${c.MesesDevengados} dev.)` : ''}</td>
                    <td>${(c.Estado === 'FACTURADO' && s.ReconoceDiferido) ? `<button class="swal2-styled" style="padding:4px 8px;font-size:.75rem;margin:0" onclick="RecurrenteModule.devengar(${c.CicloID})">Devengar mes</button>` : ''}</td>
                </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#888">Sin ciclos generados.</td></tr>';
            Swal.fire({
                title: s.Descripcion, width: 640,
                html: `<div style="font-size:.82rem;text-align:left;margin-bottom:6px">
                        <b>Cliente:</b> ${s.ClienteNombre || '—'} · <b>${s.Periodicidad}</b> · ${this.money(s.MontoPeriodo)}${s.GravaIVA ? ' + IVA' : ''}
                        · <b>Estado:</b> ${s.Estado}${s.ReconoceDiferido ? ' · <b>ingreso diferido</b>' : ''}<br>
                        <b>Próxima facturación:</b> ${String(s.ProximaFacturacion).slice(0, 10)}
                       </div>
                       <table style="width:100%;font-size:.8rem;border-collapse:collapse">
                         <thead><tr><th style="text-align:left;border-bottom:1px solid #ccc">Período</th><th style="text-align:right;border-bottom:1px solid #ccc">Total</th><th style="border-bottom:1px solid #ccc">Estado</th><th></th></tr></thead>
                         <tbody>${filas}</tbody>
                       </table>`
            });
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar', 'error'); }
    },

    async devengar(cicloId) {
        try {
            const r = await api.post(`/recurrente/ciclos/${cicloId}/devengar`, {});
            window.Toast.fire({ icon: 'success', title: `Devengado ${r.data.mesesDevengados}/${r.data.de} (${this.money(r.data.monto)})` });
            Swal.close();
            this.cargarResumen();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo devengar', 'error'); }
    },

    // ── CATÁLOGO DE ÍTEMS ───────────────────────────────────────────
    async cargarItems() {
        const body = document.getElementById('rc-item-body');
        body.innerHTML = '<tr><td colspan="8" class="omni-empty">Cargando...</td></tr>';
        const tipo = document.getElementById('rc-item-tipo').value;
        try {
            const r = await api.get(`/recurrente/items?sedeId=${this.getSede()}&todos=1${tipo ? '&tipo=' + tipo : ''}`);
            const lista = r.data.items || [];
            this._itemsCache = {};
            lista.forEach(i => this._itemsCache[i.ItemID] = i);
            document.getElementById('rc-item-count').textContent = `${lista.length} ítems`;
            body.innerHTML = lista.length ? lista.map(i => `
                <tr>
                    <td><b>${i.Codigo}</b></td>
                    <td>${i.Nombre}</td>
                    <td>${i.Tipo}</td>
                    <td>${this.money(i.PrecioBase)}</td>
                    <td>${i.GravaIVA ? 'Sí' : 'No'}</td>
                    <td>${i.Periodicidad || '—'}</td>
                    <td><span class="rc-pill ${i.Activo ? 'on' : 'of'}">${i.Activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="admin-only"><button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="RecurrenteModule.editarItem(${i.ItemID})"><i class="fas fa-pen"></i></button></td>
                </tr>`).join('') : '<tr><td colspan="8" class="omni-empty">Sin ítems. Crea el primero.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="8" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async nuevoItem() {
        const { value: v } = await Swal.fire({
            title: 'Nuevo ítem', width: 520,
            html: `<div style="text-align:left;font-size:.85rem">
                <label>Código *</label><input id="i-cod" class="swal2-input" placeholder="Ej: PLAN-PRO">
                <label>Nombre *</label><input id="i-nom" class="swal2-input" placeholder="Ej: Plan Pro anual">
                <label>Tipo</label>
                <select id="i-tipo" class="swal2-input"><option value="SERVICIO">Servicio</option><option value="SUSCRIPCION">Suscripción</option><option value="BIEN">Bien</option></select>
                <label>Precio base</label><input id="i-precio" type="number" step="0.01" class="swal2-input" placeholder="0.00">
                <label>Periodicidad (solo suscripción)</label>
                <select id="i-per" class="swal2-input"><option value="MENSUAL">Mensual</option><option value="TRIMESTRAL">Trimestral</option><option value="ANUAL">Anual</option></select>
                <label style="display:block;margin-top:6px"><input type="checkbox" id="i-iva" checked> Grava IVA</label>
                <label style="display:block"><input type="checkbox" id="i-corp"> Corporativo (todas las empresas)</label>
              </div>`,
            showCancelButton: true, confirmButtonText: 'Crear',
            preConfirm: () => {
                const cod = document.getElementById('i-cod').value.trim();
                const nom = document.getElementById('i-nom').value.trim();
                if (!cod || !nom) { Swal.showValidationMessage('Código y nombre son obligatorios'); return false; }
                return {
                    Codigo: cod, Nombre: nom, Tipo: document.getElementById('i-tipo').value,
                    PrecioBase: parseFloat(document.getElementById('i-precio').value) || 0,
                    Periodicidad: document.getElementById('i-per').value,
                    GravaIVA: document.getElementById('i-iva').checked,
                    corporativo: document.getElementById('i-corp').checked
                };
            }
        });
        if (!v) return;
        try {
            await api.post('/recurrente/items', { ...v, SedeID: this.getSede() });
            window.Toast.fire({ icon: 'success', title: 'Ítem creado' });
            this.cargarItems();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear', 'error'); }
    },

    async editarItem(id) {
        const d = (this._itemsCache && this._itemsCache[id]) || {};
        const { value: v } = await Swal.fire({
            title: 'Editar ítem', width: 460,
            html: `<div style="text-align:left;font-size:.85rem">
                <label>Nombre</label><input id="i-nom" class="swal2-input" value="${(d.Nombre || '').replace(/"/g, '&quot;')}">
                <label>Precio base</label><input id="i-precio" type="number" step="0.01" class="swal2-input" value="${d.PrecioBase || 0}">
                <label style="display:block;margin-top:6px"><input type="checkbox" id="i-iva" ${d.GravaIVA ? 'checked' : ''}> Grava IVA</label>
                <label style="display:block"><input type="checkbox" id="i-act" ${d.Activo ? 'checked' : ''}> Activo</label>
              </div>`,
            showCancelButton: true, confirmButtonText: 'Guardar',
            preConfirm: () => ({
                Nombre: document.getElementById('i-nom').value.trim(),
                PrecioBase: parseFloat(document.getElementById('i-precio').value) || 0,
                GravaIVA: document.getElementById('i-iva').checked,
                Activo: document.getElementById('i-act').checked
            })
        });
        if (!v) return;
        try {
            await api.put(`/recurrente/items/${id}`, v);
            window.Toast.fire({ icon: 'success', title: 'Actualizado' });
            this.cargarItems();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar', 'error'); }
    }
};

module.exports = RecurrenteModule;
