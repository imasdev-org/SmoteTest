# language: es

@smoke
Característica: Ciclo de prueba 1 - Pilas
  Como tester de Tienda Inglesa
  Quiero verificar el ciclo de compra completo de un producto financiable
  Para asegurar que el flujo de checkout con envío a domicilio y PASSCARD funciona

  @requiere-geopay
  Escenario: Ciclo completo - buscar, comprar con PASSCARD envío a domicilio y cancelar
    Dado que estoy logueado con el usuario de prueba
    Y no hay pedidos pendientes
    Y el carrito está vacío
    Cuando busco el producto financiable del ambiente
    Y agrego el primer producto al carrito
    Entonces el carrito tiene al menos 1 producto
    Cuando inicio el checkout
    Y selecciono "Envío a domicilio"
    Y selecciono la fecha de entrega más lejana
    Y continúo al paso de forma de pago
    Entonces estoy en la página de forma de pago
    Cuando selecciono la pestaña "Tarjetas"
    Y elimino la PASSCARD existente si la hay
    Y selecciono nueva tarjeta de crédito
    Y elijo el tipo "Pass Card"
    Y completo los datos de la PASSCARD en el popup de GeoPay
    Y selecciono cuotas
    Y continúo al paso de confirmación
    Entonces veo la fecha de entrega correcta
    Y veo la dirección de entrega correcta
    Cuando confirmo el pedido
    Entonces el pedido se completó exitosamente
    Cuando voy a mis pedidos desde el menú
    Y cancelo el último pedido
    Entonces el pedido aparece como anulado en mis pedidos
