// C:\SistemasHotel\MasterHotel_App\frontend\modules\sedes.js
const api = require('./api');

const SedesModule = {
    sedes: [],
    map: null,
    marker: null,

    init() {
        console.log("SedesModule: Inicializando infraestructura...");
        window.SedesModule = this;
        this.listarSedes();
        this.setupForm();
    },

    async listarSedes() {
        try {
            const res = await api.get('/admin/sedes');
            this.sedes = res.data;
            const body = document.getElementById('tablaSedesBody');
            if (!body) return;

            if (this.sedes.length === 0) {
                body.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; opacity:0.5;">No hay establecimientos registrados</td></tr>`;
                return;
            }

            const serverUrl = api.defaults.baseURL.split('/api')[0];

            body.innerHTML = this.sedes.map(s => {
                const logoRender = s.LogoPath 
                    ? `<img src="${serverUrl}/uploads/${s.LogoPath}" style="width:35px; height:35px; border-radius:6px; object-fit:cover; border:1px solid #1a365d40;" onerror="this.src=''; this.className='fas fa-store';">`
                    : `<i class="fas fa-store" style="color:#718096; font-size: 1.2rem;"></i>`;
                
                const estadoClass = s.Estado ? 'active' : 'inactive';
                const estadoTexto = s.Estado ? 'ACTIVO' : 'INACTIVO';
                
                let regimenTexto = '';
                if (s.RegimenTributario === 'RIMPE_NP') regimenTexto = 'RIMPE NP';
                else if (s.RegimenTributario === 'RIMPE_E') regimenTexto = 'RIMPE EMP';
                
                const rimpeBadge = regimenTexto ? `<span style="font-size:0.6rem; background:#fbbf24; color:#fff; padding:2px 5px; border-radius:4px; margin-left:5px;">${regimenTexto}</span>` : '';

                return `
                <tr>
                    <td style="text-align: center;">${logoRender}</td>
                    <td><strong>${s.RUC_NIT}</strong></td>
                    <td>${s.NombreComercial} ${rimpeBadge}</td>
                    <td>${s.Ciudad || 'N/A'}</td>
                    <td>${s.MonedaSimbolo || '$'} / ${s.ImpuestoPorcentaje}%</td>
                    <td><span class="status-pill ${estadoClass}">${estadoTexto}</span></td>
                    <td style="text-align: center; white-space:nowrap;">
                        <button onclick="SedesModule.editarSede(${s.SedeID})" class="btn-neo" style="padding:8px 12px; display:inline-flex;" title="Datos fiscales">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="SedesModule.abrirConfig(${s.SedeID})" class="btn-neo" style="padding:8px 12px; display:inline-flex;" title="Pagos e impresión">
                            <i class="fas fa-sliders"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        } catch (error) {
            console.error("Error al listar sedes:", error);
            if (window.Toast) window.Toast.fire({ icon: 'error', title: 'Error de conexión con el servidor' });
        }
    },

    initMap(lat, lng) {
        if (typeof L === 'undefined') {
            console.error("Fallo Crítico: Leaflet no está cargado en el núcleo.");
            return;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        const container = document.getElementById('mapContainer');
        if (!container) return;

        const assetPath = 'assets/vendor/leasleft/images/';
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: assetPath + 'marker-icon-2x.png',
            iconUrl: assetPath + 'marker-icon.png',
            shadowUrl: assetPath + 'marker-shadow.png',
        });

        this.map = L.map('mapContainer').setView([lat, lng], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; MasterHotel'
        }).addTo(this.map);

        this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);

        const updateCoordsInputs = (latlng) => {
            if(document.getElementById('latitud')) document.getElementById('latitud').value = latlng.lat.toFixed(6);
            if(document.getElementById('longitud')) document.getElementById('longitud').value = latlng.lng.toFixed(6);
        };

        this.marker.on('dragend', (e) => updateCoordsInputs(e.target.getLatLng()));
        
        this.map.on('click', (e) => {
            this.marker.setLatLng(e.latlng);
            updateCoordsInputs(e.latlng);
        });

        setTimeout(() => this.map.invalidateSize(), 200);
    },

    async buscarDireccion() {
        const dir = document.getElementById('direccion').value;
        const ciudad = document.getElementById('ciudad').value;
        if (!dir) return;

        try {
            const query = `${dir}, ${ciudad}, Ecuador`;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            if (data.length > 0) {
                const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                this.map.setView([coords.lat, coords.lng], 17);
                this.marker.setLatLng([coords.lat, coords.lng]);
                if(document.getElementById('latitud')) document.getElementById('latitud').value = coords.lat.toFixed(6);
                if(document.getElementById('longitud')) document.getElementById('longitud').value = coords.lon.toFixed(6);
            } else {
                if (window.Toast) window.Toast.fire({ icon: 'warning', title: 'Ubicación no encontrada' });
            }
        } catch (e) { 
            console.error("Error en geocodificación:", e); 
        }
    },

    abrirModal(datos = null) {
        const modal = document.getElementById('modalSede');
        const form = document.getElementById('formSede');
        const preview = document.getElementById('logoPreview');
        const placeholder = document.getElementById('logoPlaceholder');
        
        if (!modal || !form) return;

        form.reset();

        let logoActualInput = document.getElementById('logoActualPath');
        if (!logoActualInput) {
            logoActualInput = document.createElement('input');
            logoActualInput.type = 'hidden';
            logoActualInput.id = 'logoActualPath';
            logoActualInput.name = 'LogoActual';
            form.appendChild(logoActualInput);
        }

        if(document.getElementById('sedeId')) document.getElementById('sedeId').value = datos ? datos.SedeID : '';
        if(document.getElementById('modalSedeTitle')) document.getElementById('modalSedeTitle').innerText = datos ? 'MODIFICAR EMPRESA' : 'NUEVA EMPRESA';

        let lat = -0.1807;
        let lng = -78.4678;

        if (datos) {
            if(document.getElementById('ruc_nit')) document.getElementById('ruc_nit').value = datos.RUC_NIT || '';
            if(document.getElementById('nombreComercial')) document.getElementById('nombreComercial').value = datos.NombreComercial || '';
            if(document.getElementById('razonSocial')) document.getElementById('razonSocial').value = datos.RazonSocial || '';
            if(document.getElementById('direccion')) document.getElementById('direccion').value = datos.Direccion || '';
            if(document.getElementById('ciudad')) document.getElementById('ciudad').value = datos.Ciudad || '';
            if(document.getElementById('provincia_estado')) document.getElementById('provincia_estado').value = datos.Provincia_Estado || '';
            if(document.getElementById('region_decimo_cuarto')) document.getElementById('region_decimo_cuarto').value = datos.RegionDecimoCuarto || '';
            if(document.getElementById('telefono')) document.getElementById('telefono').value = datos.Telefono || '';
            if(document.getElementById('emailContacto')) document.getElementById('emailContacto').value = datos.EmailContacto || '';
            if(document.getElementById('impuestoPorcentaje')) document.getElementById('impuestoPorcentaje').value = datos.ImpuestoPorcentaje || 0;
            if(document.getElementById('estadoSede')) document.getElementById('estadoSede').value = datos.Estado ? "1" : "0";
            if(document.getElementById('monedaSimbolo')) document.getElementById('monedaSimbolo').value = datos.MonedaSimbolo || '$';
            if(document.getElementById('website')) document.getElementById('website').value = datos.Website || '';
            
            if(document.getElementById('regimenTributario')) document.getElementById('regimenTributario').value = datos.RegimenTributario || 'GENERAL';
            if(document.getElementById('agenteRetencion')) document.getElementById('agenteRetencion').value = datos.AgenteRetencion || '';
            if(document.getElementById('contribuyenteEspecial')) document.getElementById('contribuyenteEspecial').value = datos.ContribuyenteEspecial || '';
            if(document.getElementById('obligadoContabilidad')) document.getElementById('obligadoContabilidad').value = datos.ObligadoContabilidad ? "1" : "0";
            
            logoActualInput.value = datos.LogoPath || '';

            if (datos.Latitud && datos.Longitud) {
                lat = parseFloat(datos.Latitud);
                lng = parseFloat(datos.Longitud);
                if(document.getElementById('latitud')) document.getElementById('latitud').value = lat;
                if(document.getElementById('longitud')) document.getElementById('longitud').value = lng;
            }

            if (preview && placeholder) {
                if (datos.LogoPath) {
                    const serverUrl = api.defaults.baseURL.split('/api')[0];
                    preview.src = `${serverUrl}/uploads/${datos.LogoPath}`;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                } else {
                    preview.src = '';
                    preview.style.display = 'none';
                    placeholder.style.display = 'block';
                }
            }
        } else {
            logoActualInput.value = '';
            if(document.getElementById('regimenTributario')) document.getElementById('regimenTributario').value = 'GENERAL';
            if(document.getElementById('agenteRetencion')) document.getElementById('agenteRetencion').value = '';
            if(document.getElementById('contribuyenteEspecial')) document.getElementById('contribuyenteEspecial').value = '';
            if(document.getElementById('obligadoContabilidad')) document.getElementById('obligadoContabilidad').value = '0';

            if (preview && placeholder) {
                preview.src = '';
                preview.style.display = 'none';
                placeholder.style.display = 'block';
            }
        }

        modal.classList.remove('hidden');
        setTimeout(() => this.initMap(lat, lng), 300);
    },

    cerrarModal() { 
        document.getElementById('modalSede').classList.add('hidden'); 
    },

    setupForm() {
        const form = document.getElementById('formSede');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const user = JSON.parse(localStorage.getItem('user'));
            const formData = new FormData(form);
            
            const rolID = user?.RolID || user?.rolId || 0;
            formData.append('rolEjecutor', parseInt(rolID));
            
            if(document.getElementById('estadoSede')) formData.set('Estado', document.getElementById('estadoSede').value === "1" ? 1 : 0);
            if(document.getElementById('regimenTributario')) formData.set('RegimenTributario', document.getElementById('regimenTributario').value);
            if(document.getElementById('obligadoContabilidad')) formData.set('ObligadoContabilidad', document.getElementById('obligadoContabilidad').value === "1" ? 1 : 0);

            try {
                // La instancia de axios fija 'Content-Type: application/json' por defecto,
                // lo cual bloquea la autodetección de FormData. Hay que forzar multipart aquí.
                const res = await api.post('/admin/sedes', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                if (res.data.success) {
                    this.cerrarModal();
                    this.listarSedes();
                    if (window.Toast) window.Toast.fire({ icon: 'success', title: 'CONFIGURACIÓN SINCRONIZADA' });
                }
            } catch (err) { 
                console.error("Fallo al guardar sede:", err);
                const msg = err.response?.data?.error || 'Error al procesar la solicitud';
                if (window.Toast) window.Toast.fire({ icon: 'error', title: msg });
            }
        };
    },

    editarSede(id) {
        const sede = this.sedes.find(s => s.SedeID === id);
        if (sede) this.abrirModal(sede);
    },

    handleLogoChange(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('logoPreview');
                const placeholder = document.getElementById('logoPlaceholder');
                if (preview && placeholder) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    // Sugiere la región del Décimo Cuarto según la provincia escrita — el admin
    // puede corregirlo manualmente, esto es solo una ayuda (no se auto-guarda).
    sugerirRegionDecimoCuarto() {
        const provincia = (document.getElementById('provincia_estado')?.value || '').trim().toLowerCase();
        const sel = document.getElementById('region_decimo_cuarto');
        if (!provincia || !sel || sel.value) return; // no pisar una elección manual ya hecha

        const costaGalapagos = ['guayas', 'manabí', 'manabi', 'los ríos', 'los rios', 'el oro', 'esmeraldas', 'santa elena', 'santo domingo', 'galápagos', 'galapagos'];
        const sierraAmazonia = ['pichincha', 'azuay', 'loja', 'tungurahua', 'chimborazo', 'cotopaxi', 'imbabura', 'carchi', 'cañar', 'canar', 'bolívar', 'bolivar',
            'sucumbíos', 'sucumbios', 'napo', 'orellana', 'pastaza', 'morona santiago', 'zamora chinchipe'];

        if (costaGalapagos.some(p => provincia.includes(p))) sel.value = 'COSTA';
        else if (sierraAmazonia.some(p => provincia.includes(p))) sel.value = 'SIERRA';
    }
};

// ============================================================
//  CONFIGURACIÓN POR EMPRESA — Pagos e impresión
//  Modal independiente al de datos fiscales. Se inyecta una vez.
// ============================================================
const OMNI_SEDECONFIG_KEYS = [
    'PASARELA_ACTIVA',
    'PAYPHONE_TOKEN', 'PAYPHONE_STORE_ID', 'PAYPHONE_MODO',
    'DEUNA_MODO', 'DEUNA_QR_ESTATICO_PAYLOAD', 'DEUNA_API_KEY', 'DEUNA_SECRET', 'DEUNA_WEBHOOK_SECRET',
    'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_MODO',
    'IMPRESORA_NOMBRE', 'IMPRESORA_ANCHO', 'IMPRESORA_AUTO', 'IMPRESORA_COPIAS',
    'TICKET_ENCABEZADO', 'TICKET_PIE', 'TICKET_MOSTRAR_LOGO',
    'MANTENIMIENTO_AREAS'
];

Object.assign(SedesModule, {

    _ensureConfigModal() {
        if (document.getElementById('modalSedeConfig')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
        <div id="modalSedeConfig" class="omni-cfg-bg" style="display:none;">
          <div class="omni-cfg">
            <div class="omni-cfg-head">
              <h3><i class="fas fa-sliders"></i> Pagos e impresión — <span id="cfg-sede-nom"></span></h3>
              <button onclick="SedesModule.cerrarConfig()"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="omni-cfg-body">
              <input type="hidden" id="cfg-sede-id">

              <h4>Pasarela de pago</h4>
              <label>Pasarela activa
                <select id="cfg-PASARELA_ACTIVA" onchange="SedesModule._cfgToggle()">
                  <option value="">Ninguna</option>
                  <option value="PAYPHONE">Payphone</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="DEUNA">DeUna</option>
                </select>
              </label>

              <div id="cfg-grp-payphone" class="omni-cfg-grp">
                <label>Modo
                  <select id="cfg-PAYPHONE_MODO">
                    <option value="link">API Link (URL + QR)</option>
                    <option value="cajita">Cajita de pagos (web)</option>
                  </select>
                </label>
                <label>Token (Bearer) <input type="password" id="cfg-PAYPHONE_TOKEN" placeholder="••••••••" autocomplete="off"></label>
                <label>Store ID <input type="text" id="cfg-PAYPHONE_STORE_ID" autocomplete="off"></label>
              </div>

              <div id="cfg-grp-deuna" class="omni-cfg-grp">
                <label>Modo de QR
                  <select id="cfg-DEUNA_MODO">
                    <option value="estatico">QR estático (fijo del local, cliente digita monto)</option>
                    <option value="dinamico">QR dinámico (API, monto automático)</option>
                  </select>
                </label>
                <label>Payload del QR estático
                  <textarea id="cfg-DEUNA_QR_ESTATICO_PAYLOAD" rows="2" placeholder="Texto/URL que codifica el QR fijo entregado por DeUna"></textarea>
                </label>
                <label>API Key <input type="password" id="cfg-DEUNA_API_KEY" placeholder="••••••••" autocomplete="off"></label>
                <label>Secret <input type="password" id="cfg-DEUNA_SECRET" placeholder="••••••••" autocomplete="off"></label>
                <label>Webhook Secret <input type="password" id="cfg-DEUNA_WEBHOOK_SECRET" placeholder="••••••••" autocomplete="off"></label>
              </div>

              <div id="cfg-grp-stripe" class="omni-cfg-grp">
                <label>Modo
                  <select id="cfg-STRIPE_MODO">
                    <option value="test">Test (sk_test_…)</option>
                    <option value="live">Producción (sk_live_…)</option>
                  </select>
                </label>
                <label>Secret Key <input type="password" id="cfg-STRIPE_SECRET_KEY" placeholder="sk_live_… / sk_test_…" autocomplete="off"></label>
                <label>Publishable Key <input type="text" id="cfg-STRIPE_PUBLISHABLE_KEY" placeholder="pk_…" autocomplete="off"></label>
                <label>Webhook Secret <input type="password" id="cfg-STRIPE_WEBHOOK_SECRET" placeholder="whsec_…" autocomplete="off"></label>
              </div>

              <h4>Impresora térmica</h4>
              <label>Impresora
                <span style="display:flex;gap:8px">
                  <input type="text" id="cfg-IMPRESORA_NOMBRE" list="cfg-impresoras" placeholder="Nombre tal como aparece en Windows" style="flex:1">
                  <button type="button" class="omni-cfg-mini" onclick="SedesModule.detectarImpresoras()">Detectar</button>
                </span>
              </label>
              <datalist id="cfg-impresoras"></datalist>
              <div class="omni-cfg-row2">
                <label>Ancho de papel
                  <select id="cfg-IMPRESORA_ANCHO"><option value="80">80 mm</option><option value="58">58 mm</option></select>
                </label>
                <label>Copias <input type="number" id="cfg-IMPRESORA_COPIAS" min="1" value="1"></label>
              </div>
              <label class="omni-cfg-chk"><input type="checkbox" id="cfg-IMPRESORA_AUTO"> Imprimir automáticamente al cerrar una venta</label>
              <label class="omni-cfg-chk"><input type="checkbox" id="cfg-TICKET_MOSTRAR_LOGO"> Mostrar el logo de la empresa en el ticket</label>
              <label>Encabezado del ticket <input type="text" id="cfg-TICKET_ENCABEZADO" placeholder="Gracias por su compra"></label>
              <label>Pie del ticket <input type="text" id="cfg-TICKET_PIE" placeholder="Documento sin valor tributario"></label>

              <h4>Operación</h4>
              <label>Áreas para órdenes de mantenimiento (separadas por coma)
                <textarea id="cfg-MANTENIMIENTO_AREAS" rows="2" placeholder="Instalaciones, Equipos / Maquinaria, Tecnología / Sistemas, Mobiliario, Vehículos, Bodega / Almacén"></textarea>
              </label>
            </div>
            <div class="omni-cfg-foot">
              <button class="omni-cfg-ghost" onclick="SedesModule.cerrarConfig()">Cancelar</button>
              <button class="omni-cfg-save" onclick="SedesModule.guardarConfig()"><i class="fas fa-save"></i> Guardar configuración</button>
            </div>
          </div>
        </div>
        <style>
          .omni-cfg-bg{position:fixed;inset:0;background:rgba(12,22,38,.6);display:flex;align-items:center;justify-content:center;z-index:3000;font-family:'Inter','Segoe UI',sans-serif}
          .omni-cfg{background:#fff;border-radius:16px;width:min(560px,94vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(0,0,0,.4)}
          .omni-cfg-head{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #eef1f5}
          .omni-cfg-head h3{margin:0;font-size:1rem;font-weight:900;color:#1a365d;letter-spacing:.5px}
          .omni-cfg-head h3 i{color:#2f7be6;margin-right:8px}
          .omni-cfg-head button{border:none;background:#eef1f5;width:30px;height:30px;border-radius:8px;cursor:pointer;color:#5a6b7d}
          .omni-cfg-body{padding:18px 22px;overflow-y:auto}
          .omni-cfg-body h4{margin:16px 0 10px;font-size:.7rem;font-weight:900;letter-spacing:1.5px;color:#5a6b7d;text-transform:uppercase}
          .omni-cfg-body h4:first-child{margin-top:0}
          .omni-cfg-body label{display:block;font-size:.72rem;font-weight:800;color:#5a6b7d;text-transform:uppercase;letter-spacing:.3px;margin-bottom:12px}
          .omni-cfg-body input,.omni-cfg-body select,.omni-cfg-body textarea{width:100%;margin-top:5px;padding:9px 11px;border:1px solid #d5dce5;border-radius:9px;font-size:.82rem;font-family:inherit;color:#16283c;outline:none}
          .omni-cfg-body input:focus,.omni-cfg-body select:focus,.omni-cfg-body textarea:focus{border-color:#2f7be6}
          .omni-cfg-chk{display:flex !important;align-items:center;gap:8px;text-transform:none !important;font-weight:700 !important}
          .omni-cfg-chk input{width:auto !important;margin:0 !important}
          .omni-cfg-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .omni-cfg-grp{border-left:3px solid #e7edf5;padding-left:12px;margin-bottom:8px}
          .omni-cfg-mini{border:1px solid #d5dce5;background:#f4f7fb;border-radius:8px;padding:0 12px;font-size:.72rem;font-weight:800;color:#2f7be6;cursor:pointer}
          .omni-cfg-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid #eef1f5}
          .omni-cfg-foot button{border:none;border-radius:10px;padding:10px 18px;font-weight:800;font-size:.8rem;cursor:pointer}
          .omni-cfg-ghost{background:#e2e7ee;color:#5a6b7d}
          .omni-cfg-save{background:#2f7be6;color:#fff}
        </style>`;
        document.body.appendChild(wrap);
    },

    _cfgToggle() {
        const v = (document.getElementById('cfg-PASARELA_ACTIVA').value || '').toUpperCase();
        document.getElementById('cfg-grp-payphone').style.display = v === 'PAYPHONE' ? '' : 'none';
        document.getElementById('cfg-grp-deuna').style.display = v === 'DEUNA' ? '' : 'none';
        const st = document.getElementById('cfg-grp-stripe');
        if (st) st.style.display = v === 'STRIPE' ? '' : 'none';
    },

    async abrirConfig(id) {
        const sede = this.sedes.find(s => s.SedeID === id);
        this._ensureConfigModal();
        document.getElementById('cfg-sede-id').value = id;
        document.getElementById('cfg-sede-nom').textContent = sede ? sede.NombreComercial : `Sede ${id}`;
        // limpiar
        OMNI_SEDECONFIG_KEYS.forEach(k => {
            const el = document.getElementById('cfg-' + k);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = false; else el.value = '';
        });
        try {
            const r = await api.get(`/sedeconfig?sedeId=${id}`);
            const c = r.data.config || {};
            OMNI_SEDECONFIG_KEYS.forEach(k => {
                const el = document.getElementById('cfg-' + k);
                if (!el || c[k] === undefined) return;
                if (el.type === 'checkbox') el.checked = c[k] === '1' || c[k] === true;
                else el.value = c[k];
            });
        } catch (e) {
            if (window.Toast) window.Toast.fire({ icon: 'error', title: 'No se pudo cargar la configuración' });
        }
        this._cfgToggle();
        document.getElementById('modalSedeConfig').style.display = 'flex';
    },

    cerrarConfig() {
        const m = document.getElementById('modalSedeConfig');
        if (m) m.style.display = 'none';
    },

    async detectarImpresoras() {
        try {
            const { ipcRenderer } = require('electron');
            const lista = await ipcRenderer.invoke('omni:list-printers');
            const dl = document.getElementById('cfg-impresoras');
            dl.innerHTML = (lista || []).map(p => `<option value="${p.name}">${p.displayName || p.name}</option>`).join('');
            if (window.Toast) window.Toast.fire({ icon: 'success', title: `${(lista || []).length} impresora(s) detectada(s)` });
        } catch (e) {
            if (window.Toast) window.Toast.fire({ icon: 'info', title: 'Escribe el nombre de la impresora manualmente' });
        }
    },

    async guardarConfig() {
        const id = parseInt(document.getElementById('cfg-sede-id').value);
        const config = {};
        OMNI_SEDECONFIG_KEYS.forEach(k => {
            const el = document.getElementById('cfg-' + k);
            if (!el) return;
            config[k] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value.trim();
        });
        try {
            await api.put('/sedeconfig', { SedeID: id, config });
            this.cerrarConfig();
            if (window.Toast) window.Toast.fire({ icon: 'success', title: 'Configuración guardada' });
        } catch (e) {
            if (window.Toast) window.Toast.fire({ icon: 'error', title: e.response?.data?.error || 'Error al guardar' });
        }
    }
});

module.exports = SedesModule;