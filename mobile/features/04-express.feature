# language: es

# Los escenarios se ejecutan en orden: la app reabre en el mundo del ÚLTIMO PEDIDO. Como el smoke anula
# la compra Express del primer escenario, al reabrir la app aparece el selector de mundos (esperado).
@smoke @express
Característica: Mundo Express (app)
  Smoke SD - filas de Express, cierre/background de la app y cambio de mundo

  Escenario: Compra Express: primer producto como anónimo, después logueado hasta los topes
    # El carrito es del usuario: se vacía logueado antes de pasar a anónimo
    Dado que estoy logueado con el usuario de prueba
    Y no hay pedidos pendientes
    Y entro al mundo Express
    Y el carrito está vacío
    Y que entro a la app como anónimo
    Cuando entro al mundo Express
    Y elijo un domicilio con cobertura express
    Y recorro la home de Express
    Y agrego un producto desde un carrusel de compra rápida
    Y me logueo con el usuario de prueba si me lo pide
    Entonces el carrito tiene al menos 1 producto
    Cuando agrego productos hasta llegar al tope del carrito
    Entonces veo el mensaje de tope del carrito
    # "Ir a pagar" en Express a veces va directo a "Confirmar Pedido" (quick checkout, se confirma tal cual)
    # y a veces al checkout normal ("Pedido" con fecha → forma de pago)
    Cuando voy al carrito y toco pagar
    Y si no es quick checkout completo el checkout con la PASSCARD
    Y confirmo el pedido
    Entonces el pedido se confirmó
    Cuando cancelo el pedido desde mis pedidos
    Entonces el pedido queda anulado

  Escenario: Con el pedido Express anulado la app reabre en el selector de mundos, Express sobrevive al background y se puede cambiar de mundo
    Dado que estoy logueado con el usuario de prueba
    Y estoy en el mundo Express con productos en el carrito
    Cuando cierro la app y la vuelvo a abrir
    Entonces la app abre en el selector de mundos
    Cuando elijo el mundo Express en el selector
    Y mando la app a background 30 segundos y vuelvo
    Entonces sigo en la home de Express sin que se recargue
    Cuando cambio al mundo Supermercado
    Entonces estoy en el mundo Supermercado
    Cuando cambio al mundo Express
    Entonces la app abre en el mundo Express

  # Pendiente: en el local Express que atiende Buceo cada bidón tiene 1 unidad en stock ("1 Disponibles"),
  # no se puede llegar a 4. Falta definir producto/dirección con stock para probar el tope.
  @pendiente
  Escenario: No se pueden pedir más de 3 bidones de agua en Express
    Dado que estoy logueado con el usuario de prueba
    Y estoy en el mundo Express con productos en el carrito
    Cuando intento agregar más de 3 bidones de agua
    Entonces veo el mensaje de tope de bidones

  @ios
  Escenario: Ciclo de compra Express por Quick Checkout
    Dado que estoy logueado con el usuario de prueba
    Y no hay pedidos pendientes
    Y estoy en el mundo Express con productos en el carrito
    Cuando voy al carrito y toco pagar
    Entonces estoy en el quick checkout
    Cuando confirmo el pedido
    Entonces el pedido se confirmó
    Cuando cancelo el pedido desde mis pedidos
    Entonces el pedido queda anulado
