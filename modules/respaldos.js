const api = require('./api');

const fmtBytes = b => {
    b = Number(b || 0);
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
};

const RespaldosModule = {
    async init() {
        window.RespaldosModule = this;
        window.backView = 'dashboard';
        await this.cargar();
    },

    async cargar() {
        const body = document.getElementById('rb-body');
        body.innerHTML = '<tr><td colspan="4" class="omni-empty">Cargando…</td></tr>';
        try {
            const r = await api.get('/backups');
            document.getElementById('rb-carpeta').textContent = 'Carpeta: ' + r.data.carpeta;
            const list = r.data.backups || [];
            document.getElementById('rb-count').textContent = `${list.length} archivos`;
            body.innerHTML = list.length ? list.map(b => `
                <tr>
                    <td><b>${b.archivo}</b></td>
                    <td>${fmtBytes(b.bytes)}</td>
                    <td>${new Date(b.fecha).toLocaleString('es-EC')}</td>
                    <td><button class="omni-btn omni-btn-ghost" style="padding:5px 10px" onclick="RespaldosModule.descargar('${b.archivo}')"><i class="fas fa-download"></i></button></td>
                </tr>`).join('') : '<tr><td colspan="4" class="omni-empty">Aún no hay respaldos. Ejecuta uno.</td></tr>';
        } catch (e) {
            body.innerHTML = `<tr><td colspan="4" class="omni-empty">${e.response?.data?.error || e.message}</td></tr>`;
        }
    },

    async ejecutar() {
        const btn = document.getElementById('rb-run');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Respaldando…';
        try {
            const r = await api.post('/backups', {});
            const d = r.data.resultado;
            Swal.fire({
                icon: 'success', title: 'Respaldo completado',
                html: `<div style="text-align:left;font-size:.85rem">
                    <b>BD:</b> ${d.db.archivo} (${fmtBytes(d.db.bytes)})<br>
                    <b>Archivos:</b> ${d.uploads.archivo ? d.uploads.archivo + ' (' + fmtBytes(d.uploads.bytes) + ')' : (d.uploads.error || 'omitido')}<br>
                    <b>Nube:</b> ${d.nube.subido ? 'subido ✔' : (d.nube.motivo || (d.nube.errores || []).join('; ') || 'no')}<br>
                    <b>Retención:</b> conserva ${d.retencion.juegosConservados}, borró ${d.retencion.archivosBorrados}
                </div>`
            });
            this.cargar();
        } catch (e) {
            Swal.fire('Error', e.response?.data?.error || 'No se pudo respaldar', 'error');
        } finally {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Respaldar ahora';
        }
    },

    descargar(archivo) {
        const base = api.base();
        const url = `${base}/backups/descargar/${encodeURIComponent(archivo)}`;
        try {
            const { shell } = require('electron');
            // descarga vía navegador del sistema con el token en query no aplica; abrimos con axios blob
        } catch (_) {}
        window.axios.get(url, { responseType: 'blob', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(res => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(res.data);
                a.download = archivo;
                a.click();
            })
            .catch(() => Swal.fire('Error', 'No se pudo descargar', 'error'));
    }
};

module.exports = RespaldosModule;
