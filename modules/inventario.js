const api = require('./api');

const _esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _money = n => '$' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const InventarioModule = {
    productos: [],
    categorias: [],
    // Estado interno para filtros
    state: {
        busqueda: '',
        categoria: 'TODAS',
        tipo: 'TODOS',
        soloBajo: false
    },

    async init() {
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
        const chkBajo = document.getElementById('filtroBajo');
        if (chkBajo) chkBajo.onchange = (e) => { this.state.soloBajo = e.target.checked; this.renderProductos(); };
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
        const tipoLabel = { ALIMENTO: 'Alimento', BEBIDA: 'Bebida', COMERCIAL: 'Comercial' };
        const tipoColor = { ALIMENTO: 'background:#e8f8ef;color:#1e8e4e', BEBIDA: 'background:#e8eefc;color:#1a5fc0', COMERCIAL: 'background:#f1e9fb;color:#7a3fc0' };
        lista.innerHTML = this.categorias.length ? this.categorias.map(c => `
            <div class="inv-cat">
                <div><b style="color:#1a365d">${_esc(c.Nombre)}</b>
                    <span class="inv-tag" style="${tipoColor[c.Tipo] || tipoColor.COMERCIAL}">${tipoLabel[c.Tipo] || _esc(c.Tipo) || 'Comercial'}</span></div>
                <div class="inv-acc">
                    <button class="inv-ib e" title="Cambiar tipo" onclick="InventarioModule.editarTipoCategoria(${c.CategoriaID}, '${_esc(c.Nombre).replace(/'/g, '&#39;')}', '${c.Tipo || 'COMERCIAL'}')"><i class="fas fa-pen"></i></button>
                    <button class="inv-ib d" title="Eliminar" onclick="InventarioModule.eliminarCategoria(${c.CategoriaID})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('') : '<div class="omni-empty">Sin categorías</div>';
    },

    async editarTipoCategoria(id, nombre, tipoActual) {
        const { value: nuevoTipo } = await Swal.fire({
            title: `Tipo de "${nombre}"`,
            input: 'select',
            inputOptions: { COMERCIAL: 'Comercial', ALIMENTO: 'Alimento', BEBIDA: 'Bebida' },
            inputValue: tipoActual,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2f7be6'
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
        grid.innerHTML = '<tr><td colspan="10" class="omni-empty">Cargando inventario...</td></tr>';

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
        const esServicio = p => p.TipoItem === 'SERVICIO';
        const bajoMin = p => !esServicio(p) && (parseInt(p.StockActual) || 0) <= (parseInt(p.StockMinimo) || 0);

        // Resumen de la empresa (sobre todo el inventario, no solo lo filtrado)
        const fisicos = this.productos.filter(p => !esServicio(p));
        const unidades = fisicos.reduce((s, p) => s + Math.max(0, parseInt(p.StockActual) || 0), 0);
        const valor = fisicos.reduce((s, p) => s + Math.max(0, parseInt(p.StockActual) || 0) * Number(p.CostoCompra || 0), 0);
        const bajos = fisicos.filter(bajoMin).length;
        const sinStock = fisicos.filter(p => (parseInt(p.StockActual) || 0) <= 0).length;
        const cards = document.getElementById('inv-cards');
        if (cards) cards.innerHTML = `
            <div class="omni-card"><span>Productos</span><b>${fisicos.length}</b></div>
            <div class="omni-card"><span>Unidades en stock</span><b>${unidades.toLocaleString('es-EC')}</b></div>
            <div class="omni-card"><span>Valor del inventario (costo)</span><b>${_money(valor)}</b></div>
            <div class="omni-card ${bajos ? 'warn' : ''}"><span>Bajo stock mínimo</span><b>${bajos}</b></div>
            <div class="omni-card ${sinStock ? 'hot' : ''}"><span>Sin stock</span><b>${sinStock}</b></div>
            <div class="omni-card"><span>Servicios</span><b>${this.productos.length - fisicos.length}</b></div>`;

        const txt = this.state.busqueda.toLowerCase().trim();
        const filtrados = this.productos.filter(p => {
            const matchBusqueda = !txt || String(p.Nombre || '').toLowerCase().includes(txt) || String(p.CodigoBarras || '').toLowerCase().includes(txt);
            const matchCat = (this.state.categoria === 'TODAS' || p.CategoriaID == this.state.categoria);
            const matchTipo = (this.state.tipo === 'TODOS' || p.TipoItem === this.state.tipo);
            return matchBusqueda && matchCat && matchTipo && (!this.state.soloBajo || bajoMin(p));
        });

        const cnt = document.getElementById('inv-count');
        if (cnt) cnt.textContent = `${filtrados.length} de ${this.productos.length}`;

        if (!filtrados.length) {
            grid.innerHTML = `<tr><td colspan="10" class="omni-empty">${this.productos.length ? 'No hay productos con estos filtros.' : 'Esta empresa aún no tiene productos. Créalos con "Nuevo producto" y registra su entrada como Compra.'}</td></tr>`;
            return;
        }

        const badge = { VENTA: ['inv-b-venta', 'Venta'], INSUMO: ['inv-b-insumo', 'Insumo'], SERVICIO: ['inv-b-serv', 'Servicio'] };
        grid.innerHTML = filtrados.map(p => {
            const stock = parseInt(p.StockActual) || 0;
            const serv = esServicio(p);
            const b = badge[p.TipoItem] || badge.VENTA;
            const claseStock = serv ? '' : (stock <= 0 ? 'inv-stock-cero' : (bajoMin(p) ? 'inv-stock-bajo' : ''));
            const gravaIva = !(p.GravaIVA === false || p.GravaIVA === 0);
            return `
            <tr>
                <td><b style="color:#1a365d">${_esc(p.Nombre)}</b>${p.CodigoBarras ? `<span class="inv-cod">${_esc(p.CodigoBarras)}</span>` : ''}</td>
                <td>${_esc(p.CategoriaNombre || 'Sin categoría')}</td>
                <td><span class="inv-badge ${b[0]}">${b[1]}</span></td>
                <td class="num ${claseStock}">${serv ? '—' : stock}${!serv && bajoMin(p) ? ' <i class="fas fa-triangle-exclamation" title="Bajo el stock mínimo"></i>' : ''}</td>
                <td class="num">${serv ? '—' : (parseInt(p.StockMinimo) || 0)}</td>
                <td class="num">${_money(p.CostoCompra)}</td>
                <td class="num">${_money(p.PrecioVenta)}</td>
                <td>${gravaIva ? '<span class="inv-badge inv-b-venta">Sí</span>' : '<span class="inv-badge" style="background:#e8f8ef;color:#1e8e4e">0%</span>'}</td>
                <td class="num">${serv ? '—' : _money(Math.max(0, stock) * Number(p.CostoCompra || 0))}</td>
                <td><div class="inv-acc">
                    <button class="inv-ib k" title="Kardex: compras, ventas y ajustes" onclick="InventarioModule.verKardex(${p.ProductoID})"><i class="fas fa-list-check"></i> Kardex</button>
                    ${serv ? '' : `<button class="inv-ib a" title="Ajuste por conteo físico" onclick="InventarioModule.abrirModalMovimiento(${p.ProductoID}, 'AJUSTE')"><i class="fas fa-scale-balanced"></i></button>`}
                    <button class="inv-ib e" title="Editar ficha" onclick="InventarioModule.editarProducto(${p.ProductoID})"><i class="fas fa-pen"></i></button>
                    <button class="inv-ib d" title="Eliminar / desactivar" onclick="InventarioModule.eliminarProducto(${p.ProductoID})"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>`;
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

    /** Verificación de integridad compras ↔ inventario ↔ caja (solo lectura). */
    async verificarIntegridad() {
        const selector = document.getElementById('globalSedeSelector');
        const sedeId = selector ? selector.value : App.user.SedeID;
        Swal.fire({ title: 'Verificando integridad...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        try {
            const { data } = await api.get(`/inventario/integridad?sedeId=${sedeId}`);
            const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            const fmt = v => v instanceof Date || /^\d{4}-\d{2}-\d{2}T/.test(v) ? String(v).slice(0, 10) : v;
            const color = { error: '#c0392b', aviso: '#b9770e', info: '#2c5282' };
            const bloques = data.checks.map(c => {
                const okFila = !c.total;
                const icono = okFila ? '<i class="fas fa-check-circle" style="color:#27ae60"></i>'
                    : `<i class="fas ${c.nivel === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle'}" style="color:${color[c.nivel]}"></i>`;
                let tabla = '';
                if (c.total) {
                    const cols = Object.keys(c.filas[0]);
                    tabla = `<div style="max-height:160px;overflow:auto;margin-top:6px"><table style="width:100%;font-size:.72rem;border-collapse:collapse">
                        <tr>${cols.map(k => `<th style="text-align:left;padding:3px 6px;border-bottom:1px solid #ddd">${esc(k)}</th>`).join('')}</tr>
                        ${c.filas.map(f => `<tr>${cols.map(k => `<td style="padding:3px 6px;border-bottom:1px solid #f0f0f0">${esc(fmt(f[k]))}</td>`).join('')}</tr>`).join('')}
                    </table>${c.total > c.filas.length ? `<div style="font-size:.7rem;color:#718096">… y ${c.total - c.filas.length} más</div>` : ''}</div>`;
                }
                return `<div style="text-align:left;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px">
                    <div style="font-weight:800;font-size:.85rem">${icono} ${esc(c.titulo)} <span style="float:right">${okFila ? 'OK' : c.total}</span></div>
                    <div style="font-size:.72rem;color:#718096">${esc(c.detalle)}</div>${tabla}</div>`;
            }).join('');
            const r = data.resumen || {};
            Swal.fire({
                width: 820, icon: data.ok ? 'success' : 'warning',
                title: data.ok ? 'Integridad correcta' : 'Se encontraron inconsistencias',
                html: `<div style="font-size:.78rem;color:#4a5568;margin-bottom:10px">${r.Compras ?? 0} compras · ${r.LineasConProducto ?? 0} líneas con producto · ${r.Productos ?? 0} productos · ${r.Ventas ?? 0} ventas vigentes</div>${bloques}`,
                confirmButtonColor: '#1a365d'
            });
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || e.message, 'error');
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
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; margin-bottom:8px; background:#f6f8fb; border:1px solid #e3e8ef; border-radius:10px;">
                            <div>
                                <strong>${p.Nombre}</strong>
                                <span style="font-size:0.75rem; color:#7f8c8d;"> — ${p.CategoriaNombre || 'Sin categoría'}</span>
                            </div>
                            <button class="inv-ib k" onclick="InventarioModule.reactivarProducto(${p.ProductoID})">
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
                width: 520
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
        
        const st = document.getElementById('stockProd'); if (st) st.value = parseInt(p.StockActual) || 0;
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