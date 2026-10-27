const api = require('./api');

const InventarioModule = {
    productos: [],
    categorias: [],
    // Estado interno para filtros
    state: {
        busqueda: '',
        categoria: 'TODAS',
        tipo: 'TODOS'
    },

    async init() {
        window.backView = 'inventarios';
        this.renderSedeSelector();
        await this.cargarCategorias();
        await this.cargarProductos();
        this.initForm();
        this.initFormCategoria();
        this.initFiltrosListeners();
        this.setupSocket();
    },

    setupSocket() {
        if (!window.socket) return;
        window.socket.on('producto:stock', () => {
            this.cargarProductos();
        });
    },

    initFiltrosListeners() {
        const inputBusqueda = document.getElementById('filtroTexto');
        const selectCat = document.getElementById('filtroCategoria');
        const selectTipo = document.getElementById('filtroTipo');

        if (inputBusqueda) inputBusqueda.oninput = (e) => { this.state.busqueda = e.target.value; this.renderProductos(); };
        if (selectCat) selectCat.onchange = (e) => { this.state.categoria = e.target.value; this.renderProductos(); };
        if (selectTipo) selectTipo.onchange = (e) => { this.state.tipo = e.target.value; this.renderProductos(); };
    },

    // --- LÓGICA DE UI ---
    toggleStockFields() {
        const container = document.getElementById('contenedorStock');
        if (!container) return;
        // Ahora SIEMPRE mostramos el stock, incluso para servicios (ej: cupos de parqueadero)
        container.style.display = 'flex';
    },

    renderSedeSelector() {
        App.renderSedeSelector('sedeSelectorInv', () => this.cargarProductos());
    },

    // --- CATEGORÍAS ---
    async cargarCategorias() {
        try {
            const res = await api.get('/inventario/categorias');
            this.categorias = res.data;
            this.renderCategoriasSelect();
            this.renderCategoriasLista();
            this.actualizarSelectFiltro();
        } catch (e) {
            console.error("Error al cargar categorías:", e);
        }
    },

    actualizarSelectFiltro() {
        const select = document.getElementById('filtroCategoria');
        if (!select) return;
        select.innerHTML = '<option value="TODAS">Todas las Categorías</option>' + 
            this.categorias.map(c => `<option value="${c.CategoriaID}">${c.Nombre}</option>`).join('');
    },

    renderCategoriasSelect() {
        const select = document.getElementById('catProdId');
        if (select) {
            select.innerHTML = this.categorias.map(c => 
                `<option value="${c.CategoriaID}">${c.Nombre}</option>`
            ).join('');
        }
    },

    renderCategoriasLista() {
        const lista = document.getElementById('listaCategorias');
        if (!lista) return;
        const tipoLabel = { ALIMENTO: '🍽 Alimento', BEBIDA: '🥤 Bebida', COMERCIAL: '🛒 Comercial' };
        const tipoColor = { ALIMENTO: '#27ae60', BEBIDA: '#2980b9', COMERCIAL: '#8e44ad' };
        lista.innerHTML = this.categorias.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:10px; background:white; border-radius:15px; box-shadow: 4px 4px 8px #bebebe;">
                <div>
                    <span style="font-weight:700; color:#1a365d;">${c.Nombre}</span>
                    <span style="font-size:0.7rem; font-weight:700; color:white; background:${tipoColor[c.Tipo] || '#999'}; border-radius:8px; padding:2px 8px; margin-left:8px;">
                        ${tipoLabel[c.Tipo] || c.Tipo || 'COMERCIAL'}
                    </span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-neo" style="padding:5px 10px; color:#2980b9; box-shadow:none;" onclick="InventarioModule.editarTipoCategoria(${c.CategoriaID}, '${c.Nombre}', '${c.Tipo || 'COMERCIAL'}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-neo" style="padding:5px 10px; color:#e74c3c; box-shadow:none;" onclick="InventarioModule.eliminarCategoria(${c.CategoriaID})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async editarTipoCategoria(id, nombre, tipoActual) {
        const { value: nuevoTipo } = await Swal.fire({
            title: `Tipo de "${nombre}"`,
            input: 'select',
            inputOptions: { ALIMENTO: '🍽 Alimento', BEBIDA: '🥤 Bebida', COMERCIAL: '🛒 Comercial' },
            inputValue: tipoActual,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            background: '#e0e0e4'
        });
        if (!nuevoTipo) return;
        try {
            await api.post('/inventario/categorias', { CategoriaID: id, Nombre: nombre, Tipo: nuevoTipo });
            await this.cargarCategorias();
            window.Toast.fire({ icon: 'success', title: 'Tipo actualizado' });
        } catch (e) { console.error(e); }
    },

    async eliminarCategoria(id) {
        const result = await Swal.fire({
            title: '¿Eliminar categoría?',
            text: "Esto fallará si hay productos vinculados.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            background: '#e0e0e4'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/inventario/categorias/${id}`);
                await this.cargarCategorias();
                Swal.fire('Eliminado', 'La categoría ha sido borrada', 'success');
            } catch (e) {
                Swal.fire('Error', e.response?.data?.error || 'No se pudo eliminar', 'error');
            }
        }
    },

    initFormCategoria() {
        const formCat = document.getElementById('formCategoria');
        if (!formCat) return;
        formCat.onsubmit = async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nombreCat').value;
            const tipo = document.getElementById('tipoCat').value;
            try {
                await api.post('/inventario/categorias', { Nombre: nombre, Tipo: tipo });
                document.getElementById('nombreCat').value = '';
                await this.cargarCategorias();
                window.Toast.fire({ icon: 'success', title: 'Categoría guardada' });
            } catch (e) { console.error(e); }
        };
    },

    // --- PRODUCTOS Y RENDERIZADO ---
    async cargarProductos() {
        const selector = document.getElementById('globalSedeSelector');
        const sedeId = selector ? selector.value : App.user.SedeID;
        const grid = document.getElementById('gridProductos');
        if (!grid) return;
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Cargando inventario...</p>';

        try {
            const res = await api.get(`/inventario/sede/${sedeId}`);
            this.productos = res.data;
            this.renderProductos();
        } catch (e) {
            console.error("Error al cargar productos:", e);
        }
    },

    renderProductos() {
        const grid = document.getElementById('gridProductos');
        if (!grid) return;

        // 1. Filtrado basado en el Estado
        const productosFiltrados = this.productos.filter(p => {
            const matchBusqueda = p.Nombre.toLowerCase().includes(this.state.busqueda.toLowerCase());
            const matchCat = (this.state.categoria === 'TODAS' || p.CategoriaID == this.state.categoria);
            const matchTipo = (this.state.tipo === 'TODOS' || p.TipoItem === this.state.tipo);
            return matchBusqueda && matchCat && matchTipo;
        });

        if (productosFiltrados.length === 0) {
            grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">No se encontraron resultados.</p>';
            return;
        }

        // 2. Renderizado de Tarjetas
        grid.innerHTML = productosFiltrados.map(p => {
            const stockActual = parseInt(p.StockActual) || 0;
            const stockMinimo = parseInt(p.StockMinimo) || 0;
            
            // Evaluamos estado crítico de stock para TODO tipo de ítem
            const esCritico = (stockActual <= stockMinimo);

            // Etiqueta visual para distinguir si es servicio o producto
            const iconTipo = p.TipoItem === 'SERVICIO' ? '<i class="fas fa-briefcase"></i> SERV | ' : '<i class="fas fa-box"></i> ';

            return `
            <div class="prod-card" style="${esCritico ? 'border: 2px solid var(--hotel-danger);' : ''}">
                <div class="stock-badge" style="color: ${esCritico ? 'var(--hotel-danger)' : '#1a365d'}">
                    ${iconTipo} STOCK: ${stockActual}
                    ${esCritico ? '<br><small style="font-weight:900;">BAJO MÍNIMO</small>' : ''}
                </div>
                
                <h4 style="margin: 10px 0; font-weight: 800; color: #1a365d;">${p.Nombre}</h4>
                <p style="font-size:0.7rem; color:#7f8c8d; margin-bottom:10px; text-transform: uppercase;">${p.CategoriaNombre || 'Sin Categoría'}</p>
                <span class="price-tag">$${parseFloat(p.PrecioVenta).toFixed(2)}</span>
                
                <div style="margin-top:15px; display:flex; flex-direction:column; gap:5px;">
                    <button class="btn-neo" style="width:100%; justify-content:center;" onclick="InventarioModule.editarProducto(${p.ProductoID})">
                        <i class="fas fa-edit"></i> EDITAR FICHA
                    </button>

                    <div style="display:flex; gap:5px;">
                        <button class="btn-neo" style="flex:1" title="Historial trazable: compras, ventas y ajustes" onclick="InventarioModule.verKardex(${p.ProductoID})">
                            <i class="fas fa-list-check"></i> Kardex
                        </button>
                        <button class="btn-neo" style="flex:1" title="Sobrante / faltante de conteo físico" onclick="InventarioModule.abrirModalMovimiento(${p.ProductoID}, 'AJUSTE')">
                            <i class="fas fa-tools"></i> Ajuste
                        </button>
                        <button class="btn-neo" style="flex:0 0 auto; color:#e74c3c;" title="Eliminar" onclick="InventarioModule.eliminarProducto(${p.ProductoID})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    },

    // --- GESTIÓN DE MOVIMIENTOS ---
    // Las ENTRADAS de mercadería se registran como Compra (Facturación → Compras),
    // con proveedor, comprobante y costo: así el kardex y la contabilidad cuadran.
    // Aquí solo quedan los ajustes de conteo físico, con motivo obligatorio.
    async abrirModalMovimiento(id, tipo) {
        const { value: formValues } = await Swal.fire({
            title: 'Ajuste de inventario',
            html: '<div style="text-align:left;font-size:.78rem;color:#5a6b7d;margin-bottom:6px">Para mercadería comprada use <b>Facturación → Compras</b> (con proveedor y factura). El ajuste es solo para diferencias de conteo físico, mermas o inventario inicial.</div>' +
                  '<select id="swal-tipo" class="swal2-select" style="display:block;width:100%;margin:8px 0">' +
                  '<option value="AJUSTE_NEGATIVO">Faltante / merma / daño (−)</option>' +
                  '<option value="AJUSTE_POSITIVO">Sobrante de conteo / inventario inicial (+)</option></select>' +
                  '<input id="swal-cant" type="number" min="1" step="1" class="swal2-input" placeholder="Cantidad">' +
                  '<input id="swal-motivo" type="text" class="swal2-input" placeholder="Motivo (obligatorio): ej. conteo físico 27/10, producto vencido">',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'REGISTRAR AJUSTE',
            cancelButtonText: 'CANCELAR',
            preConfirm: () => {
                const cant = parseInt(document.getElementById('swal-cant').value);
                const motivo = document.getElementById('swal-motivo').value.trim();
                if (!cant || cant <= 0) { Swal.showValidationMessage('Ingrese una cantidad entera mayor a 0'); return false; }
                if (motivo.length < 5) { Swal.showValidationMessage('El motivo es obligatorio (mínimo 5 caracteres)'); return false; }
                return { cantidad: cant, motivo, tipo: document.getElementById('swal-tipo').value };
            }
        });

        if (formValues && formValues.cantidad) {
            this.ejecutarMovimiento(id, formValues.tipo, formValues.cantidad, formValues.motivo);
        }
    },

    /** Kardex: cada entrada/salida con su documento de origen (compra, venta, ajuste). */
    async verKardex(id) {
        try {
            const { data } = await api.get(`/inventario/kardex/${id}`);
            const p = data.producto;
            const etiqueta = { COMPRA: 'Compra', ANULA_COMPRA: 'Anulación compra', VENTA: 'Venta POS', ANULA_VENTA: 'Anulación venta', AJUSTE: 'Ajuste' };
            const filas = (data.movimientos || []).map(m => {
                const entra = ['INGRESO', 'AJUSTE_POSITIVO'].includes(m.TipoMovimiento);
                return `<tr>
                    <td>${String(m.FechaMovimiento).replace('T', ' ').slice(0, 16)}</td>
                    <td>${etiqueta[m.Origen] || (m.Origen || 'Histórico')}</td>
                    <td style="text-align:left">${m.Documento || m.Motivo || ''}</td>
                    <td style="text-align:right;color:${entra ? '#1e8e4e' : '#e74c3c'};font-weight:800">${entra ? '+' : '−'}${m.Cantidad}</td>
                    <td style="text-align:right">${m.CostoUnitario != null ? '$' + Number(m.CostoUnitario).toFixed(2) : ''}</td>
                    <td style="text-align:right">${m.StockResultante ?? ''}</td>
                    <td>${m.Usuario || ''}</td>
                </tr>`;
            }).join('');
            Swal.fire({
                title: `Kardex · ${p.Nombre}`,
                width: 960,
                html: `<div style="display:flex;gap:18px;justify-content:center;font-size:.8rem;margin-bottom:10px">
                        <span><b>Stock:</b> ${p.StockActual}</span><span><b>Costo promedio:</b> $${Number(p.CostoCompra || 0).toFixed(2)}</span>
                        <span><b>Valor en inventario:</b> $${(Number(p.StockActual) * Number(p.CostoCompra || 0)).toFixed(2)}</span></div>
                       <div style="max-height:55vh;overflow:auto">
                       <table style="width:100%;border-collapse:collapse;font-size:.75rem">
                         <thead><tr style="background:#1a365d;color:#fff">${['Fecha', 'Origen', 'Documento / motivo', 'Cant.', 'Costo u.', 'Saldo', 'Usuario'].map(h => `<th style="padding:7px 8px;font-size:.62rem;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
                         <tbody>${filas || '<tr><td colspan="7" style="padding:16px;color:#a0aab8">Sin movimientos</td></tr>'}</tbody>
                       </table></div>`,
                confirmButtonText: 'Cerrar'
            });
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar el kardex', 'error');
        }
    },

    async ejecutarMovimiento(id, tipo, cantidad, motivo) {
        try {
            const selector = document.getElementById('globalSedeSelector');
            const user = JSON.parse(localStorage.getItem('user'));
            
            await api.post('/inventario/movimiento', {
                ProductoID: id,
                SedeID: selector ? selector.value : user.SedeID,
                UsuarioID: user.UsuarioID,
                Cantidad: parseInt(cantidad),
                TipoMovimiento: tipo,
                Motivo: motivo
            });
            await this.cargarProductos();
            window.Toast.fire({ icon: 'success', title: 'Movimiento registrado correctamente' });
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo registrar el movimiento', 'error');
        }
    },

    async eliminarProducto(id) {
        const result = await Swal.fire({
            title: '¿Eliminar producto?',
            text: "Si nunca ha tenido ventas ni movimientos se borra por completo. Si ya tiene historial, se desactivará en su lugar para no perderlo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            background: '#e0e0e4'
        });
        if (!result.isConfirmed) return;

        try {
            const res = await api.delete(`/inventario/${id}`);
            await this.cargarProductos();
            Swal.fire(
                res.data.desactivada ? 'Desactivado' : 'Eliminado',
                res.data.message,
                'success'
            );
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo eliminar el producto', 'error');
        }
    },

    async verDesactivados() {
        const selector = document.getElementById('globalSedeSelector');
        const user = JSON.parse(localStorage.getItem('user'));
        const sedeId = selector ? selector.value : user.SedeID;

        try {
            const res = await api.get(`/inventario/desactivados/${sedeId}`);
            const desactivados = res.data || [];

            if (desactivados.length === 0) {
                Swal.fire('Sin registros', 'No hay productos desactivados en esta sede.', 'info');
                return;
            }

            const html = `
                <div style="text-align:left; max-height:400px; overflow-y:auto;">
                    ${desactivados.map(p => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:8px; background:#f1f3f5; border-radius:10px;">
                            <div>
                                <strong>${p.Nombre}</strong>
                                <span style="font-size:0.75rem; color:#7f8c8d;"> — ${p.CategoriaNombre || 'Sin categoría'}</span>
                            </div>
                            <button class="btn-neo" style="padding:6px 12px;" onclick="InventarioModule.reactivarProducto(${p.ProductoID})">
                                <i class="fas fa-undo"></i> Reactivar
                            </button>
                        </div>
                    `).join('')}
                </div>`;

            Swal.fire({
                title: 'Productos desactivados',
                html,
                showConfirmButton: false,
                showCloseButton: true,
                background: '#e0e0e4',
                width: 500
            });
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar los productos desactivados', 'error');
        }
    },

    async reactivarProducto(id) {
        try {
            await api.post(`/inventario/${id}/reactivar`);
            Swal.close();
            await this.cargarProductos();
            window.Toast.fire({ icon: 'success', title: 'Producto reactivado' });
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo reactivar el producto', 'error');
        }
    },

    // --- FORMULARIOS Y EDICIÓN ---
    initForm() {
        const form = document.getElementById('formProducto');
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const selector = document.getElementById('globalSedeSelector');
            const user = JSON.parse(localStorage.getItem('user'));
            
            const data = {
                ProductoID: document.getElementById('productoId').value || null,
                SedeID: selector ? selector.value : user.SedeID,
                UsuarioID: user.UsuarioID,
                CategoriaID: document.getElementById('catProdId').value,
                Nombre: document.getElementById('nombreProd').value,
                PrecioVenta: parseFloat(document.getElementById('precioProd').value),
                CostoCompra: parseFloat(document.getElementById('costoProd').value),
                TipoItem: document.getElementById('tipoProd')?.value || 'VENTA',
                StockMinimo: parseInt(document.getElementById('minProd')?.value || 0),
                StockIdeal: parseInt(document.getElementById('idealProd')?.value || 0),
                CodigoBarras: document.getElementById('barraProd')?.value || null,
                GravaIVA: document.getElementById('gravaIvaProd')?.checked !== false
            };

            try {
                await api.post('/inventario', data);
                this.cerrarModal();
                await this.cargarProductos();
                window.Toast.fire({ icon: 'success', title: 'Ficha guardada exitosamente' });
            } catch (e) {
                Swal.fire('Error', e.response?.data?.error || 'No se pudo guardar la ficha', 'error');
            }
        };
    },

    editarProducto(id) {
        const p = this.productos.find(prod => prod.ProductoID === id);
        if (!p) return;

        document.getElementById('productoId').value = p.ProductoID;
        document.getElementById('nombreProd').value = p.Nombre;
        document.getElementById('catProdId').value = p.CategoriaID;
        document.getElementById('precioProd').value = p.PrecioVenta;
        document.getElementById('costoProd').value = p.CostoCompra;
        
        if(document.getElementById('tipoProd')) {
            document.getElementById('tipoProd').value = p.TipoItem;
            this.toggleStockFields();
        }
        
        document.getElementById('minProd').value = p.StockMinimo;
        document.getElementById('idealProd').value = p.StockIdeal;
        document.getElementById('barraProd').value = p.CodigoBarras || '';
        const gi = document.getElementById('gravaIvaProd');
        if (gi) gi.checked = !(p.GravaIVA === false || p.GravaIVA === 0);

        document.getElementById('modalProducto').classList.remove('hidden');
    },

    abrirModalProducto() {
        const form = document.getElementById('formProducto');
        if (form) form.reset();
        document.getElementById('productoId').value = '';
        document.getElementById('tipoProd').value = 'VENTA';
        this.toggleStockFields();
        document.getElementById('modalProducto').classList.remove('hidden');
    },

    abrirModalCat() {
        document.getElementById('modalCategoria').classList.remove('hidden');
    },

    cerrarModal() {
        document.getElementById('modalProducto').classList.add('hidden');
        document.getElementById('modalCategoria').classList.add('hidden');
    }
};

window.InventarioModule = InventarioModule;
module.exports = InventarioModule;