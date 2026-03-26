# language: es

@smoke
Característica: Ciclo de prueba 2 - Manzana
  Como tester de Tienda Inglesa
  Quiero verificar el ciclo de compra de un producto no financiable
  Para asegurar que el flujo de checkout con Click & Go y PASSCARD funciona

  Antecedentes:
    Dado que estoy logueado con el usuario de prueba
    Y el carrito está vacío

  Escenario: Buscar manzana y agregar al carrito
    Cuando busco "manzana"
    Y agrego el primer producto al carrito
    Entonces el carrito tiene al menos 1 producto

  Escenario: Verificar detalle del producto manzana
    Cuando busco "manzana"
    Y entro al detalle del primer producto
    Entonces la imagen del producto es visible
    Y el precio del producto es visible
    Y el precio contiene "$"

  Escenario: Checkout con Click and Go
    Dado que tengo un producto en el carrito
    Cuando inicio el checkout
    Y selecciono "Retiro"
    Y selecciono zona "Montevideo" y sucursal "Central"
    Y selecciono la fecha de entrega más lejana
    Y continúo al paso de forma de pago
    Entonces estoy en la página de forma de pago

  @requiere-geopay
  Escenario: Pagar con PASSCARD, confirmar pedido y cancelar
    Dado que estoy en la página de forma de pago
    Cuando selecciono la pestaña "Tarjetas"
    Y elimino la PASSCARD existente si la hay
    Y selecciono nueva tarjeta de crédito
    Y elijo el tipo "Pass Card"
    Y completo los datos de la PASSCARD en el popup de GeoPay
    Y continúo al paso de confirmación
    Entonces veo la fecha de entrega correcta
    Cuando confirmo el pedido
    Entonces el pedido se completó exitosamente
    Cuando voy a mis pedidos desde el menú
    Y cancelo el último pedido
    Entonces el pedido fue cancelado exitosamente
