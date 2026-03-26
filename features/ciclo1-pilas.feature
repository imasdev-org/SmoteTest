# language: es

@smoke
Característica: Ciclo de prueba 1 - Pilas
  Como tester de Tienda Inglesa
  Quiero verificar el ciclo de compra de un producto financiable
  Para asegurar que el flujo de checkout con envío a domicilio y PASSCARD funciona

  Antecedentes:
    Dado que estoy logueado con el usuario de prueba

  Escenario: Buscar producto financiable y agregar al carrito
    Dado el carrito está vacío
    Cuando busco el producto financiable del ambiente
    Y agrego el primer producto al carrito
    Entonces el carrito tiene al menos 1 producto

  Escenario: Checkout con envío a domicilio y fecha lejana
    Dado que tengo un producto en el carrito
    Cuando inicio el checkout
    Y selecciono "Envío a domicilio"
    Y selecciono una dirección de entrega
    Y selecciono la fecha de entrega más lejana
    Y continúo al paso de forma de pago
    Entonces estoy en la página de forma de pago

  @requiere-geopay
  Escenario: Dar de alta PASSCARD, confirmar pedido y cancelar
    Dado que estoy en la página de forma de pago
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
    Entonces el pedido fue cancelado exitosamente
