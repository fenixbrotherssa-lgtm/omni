let ipc = null;
try { ipc = require('electron').ipcRenderer; } catch (_) {}

const LoginModule = {
    init() {
        const btn = document.getElementById('btn-login-submit');
        const userField = document.getElementById('login-usuario');
        const passField = document.getElementById('login-password');

        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                this.autenticar();
            };
        }

        // Soporte para tecla Enter
        [userField, passField].forEach(input => {
            if (!input) return;
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.autenticar();
                }
            };
        });

        // Configurar servidor (visible ANTES de iniciar sesión).
        const srvBtn = document.getElementById('btn-login-servidor');
        if (srvBtn) {
            srvBtn.onclick = () => this.configurarServidor();
            this.mostrarServidorActual();
        }
    },

    async mostrarServidorActual() {
        const txt = document.getElementById('login-srv-txt');
        if (!ipc || !txt) return;
        try {
            const s = await ipc.invoke('omni:get-server');
            txt.textContent = `Servidor: ${s.address}${/^\d|\d$/.test(s.address) ? ':' + s.port : ''}`;
        } catch (_) { /* deja el texto por defecto */ }
    },

    async configurarServidor() {
        if (!ipc) {
            window.Toast.fire({ icon: 'info', title: 'Solo disponible en la app de escritorio' });
            return;
        }
        let actual = { address: 'localhost', port: 3636 };
        try { actual = await ipc.invoke('omni:get-server'); } catch (_) {}

        const { value: v } = await Swal.fire({
            title: 'Dirección del servidor',
            html:
                `<input id="srv-addr" class="swal2-input" placeholder="IP o dominio (sin http:// ni puerto)" value="${actual.address || ''}">` +
                `<input id="srv-port" class="swal2-input" placeholder="Puerto" value="${actual.port || 3636}">` +
                `<div style="font-size:.8rem;color:#64748b;margin-top:8px;text-align:left">` +
                `Ej. misma máquina: <b>localhost</b> · 3636<br>` +
                `Otra máquina en la red: <b>192.168.1.50</b> · 3636<br>` +
                `Dominio con HTTPS: <b>contabilidad.miempresa.com</b> (deja el puerto vacío)</div>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar y reiniciar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const address = document.getElementById('srv-addr').value.trim();
                const port = document.getElementById('srv-port').value.trim();
                if (!address) { Swal.showValidationMessage('Ingresa la IP o el dominio.'); return false; }
                return { address, port: port || '3636' };
            }
        });
        if (!v) return;
        try {
            await ipc.invoke('omni:set-server', v);   // reescribe config.js y reinicia la app
        } catch (e) {
            window.Toast.fire({ icon: 'error', title: 'No se pudo guardar la configuración' });
        }
    },

    async autenticar() {
        const usuarioInput = document.getElementById('login-usuario');
        const passwordInput = document.getElementById('login-password');
        const btn = document.getElementById('btn-login-submit');

        const usuario = usuarioInput.value.trim();
        const password = passwordInput.value.trim();

        if (!usuario || !password) {
            window.Toast.fire({
                icon: 'warning',
                title: 'CAMPOS VACIOS',
                text: 'Por favor, ingrese sus credenciales.'
            });
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> VERIFICANDO...';
            btn.style.opacity = "0.7";

            const response = await api.post('/auth/login', { usuario, password });

            if (response.data && response.data.token) {
                // GUARDAR SESIÓN
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('refreshToken', response.data.refreshToken);
                localStorage.setItem('user', JSON.stringify(response.data.user));

                // ÉXITO TOTAL
                await window.Toast.fire({
                    icon: 'success',
                    title: 'ACCESO CONCEDIDO',
                    text: `Bienvenido, ${response.data.user.NombreFull}`,
                    timer: 1500,
                    showConfirmButton: false
                });

                // Cargar el Shell del sistema (detecta entorno: escritorio o móvil)
                if (typeof App !== 'undefined' && App.renderShell) {
                    // Escritorio (Electron): carga sus empresas y, si tiene
                    // varias, le pide elegir con cuál trabajar.
                    App.user = response.data.user;
                    await App.entrar({ nuevaSesion: true });
                } else if (typeof AppMobile !== 'undefined') {
                    // Móvil (Capacitor): refresca usuario y enruta por rol
                    AppMobile.user = response.data.user;
                    AppMobile.conectarSocket();
                    AppMobile.routeByRole();
                }
            }

        } catch (err) {
            btn.disabled = false;
            btn.innerText = "INGRESAR";
            btn.style.opacity = "1";

            const esConexion = !err.response; // sin respuesta = no se pudo contactar el backend
            const msg = err.response?.data?.message || "ERROR DE CONEXION AL SERVIDOR";

            if (esConexion) {
                // Resaltar el botón de configuración: casi siempre es la dirección mal puesta.
                const srvBtn = document.getElementById('btn-login-servidor');
                if (srvBtn) srvBtn.classList.add('ol-srv-bad');
                const errEl = document.getElementById('login-error');
                let apiUrl = '';
                try { apiUrl = (await ipc.invoke('omni:get-server')).apiUrl; } catch (_) {}
                if (errEl) errEl.textContent = apiUrl
                    ? `No se pudo conectar a ${apiUrl}. Revisa la dirección del servidor abajo.`
                    : 'No se pudo conectar al servidor. Revisa la dirección abajo.';
            }

            window.Toast.fire({
                icon: 'error',
                title: 'ERROR DE ACCESO',
                text: msg.toUpperCase(),
                confirmButtonText: 'REINTENTAR'
            });
        }
    }
};

module.exports = LoginModule;
