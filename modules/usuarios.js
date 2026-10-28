// usuarios.js - Gestión de Usuarios | HotelMasterDB
const api = require('./api'); 

const UsuariosModule = {
    editandoID: null, 

    init() {
        console.log("Modulo Usuarios (Hotel): Activo");
        this.listarUsuarios();
        this.setupEventListeners();
        
        window.UsuariosModule = this;
    },

    // 1. LISTADO DE PERSONAL (ACTUALIZADO CON LÓGICA DUAL)
    async listarUsuarios() {
        try {
            const res = await api.get('/admin/usuarios');
            const usuarios = res.data;
            const body = document.getElementById('tablaUsuariosBody');
            if (!body) return;

            body.innerHTML = usuarios.map(u => {
                // Definimos el estilo del botón según el estado
                const btnClass = u.Estado ? 'btn-delete' : 'btn-activate';
                const btnIcon = u.Estado ? 'fa-user-slash' : 'fa-user-check';
                const btnColor = u.Estado ? '' : 'style="background: #27ae60; color: white;"';

                return `
                <tr>
                    <td>
                        <div class="user-info">
                            <strong>${u.NombreFull}</strong><br>
                            <small class="text-muted">${u.Cedula || 'S/C'}</small>
                        </div>
                    </td>
                    <td>${u.Usuario}</td>
                    <td><span class="badge-rol">${u.NombreRol || 'SIN ROL'}</span></td>
                    <td>${u.Sede || 'SIN SEDE'}</td>
                    <td>
                        <span class="status-pill ${u.Estado ? 'active' : 'inactive'}">
                            ${u.Estado ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                    </td>
                    <td>
                        <div class="actions">
                            <button class="btn-edit" onclick='UsuariosModule.prepararEdicion(${JSON.stringify(u)})' title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${parseInt(u.RolID) !== 1 ? `<button class="btn-edit" style="background:#eaf2fb;color:#1a5fc0" onclick="UsuariosModule.abrirPermisosUsuario(${u.UsuarioID})" title="Permisos de este usuario (excepciones a su rol)">
                                <i class="fas fa-key"></i>
                            </button>` : ''}
                            <button class="${btnClass}" ${btnColor} onclick='UsuariosModule.toggleEstadoUsuario(${JSON.stringify(u)})' title="${u.Estado ? 'Desactivar' : 'Activar'}">
                                <i class="fas ${btnIcon}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        } catch (error) {
            console.error("Error en listarUsuarios:", error);
        }
    },

    // 2. CARGA DE SELECTORES (Roles y Sedes)
    async cargarSelectores() {
        try {
            const [resRoles, resSedes] = await Promise.all([
                api.get('/admin/roles'),
                api.get('/admin/sedes')
            ]);

            const selRol = document.getElementById('rolId');
            const selSede = document.getElementById('sedeId');

            if (selRol && resRoles.data) {
                selRol.innerHTML = '<option value="">SELECCIONE ROL</option>';
                resRoles.data.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.RolID;
                    opt.textContent = r.NombreRol.toUpperCase();
                    selRol.appendChild(opt);
                });
            }

            if (selSede && resSedes.data) {
                selSede.innerHTML = '<option value="">SELECCIONE SEDE</option>';
                resSedes.data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.SedeID;
                    opt.textContent = s.NombreComercial.toUpperCase();
                    selSede.appendChild(opt);
                });
            }
        } catch (error) {
            console.error("Error en cargarSelectores:", error);
        }
    },

    // 3. CONTROL DE MODAL
    async abrirModal(esEdicion = false) {
        const modal = document.getElementById('modalUsuario');
        const form = document.getElementById('formUsuario');
        
        if (!modal) return;

        if (!esEdicion) {
            this.editandoID = null;
            if (form) form.reset();
            document.getElementById('modalTitulo').textContent = "REGISTRAR NUEVO PERSONAL";
            
            const passField = document.getElementById('password');
            if(passField) {
                passField.placeholder = "CONTRASEÑA";
                passField.required = true;
            }
        }

        modal.classList.remove('hidden');
        await this.cargarSelectores();
    },

    cerrarModal() {
        const modal = document.getElementById('modalUsuario');
        if (modal) modal.classList.add('hidden');
        this.editandoID = null;
    },

    // 4. EVENTOS DE FORMULARIO
    setupEventListeners() {
        const form = document.getElementById('formUsuario');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const userLogueado = JSON.parse(localStorage.getItem('user')) || {};
            const rEjecutor = userLogueado.rolId || userLogueado.RolID || 0;
            
            const datos = {
                nombre: document.getElementById('nombre').value.trim(),
                cedula: document.getElementById('cedula').value.trim(),
                telefono: document.getElementById('telefono').value.trim(),
                direccion: document.getElementById('direccion').value.trim(),
                correo: document.getElementById('correo').value.trim(),
                usuario: document.getElementById('usuario').value.trim(),
                password: document.getElementById('password').value,
                rolId: parseInt(document.getElementById('rolId').value),
                sedeId: parseInt(document.getElementById('sedeId').value),
                estado: document.getElementById('estado') ? (document.getElementById('estado').checked ? 1 : 0) : 1,
                rolEjecutor: rEjecutor
            };

            if (!datos.rolId || !datos.sedeId) {
                return window.Toast.fire({ icon: 'warning', title: 'DEBE SELECCIONAR ROL Y SEDE' });
            }

            try {
                let res;
                if (this.editandoID) {
                    res = await api.put(`/admin/usuarios/${this.editandoID}`, datos);
                } else {
                    res = await api.post('/admin/usuarios', datos);
                }

                if (res.data.success) {
                    window.Toast.fire({ icon: 'success', title: 'OPERACIÓN EXITOSA' });
                    this.cerrarModal();
                    this.listarUsuarios();
                }
            } catch (error) {
                const msg = error.response?.data?.error || "ERROR DE SERVIDOR";
                window.Toast.fire({ icon: 'error', title: 'ERROR', text: msg.toUpperCase() });
            }
        };
    },

    // 5. PREPARAR EDICION
    async prepararEdicion(u) {
        this.editandoID = u.UsuarioID;
        await this.abrirModal(true);
        
        document.getElementById('modalTitulo').textContent = `EDITANDO: ${u.NombreFull.toUpperCase()}`;
        
        document.getElementById('nombre').value = u.NombreFull || '';
        document.getElementById('cedula').value = u.Cedula || '';
        document.getElementById('telefono').value = u.Telefono || '';
        document.getElementById('direccion').value = u.Direccion || '';
        document.getElementById('correo').value = u.Correo || '';
        document.getElementById('usuario').value = u.Usuario || '';
        
        if (u.RolID) document.getElementById('rolId').value = u.RolID;
        if (u.SedeID) document.getElementById('sedeId').value = u.SedeID;
        
        const passField = document.getElementById('password');
        if (passField) {
            passField.required = false;
            passField.value = ""; 
            passField.placeholder = "DEJAR VACÍO PARA MANTENER ACTUAL";
        }

        const checkEstado = document.getElementById('estado');
        if (checkEstado) {
            checkEstado.checked = (u.Estado == 1 || u.Estado === true);
        }
    },

    // 6. ACTIVACIÓN / DESACTIVACIÓN (LA VARITA MÁGICA)
    async toggleEstadoUsuario(u) {
        const userLogueado = JSON.parse(localStorage.getItem('user')) || {};
        const rEjecutor = userLogueado.rolId || userLogueado.RolID || 0;
        
        const accion = u.Estado ? 'DESACTIVAR' : 'ACTIVAR';
        const nuevoEstado = u.Estado ? 0 : 1;

        const confirm = await Swal.fire({
            title: `¿${accion} USUARIO?`,
            text: u.Estado 
                ? "El colaborador ya no podrá ingresar al sistema." 
                : "El colaborador recuperará el acceso al sistema.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: u.Estado ? '#d33' : '#27ae60',
            confirmButtonText: `SÍ, ${accion}`,
            cancelButtonText: 'CANCELAR'
        });

        if (confirm.isConfirmed) {
            try {
                // Enviamos la actualización de estado al backend
                const res = await api.put(`/admin/usuarios/${u.UsuarioID}`, {
                    nombre: u.NombreFull,
                    cedula: u.Cedula,
                    telefono: u.Telefono,
                    direccion: u.Direccion,
                    correo: u.Correo,
                    usuario: u.Usuario,
                    rolId: u.RolID,
                    sedeId: u.SedeID,
                    estado: nuevoEstado,
                    rolEjecutor: rEjecutor
                });

                if (res.data.success) {
                    window.Toast.fire({ 
                        icon: 'success', 
                        title: `USUARIO ${nuevoEstado ? 'ACTIVADO' : 'DESACTIVADO'} CON ÉXITO` 
                    });
                    this.listarUsuarios();
                }
            } catch (error) {
                const msg = error.response?.data?.error || "ERROR DE PERMISOS";
                window.Toast.fire({ icon: 'error', title: 'ERROR', text: msg.toUpperCase() });
            }
        }
    },

    // ── ROLES Y PERMISOS ─────────────────────────────────────
    //  Niveles: 0 sin acceso · 1 ver · 2 crear/editar · 3 total (anular,
    //  eliminar, cerrar, configurar). El administrador siempre tiene todo.
    _esc(v) { return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
    _colorNivel: ['#a0aab8', '#1a5fc0', '#1e8e4e', '#b9420b'],

    _selNivel(id, valor, niveles, conHereda, heredado) {
        const ops = (conHereda ? [`<option value="" ${valor == null ? 'selected' : ''}>Según su rol (${niveles[heredado || 0]})</option>`] : [])
            .concat(niveles.map((n, i) => `<option value="${i}" ${valor === i ? 'selected' : ''}>${n}</option>`)).join('');
        const color = valor == null ? '#718096' : this._colorNivel[valor];
        return `<select data-k="${id}" class="perm-sel" style="width:100%;padding:5px 6px;border:1px solid #d5dce5;border-radius:7px;font-size:.74rem;font-weight:700;color:${color};background:#fff"
                    onchange="this.style.color = this.value === '' ? '#718096' : UsuariosModule._colorNivel[this.value]">${ops}</select>`;
    },

    async abrirRolesPermisos() {
        let data;
        try { data = (await api.get('/permisos/matriz')).data; }
        catch (e) { return Swal.fire('Sin acceso', e.response?.data?.error || e.message, 'error'); }
        const { modulos, niveles, roles } = data;
        const grupos = [...new Set(modulos.map(m => m.grupo))];
        const cab = roles.map(r => `<th style="padding:7px 6px;font-size:.62rem;min-width:110px" title="${this._esc(r.Descripcion)}">${this._esc(r.NombreRol)}</th>`).join('');
        const filas = grupos.map(g => `
            <tr><td colspan="${roles.length + 1}" style="background:#eef1f5;font-size:.62rem;font-weight:900;letter-spacing:1px;color:#5a6b7d;padding:6px 8px">${this._esc(g.toUpperCase())}</td></tr>
            ${modulos.filter(m => m.grupo === g).map(m => `
                <tr><td style="padding:5px 8px;font-size:.76rem;font-weight:700;color:#1a365d;white-space:nowrap">${this._esc(m.nombre)}</td>
                ${roles.map(r => `<td style="padding:3px 4px">${this._selNivel(`${r.RolID}|${m.clave}`, r.permisos[m.clave] ?? 0, niveles, false)}</td>`).join('')}</tr>`).join('')}`).join('');
        const r = await Swal.fire({
            title: 'Roles y permisos', width: Math.min(1250, 260 + roles.length * 125), showCancelButton: true,
            confirmButtonText: 'Guardar cambios', cancelButtonText: 'Cerrar', confirmButtonColor: '#1a365d',
            html: `<div style="text-align:left;font-size:.78rem;color:#5a6b7d;margin-bottom:8px">
                    <b>Ver</b>: consulta · <b>Crear / editar</b>: registra y modifica · <b>Total</b>: además anula, elimina, cierra períodos y configura.
                    El <b>Administrador</b> siempre tiene todo. Usuarios, Empresas, Respaldos y Licencia son solo del administrador.
                    Para darle o quitarle un módulo a una sola persona usa el botón <i class="fas fa-key"></i> en su fila.</div>
                <div style="max-height:62vh;overflow:auto;border:1px solid #e3e8ef;border-radius:10px">
                <table style="width:100%;border-collapse:collapse">
                    <thead style="position:sticky;top:0;z-index:1;background:#1a365d;color:#fff"><tr><th style="padding:7px 8px;text-align:left;font-size:.62rem">MÓDULO</th>${cab}</tr></thead>
                    <tbody>${filas}</tbody></table></div>`,
            preConfirm: () => {
                const cambios = {};
                document.querySelectorAll('.perm-sel').forEach(s => {
                    const [rolId, mod] = s.dataset.k.split('|');
                    const rol = roles.find(x => String(x.RolID) === rolId);
                    const v = parseInt(s.value);
                    if ((rol.permisos[mod] ?? 0) !== v) { (cambios[rolId] = cambios[rolId] || {})[mod] = v; }
                });
                return cambios;
            }
        });
        if (!r.isConfirmed) return;
        const cambios = r.value || {};
        if (!Object.keys(cambios).length) return window.Toast.fire({ icon: 'info', title: 'Sin cambios' });
        try {
            for (const [rolId, permisos] of Object.entries(cambios)) await api.put(`/permisos/rol/${rolId}`, { permisos });
            window.Toast.fire({ icon: 'success', title: `Permisos actualizados (${Object.keys(cambios).length} rol/es)` });
        } catch (e) { Swal.fire('No se guardó', e.response?.data?.error || e.message, 'error'); }
    },

    async abrirPermisosUsuario(usuarioId) {
        let data;
        try { data = (await api.get(`/permisos/usuario/${usuarioId}`)).data; }
        catch (e) { return Swal.fire('Permisos', e.response?.data?.error || e.message, 'info'); }
        const { usuario, modulos, niveles, delRol, excepciones } = data;
        const grupos = [...new Set(modulos.map(m => m.grupo))];
        const filas = grupos.map(g => `
            <tr><td colspan="2" style="background:#eef1f5;font-size:.62rem;font-weight:900;letter-spacing:1px;color:#5a6b7d;padding:6px 8px">${this._esc(g.toUpperCase())}</td></tr>
            ${modulos.filter(m => m.grupo === g).map(m => `
                <tr><td style="padding:5px 8px;font-size:.78rem;font-weight:700;color:#1a365d">${this._esc(m.nombre)}</td>
                <td style="padding:3px 6px;width:230px">${this._selNivel(m.clave, excepciones[m.clave] ?? null, niveles, true, delRol[m.clave] || 0)}</td></tr>`).join('')}`).join('');
        const r = await Swal.fire({
            title: `Permisos de ${this._esc(usuario.NombreFull)}`, width: 640, showCancelButton: true,
            confirmButtonText: 'Guardar', cancelButtonText: 'Cerrar', confirmButtonColor: '#1a365d',
            html: `<div style="text-align:left;font-size:.78rem;color:#5a6b7d;margin-bottom:8px">
                    Rol: <b>${this._esc(usuario.NombreRol)}</b>. Por defecto cada módulo sigue a su rol; elige otro nivel solo
                    donde esta persona necesite más (o menos) acceso que su rol.</div>
                <div style="max-height:60vh;overflow:auto;border:1px solid #e3e8ef;border-radius:10px">
                <table style="width:100%;border-collapse:collapse"><tbody>${filas}</tbody></table></div>`,
            preConfirm: () => {
                const cambios = {};
                document.querySelectorAll('.perm-sel').forEach(s => {
                    const actual = excepciones[s.dataset.k] ?? null;
                    const nuevo = s.value === '' ? null : parseInt(s.value);
                    if (actual !== nuevo) cambios[s.dataset.k] = nuevo;
                });
                return cambios;
            }
        });
        if (!r.isConfirmed) return;
        if (!Object.keys(r.value || {}).length) return window.Toast.fire({ icon: 'info', title: 'Sin cambios' });
        try {
            await api.put(`/permisos/usuario/${usuarioId}`, { permisos: r.value });
            window.Toast.fire({ icon: 'success', title: 'Permisos del usuario actualizados' });
        } catch (e) { Swal.fire('No se guardó', e.response?.data?.error || e.message, 'error'); }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    UsuariosModule.init();
});

module.exports = UsuariosModule;