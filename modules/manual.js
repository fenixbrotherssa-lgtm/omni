// ============================================================
//  manual.js — Manual de ayuda DENTRO de la app, para usuarios.
//  Explica qué hace cada módulo y cómo usarlo, con pasos concretos.
//  El contenido vive aquí (array TEMAS) — nunca en el .html
//  (los views se inyectan sin evaluar template literals).
// ============================================================

const TEMAS = [
  // ── RESUMEN ──────────────────────────────────────────────
  {
    id: 'dashboard', grupo: 'Resumen', titulo: 'Panel general', icono: 'fa-gauge-high',
    dek: 'La pantalla de inicio: un vistazo rápido a cómo va el negocio.',
    html: `
      <p>Es lo primero que ves al entrar. Muestra tarjetas con lo más importante del momento: ventas del día, saldo de caja, cuentas por cobrar/pagar vencidas, y alertas (por ejemplo, si se le debe sueldo o beneficios al personal).</p>
      <h4>Accesos rápidos</h4>
      <p>Desde aquí puedes saltar directo a los módulos más usados sin pasar por el menú lateral. Si eres administrador, también puedes cambiar de <strong>empresa activa</strong> desde el selector de arriba — todo lo que veas después corresponde a esa empresa.</p>
      <div class="mn-tip">Si trabajas con varias empresas (sucursales, negocios distintos), recuerda revisar cuál está seleccionada antes de registrar algo — cada documento queda ligado a la empresa activa en ese momento.</div>`
  },
  {
    id: 'kpi', grupo: 'Resumen', titulo: 'Tablero KPI', icono: 'fa-chart-column',
    dek: 'Ventas analizadas por día, producto, cliente, forma de pago y día de la semana.',
    html: `
      <p>Elige un rango de fechas y el sistema te muestra: ventas netas (comparadas con el período anterior), número de transacciones, ticket promedio, margen bruto (ventas menos costo), IVA generado, y cuánto estás generando en suscripciones recurrentes (MRR).</p>
      <h4>Las 5 vistas</h4>
      <ul>
        <li><strong>Curva de ingresos</strong> — cómo se distribuyen las ventas día a día.</li>
        <li><strong>Top ítems</strong> — qué productos o servicios más se venden.</li>
        <li><strong>Top clientes</strong> — quién te compra más.</li>
        <li><strong>Forma de pago</strong> — efectivo vs. transferencia vs. tarjeta, etc.</li>
        <li><strong>Día de la semana</strong> — qué días vendes más.</li>
      </ul>
      <p>Haz clic en <em>"detalle"</em> sobre cualquier tarjeta para ver el listado completo detrás del número. Los botones <strong>PDF</strong> y <strong>CSV</strong> exportan todo el tablero para imprimir o llevarlo a Excel.</p>`
  },

  // ── CONTABILIDAD ─────────────────────────────────────────
  {
    id: 'plancuentas', grupo: 'Contabilidad', titulo: 'Plan de cuentas', icono: 'fa-sitemap',
    dek: 'El catálogo de cuentas contables de tu empresa: Activo, Pasivo, Patrimonio, Ingresos y Gastos.',
    html: `
      <p>OMNI CORE trae un plan de cuentas completo listo para usar. Aquí puedes revisarlo, buscar una cuenta por código o nombre, y filtrar por tipo.</p>
      <h4>Cuando necesitas una cuenta nueva</h4>
      <p>Usa <strong>Nueva cuenta</strong> (solo administradores). Cada cuenta tiene un código (ej. <kbd>5.2.15</kbd>), un tipo, una naturaleza (deudora o acreedora) y si es "de movimiento" — solo las cuentas de movimiento pueden recibir asientos; las de agrupación (como "5.2 GASTOS OPERACIONALES") son solo para organizar.</p>
      <div class="mn-warn">No borres ni desactives una cuenta que ya tiene movimientos — mejor créala nueva y deja la anterior inactiva.</div>`
  },
  {
    id: 'librodiario', grupo: 'Contabilidad', titulo: 'Libro diario', icono: 'fa-book-open',
    dek: 'Todos los asientos contables de la empresa, en orden cronológico.',
    html: `
      <p>Cada venta, compra, cobro, pago, nómina, activo, nota de crédito/débito, retención o depreciación genera <strong>automáticamente</strong> su asiento — no tienes que registrarlo tú. Aquí los ves todos, con su fecha, glosa, origen y las líneas de Debe/Haber.</p>
      <h4>Filtrar</h4>
      <p>Elige un rango de fechas y, si quieres, un origen específico (VENTA, COMPRA, NÓMINA, CIERRE...) para encontrar algo puntual.</p>
      <h4>Asiento manual</h4>
      <p>Si necesitas registrar algo que el sistema no genera solo (un ajuste, por ejemplo), usa <strong>Nuevo asiento</strong>: agrega líneas de Debe y Haber hasta que el indicador diga "Cuadrado" — el sistema no te deja guardar un asiento descuadrado. Si tu empresa usa centros de costo o proyectos, puedes asignarlos ahí mismo.</p>
      <h4>Anular</h4>
      <p>Un asiento no se borra — se <strong>anula</strong> (queda visible, marcado, para no perder el rastro). Solo un administrador puede hacerlo, y no se puede si el período de esa fecha ya está cerrado.</p>
      <div class="mn-tip">Desde casi cualquier documento del sistema (una venta, una compra, un cobro...) hay un botón con un libro <i class="fas fa-book"></i> "Ver asiento" que te trae directo aquí, ya filtrado a ese movimiento.</div>`
  },
  {
    id: 'libromayor', grupo: 'Contabilidad', titulo: 'Libro mayor', icono: 'fa-layer-group',
    dek: 'El historial de movimientos de UNA cuenta contable específica.',
    html: `
      <p>Elige una cuenta (por ejemplo, "1.1.03 BANCOS") y un rango de fechas: verás cada asiento que la afectó, con el saldo acumulándose línea por línea. Es la forma de responder "¿por qué esta cuenta tiene este saldo?"</p>`
  },
  {
    id: 'balance', grupo: 'Contabilidad', titulo: 'Balance de comprobación', icono: 'fa-scale-balanced',
    dek: 'Todas las cuentas con movimiento, con su total de Debe, Haber y saldo — a una fecha de corte.',
    html: `
      <p>Es el reporte clásico para verificar que la contabilidad esté cuadrada: la suma de todos los Debe debe ser igual a la suma de todos los Haber. Útil antes de cerrar un mes.</p>`
  },
  {
    id: 'estados', grupo: 'Contabilidad', titulo: 'Estados financieros', icono: 'fa-file-invoice-dollar',
    dek: 'Estado de Resultados (utilidad o pérdida del período) y Balance General (situación financiera).',
    html: `
      <p>Dos pestañas:</p>
      <ul>
        <li><strong>Estado de Resultados</strong> — Ingresos menos Costos y Gastos, en un rango de fechas. Al final te dice si hubo utilidad o pérdida.</li>
        <li><strong>Balance General</strong> — Activo, Pasivo y Patrimonio a una fecha de corte. Si el sistema está bien cuadrado, Activo = Pasivo + Patrimonio (el reporte te lo confirma con un mensaje).</li>
      </ul>
      <p>El botón <strong>PDF</strong> genera un documento listo para imprimir o enviar al contador/auditor.</p>`
  },
  {
    id: 'conciliacion', grupo: 'Contabilidad', titulo: 'Conciliación bancaria', icono: 'fa-scale-balanced',
    dek: 'Cotejar los movimientos de Bancos del sistema contra el extracto real del banco.',
    html: `
      <ol>
        <li>Elige el rango de fechas del extracto que tienes en la mano.</li>
        <li>Verás cada movimiento que tocó la cuenta Bancos (ingresos y egresos).</li>
        <li>Marca la casilla de cada uno que efectivamente aparece en el extracto del banco — te pedirá una referencia opcional.</li>
      </ol>
      <p>Arriba se muestra el <strong>saldo según libros</strong>, el <strong>saldo ya conciliado</strong> y lo que falta por conciliar. Si algo no calza, probablemente ese movimiento todavía no se refleja en el banco (cheque en tránsito) o falta registrarlo.</p>`
  },
  {
    id: 'dimensiones', grupo: 'Contabilidad', titulo: 'Dimensiones y períodos', icono: 'fa-diagram-project',
    dek: 'Centros de costo, proyectos, presupuestos y el cierre de períodos/ejercicio.',
    html: `
      <h4>Centros de costo y Proyectos</h4>
      <p>Sirven para "etiquetar" un asiento y saber a qué área o proyecto pertenece (ej. "Sucursal Norte", "Proyecto Expansión 2026"). Una vez creados, aparecen como selección opcional al vender, comprar o hacer un asiento manual.</p>
      <h4>Presupuestos</h4>
      <p>Define cuánto esperas gastar o ingresar por cuenta, centro de costo o proyecto, por mes o por año. La <strong>ejecución presupuestaria</strong> compara ese presupuesto contra lo que realmente pasó, con el porcentaje de cumplimiento.</p>
      <h4>Períodos contables</h4>
      <p>Un mes se puede <strong>cerrar</strong>: una vez cerrado, ya no se pueden crear ni anular asientos con fecha en ese mes (protege la información histórica). Se puede reabrir si hace falta corregir algo.</p>
      <h4>Cierre del ejercicio</h4>
      <p>Al terminar el año, el botón <strong>Cerrar ejercicio</strong> lleva todos los Ingresos y Gastos del año a Utilidad o Pérdida del Ejercicio, y cierra los 12 meses de una vez. Se puede reabrir si es necesario.</p>
      <div class="mn-warn">Cerrar períodos y el ejercicio son acciones solo de administrador — tienen impacto en toda la empresa.</div>`
  },

  // ── TRIBUTARIO · SRI ─────────────────────────────────────
  {
    id: 'facturacion', grupo: 'Tributario · SRI', titulo: 'Facturación electrónica', icono: 'fa-file-signature',
    dek: 'Emitir facturas, notas de crédito/débito, retenciones y gestionar compras — todo firmado y enviado al SRI.',
    html: `
      <p>Este módulo tiene varias pestañas:</p>
      <ul>
        <li><strong>Emitir</strong> — genera una factura electrónica: se firma con el certificado de la empresa y se envía al SRI automáticamente.</li>
        <li><strong>Historial</strong> — todas las facturas emitidas, con su estado ante el SRI (autorizada, rechazada...), reenvío por correo y descarga del RIDE/XML.</li>
        <li><strong>Compras</strong> — registra lo que le compras a tus proveedores. Debes indicar <strong>qué se compró</strong> (una cuenta contable: inventario, gasto, activo...) para que se genere el asiento; si no la eliges en el momento, queda con el botón <strong>Clasificar</strong> para hacerlo después.</li>
        <li><strong>Liquidación de compra</strong> — para compras a quienes no emiten factura (proveedores informales).</li>
        <li><strong>Proveedores</strong> y <strong>Códigos de retención</strong> — catálogos de apoyo.</li>
      </ul>
      <div class="mn-tip">Las notas de crédito y débito, y las retenciones que emites a proveedores, se manejan desde sus propias pantallas (accesibles desde aquí) y también generan su asiento automáticamente.</div>`
  },
  {
    id: 'ats', grupo: 'Tributario · SRI', titulo: 'ATS — Anexo Transaccional', icono: 'fa-file-shield',
    dek: 'El reporte mensual que se declara al SRI con el detalle de ventas y compras.',
    html: `
      <ol>
        <li>Elige el año y el mes.</li>
        <li><strong>Previsualizar</strong> — verás las ventas agrupadas y las compras del período, con las que no son declarables marcadas aparte.</li>
        <li><strong>Generar</strong> — produce el XML y el ZIP listos para subir al SRI.</li>
      </ol>
      <p>También puedes ver el XML generado o descargarlo directamente.</p>`
  },

  // ── COMERCIAL ────────────────────────────────────────────
  {
    id: 'pos', grupo: 'Comercial', titulo: 'Punto de venta', icono: 'fa-cart-shopping',
    dek: 'Registrar una venta: productos o servicios, cliente, forma de pago.',
    html: `
      <ol>
        <li>Busca y agrega los productos/servicios (o escríbelos si no están en el catálogo).</li>
        <li>Escribe el nombre o documento del cliente — si ya existe, se autocompleta.</li>
        <li>Elige si es <strong>Contado</strong> o <strong>Crédito</strong> (a crédito se crea automáticamente una cuenta por cobrar).</li>
        <li>Elige el método de pago. Si tu empresa tiene una pasarela configurada (Payphone, Stripe o DeUna), aparece el botón <strong>Cobrar con pasarela</strong> — genera un QR o enlace de pago y confirma solo cuando el cliente paga.</li>
        <li><strong>Registrar venta</strong>.</li>
      </ol>
      <p>En <strong>Ventas recientes</strong> puedes reimprimir el ticket, anular una venta, o ver su asiento contable (incluye el costo de venta si el producto tiene costo cargado).</p>
      <div class="mn-tip">Si tu empresa configuró impresora térmica, el ticket sale automáticamente al confirmar la venta.</div>`
  },
  {
    id: 'recurrente', grupo: 'Comercial', titulo: 'Omni Recurrente', icono: 'fa-repeat',
    dek: 'Suscripciones y cobros periódicos — ideal para software, soporte o membresías.',
    html: `
      <h4>Catálogo de ítems</h4>
      <p>Define qué vendes de forma recurrente: un plan, un servicio de soporte, etc. — con su precio y periodicidad (mensual, trimestral, anual).</p>
      <h4>Suscripciones</h4>
      <p>Crea una suscripción por cliente, indicando el monto y cada cuánto se cobra. El botón <strong>Facturar</strong> genera el cobro del período actual y avanza automáticamente la fecha del siguiente. <strong>Facturar vencidas</strong> procesa de una vez todas las suscripciones que ya tocaba cobrar.</p>
      <div class="mn-tip">Si activas "cobro por adelantado con ingreso diferido", el dinero se recibe de una vez pero el ingreso se reconoce contablemente mes a mes — así los estados financieros reflejan la realidad del servicio prestado, no solo el cobro.</div>`
  },
  {
    id: 'crm', grupo: 'Comercial', titulo: 'CRM — Clientes', icono: 'fa-address-book',
    dek: 'La cartera de clientes: quién te compra, cuánto, y cómo comunicarte con ellos.',
    html: `
      <h4>Clientes</h4>
      <p>Cada cliente se clasifica solo según su historial: <strong>VIP</strong>, <strong>Frecuente</strong>, <strong>Regular</strong>, <strong>Nuevo</strong> o <strong>Sin actividad</strong>. Haz clic en un cliente para ver su historial de compras, agregarle notas, editar sus datos o enviarle un correo.</p>
      <h4>Cumpleaños</h4>
      <p>Lista de clientes con cumpleaños en los próximos 30 días — útil para enviar un saludo o una promoción puntual.</p>
      <h4>Campañas de correo</h4>
      <p>Para enviar un mensaje a muchos clientes a la vez: elige a quién (todos con correo, por clasificación, cumpleañeros próximos, o los que hayas seleccionado en la tabla), escribe el mensaje y el ritmo de envío. El sistema envía <strong>uno por uno con pausas</strong> para no ser marcado como spam por el proveedor de correo, y puedes detener la campaña en cualquier momento.</p>
      <div class="mn-warn">Solo se envía a clientes que tienen marcado "acepta promociones" — respeta ese consentimiento.</div>`
  },
  {
    id: 'cxc', grupo: 'Comercial', titulo: 'Cuentas por cobrar', icono: 'fa-hand-holding-dollar',
    dek: 'El dinero que te deben los clientes.',
    html: `
      <p>Cada venta a crédito, factura, o venta de un activo a crédito crea aquí una cuenta por cobrar automáticamente.</p>
      <h4>Registrar un cobro</h4>
      <p>Botón <strong>Cobrar</strong> — indica el monto (puede ser parcial), fecha y método de pago. Si el método no es efectivo, puedes adjuntar el comprobante. También puedes usar <strong>Cobrar con pasarela</strong> si tu empresa tiene una configurada.</p>
      <h4>Si el cliente te retuvo</h4>
      <p>Botón <strong>Retención</strong> — cuando un cliente te hace una retención de renta o IVA al pagarte, regístrala aquí: baja el saldo pendiente y genera el crédito tributario correspondiente.</p>
      <h4>Cuentas creadas manualmente</h4>
      <p>Si registras una cuenta por cobrar "a mano" (no generada por una venta), debes indicarle una cuenta contable de contrapartida — si no la eliges de una vez, queda con el botón <strong>Clasificar</strong> para hacerlo después. Así el sistema nunca "inventa" a qué corresponde un cobro.</p>`
  },
  {
    id: 'cxp', grupo: 'Comercial', titulo: 'Cuentas por pagar', icono: 'fa-file-invoice',
    dek: 'El dinero que le debes a tus proveedores.',
    html: `
      <p>Funciona igual que Cuentas por Cobrar pero al revés: cada compra a crédito genera aquí una cuenta por pagar. Usa <strong>Pagar</strong> para registrar el pago (con comprobante si aplica), y <strong>Clasificar</strong> si quedó una cuenta manual sin cuenta contable asignada.</p>`
  },
  {
    id: 'caja', grupo: 'Comercial', titulo: 'Caja', icono: 'fa-cash-register',
    dek: 'Apertura y cierre de turno, y movimientos de efectivo/banco que no vienen de una venta.',
    html: `
      <ol>
        <li><strong>Abrir turno</strong> — indica el monto inicial en efectivo.</li>
        <li>Durante el turno, registra <strong>movimientos</strong> (ingresos o egresos que no son una venta: por ejemplo, un pago de servicios básicos, o un ingreso de un préstamo). Todo egreso debe llevar un sustento — voucher o número de referencia.</li>
        <li>Si eliges la <strong>cuenta contable</strong> del movimiento en el momento, se contabiliza al instante; si no, queda con el botón <strong>Clasificar</strong> para hacerlo después.</li>
        <li><strong>Cerrar turno</strong> — el sistema calcula lo que debería haber según sus registros; tú declaras lo que contaste físicamente. Si hay diferencia, se te pide una observación.</li>
      </ol>
      <p>Si tu empresa tiene una pasarela de pago configurada, el botón verde de cobro rápido te deja generar un QR/enlace y cobrar sin salir de Caja.</p>`
  },

  // ── OPERACIÓN ────────────────────────────────────────────
  {
    id: 'inventario', grupo: 'Operación', titulo: 'Inventario', icono: 'fa-boxes-stacked',
    dek: 'Tus productos: precio, costo, stock y categorías.',
    html: `
      <p>Da de alta un producto con su precio de venta, costo, stock mínimo/ideal y si <strong>grava IVA</strong> o no (algunos servicios o productos están exentos — desmarca la casilla si aplica). El costo cargado aquí es el que usa el sistema para calcular automáticamente el costo de cada venta.</p>
      <p>Los <strong>movimientos de inventario</strong> (ingreso de mercadería, ajustes) quedan registrados con su motivo, para poder rastrear por qué cambió el stock.</p>`
  },
  {
    id: 'activos', grupo: 'Operación', titulo: 'Activos fijos', icono: 'fa-desktop',
    dek: 'Equipos, vehículos, mobiliario — su ciclo de vida completo, con depreciación.',
    html: `
      <h4>Alta y traslados</h4>
      <p>Registra un activo nuevo con su costo y, si lo sabes, la vida útil en meses (si no la indicas, el sistema usa un estándar según el tipo: vehículos, equipo de cómputo, mobiliario...). Cada activo tiene un código QR para identificarlo físicamente.</p>
      <h4>Depreciación mensual</h4>
      <p>Botón <strong>Depreciación</strong> en la parte superior — elige el mes y verás el plan (cuánto le toca depreciar a cada activo ese mes) antes de ejecutarlo. Genera el asiento correspondiente y actualiza el valor en libros. También puede correr sola cada 1º de mes si el administrador lo activó.</p>
      <h4>Baja o venta</h4>
      <p>Cuando un activo se vende, se dona o simplemente se da de baja, usa <strong>Dar de baja / Vender</strong>: indica el motivo y, si corresponde, el valor de venta y si fue a crédito. El sistema calcula automáticamente si hubo ganancia o pérdida y genera el asiento — no tienes que calcular nada a mano.</p>`
  },
  {
    id: 'personal', grupo: 'Operación', titulo: 'Personal y nómina', icono: 'fa-id-badge',
    dek: 'Empleados, roles de pago, anticipos, bonos y liquidaciones.',
    html: `
      <p>El cálculo del rol sigue la legislación ecuatoriana: aporte al IESS, décimo tercero, décimo cuarto, fondo de reserva y vacaciones — todo automático según el sueldo y la fecha de ingreso de cada empleado (si empezó a mitad de un período, el sistema prorratea correctamente).</p>
      <h4>Anticipos y bonos</h4>
      <p>Puedes registrar un anticipo o un bono en cualquier momento; si marcas "registrar pago", sale de caja de inmediato y se contabiliza aparte — al pagar la nómina del mes, ese monto <strong>no se vuelve a pagar</strong> (el sistema lo descuenta automáticamente para evitar pagarlo dos veces).</p>
      <h4>Pagar nómina</h4>
      <p>Genera el rol del período, muestra el neto a pagar por empleado, y al confirmar registra el egreso de caja y el asiento contable completo.</p>`
  },
  {
    id: 'mantenimiento', grupo: 'Operación', titulo: 'Mantenimiento', icono: 'fa-tools',
    dek: 'Reportar y dar seguimiento a incidencias (equipos, instalaciones, vehículos...).',
    html: `
      <p>Cualquier usuario puede <strong>reportar una incidencia</strong>: elige el área afectada, describe el problema y su prioridad. Un administrador la gestiona desde aquí: le asigna un responsable, cambia su estado (pendiente → en proceso → resuelto) y deja notas de cómo se solucionó.</p>
      <div class="mn-tip">Las áreas disponibles se configuran por empresa (en Empresas → configuración), para que se ajusten a tu tipo de negocio.</div>`
  },

  // ── ADMINISTRACIÓN ───────────────────────────────────────
  {
    id: 'usuarios', grupo: 'Administración', titulo: 'Usuarios', icono: 'fa-users-gear',
    dek: 'Quién puede entrar al sistema y con qué permisos.',
    html: `
      <p>Crea un usuario por cada persona que vaya a usar OMNI CORE, asignándole una empresa y un rol. El rol <strong>Administrador</strong> puede ver y cambiar entre todas las empresas, gestionar usuarios, cerrar períodos, activar la licencia, etc. Los demás roles quedan limitados a su empresa y a las tareas operativas del día a día.</p>`
  },
  {
    id: 'sedes', grupo: 'Administración', titulo: 'Empresas', icono: 'fa-building',
    dek: 'Alta de cada empresa/establecimiento y su configuración particular.',
    html: `
      <p>Cada fila es una empresa independiente (pueden ser sucursales de un mismo negocio o negocios completamente distintos — todas comparten la misma instalación de OMNI CORE, pero cada una con su propia información).</p>
      <h4>Configuración por empresa (ícono de engranaje)</h4>
      <ul>
        <li><strong>Pasarela de pago</strong> — Payphone, Stripe o DeUna. Elige una, completa sus credenciales y desde ese momento aparece la opción de cobro con pasarela en Ventas, Cuentas por Cobrar y Caja.</li>
        <li><strong>Impresora térmica</strong> — nombre de la impresora, ancho del papel, si imprime automático al vender, y el texto de encabezado/pie del ticket.</li>
        <li><strong>Áreas de mantenimiento</strong> — personaliza la lista según tu tipo de negocio.</li>
      </ul>`
  },
  {
    id: 'respaldos', grupo: 'Administración', titulo: 'Respaldos', icono: 'fa-database',
    dek: 'Copias de seguridad de la base de datos y los archivos.',
    html: `
      <p>El sistema respalda automáticamente cada noche (se puede configurar la hora). El botón <strong>Respaldar ahora</strong> genera uno al instante — útil antes de un cambio importante. Puedes descargar cualquier respaldo de la lista.</p>
      <div class="mn-tip">Para que los respaldos se suban solos a una nube (Google Drive u otra), se configura una sola vez a nivel de servidor — pídeselo a quien te instaló el sistema.</div>`
  },
  {
    id: 'licencia', grupo: 'Administración', titulo: 'Licencia', icono: 'fa-key',
    dek: 'Activación de OMNI CORE y verificación de actualizaciones disponibles.',
    html: `
      <p>Aquí ves si la licencia está activa, para qué empresa/edición fue emitida y cuánto le queda de vigencia (o si es perpetua). Para activarla o renovarla, pega la clave que te entregó CasRodsoft Development en el campo y confirma.</p>
      <p>Más abajo, <strong>Buscar actualización</strong> te dice si hay una versión nueva de OMNI CORE disponible y te da el enlace para descargar el instalador — nunca se actualiza sola, tú decides cuándo instalarla.</p>`
  },
  {
    id: 'auditoria', grupo: 'Administración', titulo: 'Auditoría', icono: 'fa-shield-halved',
    dek: 'El historial de quién hizo qué y cuándo.',
    html: `
      <p>Cada acción importante (crear, anular, cerrar, activar...) queda registrada aquí con el usuario, la fecha y el detalle. Filtra por módulo, empresa o rango de fechas para investigar cualquier cambio.</p>`
  }
];

const ManualModule = {
  _sel: null,

  async init() {
    window.ManualModule = this;
    window.backView = 'dashboard';
    this._render(TEMAS);
    const primero = TEMAS[0];
    if (primero) this.abrir(primero.id);
  },

  _render(lista) {
    const grupos = [];
    lista.forEach(t => { if (!grupos.includes(t.grupo)) grupos.push(t.grupo); });
    const toc = document.getElementById('mn-toc');
    if (!lista.length) { toc.innerHTML = '<div class="empty">Sin resultados.</div>'; return; }
    toc.innerHTML = grupos.map(g => `
      <div class="grp">${g}</div>
      ${lista.filter(t => t.grupo === g).map(t => `
        <a id="mn-link-${t.id}" onclick="ManualModule.abrir('${t.id}')"><i class="fas ${t.icono}"></i> ${t.titulo}</a>
      `).join('')}
    `).join('');
    if (this._sel) {
      const activo = document.getElementById('mn-link-' + this._sel);
      if (activo) activo.classList.add('active');
    }
  },

  abrir(id) {
    const t = TEMAS.find(x => x.id === id);
    if (!t) return;
    this._sel = id;
    document.querySelectorAll('.mn-toc a').forEach(a => a.classList.remove('active'));
    const link = document.getElementById('mn-link-' + id);
    if (link) link.classList.add('active');
    document.getElementById('mn-body').innerHTML = `
      <h3>${t.titulo}</h3>
      <p class="mn-dek">${t.dek}</p>
      ${t.html}`;
    document.querySelector('.mn-content').scrollTop = 0;
  },

  buscar(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) { this._render(TEMAS); return; }
    const filtrados = TEMAS.filter(t =>
      t.titulo.toLowerCase().includes(q) ||
      t.dek.toLowerCase().includes(q) ||
      t.html.toLowerCase().includes(q) ||
      t.grupo.toLowerCase().includes(q)
    );
    this._render(filtrados);
    if (filtrados.length && !filtrados.some(t => t.id === this._sel)) this.abrir(filtrados[0].id);
    if (!filtrados.length) {
      document.getElementById('mn-body').innerHTML =
        '<div class="mn-empty-state"><i class="fas fa-magnifying-glass" style="font-size:1.8rem;margin-bottom:10px;display:block"></i>Sin resultados para tu búsqueda.</div>';
    }
  }
};

module.exports = ManualModule;
