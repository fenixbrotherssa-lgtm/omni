const api = require('./api');

const PlancuentasModule = {
    cuentas: [],

    getSede() {
        return localStorage.getItem('currentSedeId') || (App.user && App.user.SedeID) || 1;
    },
    esAdmin() { return App.puede('plancuentas', 'EDITAR'); },

    async init() {
        window.PlancuentasModule = this;
        window.backView = 'dashboard';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = this.esAdmin() ? '' : 'none');
        document.getElementById('pc-buscar').oninput = () => this.render();
        document.getElementById('pc-tipo').onchange = () => this.render();
        document.getElementById('pc-inactivas').onchange = () => this.cargar();
        await this.cargar();
    },

    async cargar() {
        const inactivas = document.getElementById('pc-inactivas').checked ? '1' : '0';
        try {
            const res = await api.get(`/contabilidad/plan?sedeId=${this.getSede()}&incluirInactivas=${inactivas}`);
            this.cuentas = res.data.cuentas || [];
            this.render();
        } catch (e) {
            document.getElementById('pc-body').innerHTML = `<tr><td colspan="8" class="omni-empty">Error: ${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    render() {
        const q = (document.getElementById('pc-buscar').value || '').toLowerCase();
        const tipo = document.getElementById('pc-tipo').value;
        const rows = this.cuentas.filter(c =>
            (tipo === 'TODOS' || c.Tipo === tipo) &&
            (!q || c.Codigo.toLowerCase().includes(q) || c.Nombre.toLowerCase().includes(q))
        );
        document.getElementById('pc-count').textContent = `${rows.length} cuentas`;
        const body = document.getElementById('pc-body');
        if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="omni-empty">Sin resultados</td></tr>`; return; }

        body.innerHTML = rows.map(c => {
            const sangria = (c.Nivel - 1) * 16;
            const puedeEditar = this.esAdmin();
            return `<tr>
                <td class="pc-code" style="padding-left:${14 + sangria}px">${c.Codigo}</td>
                <td style="${c.EsMovimiento ? '' : 'font-weight:800;color:#1a365d'}">${c.Nombre}</td>
                <td><span class="badge b-${c.Tipo}">${c.Tipo}</span></td>
                <td>${c.Naturaleza}</td>
                <td><span class="badge ${c.EsMovimiento ? 'b-mov' : 'b-grp'}">${c.EsMovimiento ? 'MOVIMIENTO' : 'GRUPO'}</span></td>
                <td>${c.Movimientos}</td>
                <td><span class="badge ${c.Estado ? 'b-on' : 'b-off'}">${c.Estado ? 'ACTIVA' : 'INACTIVA'}</span></td>
                <td class="admin-only">${puedeEditar ? `
                    <button class="omni-btn omni-btn-ghost" style="padding:6px 10px" onclick="PlancuentasModule.abrirModal(${c.CuentaID})"><i class="fas fa-pen"></i></button>
                    ${c.Movimientos === 0 && c.Estado ? `<button class="omni-btn omni-btn-danger" style="padding:6px 10px" onclick="PlancuentasModule.eliminar(${c.CuentaID})"><i class="fas fa-trash"></i></button>` : ''}
                ` : ''}</td>
            </tr>`;
        }).join('');
    },

    abrirModal(id) {
        const modal = document.getElementById('pc-modal');
        const c = id ? this.cuentas.find(x => x.CuentaID === id) : null;
        document.getElementById('pc-modal-title').textContent = c ? `Editar · ${c.Codigo}` : 'Nueva cuenta';
        document.getElementById('pc-f-id').value = c ? c.CuentaID : '';
        document.getElementById('pc-f-codigo').value = c ? c.Codigo : '';
        document.getElementById('pc-f-codigo').disabled = !!c;
        document.getElementById('pc-f-nombre').value = c ? c.Nombre : '';
        document.getElementById('pc-f-tipo').value = c ? c.Tipo : 'ACTIVO';
        document.getElementById('pc-f-tipo').disabled = !!c;
        document.getElementById('pc-f-nat').value = c ? c.Naturaleza : 'DEUDORA';
        document.getElementById('pc-f-mov').checked = c ? !!c.EsMovimiento : true;
        document.getElementById('pc-f-estado-wrap').style.display = c ? 'flex' : 'none';
        document.getElementById('pc-f-estado').checked = c ? !!c.Estado : true;
        modal.style.display = 'flex';
    },
    cerrarModal() { document.getElementById('pc-modal').style.display = 'none'; },

    async guardar() {
        const id = document.getElementById('pc-f-id').value;
        const payload = {
            SedeID: null,
            Codigo: document.getElementById('pc-f-codigo').value.trim(),
            Nombre: document.getElementById('pc-f-nombre').value.trim(),
            Tipo: document.getElementById('pc-f-tipo').value,
            Naturaleza: document.getElementById('pc-f-nat').value,
            EsMovimiento: document.getElementById('pc-f-mov').checked ? 1 : 0,
            Estado: document.getElementById('pc-f-estado').checked ? 1 : 0
        };
        if (!payload.Codigo || !payload.Nombre) { window.Toast.fire({ icon: 'warning', title: 'Código y Nombre son obligatorios' }); return; }
        try {
            if (id) await api.put(`/contabilidad/plan/${id}`, payload);
            else await api.post('/contabilidad/plan', payload);
            this.cerrarModal();
            window.Toast.fire({ icon: 'success', title: 'Cuenta guardada' });
            await this.cargar();
        } catch (e) {
            window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error al guardar' });
        }
    },

    async eliminar(id) {
        const c = this.cuentas.find(x => x.CuentaID === id);
        const r = await Swal.fire({
            title: '¿Inactivar cuenta?', text: `${c.Codigo} — ${c.Nombre}`, icon: 'warning',
            showCancelButton: true, confirmButtonText: 'Sí, inactivar', cancelButtonText: 'Cancelar'
        });
        if (!r.isConfirmed) return;
        try { await api.delete(`/contabilidad/plan/${id}`); window.Toast.fire({ icon: 'success', title: 'Cuenta inactivada' }); await this.cargar(); }
        catch (e) { window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error' }); }
    }
};

module.exports = PlancuentasModule;
