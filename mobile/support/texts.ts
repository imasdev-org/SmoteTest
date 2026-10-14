/**
 * Textos / accessibility labels de la app que usan los steps.
 * Cada entrada acepta varias alternativas. findByText busca en text y en
 * content-desc (Android) / label-name-value (iOS), contiene + case-insensitive.
 *
 * Relevado en Android trunk 35.1252 (oct-2026). iOS todavía sin relevar:
 * GeneXus suele exponer los mismos nombres de control como accessibility label.
 */
export const T = {
  // Onboarding / login
  iniciarSesion: ['Iniciar sesión'],
  usuario: ['Usuario / e-mail', 'Usuario'],
  password: ['Contraseña'],
  ingresar: ['Ingresar'],
  usuarioLogueado: ['Hola,'],              // drawer: "var User Name Hola, <nombre>"
  cerrarSesion: ['Cerrar sesión', 'Salir'],

  // Home / búsqueda / tarjeta de producto
  buscar: ['Buscar'],
  home: ['Entrega en', 'Retira en'],          // barra de domicilio de la home (Super y Express)
  appCargada: ['Channel Logo'],
  // Pantallas que puede mostrar la app al arrancar y se descartan (ej. "Verificación de Email" en prod)
  descartarAlInicio: ['En otro momento'],
  sumar: ['+'],
  restar: ['-'],
  unidadesAproximadas: ['Aprox'],          // "Aprox 5 unidades"
  cantidadEnTarjeta: ['txt Amount'],        // desc "txt Amount 1,0 kg"
  nombreProducto: ['Product Name Camel'],   // desc "Product Name Camel <nombre>"
  imagenEnGrilla: ['Var Product Image'],
  imagenDetalle: ['Product Picture'],
  agregarAlCarritoDetalle: ['Agregar al carrito'],
  sinResultados: ['No se han encontrado resultados'],

  // Carrito (panel lateral)
  pagar: ['Pagar'],
  vaciarCarrito: ['Vaciar carrito'],
  pedidoNuevo: ['No, quiero uno nuevo', 'pedido nuevo'],
  topeCarrito: ['límite de unidades'],      // Express: "Ooops, ¡has llegado al límite de unidades para tu pedido express!" (16/16)
  irAPagar: ['Ir a pagar'],
  topeBidones: ['máximo', 'hasta 3', 'no podés agregar más', 'No es posible agregar'],

  // Checkout - entrega
  lugarDeEntrega: ['Lugar de Entrega', 'Entrega a domicilio', 'Retira en sucursal'],
  tabRetiro: ['Retiro'],
  tabEnvio: ['Envío a domicilio'],
  clickAndGo: ['Click and Go'],
  region: 'Montevideo',
  sucursal: process.env.SUCURSAL || 'Central',
  seleccionar: ['Seleccionar'],
  confirmar: ['Confirmar'],
  fecha: ['Date Info'],                    // desc "Date Info Elegí cuando" / "Date Info jueves 15 de 10 a 11 hs"
  continuar: ['Continuar'],

  // Checkout - pago
  moneda: ['Moneda'],
  pesos: ['Pesos Uruguayos'],
  tarjetas: ['Caption Tarjetas'],
  passcardGuardada: ['Caption Passcard', '628026'],
  debitoGuardada: ['Payment Type Desc Débito'], // tarjeta guardada (no confundir con "Nueva tarjeta de débito")
  nuevaTarjetaCredito: ['Caption Nueva tarjeta de crédito'],
  nuevaTarjetaDebito: ['Caption Nueva tarjeta de débito'],
  tipoPassCard: ['Payment Description Pass Card'],
  eliminar: ['Eliminar'],
  cuotas: ['Cuotas', 'cuotas'],
  confirmarPedido: ['Confirmar Pedido'],
  pedidoConfirmado: ['Confirmación del pedido'],

  // Pedidos
  menuMisPedidos: ['Menu Title Mis pedidos'],
  cancelarPedido: ['Cancelar Pedido'],
  motivoCancelacion: ['Motivo de cancelación'],
  anulado: 'ANULADO',
  widgetStatusPedido: ['Pedido #'],            // tarjeta de la home: "Pedido # 12919979 - Confirmado"
  notificacionPedido: ['pedido'],

  // Mundos (el selector son imágenes sin nombre, en este orden)
  mundos: ['Super', 'Express', 'Deli', 'Barnys', 'Farma'] as const,
  canalExpress: ['Channel Name Express'],
  direccionDeEntrega: ['Var Delivery Address Full'],
  // Marcas de que la home es la de Express (franja de entrega del día)
  homeExpress: ['Próxima entrega', 'franja de envío', 'entrega en el día', 'Recibilo hoy', 'Llega hoy', 'entregas para hoy', 'Programá tu pedido'],
  sinCoberturaExpress: ['No hay cobertura para Express'],
  debeIniciarSesion: ['Debe iniciar sesión'],   // diálogo al agregar como anónimo (ACEPTAR lleva al login)
  bidonAgua: process.env.BIDON_TERM || 'bidon agua',
};
