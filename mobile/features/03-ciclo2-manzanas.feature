# language: es

@smoke
Característica: Ciclo de compra 2 - Manzanas (app)
  Smoke SD - filas "Ciclo de compra 2 (buscar manzanas...)" de Android e iOS
  El smoke manual paga con débito; no hay tarjeta de débito de prueba, así que se paga con la PASSCARD.

  Antecedentes:
    Dado que estoy logueado con el usuario de prueba
    Y estoy en el mundo Supermercado
    Y no hay pedidos pendientes
    Y el carrito está vacío

  Escenario: Pesable con unidades aproximadas, Click & Go y cancelar desde el widget
    Cuando busco "manzana"
    Y agrego el primer producto al carrito desde la búsqueda
    Entonces la tarjeta del producto muestra "unidades aproximadas"
    Cuando sumo una unidad desde la tarjeta del producto
    Entonces el precio y las unidades aproximadas se actualizan
    Cuando resto una unidad desde la tarjeta del producto
    Entonces el precio y las unidades aproximadas vuelven al valor anterior
    Cuando entro al detalle del primer producto
    Entonces veo la imagen, el nombre y el precio del producto
    Cuando voy al carrito y toco pagar
    Y elijo "Click & Go"
    Y elijo la fecha de entrega más lejana
    Y continúo a forma de pago
    Y pago con tarjeta de crédito PASSCARD
    Y confirmo el pedido
    Entonces el pedido se confirmó
    Cuando toco el widget de status del pedido en la landing
    Y cancelo el pedido
    Entonces el pedido queda anulado
