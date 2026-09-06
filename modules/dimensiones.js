const api = require('./api');

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const DimensionesModule = {

    getSede() { return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1; },
    esAdmin() { return App.user && parseInt(App.user.RolID) === 1; },

    async init() {
        window.DimensionesModule = this;
        window.backView = 'dashboard';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = this.esAdmin() ? '' : 'none');
        document.getElementById('dm-anio').value = new Date().getFullYear();
        this.tab('centros');
    },

    tab(name) {
        ['centros', 'proyectos', 'periodos', 'presupuestos'].forEach(t => {
            document.getElementById('dm-' + t).style.display = t === name ? '' : 'none';
        });
        document.querySelectorAll('.dm-tab').forEach(b => b.classList.toggle('dm-active', b.dataset.tab === name));
        if (name === 'centros') this.cargarCentros();
        if (name === 'proyectos') this.cargarProyectos();
        if (name === 'periodos') this.cargarPeriodos();
        if (name === 'presupuestos') {
            const a = document.getElementById('dm-pp-anio');
            if (a && !a.value) a.value = new Date().getFullYear();
            const ms = document.getElementById('dm-pp-mes');
            if (ms && ms.options.length < 2) MESES.forEach((m, i) => { if (i) ms.insertAdjacentHTML('beforeend', `<option value="${i}">${m}</option>`); });
            this.cargarPresupuestos();
        }
    },

    _money(n) { return '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 }); },

    async cargarPresupuestos() {
        const body = document.getElementById('dm-pp-body');
        body.innerHTML = '<tr><td colspan="7" class="omni-empty">Cargando…</td></tr>';
        const anio = parseInt(document.getElementById('dm-pp-anio').value) || new Date().getFullYear();
        const mes = document.getElementById('dm-pp-mes').value;
        try {
            const r = await api.get(`/contabilidad/presupuestos/ejecucion?sedeId=${this.getSede()}&anio=${anio}${mes ? '&mes=' + mes : ''}`);
            const filas = r.data.filas || [];
            body.innerHTML = filas.length ? filas.map(f => {
                const col = f.Variacion >= 0 ? '#166534' : '#991b1b';
                return `<tr>
                    <td>${f.Concepto}</td>
                    <td>${f.Periodo}</td>
                    <td class="num">${this._money(f.Presupuesto)}</td>
                    <td class="num">${this._money(f.Real)}</td>
                    <td class="num" style="color:${col};font-weight:800">${this._money(f.Variacion)}</td>
                    <td>${f.Cumplimiento}%</td>
                    <td class="admin-only"><button class="omni-btn omni-btn-ghost" style="padding:4px 8px" onclick="DimensionesModule.borrarPresupuesto(${f.PresupuestoID})"><i class="fas fa-trash"></i></button></td>
                </tr>`;
            }).join('') : '<tr><td colspan="7" class="omni-empty">Sin líneas de presupuesto para este año.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="7" class="omni-empty">${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async nuevoPresupuesto() {
        // cuentas de resultado
        let cuentas = [];
        try { cuentas = (await api.get(`/contabilidad/plan?sedeId=${this.getSede()}&soloMovimiento=1`)).data.cuentas || []; } catch (_) {}
        cuentas = cuentas.filter(c => ['INGRESO', 'GASTO'].includes(c.Tipo));
        const opts = '<option value="">— cuenta de resultado —</option>' + cuentas.map(c => `<option value="${c.CuentaID}">${c.Codigo} · ${c.Nombre}</option>`).join('');
        const { value: v } = await Swal.fire({
            title: 'Nueva línea de presupuesto', width: 480,
            html: `<div style="text-align:left;font-size:.85rem">
                <label>Año</label><input id="p-anio" type="number" class="swal2-input" value="${document.getElementById('dm-pp-anio').value || new Date().getFullYear()}">
                <label>Mes (vacío = todo el año)</label>
                <select id="p-mes" class="swal2-input"><option value="">Todo el año</option>${MESES.map((m, i) => i ? `<option value="${i}">${m}</option>` : '').join('')}</select>
                <label>Cuenta</label><select id="p-cta" class="swal2-input">${opts}</select>
                <label>Monto presupuestado</label><input id="p-monto" type="number" step="0.01" class="swal2-input">
                <label>Nota</label><input id="p-nota" class="swal2-input" placeholder="opcional">
              </div>`,
            showCancelButton: true, confirmButtonText: 'Guardar',
            preConfirm: () => {
                const monto = parseFloat(document.getElementById('p-monto').value);
                if (!monto) { Swal.showValidationMessage('Indica el monto'); return false; }
                return {
                    Anio: parseInt(document.getElementById('p-anio').value),
                    Mes: document.getElementById('p-mes').value || null,
                    CuentaID: document.getElementById('p-cta').value || null,
                    Monto: monto, Nota: document.getElementById('p-nota').value.trim() || null
                };
            }
        });
        if (!v) return;
        try {
            await api.post('/contabilidad/presupuestos', v);
            window.Toast.fire({ icon: 'success', title: 'Línea creada' });
            this.cargarPresupuestos();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear', 'error'); }
    },

    async borrarPresupuesto(id) {
        const r = await Swal.fire({ title: '¿Borrar línea?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Borrar' });
        if (!r.isConfirmed) return;
        try { await api.delete(`/contabilidad/presupuestos/${id}`); this.cargarPresupuestos(); }
        catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo borrar', 'error'); }
    },

    // ── CENTROS DE COSTO ──────────────────────────────────────────────
    async cargarCentros() {
        const body = document.getElementById('dm-cc-body');
        body.innerHTML = '<tr><td colspan="5" class="omni-empty">Cargando...</td></tr>';
        try {
            const r = await api.get(`/contabilidad/centros-costo?sedeId=${this.getSede()}&todos=1`);
            const lista = r.data.centros || [];
            document.getElementById('dm-cc-count').textContent = `${lista.length} centros`;
            body.innerHTML = lista.length ? lista.map(c => `
                <tr>
                    <td><b>${c.Codigo}</b></td>
                    <td>${c.Nombre}</td>
                    <td>${c.SedeID ? '<span class="dm-pill">Empresa</span>' : '<span class="dm-pill corp">Corporativo</span>'}</td>
                    <td><span class="dm-pill ${c.Activo ? 'on' : 'off'}">${c.Activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td class="admin-only">
                        <button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="DimensionesModule.editarCentro(${c.CentroCostoID}, '${encodeURIComponent(c.Nombre)}', ${c.Activo ? 1 : 0})"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>`).join('') : '<tr><td colspan="5" class="omni-empty">Sin centros de costo. Crea el primero.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="5" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async nuevoCentro() {
        const { value: v } = await Swal.fire({
            title: 'Nuevo centro de costo',
            html: `<input id="s1" class="swal2-input" placeholder="Código (ej: CC-VENTAS)">
                   <input id="s2" class="swal2-input" placeholder="Nombre">
                   <label style="display:block;font-size:.8rem;margin-top:8px"><input type="checkbox" id="s3"> Corporativo (todas las empresas)</label>`,
            showCancelButton: true, confirmButtonText: 'Crear',
            preConfirm: () => {
                const cod = document.getElementById('s1').value.trim();
                const nom = document.getElementById('s2').value.trim();
                if (!cod || !nom) { Swal.showValidationMessage('Código y nombre son obligatorios'); return false; }
                return { Codigo: cod, Nombre: nom, corporativo: document.getElementById('s3').checked };
            }
        });
        if (!v) return;
        try {
            await api.post('/contabilidad/centros-costo', v);
            window.Toast.fire({ icon: 'success', title: 'Centro creado' });
            this.cargarCentros();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear', 'error'); }
    },

    async editarCentro(id, nombreEnc, activo) {
        const { value: v } = await Swal.fire({
            title: 'Editar centro de costo',
            html: `<input id="s2" class="swal2-input" value="${decodeURIComponent(nombreEnc)}" placeholder="Nombre">
                   <label style="display:block;font-size:.8rem;margin-top:8px"><input type="checkbox" id="s3" ${activo ? 'checked' : ''}> Activo</label>`,
            showCancelButton: true, confirmButtonText: 'Guardar',
            preConfirm: () => ({ Nombre: document.getElementById('s2').value.trim(), Activo: document.getElementById('s3').checked })
        });
        if (!v) return;
        try {
            await api.put(`/contabilidad/centros-costo/${id}`, v);
            window.Toast.fire({ icon: 'success', title: 'Actualizado' });
            this.cargarCentros();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar', 'error'); }
    },

    // ── PROYECTOS ─────────────────────────────────────────────────────
    async cargarProyectos() {
        const body = document.getElementById('dm-pr-body');
        body.innerHTML = '<tr><td colspan="5" class="omni-empty">Cargando...</td></tr>';
        try {
            const r = await api.get(`/contabilidad/proyectos?sedeId=${this.getSede()}&todos=1`);
            const lista = r.data.proyectos || [];
            document.getElementById('dm-pr-count').textContent = `${lista.length} proyectos`;
            const f = d => d ? String(d).slice(0, 10) : '—';
            body.innerHTML = lista.length ? lista.map(p => `
                <tr>
                    <td><b>${p.Codigo}</b></td>
                    <td>${p.Nombre}</td>
                    <td style="font-size:.78rem">${f(p.FechaInicio)} → ${f(p.FechaFin)}</td>
                    <td><span class="dm-pill ${p.Estado === 'ACTIVO' ? 'on' : 'off'}">${p.Estado}</span></td>
                    <td class="admin-only">
                        <button class="omni-btn omni-btn-ghost" style="padding:5px 9px" onclick="DimensionesModule.editarProyecto(${p.ProyectoID}, '${encodeURIComponent(p.Nombre)}', '${p.Estado}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>`).join('') : '<tr><td colspan="5" class="omni-empty">Sin proyectos. Crea el primero.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="5" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async nuevoProyecto() {
        const { value: v } = await Swal.fire({
            title: 'Nuevo proyecto',
            html: `<input id="s1" class="swal2-input" placeholder="Código (ej: PRY-2026-01)">
                   <input id="s2" class="swal2-input" placeholder="Nombre">
                   <label style="display:block;font-size:.72rem;color:#718096;margin:6px 0 0">Inicio</label>
                   <input id="s3" type="date" class="swal2-input">
                   <label style="display:block;font-size:.72rem;color:#718096;margin:6px 0 0">Fin (opcional)</label>
                   <input id="s4" type="date" class="swal2-input">
                   <label style="display:block;font-size:.8rem;margin-top:8px"><input type="checkbox" id="s5"> Corporativo</label>`,
            showCancelButton: true, confirmButtonText: 'Crear',
            preConfirm: () => {
                const cod = document.getElementById('s1').value.trim();
                const nom = document.getElementById('s2').value.trim();
                if (!cod || !nom) { Swal.showValidationMessage('Código y nombre son obligatorios'); return false; }
                return {
                    Codigo: cod, Nombre: nom,
                    FechaInicio: document.getElementById('s3').value || null,
                    FechaFin: document.getElementById('s4').value || null,
                    corporativo: document.getElementById('s5').checked
                };
            }
        });
        if (!v) return;
        try {
            await api.post('/contabilidad/proyectos', v);
            window.Toast.fire({ icon: 'success', title: 'Proyecto creado' });
            this.cargarProyectos();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo crear', 'error'); }
    },

    async editarProyecto(id, nombreEnc, estado) {
        const { value: v } = await Swal.fire({
            title: 'Editar proyecto',
            html: `<input id="s2" class="swal2-input" value="${decodeURIComponent(nombreEnc)}" placeholder="Nombre">
                   <select id="s3" class="swal2-input">
                     <option value="ACTIVO" ${estado === 'ACTIVO' ? 'selected' : ''}>ACTIVO</option>
                     <option value="CERRADO" ${estado === 'CERRADO' ? 'selected' : ''}>CERRADO</option>
                   </select>`,
            showCancelButton: true, confirmButtonText: 'Guardar',
            preConfirm: () => ({ Nombre: document.getElementById('s2').value.trim(), Estado: document.getElementById('s3').value })
        });
        if (!v) return;
        try {
            await api.put(`/contabilidad/proyectos/${id}`, v);
            window.Toast.fire({ icon: 'success', title: 'Actualizado' });
            this.cargarProyectos();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar', 'error'); }
    },

    // ── PERÍODOS CONTABLES ────────────────────────────────────────────
    async cargarPeriodos() {
        const body = document.getElementById('dm-pe-body');
        const anio = parseInt(document.getElementById('dm-anio').value) || new Date().getFullYear();
        body.innerHTML = '<tr><td colspan="5" class="omni-empty">Cargando...</td></tr>';
        try {
            const r = await api.get(`/contabilidad/periodos?sedeId=${this.getSede()}&anio=${anio}`);
            const map = {};
            (r.data.periodos || []).forEach(p => map[p.Mes] = p);
            let rows = '';
            for (let m = 1; m <= 12; m++) {
                const p = map[m];
                const cerrado = p && String(p.Estado).toUpperCase() === 'CERRADO';
                rows += `
                <tr>
                    <td><b>${MESES[m]}</b></td>
                    <td><span class="dm-pill ${cerrado ? 'off' : 'on'}">${cerrado ? 'Cerrado' : 'Abierto'}</span></td>
                    <td style="font-size:.8rem">${p?.NombreUsuario || '—'}${p?.Observacion ? `<br><span class="omni-sub">${p.Observacion}</span>` : ''}</td>
                    <td style="font-size:.8rem">${p?.FechaCierre ? new Date(p.FechaCierre).toLocaleString('es-EC') : '—'}</td>
                    <td class="admin-only">
                        ${cerrado
                            ? `<button class="omni-btn omni-btn-ghost" style="padding:5px 10px" onclick="DimensionesModule.reabrir(${anio},${m})"><i class="fas fa-lock-open"></i> Reabrir</button>`
                            : `<button class="omni-btn" style="padding:5px 10px" onclick="DimensionesModule.cerrar(${anio},${m})"><i class="fas fa-lock"></i> Cerrar</button>`}
                    </td>
                </tr>`;
            }
            body.innerHTML = rows;
        } catch (e) {
            body.innerHTML = `<tr><td colspan="5" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async cerrar(anio, mes) {
        const { value: obs, isConfirmed } = await Swal.fire({
            title: `Cerrar ${MESES[mes]} ${anio}`,
            input: 'text', inputPlaceholder: 'Observación (opcional)',
            icon: 'warning',
            html: '<p style="font-size:.85rem;color:#4a5568">No se podrán crear ni anular asientos con fecha en este mes hasta reabrirlo.</p>',
            showCancelButton: true, confirmButtonText: 'Cerrar período', cancelButtonText: 'Cancelar'
        });
        if (!isConfirmed) return;
        try {
            await api.post('/contabilidad/periodos/cerrar', { SedeID: this.getSede(), Anio: anio, Mes: mes, Observacion: obs || null });
            window.Toast.fire({ icon: 'success', title: 'Período cerrado' });
            this.cargarPeriodos();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cerrar', 'error'); }
    },

    async cerrarEjercicio() {
        const anio = parseInt(document.getElementById('dm-anio').value) || new Date().getFullYear();
        let prev;
        try {
            prev = (await api.get(`/contabilidad/cierre-ejercicio/preview?sedeId=${this.getSede()}&anio=${anio}`)).data;
        } catch (e) { return Swal.fire('Error', e.response?.data?.error || 'No se pudo calcular', 'error'); }
        const m = n => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 });
        const r = await Swal.fire({
            title: `Cerrar ejercicio ${anio}`, icon: 'warning', width: 520,
            html: `<div style="text-align:left;font-size:.88rem">
                Se generará el asiento de cierre (Ingresos y Gastos a cero contra Utilidad/Pérdida) y se
                <b>cerrarán los 12 meses</b> de ${anio}.<br><br>
                <b>Ingresos:</b> ${m(prev.totalIngresos)}<br>
                <b>Gastos:</b> ${m(prev.totalGastos)}<br>
                <b>Resultado:</b> <span style="color:${prev.utilidad >= 0 ? '#166534' : '#991b1b'};font-weight:800">${m(prev.utilidad)} ${prev.utilidad >= 0 ? '(utilidad)' : '(pérdida)'}</span><br>
                <span class="omni-sub">${(prev.cuentas || []).length} cuentas de resultado se saldarán.</span>
            </div>`,
            showCancelButton: true, confirmButtonText: 'Cerrar ejercicio', cancelButtonText: 'Cancelar'
        });
        if (!r.isConfirmed) return;
        try {
            const res = await api.post('/contabilidad/cierre-ejercicio', { SedeID: this.getSede(), Anio: anio });
            Swal.fire('Ejercicio cerrado', `Asiento de cierre #${res.data.numero}. Resultado ${m(res.data.utilidad)}.`, 'success');
            this.cargarPeriodos();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cerrar', 'error'); }
    },

    async reabrir(anio, mes) {
        const r = await Swal.fire({
            title: `Reabrir ${MESES[mes]} ${anio}`, icon: 'question',
            text: 'Se permitirá volver a registrar y anular asientos en este mes.',
            showCancelButton: true, confirmButtonText: 'Reabrir', cancelButtonText: 'Cancelar'
        });
        if (!r.isConfirmed) return;
        try {
            await api.post('/contabilidad/periodos/reabrir', { SedeID: this.getSede(), Anio: anio, Mes: mes });
            window.Toast.fire({ icon: 'success', title: 'Período reabierto' });
            this.cargarPeriodos();
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo reabrir', 'error'); }
    }
};

module.exports = DimensionesModule;
