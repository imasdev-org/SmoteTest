# language: es

@smoke
Característica: Ciclo de compra 1 - Pilas (app)
  Smoke SD - filas "Ciclo de compra (buscar PILAS...)" de Android e iOS

  Antecedentes:
    Dado que estoy logueado con el usuario de prueba
    Y estoy en el mundo Supermercado
    Y no hay pedidos pendientes
    Y el carrito está vacío

  Escenario: Buscar, ver detalle, pagar con crédito en 2 cuotas con envío a domicilio y cancelar
    Cuando busco el producto financiable del ambiente
    Y agrego el primer producto al carrito desde la búsqueda
    Entonces el carrito tiene al menos 1 producto
    Cuando entro al detalle del primer producto
    Entonces veo la imagen, el nombre y el precio del producto
    Cuando voy al carrito y toco pagar
    Entonces veo el carrito cargado
    Cuando elijo "Envío a domicilio"
    Y elijo la fecha de entrega más lejana
    Y continúo a forma de pago
    Y pago con tarjeta de crédito PASSCARD
    Y elijo 2 cuotas
    Y confirmo el pedido
    Entonces el pedido se confirmó
    Cuando toco la notificación del pedido
    Y cancelo el pedido desde mis pedidos
    Entonces el pedido queda anulado
