const api = require('./api');

const DashboardModule = {
    _clockTimer: null,

    async init() {
        window.DashboardModule = this;
        this._iniciarReloj();
        this._setUserName();
        this._adminOnlyCards();
        // Accesos rápidos solo a módulos permitidos; cifras contables solo para quien las puede ver
        document.querySelectorAll('.qa[onclick]').forEach(a => {
            const m = (a.getAttribute('onclick') || '').match(/renderView\('([^']+)'/);
            if (m && App.nivelVista(m[1]) < 1) a.style.display = 'none';
        });
        const verCifras = ['estadosfinancieros', 'librodiario', 'kpi'].some(m => App.puede(m, 'VER'));
        ['wg-ingresos', 'wg-gastos', 'wg-utilidad', 'wg-asientos'].forEach(id => {
            const e = document.getElementById(id); if (e && !verCifras) e.closest('.rib').style.display = 'none';
        });
        if (verCifras) this._cargarResumenContable();
        this._verificarCaja();
        this._cargarAlertas();
    },

    _iniciarReloj() {
        const tick = () => {
            const el = document.getElementById('dash-live-clock');
            if (!el) { clearInterval(this._clockTimer); this._clockTimer = null; return; }
            el.textContent = new Date().toLocaleTimeString('es-EC');
        };
        tick();
        this._clockTimer = setInterval(tick, 1000);
    },

    _setUserName() {
        const el = document.getElementById('dash-user-name');
        if (el && App.user) {
            const nombre = App.user.NombreFull || App.user.Usuario || 'usuario';
            el.textContent = `Bienvenido, ${nombre}`;
        }
    },

    _adminOnlyCards() {
        const isAdmin = App.user && parseInt(App.user.RolID) === 1;
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isAdmin ? '' : 'none';
        });
    },

    _fmt(n) {
        return '$ ' + Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    async _cargarResumenContable() {
        try {
            const sedeId = localStorage.getItem('currentSedeId') || App.user?.SedeID;
            const res = await api.get(`/contabilidad/resumen?sedeId=${sedeId}`);
            const d = res.data || {};
            const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
            set('wg-ingresos', this._fmt(d.ingresosMes));
            set('wg-gastos', this._fmt(d.gastosMes));
            const elU = document.getElementById('wg-utilidad');
            if (elU) {
                elU.textContent = this._fmt(d.utilidadMes);
                elU.style.color = Number(d.utilidadMes) >= 0 ? '#1e8e4e' : '#e74c3c';
            }
            set('wg-asientos', d.asientosMes ?? '—');
        } catch (_) {
            ['wg-ingresos', 'wg-gastos', 'wg-utilidad', 'wg-asientos'].forEach(id => {
                const e = document.getElementById(id); if (e) e.textContent = '—';
            });
        }
    },

    async _verificarCaja() {
        const user = App.user;
        const sedeId = localStorage.getItem('currentSedeId') || user?.SedeID;
        const userId = user?.UsuarioID || user?.id;
        const elCaja = document.getElementById('wg-caja');
        if (!userId || !sedeId || !elCaja) return;
        try {
            const resCaja = await api.get(`/caja/estado/${userId}/${sedeId}`);
            if (resCaja.data.abierta) { elCaja.textContent = 'Abierta ✓'; elCaja.style.color = '#1e8e4e'; }
            else { elCaja.textContent = 'Cerrada'; elCaja.style.color = '#e74c3c'; }
        } catch (_) { elCaja.textContent = '—'; }
    },

    async _cargarAlertas() {
        const lista = document.getElementById('dash-alerts-list');
        if (!lista) return;
        lista.innerHTML = '';
        const items = [];

        // Balance de comprobación: descuadre + deuda con el personal / IESS
        try {
            const sedeId = localStorage.getItem('currentSedeId') || App.user?.SedeID;
            const res = await api.get(`/contabilidad/balance-comprobacion?sedeId=${sedeId}`);
            const s = res.data.sumas || {};
            const descuadre = Math.abs((s.debeAcum || 0) - (s.haberAcum || 0));
            if (descuadre > 0.01) {
                items.push({
                    cls: 'danger', icon: 'fa-scale-unbalanced',
                    title: 'Balance de comprobación descuadrado',
                    sub: `Diferencia de ${this._fmt(descuadre)} entre Debe y Haber`
                });
            }
            // Cuentas por pagar al personal / seguridad social (saldo acreedor)
            const PERS = { '2.1.05': 'Sueldos y beneficios por pagar', '2.1.06': 'IESS por pagar', '2.1.10': 'Beneficios sociales por pagar' };
            let deudaPersonal = 0;
            (res.data.cuentas || []).forEach(c => { if (PERS[c.Codigo]) deudaPersonal += Number(c.SaldoAcreedor || 0); });
            if (deudaPersonal > 0.01) {
                items.push({
                    cls: 'warning', icon: 'fa-hand-holding-dollar',
                    title: `Se adeuda al personal / IESS: ${this._fmt(deudaPersonal)}`,
                    sub: 'Sueldos, beneficios y aportes pendientes de pago',
                    go: 'personal'
                });
            }
        } catch (_) {}

        // Nómina del mes anterior sin pagar
        try {
            const sedeId = localStorage.getItem('currentSedeId') || App.user?.SedeID;
            const res = await api.get(`/personal/pendiente/${sedeId}`);
            const d = res.data || {};
            if ((d.pendientes || 0) > 0) {
                items.push({
                    cls: 'warning', icon: 'fa-users',
                    title: `Nómina de ${d.periodo} sin pagar: ${d.pendientes} empleado(s)`,
                    sub: d.montoAprox ? `Aprox. ${this._fmt(d.montoAprox)} (salario base)` : 'Genera y paga el rol',
                    go: 'personal'
                });
            }
        } catch (_) {}

        // Órdenes de mantenimiento pendientes (genérico)
        try {
            const sedeId = localStorage.getItem('currentSedeId') || App.user?.SedeID;
            const res = await api.get(`/mantenimiento/stats/${sedeId}`);
            const { Urgentes, Pendientes } = res.data || {};
            if ((Pendientes || 0) > 0) {
                items.push({
                    cls: Urgentes > 0 ? 'danger' : 'warning', icon: 'fa-tools',
                    title: `${Pendientes} orden(es) de mantenimiento pendiente(s)`,
                    sub: Urgentes > 0 ? `${Urgentes} urgente(s)` : 'Sin urgentes',
                    go: 'mantenimiento'
                });
            }
        } catch (_) {}

        if (!items.length) {
            lista.innerHTML = `<div style="text-align:center;padding:22px;opacity:.6;font-size:.8rem;">
                <i class="fas fa-check-circle" style="color:#1e8e4e"></i> Todo en orden</div>`;
            return;
        }
        items.forEach(it => {
            const div = document.createElement('div');
            div.className = `alert-item ${it.cls}`;
            if (it.go) { div.style.cursor = 'pointer'; div.onclick = () => App.renderView(it.go, 'viewport'); }
            div.innerHTML = `<i class="fas ${it.icon}"></i>
                <div><strong>${it.title}</strong>
                <div style="font-size:.7rem;color:#718096">${it.sub}</div></div>`;
            lista.appendChild(div);
        });
    },

    destroy() {
        if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null; }
    }
};

module.exports = DashboardModule;
