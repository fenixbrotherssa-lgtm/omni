const api = require('./api');
const { verAsiento } = require('./verAsiento');

/**
 * CARGA DINÁMICA DE LIBRERÍA QR VÍA HTTP
 * Se consume directamente desde el servidor Express local.
 */
// Subir la versión cada vez que cambie qrcode.min.js: el backend lo sirve con caché
// y sin esto los clientes seguirían usando la copia vieja (la del bug de tildes/ñ).
const QR_LIB_VERSION = '20261015';

function loadQRCodeLib() {
    return new Promise(async (resolve) => {
        if (window.QRCode) return resolve();

        try {
            const baseUrl = api.defaults.baseURL.replace('/api', '');
            const scriptUrl = `${baseUrl}/assets/js/qrcode.min.js?v=${QR_LIB_VERSION}`;

            const response = await fetch(scriptUrl);
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

            const scriptContent = await response.text();

            const script = document.createElement('script');
            script.id = 'qr-lib';
            script.textContent = scriptContent;

            document.head.appendChild(script);
            console.log("✅ QR Lib inyectada exitosamente desde el servidor local");
            resolve();
        } catch (error) {
            console.error("❌ Error al inyectar QR Lib vía fetch. Usando fallback...", error);
            const baseUrl = api.defaults.baseURL.replace('/api', '');
            const scriptFallback = document.createElement('script');
            scriptFallback.src = `${baseUrl}/assets/js/qrcode.min.js?v=${QR_LIB_VERSION}`;
            scriptFallback.onload = resolve;
            scriptFallback.onerror = () => {
                console.error("Fallo crítico: No se pudo cargar qrcode.min.js.");
                resolve();
            };
            document.head.appendChild(scriptFallback);
        }
    });
}

/**
 * qrcode.min.js no crece solo: sin `typeNumber` usa un tamaño fijo y lanza
 * "code length overflow" con textos largos (y, sin try/catch, dejaba sin QR a
 * todos los activos siguientes). Se reintenta con typeNumber creciente hasta
 * que el texto completo entre (portado de MasterHotel).
 */
function crearQRSeguro(container, text, opts) {
    const { width = 100, height = 100, correctLevel } = opts || {};
    let ultimoError = null;
    for (let typeNumber = 4; typeNumber <= 40; typeNumber++) {
        try {
            container.innerHTML = '';
            return new window.QRCode(container, { text, width, height, correctLevel, typeNumber });
        } catch (err) { ultimoError = err; }
    }
    throw ultimoError || new Error('No se pudo generar el QR.');
}

const _esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ActivosModule = {
    activosCache: [],
    tiposCache: [],
    sedeActualInfo: null,
    modoActual: 'REGISTRO',
    state: {
        busqueda: '',
        tipo: 'TODOS',
        estado: 'TODOS'
    },

    async init() {
        console.log("ActivosModule: Inicializado correctamente");

        window.backView = 'inventario';
        if (typeof Router !== 'undefined') Router.showBack(false);

        const container = document.getElementById('seccion-activos');
        if (container) container.style.display = 'block';

        window.ActivosModule = this;
        this.renderSedeSelector();

        await loadQRCodeLib();
        await this.cargarTipos();
        await this.cargarActivos();
        this.initFiltrosListeners();
    },

    // Tipos reales del catálogo (filtro, alta y edición)
    async cargarTipos() {
        try { this.tiposCache = (await api.get('/activos/tipos')).data || []; }
        catch (_) { this.tiposCache = []; }
        const ops = this.tiposCache.map(t => `<option value="${t.TipoID}">${_esc(t.Nombre)}</option>`).join('');
        const f = document.getElementById('filtroTipoActivo');
        if (f) { f.innerHTML = '<option value="TODOS">Todos los Tipos</option>' + ops; f.value = this.state.tipo || 'TODOS'; }
        const sel = document.getElementById('tipo-input');
        if (sel) sel.innerHTML = ops || '<option value="">— sin tipos —</option>';
    },

    renderSedeSelector() {
        App.renderSedeSelector('sedeSelectorActivos', () => this.cargarActivos());
    },

    getSedeId() {
        const selector = document.getElementById('globalSedeSelector');
        if (selector) return selector.value;
        return localStorage.getItem('currentSedeId') || App.user.SedeID;
    },

    initFiltrosListeners() {
        const inputBusqueda = document.getElementById('filtroTextoActivo');
        const selectTipo = document.getElementById('filtroTipoActivo');
        const selectEstado = document.getElementById('filtroEstadoActivo');

        if (inputBusqueda) {
            inputBusqueda.oninput = (e) => {
                this.state.busqueda = e.target.value;
                this.renderizarGrid();
            };
        }
        if (selectTipo) {
            selectTipo.onchange = (e) => {
                this.state.tipo = e.target.value;
                this.renderizarGrid();
            };
        }
        if (selectEstado) {
            selectEstado.onchange = (e) => {
                this.state.estado = e.target.value;
                this.renderizarGrid();
            };
        }
    },

    async cargarActivos() {
        try {
            const sedeId = this.getSedeId();

            // (Antes llamaba a /sede/:id, que no existe: la grilla siempre daba error.)
            let sedes = (window.App && App.sedes && App.sedes.length) ? App.sedes : null;
            if (!sedes) sedes = (await api.get('/admin/sedes')).data || [];
            this.sedeActualInfo = sedes.find(s => String(s.SedeID) === String(sedeId)) || { NombreComercial: 'Empresa' };

            const res = await api.get(`/activos/${sedeId}?incluirBajas=1`);
            this.activosCache = (res && res.data) ? res.data : [];
            this.renderizarGrid();
        } catch (err) {
            console.error("Error al cargar activos:", err);
            const grid = document.getElementById('grid-activos');
            if (grid) grid.innerHTML = '<p style="padding:20px; color:red;">Error de conexión con la base de datos.</p>';
        }
    },

    renderizarGrid() {
        const grid = document.getElementById('grid-activos');
        if (!grid) return;

        const activosFiltrados = this.activosCache.filter(a => {
            const busquedaLower = this.state.busqueda.toLowerCase();
            const matchBusqueda = a.Nombre.toLowerCase().includes(busquedaLower) ||
                                  (a.SeriePlaca && a.SeriePlaca.toLowerCase().includes(busquedaLower));
            const matchTipo = (this.state.tipo === 'TODOS' || a.TipoID == this.state.tipo);
            const estadoActivo = a.Estado || 'OPERATIVO';
            // Por defecto (TODOS) NO se muestran los dados de baja / vendidos;
            // solo aparecen si el filtro apunta explícitamente a ellos.
            const esBaja = ['BAJA', 'VENDIDO'].includes(estadoActivo);
            const matchEstado = this.state.estado === 'TODOS' ? !esBaja : estadoActivo === this.state.estado;

            return matchBusqueda && matchTipo && matchEstado;
        });

        if (activosFiltrados.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:50px; font-weight:bold; color:#7f8c8d;">NO SE ENCONTRARON ACTIVOS CON ESTOS FILTROS</p>';
            return;
        }

        const baseUrl = api.defaults.baseURL.replace('/api', '');
        const esAdmin = App.isSuperAdmin();
        grid.innerHTML = activosFiltrados.map(a => {
            const necesitaReingreso = (a.Estado === 'EN TRÁNSITO' || a.Estado === 'EN MANTENIMIENTO');
            const esBaja = ['BAJA', 'VENDIDO'].includes(a.Estado);
            const cant = parseInt(a.Cantidad, 10) || 1;
            const costo = Number(a.ValorCompra || 0) * cant;
            const enLibros = (costo - Number(a.DepreciacionAcumulada || 0)).toFixed(2);
            const fotoUrl = a.FotoPath ? `${baseUrl}/uploads/${String(a.FotoPath).replace(/^\/?uploads\//, '')}` : '';
            return `
                <div class="card-activo" style="border: 1px solid #ccc; padding: 20px; border-radius: 20px; text-align: center; background: var(--hotel-bg); box-shadow: 6px 6px 12px var(--hotel-shadow-dark); ${esBaja ? 'opacity:.6; filter:grayscale(.5);' : ''}">
                    <h3 style="margin-top:0; margin-bottom:2px; color: var(--hotel-blue); font-size: 1.1rem; text-transform: uppercase;">${_esc(a.Nombre)}${cant > 1 ? ` <span style="color:var(--hotel-gold)">×${cant}</span>` : ''}</h3>
                    ${(a.Marca || a.Modelo) ? `<p style="margin:0 0 6px; font-size:.7rem; font-weight:700; color:#7f8c8d; text-transform:uppercase;">${_esc([a.Marca, a.Modelo].filter(Boolean).join(' · '))}</p>` : ''}
                    ${fotoUrl ? `<img src="${fotoUrl}" alt="Foto" style="width:100%; max-height:150px; object-fit:cover; border-radius:12px; margin:6px 0;">` : ''}
                    <div id="qr-${a.ActivoID}" class="qr-container" style="width: 100px; height: 100px; margin: 15px auto; background: white; padding: 5px; border-radius: 10px;"></div>
                    <p style="margin: 5px 0; font-size: 0.85rem;"><strong>SERIE:</strong> ${_esc(a.SeriePlaca || 'S/N')}</p>
                    ${a.Ubicacion ? `<p style="margin: 5px 0; font-size: 0.85rem;"><strong>UBICACIÓN:</strong> ${_esc(a.Ubicacion)}</p>` : ''}
                    <p style="margin: 5px 0; font-size: 0.8rem;"><strong>COSTO:</strong> $${costo.toFixed(2)}${cant > 1 ? ` <span style="opacity:.6">($${Number(a.ValorCompra).toFixed(2)} c/u)</span>` : ''} &nbsp;·&nbsp; <strong>EN LIBROS:</strong> $${enLibros}</p>
                    ${a.Condicion || a.Responsable ? `<p style="margin: 5px 0; font-size: 0.78rem;">${a.Condicion ? `<strong>COND:</strong> ${_esc(a.Condicion)}` : ''}${a.Condicion && a.Responsable ? ' · ' : ''}${a.Responsable ? `<strong>RESP:</strong> ${_esc(a.Responsable)}` : ''}</p>` : ''}
                    ${a.OrigenRegistro === 'LEVANTAMIENTO' ? '<p style="margin:3px 0; font-size:.68rem; color:#1e8e4e; font-weight:800;"><i class="fas fa-mobile-screen-button"></i> LEVANTAMIENTO MÓVIL</p>' : ''}
                    <p style="margin: 5px 0; font-size: 0.85rem;"><strong>ESTADO:</strong>
                        <span style="color:${esBaja ? '#e74c3c' : 'var(--hotel-gold)'}; font-weight:800">${a.Estado || 'OPERATIVO'}</span>
                        ${esBaja && a.MotivoBaja ? `<br><span style="font-size:.72rem;color:#7f8c8d">${a.MotivoBaja}${a.ValorBaja ? ` · $${Number(a.ValorBaja).toFixed(2)}` : ''} · ${(a.FechaBaja || '').slice(0, 10)}${a.VoucherBajaPath ? ` · <a href="#" onclick="event.preventDefault();ActivosModule._abrirArchivo('${a.VoucherBajaPath}')" style="color:#2f7be6;font-weight:800">comprobante</a>` : ''}</span>` : ''}
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:15px;">
                        ${esBaja && a.AsientoBajaID ? `
                            <button class="btn-neo no-print" style="justify-content:center; color:#2e7d32;" onclick="ActivosModule.verAsientoBaja(${a.AsientoBajaID})">
                                <i class="fas fa-book"></i> VER ASIENTO DE BAJA
                            </button>
                        ` : ''}
                        ${esBaja && esAdmin ? `
                            <button class="btn-neo no-print" style="justify-content:center; background:#2e7d32; color:#fff;" onclick="ActivosModule.reactivar(${a.ActivoID})">
                                <i class="fas fa-rotate-left"></i> REACTIVAR (REVIERTE LA BAJA)
                            </button>
                        ` : ''}
                        ${esBaja ? '' : `
                            <button class="btn-neo no-print" style="justify-content:center; color:#2e7d32;" onclick="ActivosModule.verDepreciaciones(${a.ActivoID}, '${(a.Nombre || '').replace(/'/g, '')}')">
                                <i class="fas fa-book"></i> DEPRECIACIONES
                            </button>
                        `}
                        ${esBaja ? '' : necesitaReingreso ? `
                            <button class="btn-neo no-print" style="justify-content:center; background: #27ae60; color: white;" onclick="ActivosModule.abrirModalReingreso(${a.ActivoID})">
                                <i class="fas fa-check-circle"></i> CONFIRMAR RECEPCIÓN
                            </button>
                        ` : `
                            <button class="btn-neo no-print" style="justify-content:center;" onclick="ActivosModule.abrirModalMovimiento(${a.ActivoID})">
                                <i class="fas fa-exchange-alt"></i> REGISTRAR SALIDA
                            </button>
                            ${esAdmin ? `<button class="btn-neo no-print" style="justify-content:center; background:#34495e; color:#fff;" onclick="ActivosModule.abrirEdicion(${a.ActivoID})">
                                <i class="fas fa-pen"></i> EDITAR FICHA
                            </button>` : ''}
                            <button class="btn-neo no-print" style="justify-content:center; background:#fdeceb; color:#c0392b;" onclick="ActivosModule.abrirBaja(${a.ActivoID})">
                                <i class="fas fa-gavel"></i> DAR DE BAJA / VENDER
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        activosFiltrados.forEach(a => {
            const container = document.getElementById(`qr-${a.ActivoID}`);
            if (container && window.QRCode) {
                try {
                    crearQRSeguro(container, this._textoQR(a), { width: 100, height: 100, correctLevel: window.QRCode.CorrectLevel.M });
                } catch (err) {
                    console.error(`No se pudo generar el QR del activo ${a.ActivoID}:`, err);
                    container.innerHTML = '<span style="font-size:.65rem;color:#e74c3c;">QR no disponible</span>';
                }
            }
        });
    },

    _textoQR(a) {
        return `ACTIVO: ${a.Nombre}\nSERIE: ${a.SeriePlaca || 'S/N'}\nEMPRESA: ${this.sedeActualInfo.NombreComercial}` +
               `${a.Ubicacion ? `\nUBICACIÓN: ${a.Ubicacion}` : ''}\nID: ${a.ActivoID}`;
    },

    gestionarCambioTipoMovimiento(valor) {
        const contenedorSede = document.getElementById('div-sede-destino');
        if (contenedorSede) {
            contenedorSede.style.display = (valor === 'TRASLADO') ? 'block' : 'none';
        }
    },

    // --- SOLUCIÓN: PRE-RENDERIZADO BASE64 ---
    async imprimirTodasLasEtiquetas() {
        if (this.activosCache.length === 0) return alert("No hay activos para imprimir.");

        const sedeNombre = this.sedeActualInfo ? this.sedeActualInfo.NombreComercial : "EMPRESA";

        // Función auxiliar para convertir un texto a QR en Base64 usando el DOM actual
        const generarQRBase64 = (texto) => {
            return new Promise((resolve) => {
                const tempDiv = document.createElement('div');
                try {
                    // Se dibuja a 360 px y la etiqueta lo muestra a 90 px: impreso queda nítido
                    // (a 90 px reales cada módulo mide 1-2 px y la cámara no lo lee en papel).
                    crearQRSeguro(tempDiv, texto, { width: 360, height: 360, correctLevel: window.QRCode.CorrectLevel.M });
                } catch (err) {
                    console.error('No se pudo generar el QR para la etiqueta:', err);
                    return resolve('');
                }

                // Extraer el Base64 del canvas generado
                setTimeout(() => {
                    const canvas = tempDiv.querySelector('canvas');
                    if (canvas) {
                        resolve(canvas.toDataURL('image/png'));
                    } else {
                        const img = tempDiv.querySelector('img');
                        resolve(img ? img.src : '');
                    }
                }, 20);
            });
        };

        // Construir HTML inyectando directamente las imágenes
        let etiquetasHTML = '';
        for (const a of this.activosCache.filter(x => !['BAJA', 'VENDIDO'].includes(x.Estado))) {
            const base64Img = await generarQRBase64(this._textoQR(a));

            etiquetasHTML += `
                <div class="etiqueta">
                    <div class="header-tag">${sedeNombre}</div>
                    <div class="activo-name">${a.Nombre}</div>
                    <div class="qr-box">
                        <img src="${base64Img}" style="width: 100%; height: 100%; object-fit: contain;">
                    </div>
                    <div class="footer-tag">S/N: ${a.SeriePlaca || 'N/A'}${a.Ubicacion ? ' · ' + a.Ubicacion : ''}</div>
                    <div class="footer-tag" style="font-weight:bold;">ID CONTROL: ${a.ActivoID}</div>
                </div>
            `;
        }

        // Generar la ventana de impresión pura y estática
        const ventana = window.open('', '_blank');
        ventana.document.write(`
            <html>
                <head>
                    <title>Etiquetas Auditales - ${sedeNombre}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 10px; background: white; }
                        .grid-etiquetas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                        .etiqueta { border: 1px solid #1a365d; padding: 10px; text-align: center; page-break-inside: avoid; border-radius: 8px; }
                        .header-tag { font-size: 9px; font-weight: bold; color: #1a365d; border-bottom: 1px solid #c5a059; margin-bottom: 5px; padding-bottom: 2px; text-transform: uppercase; }
                        .activo-name { font-size: 11px; font-weight: 800; margin: 4px 0; color: #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                        .qr-box { width: 90px; height: 90px; margin: 5px auto; }
                        .footer-tag { font-size: 8px; font-weight: 600; color: #444; margin-top: 2px; }
                        @media print { .no-print { display: none !important; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="background:#1a365d; color:white; padding:15px; text-align:center; cursor:pointer; font-weight:bold; margin-bottom:20px; border-radius:5px;" onclick="window.print()">
                        <i class="fas fa-print"></i> CLIC AQUÍ PARA INICIAR IMPRESIÓN DE ETIQUETAS
                    </div>
                    <div class="grid-etiquetas">
                        ${etiquetasHTML}
                    </div>
                </body>
            </html>
        `);
        ventana.document.close();
    },

    async imprimirReporteOficial(tipoFiltro = 'TODOS') {
        const datos = (tipoFiltro === 'TODOS')
            ? this.activosCache
            : this.activosCache.filter(a => a.TipoID == tipoFiltro);

        const totalAcumulado = datos.reduce((sum, a) => sum + parseFloat(a.ValorCompra || 0) * (parseInt(a.Cantidad) || 1), 0);

        let logoUrl = '';
        if (this.sedeActualInfo && this.sedeActualInfo.LogoPath) {
            const fileName = this.sedeActualInfo.LogoPath.split(/[\\/]/).pop();
            logoUrl = `${window.AppConfig.apiUrl}/uploads/sedes/logos/${fileName}`;
        }

        const fecha = new Date().toLocaleString();
        const ventana = window.open('', '_blank', 'width=900,height=800');

        ventana.document.write(`
            <html>
                <head>
                    <title>Reporte de Activos</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #333; }
                        header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a365d; padding-bottom: 20px; align-items: center; }
                        .logo { max-height: 80px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                        th { background: #f2f2f2; padding: 10px; border: 1px solid #ccc; text-align: left; }
                        td { padding: 10px; border: 1px solid #ccc; font-size: 0.9rem; }
                        .total-row { font-weight: bold; background: #e8e8e8; }
                        .firmas { display: flex; justify-content: space-between; margin-top: 100px; }
                        .linea { width: 220px; border-top: 1px solid #000; text-align: center; padding-top: 10px; font-weight: bold; }
                    </style>
                </head>
                <body onload="setTimeout(() => { window.print(); }, 800)">
                    <header>
                        ${logoUrl ? `<img src="${logoUrl}" class="logo">` : '<div></div>'}
                        <div style="text-align:right;">
                            <h2 style="margin:0;">${this.sedeActualInfo.NombreComercial}</h2>
                            <p style="margin:5px 0;">Reporte de Inventario de Activos</p>
                            <small>Generado: ${fecha}</small>
                        </div>
                    </header>
                    <table>
                        <thead><tr><th>Nombre</th><th>Ubicación</th><th>Serie</th><th>Cant.</th><th>Estado</th><th>Valor</th></tr></thead>
                        <tbody>
                            ${datos.map(a => `
                                <tr>
                                    <td>${a.Nombre}</td>
                                    <td>${a.Ubicacion || '—'}</td>
                                    <td>${a.SeriePlaca || 'S/N'}</td>
                                    <td>${parseInt(a.Cantidad) || 1}</td>
                                    <td>${a.Estado || 'OPERATIVO'}</td>
                                    <td>$${(parseFloat(a.ValorCompra || 0) * (parseInt(a.Cantidad) || 1)).toFixed(2)}</td>
                                </tr>`).join('')}
                            <tr class="total-row">
                                <td colspan="5" style="text-align: right;">TOTAL GENERAL</td>
                                <td>$${totalAcumulado.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="firmas">
                        <div class="linea">Elaborado por</div>
                        <div class="linea">Gerencia</div>
                        <div class="linea">Recibido</div>
                    </div>
                </body>
            </html>
        `);
        ventana.document.close();
    },

    imprimirActaMovimiento(datos) {
        const ventanaActa = window.open('', '_blank', 'width=800,height=800');
        ventanaActa.document.write(`
            <html>
                <head>
                    <title>Acta de Movimiento</title>
                    <style>
                        body { font-family: sans-serif; padding: 50px; line-height: 1.5; }
                        .header { text-align: center; border-bottom: 2px solid #1a365d; margin-bottom: 30px; padding-bottom: 10px; }
                        .content { margin-bottom: 50px; }
                        .firmas { display: flex; justify-content: space-between; margin-top: 100px; }
                        .linea { width: 250px; border-top: 1px solid #000; text-align: center; padding-top: 10px; font-weight: bold; }
                    </style>
                </head>
                <body onload="window.print(); setTimeout(() => { window.close(); }, 500)">
                    <div class="header">
                        <h2>${this.sedeActualInfo.NombreComercial}</h2>
                        <h3>ACTA DE ENTREGA / RECEPCIÓN DE ACTIVO</h3>
                    </div>
                    <div class="content">
                        <p><strong>FECHA:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>TIPO DE MOVIMIENTO:</strong> ${datos.Tipo}</p>
                        <hr>
                        <p><strong>ACTIVO:</strong> ${datos.Nombre}</p>
                        <p><strong>SERIE / PLACA:</strong> ${datos.Serie}</p>
                        <p><strong>RESPONSABLE:</strong> ${datos.Responsable}</p>
                        <p><strong>OBSERVACIONES:</strong> ${datos.Observaciones || 'Sin observaciones adicionales'}</p>
                    </div>
                    <div class="firmas">
                        <div class="linea">ENTREGUÉ CONFORME</div>
                        <div class="linea">RECIBÍ CONFORME</div>
                    </div>
                </body>
            </html>
        `);
        ventanaActa.document.close();
    },

    async cargarHistorial(id) {
        const lista = document.getElementById('lista-historial-mov');
        const container = document.getElementById('historial-movimientos-container');
        if (!lista || !container) return;

        lista.innerHTML = '<p style="text-align:center; font-size:0.7rem;">Cargando historial...</p>';
        container.style.display = 'block';

        try {
            const res = await api.get(`/activos/historial/${id}`);
            const historial = res.data || [];

            if (historial.length === 0) {
                lista.innerHTML = '<p style="text-align:center; font-size:0.7rem; opacity:0.6;">Sin movimientos previos.</p>';
                return;
            }

            lista.innerHTML = historial.map(h => `
                <div class="timeline-item" style="padding: 10px; margin-bottom: 10px; border-radius: 10px; background: var(--hotel-bg); box-shadow: 3px 3px 6px var(--hotel-shadow-dark), -3px -3px 6px var(--hotel-shadow-light); font-size: 0.75rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:900; color:var(--hotel-blue); margin-bottom:5px;">
                        <span>${h.TipoMovimiento}</span>
                        <span>${new Date(h.FechaMovimiento).toLocaleDateString()}</span>
                    </div>
                    <p style="margin:0; opacity:0.8;"><strong>Resp:</strong> ${h.Responsable}</p>
                    <p style="margin:0; font-style:italic; font-size:0.7rem;">"${h.Observaciones || 'Sin observaciones'}"</p>
                </div>
            `).join('');
        } catch (err) {
            lista.innerHTML = '<p style="color:red; font-size:0.7rem;">Error al cargar historial.</p>';
        }
    },

    async ejecutarConfirmacion() {
        if (this.modoActual === 'REGISTRO') {
            await this.guardar();
        } else if (this.modoActual === 'MOVIMIENTO') {
            await this.registrarMovimiento();
        } else if (this.modoActual === 'REINGRESO') {
            await this.confirmarReingreso();
        }
    },

    async guardar() {
        const v = id => (document.getElementById(id)?.value || '').trim();
        const payload = {
            Nombre: v('nombre-input'), SeriePlaca: v('serie-input'),
            ValorCompra: parseFloat(v('valor-input')) || 0, Cantidad: parseInt(v('cantidad-input')) || 1,
            TipoID: parseInt(v('tipo-input')), SedeActualID: parseInt(this.getSedeId()),
            Ubicacion: v('ubicacion-input'), Marca: v('marca-input'), Modelo: v('modelo-input'),
            Responsable: v('responsable-activo-input')
        };

        if (!payload.Nombre || isNaN(payload.TipoID)) {
            return Swal.fire('Faltan datos', 'Nombre y Tipo de Activo son obligatorios.', 'warning');
        }

        try {
            await api.post('/activos', payload);
            this.cerrarModal();
            await this.cargarActivos();
        } catch (err) {
            Swal.fire('No se guardó', err.response?.data?.error || err.message, 'error');
        }
    },

    // ── Levantamiento de inventario desde el celular (empresa activa) ──
    async mostrarQRLevantamiento() {
        const sedeId = this.getSedeId();
        let info;
        // El QR usa el dominio/IP con el que ESTA app llega a su servidor (Configurar servidor)
        const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
        try { info = (await api.get(`/activos/levantamiento-url?sedeId=${sedeId}&base=${encodeURIComponent(base)}`)).data; }
        catch (e) { return Swal.fire('No disponible', e.response?.data?.error || e.message, 'error'); }

        await loadQRCodeLib();
        let qr = '';
        if (window.QRCode) {
            const tmp = document.createElement('div');
            try { crearQRSeguro(tmp, info.url, { width: 280, height: 280, correctLevel: window.QRCode.CorrectLevel.M }); } catch (_) {}
            await new Promise(r => setTimeout(r, 40));
            const c = tmp.querySelector('canvas'), im = tmp.querySelector('img');
            qr = c ? c.toDataURL('image/png') : (im ? im.src : '');
        }
        const emp = info.empresa || {};
        Swal.fire({
            width: 560, showConfirmButton: true, confirmButtonText: 'Listo', confirmButtonColor: '#1a365d',
            title: 'Levantamiento de inventario',
            html: `
                <div style="text-align:left;font-size:.85rem">
                    <div style="background:#0f1e33;color:#fff;border-radius:12px;padding:12px 14px;margin-bottom:10px">
                        <div style="font-size:.6rem;letter-spacing:1px;color:#9fb8d6;font-weight:800">EMPRESA DEL INVENTARIO</div>
                        <div style="font-size:1.05rem;font-weight:900">${_esc(emp.NombreComercial)}</div>
                        <div style="font-size:.75rem;color:#9fb8d6">RUC ${_esc(emp.RUC || '—')}</div>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:8px;font-size:.78rem;margin-bottom:6px">
                        <span><b>Servidor:</b> ${_esc(info.servidor)}</span>
                        <span style="color:${info.alcanzable ? '#1e8e4e' : '#c0392b'};font-weight:800">${info.alcanzable ? '● accesible desde el celular' : '● no accesible'}</span>
                    </div>
                    ${info.aviso ? `<div style="background:#fff4e5;border:1px solid #f5c48b;color:#8a4b00;border-radius:10px;padding:8px 10px;font-size:.75rem;margin-bottom:8px">${_esc(info.aviso)}</div>` : ''}
                    <div style="text-align:center;margin:10px 0">${qr ? `<img src="${qr}" width="240" height="240" style="background:#fff;padding:10px;border-radius:12px;border:1px solid #e2e8f0">` : '<p>No se pudo generar el QR</p>'}</div>
                    <div style="font-size:.72rem;word-break:break-all;text-align:center;color:#2f7be6">${_esc(info.url)}</div>
                    ${(info.alternativas || []).length ? `<div style="font-size:.7rem;color:#718096;margin-top:6px">Otras direcciones de este servidor: ${info.alternativas.map(_esc).join(' · ')}</div>` : ''}
                    <ol style="font-size:.78rem;line-height:1.6;margin:12px 0 0;padding-left:18px;color:#333">
                        <li>Escanea el código con la cámara del celular e ingresa con tu usuario.</li>
                        <li>Escribe el <b>lugar</b> donde vas a inventariar (bodega, oficina, local…). Queda fijo hasta que lo cambies.</li>
                        <li>Por cada activo: foto, nombre, cantidad, valor y condición → "Guardar y siguiente".</li>
                        <li>Todo queda en <b>${_esc(emp.NombreComercial)}</b> y aparece aquí al recargar.</li>
                    </ol>
                </div>`
        });
    },

    // ── Reactivar un activo dado de baja por error (revierte lo contable) ──
    async reactivar(id) {
        const a = this.activosCache.find(x => x.ActivoID === id);
        if (!a) return;
        const r = await Swal.fire({
            icon: 'warning', title: 'Reactivar activo', width: 560,
            html: `<div style="text-align:left;font-size:.85rem">
                <p><b>${_esc(a.Nombre)}</b> está <b>${_esc(a.Estado)}</b>${a.MotivoBaja ? ` (${_esc(a.MotivoBaja)})` : ''}. Al reactivarlo:</p>
                <ul style="margin:6px 0 10px;padding-left:18px;line-height:1.6">
                    <li>Si el mes de la baja sigue abierto, se <b>anula el asiento de baja</b>.</li>
                    <li>Si ese mes ya está cerrado, se registra un <b>contra-asiento con fecha de hoy</b>.</li>
                    <li>Si fue venta a crédito sin cobros, se anula la cuenta por cobrar.</li>
                    <li>La depreciación acumulada vuelve a la contabilizada.</li>
                </ul>
                <input id="react-mot" class="swal2-input" style="margin:0;width:100%" placeholder="Motivo (obligatorio)">
            </div>`,
            showCancelButton: true, confirmButtonText: 'Reactivar', confirmButtonColor: '#2e7d32', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const m = document.getElementById('react-mot').value.trim();
                if (m.length < 5) return Swal.showValidationMessage('Indique el motivo (mínimo 5 caracteres)');
                return m;
            }
        });
        if (!r.isConfirmed) return;
        try {
            const d = (await api.post(`/activos/${id}/reactivar`, { motivo: r.value })).data;
            const det = d.modo === 'ANULAR' ? 'Se anuló el asiento de baja.'
                : d.modo === 'CONTRA_ASIENTO' ? `El mes de la baja estaba cerrado: se registró el contra-asiento #${d.contraAsientoId}.`
                : 'La baja no tenía asiento contable.';
            Swal.fire({ icon: 'success', title: 'Activo reactivado', text: det + (d.cxcAnuladas?.length ? ' La cuenta por cobrar de la venta quedó anulada.' : ''), confirmButtonColor: '#1a365d' });
            await this.cargarActivos();
        } catch (e) { Swal.fire('No se reactivó', e.response?.data?.error || e.message, 'error'); }
    },

    // ── Editar ficha (solo administrador) ──
    async abrirEdicion(id) {
        const a = this.activosCache.find(x => x.ActivoID === id);
        if (!a) return;
        const conDep = Number(a.DepreciacionAcumulada) > 0;
        const tipos = this.tiposCache.map(t => `<option value="${t.TipoID}" ${t.TipoID == a.TipoID ? 'selected' : ''}>${_esc(t.Nombre)}</option>`).join('');
        const conds = ['', 'BUENO', 'REGULAR', 'MALO', 'DAÑADO'].map(c => `<option value="${c}" ${c === (a.Condicion || '') ? 'selected' : ''}>${c || '—'}</option>`).join('');
        const campo = (lbl, html) => `<label style="display:block;font-size:.7rem;font-weight:800;color:#1a365d;margin:8px 0 3px">${lbl}</label>${html}`;
        const inp = (id2, val, extra = '') => `<input id="${id2}" class="swal2-input" style="margin:0;width:100%" value="${_esc(val ?? '')}" ${extra}>`;
        const { value: f } = await Swal.fire({
            title: 'Editar activo', width: 620, showCancelButton: true, confirmButtonText: 'Guardar', confirmButtonColor: '#1a365d',
            html: `<div style="text-align:left">
                ${campo('Nombre', inp('ed-nom', a.Nombre))}
                <div style="display:flex;gap:10px">
                    <div style="flex:1">${campo('Tipo', `<select id="ed-tipo" class="swal2-select" style="margin:0;width:100%">${tipos}</select>`)}</div>
                    <div style="flex:1">${campo('Condición', `<select id="ed-cond" class="swal2-select" style="margin:0;width:100%">${conds}</select>`)}</div>
                </div>
                <div style="display:flex;gap:10px">
                    <div style="flex:1">${campo('Valor unitario ($)', inp('ed-val', a.ValorCompra, `type="number" step="0.01" ${conDep ? 'disabled' : ''}`))}</div>
                    <div style="flex:1">${campo('Cantidad', inp('ed-cant', a.Cantidad || 1, `type="number" min="1" step="1" ${conDep ? 'disabled' : ''}`))}</div>
                </div>
                ${conDep ? '<div style="font-size:.72rem;color:#8a4b00">Ya tiene depreciación contabilizada: valor y cantidad no se pueden cambiar.</div>' : ''}
                ${campo('Ubicación', inp('ed-ubic', a.Ubicacion))}
                <div style="display:flex;gap:10px">
                    <div style="flex:1">${campo('Serie / placa', inp('ed-serie', a.SeriePlaca))}</div>
                    <div style="flex:1">${campo('Responsable', inp('ed-resp', a.Responsable))}</div>
                </div>
                <div style="display:flex;gap:10px">
                    <div style="flex:1">${campo('Marca', inp('ed-marca', a.Marca))}</div>
                    <div style="flex:1">${campo('Modelo', inp('ed-modelo', a.Modelo))}</div>
                </div>
                ${campo('Observación', `<textarea id="ed-obs" class="swal2-textarea" style="margin:0;width:100%">${_esc(a.Observacion || '')}</textarea>`)}
            </div>`,
            preConfirm: () => {
                const g = x => document.getElementById(x).value;
                if (!g('ed-nom').trim()) return Swal.showValidationMessage('El nombre es obligatorio');
                return { Nombre: g('ed-nom'), TipoID: g('ed-tipo'), Condicion: g('ed-cond'), ValorCompra: g('ed-val'), Cantidad: g('ed-cant'),
                         Ubicacion: g('ed-ubic'), SeriePlaca: g('ed-serie'), Responsable: g('ed-resp'), Marca: g('ed-marca'),
                         Modelo: g('ed-modelo'), Observacion: g('ed-obs') };
            }
        });
        if (!f) return;
        try {
            await api.put(`/activos/${id}`, f);
            window.Toast && window.Toast.fire({ icon: 'success', title: 'Activo actualizado' });
            await this.cargarActivos();
        } catch (e) { Swal.fire('No se guardó', e.response?.data?.error || e.message, 'error'); }
    },

    async registrarMovimiento() {
        const user = JSON.parse(localStorage.getItem('user'));
        const tipoMov = document.getElementById('tipo-mov-input').value;
        const responsable = document.getElementById('responsable-input').value.trim();
        const obs = document.getElementById('obs-input').value.trim();

        const payload = {
            ActivoID: parseInt(document.getElementById('activoId-input').value),
            TipoMovimiento: tipoMov,
            Observaciones: obs,
            Responsable: responsable,
            SedeOrigenID: parseInt(this.getSedeId()),
            UsuarioID: user ? user.UsuarioID : 1,
            SedeDestinoID: tipoMov === 'TRASLADO' ? parseInt(document.getElementById('sede-destino-input').value) : null
        };

        if (!payload.ActivoID) return alert("No se identificó el activo.");

        try {
            const res = await api.post('/activos/movimiento', payload);
            if (res.data.success) {
                const activo = this.activosCache.find(a => a.ActivoID === payload.ActivoID);
                this.imprimirActaMovimiento({
                    Nombre: activo.Nombre,
                    Serie: activo.SeriePlaca || 'S/N',
                    Responsable: responsable,
                    Tipo: tipoMov,
                    Observaciones: obs
                });
                this.cerrarModal();
                await this.cargarActivos();
            }
        } catch (err) {
            console.error("Error en Registrar Movimiento:", err);
            alert("Error al registrar movimiento.");
        }
    },

    async confirmarReingreso() {
        const user = JSON.parse(localStorage.getItem('user'));
        const responsable = document.getElementById('responsable-input').value.trim();
        const obs = document.getElementById('obs-input').value.trim();

        const payload = {
            ActivoID: parseInt(document.getElementById('activoId-input').value),
            UsuarioID: user ? user.UsuarioID : 1,
            Observaciones: obs,
            Responsable: responsable || 'RECEPCIÓN',
            SedeActualID: parseInt(this.getSedeId())
        };

        try {
            const res = await api.post('/activos/recepcion', payload);
            if (res.data.success) {
                const activo = this.activosCache.find(a => a.ActivoID === payload.ActivoID);
                this.imprimirActaMovimiento({
                    Nombre: activo.Nombre,
                    Serie: activo.SeriePlaca || 'S/N',
                    Responsable: payload.Responsable,
                    Tipo: 'RECEPCIÓN / REINGRESO',
                    Observaciones: obs
                });
                this.cerrarModal();
                await this.cargarActivos();
            }
        } catch (err) {
            console.error("Error en Recepción:", err);
            alert("Error al confirmar recepción.");
        }
    },

    abrirModalRegistro() {
        this.modoActual = 'REGISTRO';
        this.limpiarFormulario();
        document.getElementById('form-registro').style.display = 'block';
        document.getElementById('form-movimiento').style.display = 'none';
        if (document.getElementById('historial-movimientos-container')) {
            document.getElementById('historial-movimientos-container').style.display = 'none';
        }
        document.getElementById('modal-activos').classList.remove('modal-hidden');
    },

    async abrirModalMovimiento(id) {
        this.modoActual = 'MOVIMIENTO';
        this.limpiarFormulario();
        document.getElementById('activoId-input').value = id;
        document.getElementById('form-registro').style.display = 'none';
        document.getElementById('form-movimiento').style.display = 'block';

        await this.cargarHistorial(id);

        try {
            const res = await api.get('/admin/sedes');
            const sedes = res.data || [];
            const sedeActual = parseInt(this.getSedeId());

            const comboSedeDestino = document.getElementById('sede-destino-input');
            if (comboSedeDestino) {
                comboSedeDestino.innerHTML = sedes
                    .filter(s => s.SedeID != sedeActual)
                    .map(s => `<option value="${s.SedeID}">${s.NombreComercial}</option>`)
                    .join('');
            }
        } catch (err) {
            console.error("Error al cargar sedes:", err);
        }

        const comboMov = document.getElementById('tipo-mov-input');
        if (comboMov) comboMov.style.display = 'block';
        this.gestionarCambioTipoMovimiento(comboMov ? comboMov.value : '');

        document.getElementById('modal-activos').classList.remove('modal-hidden');
    },

    async abrirModalReingreso(id) {
        this.modoActual = 'REINGRESO';
        this.limpiarFormulario();
        document.getElementById('activoId-input').value = id;
        document.getElementById('form-registro').style.display = 'none';
        document.getElementById('form-movimiento').style.display = 'block';

        await this.cargarHistorial(id);

        const comboMov = document.getElementById('tipo-mov-input');
        if (comboMov) {
            comboMov.value = 'RECEPCIÓN';
            comboMov.style.display = 'none';
        }

        const contenedorSede = document.getElementById('div-sede-destino');
        if (contenedorSede) contenedorSede.style.display = 'none';

        document.getElementById('modal-activos').classList.remove('modal-hidden');
    },

    cerrarModal() {
        document.getElementById('modal-activos').classList.add('modal-hidden');
    },

    limpiarFormulario() {
        const cant = document.getElementById('cantidad-input'); if (cant) cant.value = '1';
        ['nombre-input', 'serie-input', 'valor-input', 'activoId-input', 'obs-input', 'sede-destino-input', 'responsable-input',
         'ubicacion-input', 'marca-input', 'modelo-input', 'responsable-activo-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const comboMov = document.getElementById('tipo-mov-input');
        if (comboMov) {
            comboMov.value = 'TRASLADO';
            comboMov.style.display = 'block';
        }
    },

    // ── BAJA / VENTA / SUBASTA DE ACTIVO (con asiento contable) ──────────
    _mpBaja: [['1', 'Efectivo'], ['2', 'Transferencia'], ['3', 'Tarjeta Débito'], ['4', 'Tarjeta Crédito'], ['5', 'Deuna/QR']],

    _ensureBajaModal() {
        if (document.getElementById('actbaja-modal')) return;
        const w = document.createElement('div');
        w.innerHTML = `
        <div id="actbaja-modal" class="abm-bg" style="display:none;">
          <div class="abm">
            <div class="abm-h"><h3><i class="fas fa-gavel"></i> Dar de baja / vender activo</h3>
              <button onclick="ActivosModule.cerrarBaja()"><i class="fas fa-xmark"></i></button></div>
            <div class="abm-b">
              <input type="hidden" id="ab-id">
              <p id="ab-info" class="abm-info"></p>
              <label>Motivo
                <select id="ab-motivo" onchange="ActivosModule._bajaToggle()">
                  <option value="VENTA">Venta</option>
                  <option value="SUBASTA">Subasta / adjudicación</option>
                  <option value="DONACION">Donación</option>
                  <option value="OBSOLESCENCIA">Obsolescencia</option>
                  <option value="ROBO_PERDIDA">Robo / pérdida</option>
                  <option value="BAJA_TECNICA">Daño / baja técnica</option>
                </select>
              </label>
              <label>Depreciación acumulada a la fecha
                <input type="number" id="ab-dep" step="0.01" min="0" value="0">
                <small>Cuánto se ha depreciado el activo hasta hoy. El valor en libros = costo − depreciación.</small>
              </label>
              <div id="ab-venta-box">
                <label>Valor de venta / adjudicación
                  <input type="number" id="ab-valor" step="0.01" min="0" value="0">
                </label>
                <label class="abm-chk"><input type="checkbox" id="ab-credito" onchange="ActivosModule._bajaToggle()"> Venta a crédito (genera cuenta por cobrar)</label>
                <label id="ab-cli-box">Comprador <input type="text" id="ab-cli" placeholder="Nombre del comprador"></label>
                <label id="ab-mp-box">Método de pago
                  <select id="ab-mp">${this._mpBaja.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
                </label>
              </div>
              <label>Responsable <input type="text" id="ab-resp" placeholder="Quien autoriza la baja"></label>
              <label>Observaciones <input type="text" id="ab-obs"></label>
              <label>Comprobante (acta, factura, foto o PDF)
                <input type="file" id="ab-voucher" accept="image/*,application/pdf">
              </label>
              <div id="ab-preview" class="abm-prev"></div>
            </div>
            <div class="abm-f">
              <button class="abm-ghost" onclick="ActivosModule.cerrarBaja()">Cancelar</button>
              <button class="abm-save" onclick="ActivosModule.guardarBaja()"><i class="fas fa-check"></i> Confirmar baja</button>
            </div>
          </div>
        </div>
        <style>
          .abm-bg{position:fixed;inset:0;background:rgba(12,22,38,.6);display:flex;align-items:center;justify-content:center;z-index:4000;font-family:'Inter','Segoe UI',sans-serif}
          .abm{background:#fff;border-radius:16px;width:min(500px,94vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(0,0,0,.4)}
          .abm-h{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eef1f5}
          .abm-h h3{margin:0;font-size:.98rem;font-weight:900;color:#1a365d;letter-spacing:.5px}
          .abm-h h3 i{color:#c0392b;margin-right:8px}
          .abm-h button{border:none;background:#eef1f5;width:30px;height:30px;border-radius:8px;cursor:pointer;color:#5a6b7d}
          .abm-b{padding:16px 20px;overflow-y:auto}
          .abm-b label{display:block;font-size:.72rem;font-weight:800;color:#5a6b7d;text-transform:uppercase;letter-spacing:.3px;margin-bottom:12px}
          .abm-b input,.abm-b select{width:100%;margin-top:5px;padding:9px 11px;border:1px solid #d5dce5;border-radius:9px;font-size:.85rem;font-family:inherit;color:#16283c;outline:none}
          .abm-b small{display:block;margin-top:4px;font-weight:500;text-transform:none;color:#8b98a8;font-size:.72rem}
          .abm-chk{display:flex !important;align-items:center;gap:8px;text-transform:none !important;font-weight:700 !important}
          .abm-chk input{width:auto !important;margin:0 !important}
          .abm-info{font-size:.85rem;color:#1a365d;background:#f4f7fb;border-radius:8px;padding:10px 12px;margin:0 0 14px}
          .abm-prev{font-size:.8rem;background:#fff8e6;border:1px solid #f3e2b3;border-radius:8px;padding:10px 12px;margin-top:6px;white-space:pre-line}
          .abm-f{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #eef1f5}
          .abm-f button{border:none;border-radius:10px;padding:10px 18px;font-weight:800;font-size:.8rem;cursor:pointer}
          .abm-ghost{background:#e2e7ee;color:#5a6b7d} .abm-save{background:#c0392b;color:#fff}
        </style>`;
        document.body.appendChild(w);
        ['ab-dep', 'ab-valor'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = () => this._bajaPreview();
        });
    },

    abrirBaja(id) {
        const a = this.activosCache.find(x => x.ActivoID === id);
        if (!a) return;
        this._ensureBajaModal();
        document.getElementById('ab-id').value = id;
        document.getElementById('ab-info').textContent = `${a.Nombre} · costo $${Number(a.ValorCompra).toFixed(2)}`;
        document.getElementById('ab-motivo').value = 'VENTA';
        document.getElementById('ab-dep').value = Number(a.DepreciacionAcumulada || 0).toFixed(2);
        document.getElementById('ab-valor').value = '0';
        document.getElementById('ab-credito').checked = false;
        document.getElementById('ab-cli').value = '';
        document.getElementById('ab-resp').value = App.user?.NombreFull || '';
        document.getElementById('ab-obs').value = '';
        this._bajaToggle();
        document.getElementById('actbaja-modal').style.display = 'flex';
    },
    cerrarBaja() { const m = document.getElementById('actbaja-modal'); if (m) m.style.display = 'none'; },

    _bajaToggle() {
        const motivo = document.getElementById('ab-motivo').value;
        const esVenta = motivo === 'VENTA' || motivo === 'SUBASTA';
        document.getElementById('ab-venta-box').style.display = esVenta ? 'block' : 'none';
        const credito = document.getElementById('ab-credito').checked;
        document.getElementById('ab-cli-box').style.display = (esVenta && credito) ? 'block' : 'none';
        document.getElementById('ab-mp-box').style.display = (esVenta && !credito) ? 'block' : 'none';
        this._bajaPreview();
    },
    _bajaPreview() {
        const a = this.activosCache.find(x => x.ActivoID == document.getElementById('ab-id').value);
        if (!a) return;
        const motivo = document.getElementById('ab-motivo').value;
        const esVenta = motivo === 'VENTA' || motivo === 'SUBASTA';
        const costo = Number(a.ValorCompra) || 0;
        const dep = Math.min(parseFloat(document.getElementById('ab-dep').value) || 0, costo);
        const precio = esVenta ? (parseFloat(document.getElementById('ab-valor').value) || 0) : 0;
        const enLibros = costo - dep;
        const dif = precio - enLibros;
        let txt = `Valor en libros: $${enLibros.toFixed(2)}\n`;
        if (esVenta) txt += dif >= 0
            ? `Ganancia en venta: $${dif.toFixed(2)}  (ingreso)`
            : `Pérdida en venta: $${(-dif).toFixed(2)}  (gasto)`;
        else txt += `Pérdida por baja: $${enLibros.toFixed(2)}  (gasto)`;
        document.getElementById('ab-preview').textContent = txt;
    },

    async guardarBaja() {
        const motivo = document.getElementById('ab-motivo').value;
        const esVenta = motivo === 'VENTA' || motivo === 'SUBASTA';
        const credito = document.getElementById('ab-credito').checked;
        const payload = {
            ActivoID: parseInt(document.getElementById('ab-id').value),
            Motivo: motivo,
            DepreciacionAcumulada: parseFloat(document.getElementById('ab-dep').value) || 0,
            ValorVenta: esVenta ? (parseFloat(document.getElementById('ab-valor').value) || 0) : 0,
            ACredito: esVenta && credito,
            ClienteNombre: document.getElementById('ab-cli').value.trim() || null,
            MetodoPagoID: (esVenta && !credito) ? parseInt(document.getElementById('ab-mp').value) : null,
            Responsable: document.getElementById('ab-resp').value.trim() || null,
            Observaciones: document.getElementById('ab-obs').value.trim() || null
        };
        if (esVenta && payload.ValorVenta <= 0) {
            if (window.Toast) window.Toast.fire({ icon: 'warning', title: 'Indica el valor de venta' });
            return;
        }
        try {
            const r = await api.post('/activos/baja', payload);

            // Comprobante (llamada multipart aparte)
            const file = document.getElementById('ab-voucher')?.files?.[0];
            if (file) {
                try {
                    const fd = new FormData();
                    fd.append('voucher', file);
                    const base = api.base();
                    await window.axios.post(`${base}/activos/${payload.ActivoID}/voucher-baja`, fd, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                    });
                } catch (_) { if (window.Toast) window.Toast.fire({ icon: 'warning', title: 'Baja OK, pero el comprobante no se subió' }); }
            }

            this.cerrarBaja();
            if (window.Toast) window.Toast.fire({ icon: 'success', title: r.data.estado === 'VENDIDO' ? 'Activo vendido y contabilizado' : 'Activo dado de baja' });
            await this.cargarActivos();
        } catch (e) {
            if (window.Toast) window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error al dar de baja' });
        }
    },

    _abrirArchivo(rel) {
        const base = ((window.AppConfig && window.AppConfig.apiUrl) || '').replace(/\/api\/?$/, '');
        const u = `${base}/uploads/${rel}`;
        try { require('electron').shell.openExternal(u); } catch (_) { window.open(u, '_blank'); }
    },

    verAsientoBaja(asientoId) { verAsiento(asientoId); },

    async verDepreciaciones(activoId, nombre) {
        try {
            const r = await api.get(`/activos/depreciacion/activo/${activoId}`);
            const filas = r.data.depreciaciones || [];
            const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            Swal.fire({
                title: `Depreciaciones · ${nombre}`, width: 620,
                html: filas.length ? `<table style="width:100%;font-size:12px;border-collapse:collapse">
                    <thead><tr>
                      <th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:5px">Período</th>
                      <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:5px">Monto</th>
                      <th style="text-align:right;border-bottom:1px solid #cbd5e1;padding:5px">Acum. después</th>
                      <th style="border-bottom:1px solid #cbd5e1;padding:5px">Asiento</th>
                    </tr></thead><tbody>
                    ${filas.map(f => `<tr>
                      <td style="padding:5px">${meses[f.Mes]} ${f.Anio}</td>
                      <td style="text-align:right;padding:5px">$${Number(f.MontoMes).toFixed(2)}</td>
                      <td style="text-align:right;padding:5px">$${Number(f.DepAcumDespues).toFixed(2)}</td>
                      <td style="text-align:center;padding:5px">${f.AsientoID ? `<a href="#" onclick="event.preventDefault();ActivosModule.verAsientoBaja(${f.AsientoID})" style="color:#2e7d32;font-weight:800">#${f.AsientoID}</a>` : '—'}</td>
                    </tr>`).join('')}
                    </tbody></table>`
                    : '<p style="color:#94a3b8">Este activo aún no tiene depreciaciones registradas.</p>'
            });
        } catch (e) { Swal.fire('Error', e.response?.data?.error || 'No se pudo cargar.', 'error'); }
    },

    /* ============ DEPRECIACIÓN MENSUAL ============ */
    abrirDepreciacion() {
        if (document.getElementById('dep-ov')) document.getElementById('dep-ov').remove();
        const hoy = new Date();
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const ov = document.createElement('div');
        ov.id = 'dep-ov';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,40,.55);display:flex;align-items:center;justify-content:center;z-index:3000;padding:20px;font-family:Inter,Segoe UI,sans-serif';
        ov.innerHTML = `
          <div style="background:#fff;border-radius:16px;width:min(820px,96vw);max-height:92vh;overflow:auto;box-shadow:0 30px 60px rgba(0,0,0,.3)">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;background:#1a365d;border-radius:16px 16px 0 0">
              <h3 style="margin:0;color:#fff;font-weight:900;letter-spacing:1px"><i class="fas fa-chart-line-down"></i> Depreciación mensual</h3>
              <button onclick="document.getElementById('dep-ov').remove()" style="border:none;background:rgba(255,255,255,.15);color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer"><i class="fas fa-xmark"></i></button>
            </div>
            <div style="padding:20px 22px">
              <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px">
                <label style="font-size:.7rem;font-weight:800;color:#5a6b7d;text-transform:uppercase">Mes<br>
                  <select id="dep-mes" style="margin-top:4px;padding:9px 11px;border:1px solid #d5dce5;border-radius:9px">
                    ${meses.map((m, i) => `<option value="${i + 1}" ${i === hoy.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}
                  </select></label>
                <label style="font-size:.7rem;font-weight:800;color:#5a6b7d;text-transform:uppercase">Año<br>
                  <input id="dep-anio" type="number" value="${hoy.getFullYear()}" style="margin-top:4px;width:100px;padding:9px 11px;border:1px solid #d5dce5;border-radius:9px"></label>
                <button class="btn-neo" style="background:#2f7be6;color:#fff" onclick="ActivosModule._previewDep()"><i class="fas fa-magnifying-glass"></i> Ver plan</button>
                <span id="dep-total" style="margin-left:auto;font-weight:900;color:#1a365d"></span>
              </div>
              <div id="dep-tabla" style="border:1px solid #eef1f5;border-radius:12px;overflow:auto;max-height:52vh"></div>
              <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
                <button class="btn-neo" onclick="document.getElementById('dep-ov').remove()">Cerrar</button>
                <button class="btn-neo btn-save" id="dep-run" disabled onclick="ActivosModule._runDep()"><i class="fas fa-play"></i> Ejecutar depreciación</button>
              </div>
              <p style="font-size:.72rem;color:#94a3b8;margin:8px 0 0"><i class="fas fa-circle-info"></i> Genera un asiento por activo (DEBE Gasto depreciación / HABER Depreciación acumulada). No se puede correr dos veces el mismo mes ni en un período cerrado.</p>
            </div>
          </div>`;
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        document.body.appendChild(ov);
        this._previewDep();
    },

    async _previewDep() {
        const mes = document.getElementById('dep-mes').value;
        const anio = document.getElementById('dep-anio').value;
        const cont = document.getElementById('dep-tabla');
        cont.innerHTML = '<p style="text-align:center;padding:24px;color:#94a3b8">Calculando…</p>';
        document.getElementById('dep-run').disabled = true;
        try {
            const r = await api.get(`/activos/depreciacion/preview?sedeId=${this.getSedeId()}&anio=${anio}&mes=${mes}`);
            const plan = r.data.plan || [];
            const conMonto = plan.filter(x => x.MontoMes > 0).length;
            document.getElementById('dep-total').textContent = `Total del mes: $${Number(r.data.totalMes).toFixed(2)} · ${conMonto} activos`;
            document.getElementById('dep-run').disabled = conMonto === 0;
            cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.8rem">
              <thead><tr style="background:#1a365d;color:#fff">
                <th style="padding:9px 11px;text-align:left">Activo</th><th style="padding:9px 11px;text-align:right">Base</th>
                <th style="padding:9px 11px;text-align:center">Vida</th><th style="padding:9px 11px;text-align:right">Mes</th>
                <th style="padding:9px 11px;text-align:right">Acum. después</th><th style="padding:9px 11px;text-align:right">En libros</th>
              </tr></thead><tbody>
              ${plan.map(x => `<tr style="border-bottom:1px solid #eef1f5;${x.MontoMes === 0 ? 'opacity:.5' : ''}">
                <td style="padding:8px 11px"><b>${x.Nombre}</b><br><span style="color:#94a3b8;font-size:.72rem">${x.TipoNombre || ''}${x.Motivo ? ' · ' + x.Motivo : ''}</span></td>
                <td style="padding:8px 11px;text-align:right">$${Number(x.BaseDepreciable).toFixed(2)}</td>
                <td style="padding:8px 11px;text-align:center">${x.VidaUtil} m</td>
                <td style="padding:8px 11px;text-align:right;font-weight:800">$${Number(x.MontoMes).toFixed(2)}</td>
                <td style="padding:8px 11px;text-align:right">$${Number(x.DepAcumDespues).toFixed(2)}</td>
                <td style="padding:8px 11px;text-align:right">$${Number(x.ValorEnLibros).toFixed(2)}</td>
              </tr>`).join('')}
              </tbody></table>`;
        } catch (e) {
            cont.innerHTML = `<p style="text-align:center;padding:24px;color:#c0392b">${e.response?.data?.error || e.message}</p>`;
        }
    },

    async _runDep() {
        const mes = parseInt(document.getElementById('dep-mes').value);
        const anio = parseInt(document.getElementById('dep-anio').value);
        const btn = document.getElementById('dep-run');
        btn.disabled = true;
        try {
            const r = await api.post('/activos/depreciacion/correr', { sedeId: this.getSedeId(), anio, mes });
            document.getElementById('dep-ov').remove();
            if (window.Toast) window.Toast.fire({ icon: 'success', title: `Depreciación aplicada — ${r.data.procesados} activos, $${Number(r.data.totalMes).toFixed(2)}` });
            await this.cargarActivos();
        } catch (e) {
            btn.disabled = false;
            if (window.Toast) window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'No se pudo ejecutar' });
        }
    }
};

module.exports = ActivosModule;