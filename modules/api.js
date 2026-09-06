// api.js - Cliente de Red Local | MasterHotel SystemCore
// Priorizamos el objeto global axios (cargado localmente en index.html)
const axiosInstance = window.axios || require('axios');

/**
 * FUENTE �NICA DE VERDAD PARA EL ENDPOINT
 * -----------------------------------------------------------------------------
 * NO volvemos a hacer require('../config'). Al empaquetar (electron-packager),
 * ese config.js queda CONGELADO dentro del paquete y nunca refleja los cambios
 * que el cliente hace en el config.js EXTERNO de la carpeta /resources.
 *
 * main.js ya lee el config.js externo (resources/config.js), resuelve la URL
 * y la inyecta v�a --api-url. index.html la expone en window.AppConfig.apiUrl.
 * Por eso aqu� leemos SIEMPRE esa URL ya resuelta: as� editar la IP/dominio en
 * resources/config.js y reiniciar la app S� cambia a d�nde se conecta, tanto
 * con el t�nel arriba como ca�do (modo local).
 */
function resolverBaseURL() {
    if (window.AppConfig && window.AppConfig.apiUrl) {
        return window.AppConfig.apiUrl;
    }
    if (window.axios && window.axios.defaults && window.axios.defaults.baseURL) {
        return window.axios.defaults.baseURL;
    }
    // Último recurso — SOLO si falló toda la resolución de config.
    // La URL real se define en resources/config.js (SERVER_ADDRESS/PORT) y la
    // inyecta main.js. Este literal existe en UN solo lugar a propósito.
    return (window.AppConfig && window.AppConfig.fallbackApiUrl) || 'http://localhost:3636/api';
}

/**
 * Configuraci�n de instancia Axios para el entorno local de Ecuador.
 * Se elimina la dependencia de CDNs externas para garantizar funcionamiento Offline.
 */
const api = axiosInstance.create({
    baseURL: resolverBaseURL(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

/**
 * INTERCEPTOR DE PETICIONES
 * - Reafirma el baseURL en CADA petici�n tom�ndolo de window.AppConfig, por si
 *   la configuraci�n resolvi� tarde o cambi� en tiempo de ejecuci�n.
 * - Inyecta el JWT almacenado en el localStorage del cliente Electron.
 */
api.interceptors.request.use(config => {
    config.baseURL = resolverBaseURL();

    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

/**
 * INTERCEPTOR DE RESPUESTAS
 * En 401: intenta renovar el access token con el refresh token antes de hacer logout.
 * Solo cierra sesión si el refresh también está expirado o no existe.
 */
let _refreshing = false;
let _refreshQueue = [];

function procesarColaRefresh(nuevoToken, error) {
    _refreshQueue.forEach(cb => cb(nuevoToken, error));
    _refreshQueue = [];
}

api.interceptors.response.use(
    response => response,
    async error => {
        const config = error.config;
        const isLoginRequest   = config?.url?.includes('/auth/login');
        const isRefreshRequest = config?.url?.includes('/auth/refresh');

        if (error.response?.status === 401 && !isLoginRequest && !isRefreshRequest) {
            const refreshToken = localStorage.getItem('refreshToken');

            if (!refreshToken) {
                localStorage.clear();
                window.location.reload();
                return Promise.reject(error);
            }

            // Si ya hay un refresh en curso, encolar esta petición para reintentarla después
            if (_refreshing) {
                return new Promise((resolve, reject) => {
                    _refreshQueue.push((nuevoToken, err) => {
                        if (err) return reject(err);
                        config.headers.Authorization = `Bearer ${nuevoToken}`;
                        resolve(api.request(config));
                    });
                });
            }

            _refreshing = true;
            try {
                const res = await axiosInstance.post(
                    resolverBaseURL().replace('/api', '') + '/api/auth/refresh',
                    { refreshToken }
                );
                const nuevoToken = res.data.token;
                localStorage.setItem('token', nuevoToken);
                config.headers.Authorization = `Bearer ${nuevoToken}`;
                procesarColaRefresh(nuevoToken, null);
                return api.request(config);
            } catch (refreshErr) {
                procesarColaRefresh(null, refreshErr);
                localStorage.clear();
                window.location.reload();
                return Promise.reject(refreshErr);
            } finally {
                _refreshing = false;
            }
        }

        if (!error.response) {
            console.error("Fallo de red: El servidor no responde.");
        }

        const st = error.response?.status;
        const data = error.response?.data || {};

        // 402 fuera del login = la suscripción SaaS de la empresa venció
        // mientras había sesión (lo detecta /auth/refresh). Cierra sesión
        // y manda al login, donde se ve el mensaje al reintentar.
        if (st === 402 && !config?.url?.includes('/auth/login')) {
            try {
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Suscripción vencida', data.message || 'La suscripción de esta empresa venció. Contacta a tu proveedor.', 'warning');
                }
            } catch (_) {}
            localStorage.clear();
            setTimeout(() => window.location.reload(), 2500);
        }

        // 503 = la base de datos no responde (en Local suele ser licencia
        // vencida gestionada por el proveedor a nivel de SQL Server).
        if (st === 503 && (data.error === 'BASE_INACCESIBLE' || data.error === 'BASE_NO_DISPONIBLE')) {
            try {
                if (typeof Swal !== 'undefined' && !window.__omniDbAviso) {
                    window.__omniDbAviso = true;
                    Swal.fire({
                        title: data.error === 'BASE_INACCESIBLE' ? 'Sin acceso a la base de datos' : 'Base de datos no disponible',
                        text: data.mensaje || 'No se pudo acceder a la base de datos.',
                        icon: 'error'
                    }).then(() => { window.__omniDbAviso = false; });
                }
            } catch (_) {}
        }

        return Promise.reject(error);
    }
);

// Helpers de URL — ÚNICA fuente para el resto de módulos.
// Nadie más debe escribir 'http://localhost...' ni construir la base a mano.
api.base = resolverBaseURL;                                  // .../api
api.origin = () => resolverBaseURL().replace(/\/api\/?$/, ''); // sin /api (para /uploads, descargas)

module.exports = api;