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
    dek: 'La pantalla de inicio: un vistazo rápido a cómo va el negocio de la empresa activa.',
    html: `
      <p>Es lo primero que ves al entrar. Muestra tarjetas con lo más importante del momento: ingresos y gastos del mes, utilidad, asientos, estado de tu caja, y alertas (por ejemplo, si se le debe sueldo o beneficios al personal).</p>
      <h4>Accesos rápidos</h4>
      <p>Desde aquí puedes saltar directo a los módulos más usados sin pasar por el menú lateral.</p>
      <div class="mn-tip">Todo lo que ves corresponde a la <strong>empresa activa</strong>, que aparece siempre arriba en el menú lateral (nombre, RUC y su color). Si manejas varias empresas, mira el tema <em>Trabajar con varias empresas</em>.</div>`
  },
  {
    id: 'empresas', grupo: 'Resumen', titulo: 'Trabajar con varias empresas', icono: 'fa-building',
    dek: 'Cómo saber siempre en qué empresa estás y cómo cambiar de una a otra sin mezclar información.',
    html: `
      <p>Si eres dueño o administrador de más de una empresa, cada una lleva su propia contabilidad, inventario, caja, facturación y personal. Nada se mezcla entre ellas.</p>
      <h4>Al iniciar sesión</h4>
      <p>Si tienes varias empresas, después de tu clave aparece <strong>"¿Con qué empresa vas a trabajar?"</strong> con una tarjeta por empresa (logo, nombre, razón social y RUC). Elige una y entras directo a ella.</p>
      <h4>Siempre a la vista</h4>
      <ul>
        <li>Arriba del menú lateral está la tarjeta <strong>EMPRESA ACTIVA</strong> con su logo, nombre y RUC.</li>
        <li>Cada empresa tiene su <strong>color</strong>, que también se ve en la franja superior de la pantalla.</li>
        <li>Pantallas como Inventario, Activos o Facturación muestran una etiqueta con el nombre de la empresa.</li>
      </ul>
      <h4>Cambiar de empresa</h4>
      <p>Usa el botón <i class="fas fa-right-left"></i> de la tarjeta del menú o el selector <strong>Empresa</strong> de la barra superior. Aparece el aviso <em>"Ahora trabajas en: …"</em> y la pantalla que tenías abierta se recarga con los datos de la nueva empresa.</p>
      <div class="mn-warn">Antes de registrar una venta, compra o pago, confirma la empresa activa: cada documento queda en la empresa seleccionada en ese momento. Al cerrar sesión se olvida la empresa elegida y el próximo usuario vuelve a elegir.</div>`
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
    dek: 'Emitir facturas, notas de crédito/débito, retenciones y registrar compras trazables — todo firmado y enviado al SRI.',
    html: `
      <p>Este módulo tiene varias pestañas:</p>
      <ul>
        <li><strong>Factura manual</strong> — genera una factura electrónica: se firma con el certificado de la empresa y se envía al SRI. En cada ítem elige la <strong>tarifa de IVA</strong> (grava IVA o IVA 0%); abajo verás el desglose <strong>Subtotal 0%</strong>, <strong>Subtotal 15%</strong> e IVA, igual que en el RIDE.</li>
        <li><strong>Comprobantes emitidos</strong> — todas las facturas con su estado ante el SRI, reenvío por correo y descarga del RIDE/XML.</li>
        <li><strong>Compras</strong> — lo que le compras a tus proveedores (ver abajo).</li>
        <li><strong>Liquidación de compra</strong>, <strong>Proveedores</strong> y <strong>Códigos de retención</strong>.</li>
      </ul>
      <h4>Compras trazables</h4>
      <ol>
        <li>Busca y agrega los <strong>productos</strong> que compraste (cantidad y costo unitario sin IVA). Cada producto entra al inventario y al kardex con esta compra como origen, y se actualiza su costo promedio.</li>
        <li>Lo que no es inventario (un servicio, un gasto) agrégalo con <strong>Gasto / servicio</strong> y elige su cuenta contable (obligatoria).</li>
        <li>Si hay retenciones, el pago y la cuenta por pagar quedan por el <strong>neto</strong> (total menos retenciones), igual que el asiento.</li>
      </ol>
      <p>Una compra no se borra: se <strong>anula</strong> con un motivo, y el sistema revierte el stock, el dinero, la cuenta por pagar y el asiento. El botón de trazabilidad muestra todo lo que generó la compra (kardex, caja, asientos).</p>
      <div class="mn-tip">El botón <strong>PORTAL SRI</strong> abre SRI en línea en el navegador, para consultar o anular comprobantes y hacer declaraciones.</div>`
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
    dek: 'Registrar una venta con recibo o factura electrónica, siempre dentro de un turno de caja.',
    html: `
      <div class="mn-warn">Para vender necesitas tener tu <strong>turno de caja abierto</strong> (contado o crédito). Si está cerrado, el POS te avisa y te lleva a Caja.</div>
      <ol>
        <li>Busca y agrega los productos/servicios. Cada línea puede ser con IVA o IVA 0%; abajo ves el desglose de subtotales.</li>
        <li>Escribe el nombre o documento del cliente — si ya existe, se autocompleta.</li>
        <li>Elige <strong>Recibo</strong> o <strong>Factura SRI</strong>. La factura usa exactamente los valores de la venta; si el SRI no responde, la venta queda guardada y luego usas <strong>Facturar</strong> en Ventas recientes.</li>
        <li>Elige <strong>Contado</strong> o <strong>Crédito</strong> y el método de pago. Con pasarela configurada aparece <strong>Cobrar con pasarela</strong>.</li>
        <li><strong>Registrar venta</strong>. La venta de contado entra como ingreso en tu turno de caja y descuenta el stock con su kardex.</li>
      </ol>
      <h4>Anular una venta</h4>
      <p>Requiere <strong>usuario y contraseña de un administrador</strong> de la empresa y un motivo. Se devuelve el stock y, si fue de contado, se registra la devolución del dinero en caja. Una venta con factura autorizada no se anula: se emite una nota de crédito.</p>`
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
    dek: 'Apertura y cierre de turno, y movimientos de efectivo que no vienen de un documento.',
    html: `
      <ol>
        <li><strong>Abrir turno</strong> — indica el monto inicial en efectivo. Sin turno abierto no se puede vender, ni cobrar, pagar o comprar en efectivo.</li>
        <li>Durante el turno, registra <strong>movimientos</strong> que no son una venta (pago de servicios básicos, un ingreso extraordinario…). Todo egreso lleva sustento: voucher, referencia o el comprobante de egreso que genera el sistema.</li>
        <li>Si eliges la <strong>cuenta contable</strong> del movimiento se contabiliza al instante; si no, queda con <strong>Clasificar</strong>.</li>
        <li><strong>Cerrar turno</strong> — el sistema calcula lo que debería haber; tú declaras lo que contaste. Si hay diferencia, se pide una observación.</li>
      </ol>
      <div class="mn-tip">Los movimientos que nacen de una venta, compra, cobro o pago no se borran desde Caja: se revierten anulando su documento (así la contabilidad no se descuadra).</div>`
  },

  // ── OPERACIÓN ────────────────────────────────────────────
  {
    id: 'inventario', grupo: 'Operación', titulo: 'Inventario', icono: 'fa-boxes-stacked',
    dek: 'Productos y servicios: precio, costo promedio, stock con kardex trazable y alertas de stock mínimo.',
    html: `
      <p>Arriba ves el resumen de la empresa: productos, unidades en stock, <strong>valor del inventario al costo</strong>, cuántos están bajo el mínimo y cuántos sin stock. La tabla se filtra por nombre o <strong>código de barras</strong>, categoría, tipo, o "solo bajo mínimo".</p>
      <h4>Cómo se mueve el stock</h4>
      <ul>
        <li><strong>Entra</strong> con las <strong>Compras</strong> (Facturación → Compras), con proveedor, factura y costo.</li>
        <li><strong>Sale</strong> con las ventas del POS.</li>
        <li><strong>Ajuste</strong> (botón <i class="fas fa-scale-balanced"></i>) solo para diferencias de conteo físico, mermas o inventario inicial — con motivo obligatorio.</li>
      </ul>
      <p>El botón <strong>Kardex</strong> muestra cada entrada y salida con su documento de origen, costo y saldo. La ficha del producto (lápiz) define precio, costo, categoría, si <strong>grava IVA</strong>, stock mínimo/ideal y código de barras.</p>
      <div class="mn-tip">El botón <strong>Integridad</strong> revisa que cada compra haya entrado al inventario y que stock, kardex y caja cuadren. Úsalo antes de una revisión contable.</div>`
  },
  {
    id: 'activos', grupo: 'Operación', titulo: 'Activos fijos', icono: 'fa-desktop',
    dek: 'Equipos, vehículos, mobiliario — su ciclo de vida completo, con QR, depreciación, baja y reactivación.',
    html: `
      <h4>Alta</h4>
      <p>Registra el activo con su <strong>valor unitario</strong> y <strong>cantidad</strong> (ej. 20 sillas de $85), ubicación, marca, modelo y responsable. El costo contable es valor × cantidad. Si no indicas la vida útil, se usa la del tipo (vehículos 5 años, cómputo 3, mobiliario 10…).</p>
      <h4>Etiquetas QR</h4>
      <p>Cada activo tiene su QR con nombre, serie, empresa y ubicación. <strong>Imprimir etiquetas</strong> genera una hoja lista para pegar en los equipos.</p>
      <h4>Levantamiento con el celular</h4>
      <p>Botón <strong>LEVANTAMIENTO MÓVIL</strong>: inventario físico caminando con el celular (ver el tema <em>Levantamiento de activos con el celular</em>).</p>
      <h4>Depreciación mensual</h4>
      <p>Botón <strong>Depreciación</strong> — elige el mes, revisa el plan y ejecútalo: genera el asiento y actualiza el valor en libros.</p>
      <h4>Editar, dar de baja y reactivar</h4>
      <ul>
        <li><strong>Editar ficha</strong> (administrador): si el activo ya tiene depreciación contabilizada, no se puede cambiar su valor ni su cantidad.</li>
        <li><strong>Dar de baja / Vender</strong>: indica el motivo y, si se vendió, el valor y si fue a crédito. El sistema calcula la ganancia o pérdida y genera el asiento.</li>
        <li><strong>Reactivar</strong> (administrador, si se dio de baja por error): si el mes de la baja sigue abierto se anula su asiento; si ya se cerró, se registra un contra-asiento con fecha de hoy. La cuenta por cobrar de la venta se anula si no tiene cobros.</li>
      </ul>`
  },
  {
    id: 'levantamiento', grupo: 'Operación', titulo: 'Levantamiento de activos con el celular', icono: 'fa-mobile-screen-button',
    dek: 'Inventario físico de activos desde el celular, por empresa y por lugar, con foto.',
    html: `
      <ol>
        <li>En <strong>Activos fijos</strong> pulsa <strong>LEVANTAMIENTO MÓVIL</strong>. Verás la empresa del inventario, el servidor al que apunta y un QR.</li>
        <li>Escanea el QR con la cámara del celular e ingresa con tu usuario. La página queda fija en esa empresa (no se puede cambiar desde el celular).</li>
        <li>Escribe el <strong>lugar</strong> donde vas a inventariar (bodega, oficina, local…). Queda fijo arriba hasta que lo cambies.</li>
        <li>Por cada activo: foto, nombre, cantidad, valor, condición y responsable → <strong>Guardar y siguiente</strong>.</li>
      </ol>
      <p>Todo aparece de inmediato en Activos con la marca "LEVANTAMIENTO MÓVIL", su foto y su ubicación.</p>
      <div class="mn-tip">El QR usa la misma dirección con la que esta computadora se conecta a su servidor. Si el servidor solo es local, el celular debe estar en el mismo WiFi. Si te quedas sin señal, lo capturado queda guardado en el celular y se envía solo al volver la conexión.</div>`
  },
  {
    id: 'personal', grupo: 'Operación', titulo: 'Personal y nómina', icono: 'fa-id-badge',
    dek: 'Empleados, tipos de afiliación al IESS, roles de pago, anticipos, bonos y liquidaciones.',
    html: `
      <p>El cálculo del rol sigue la legislación ecuatoriana: aporte al IESS, décimo tercero, décimo cuarto, fondo de reserva y vacaciones — automático según el sueldo, el tipo de afiliación y la fecha de ingreso.</p>
      <h4>Ingreso a mitad de mes</h4>
      <p>Si el empleado entra el día D, el primer mes se paga <strong>proporcional</strong>: 30 − D + 1 días (mes comercial de 30). Ej.: ingresa el 27 → 4 días. El comprobante lo indica.</p>
      <h4>Tipo de afiliación</h4>
      <ul>
        <li><strong>General</strong> — relación de dependencia: usa los porcentajes del año (9,45% personal, 11,15% patronal).</li>
        <li><strong>Gerente / representante legal</strong> (mandatario, relación 109) — 17,60% a cargo de la empresa, base mínima SBU, sin décimos, fondo de reserva ni vacaciones.</li>
      </ul>
      <p>Los tipos y sus porcentajes se editan en <strong>Afiliación IESS</strong>; el SBU y los porcentajes del año en <strong>Parámetros IESS/SBU</strong>. Confirma los valores con tu contador cuando cambie la normativa.</p>
      <h4>Anticipos, bonos y pago de nómina</h4>
      <p>Un anticipo o bono pagado aparte no se vuelve a pagar en el rol. <strong>Pagar nómina</strong> registra el egreso (en efectivo requiere caja abierta) y el asiento contable completo.</p>`
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
    id: 'licencia', grupo: 'Administración', titulo: 'Licencia y actualizaciones', icono: 'fa-key',
    dek: 'Activación de OMNI CORE y cómo se actualizan la aplicación y el servidor.',
    html: `
      <p>Aquí ves si la licencia está activa, para qué empresa/edición fue emitida y su vigencia. Para activarla o renovarla, pega la clave que te entregó CasRodsoft Development.</p>
      <h4>Actualización de esta aplicación</h4>
      <p>Es <strong>automática y silenciosa</strong>: la versión nueva se descarga sola y se instala al cerrar la app. Si quieres instalarla de inmediato, aquí aparece <strong>Instalar ahora</strong>. Tu dirección de servidor se conserva al actualizar.</p>
      <h4>Actualización del servidor</h4>
      <p>Si hay una versión nueva, aparece <strong>Actualizar ahora</strong>: el servidor se detiene uno o dos minutos y vuelve solo, con los cambios de base de datos aplicados. Hazlo fuera del horario de atención.</p>`
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
