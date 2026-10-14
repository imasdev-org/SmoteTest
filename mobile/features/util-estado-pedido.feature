# language: es

# Utilitario (no es parte del smoke): muestra el estado de un pedido puntual.
#   ORDER=12926997 TAGS=@util npm run test:android -- --spec ./features/util-estado-pedido.feature
@util
Característica: Utilitario - estado de pedido

  Escenario: Ver el estado del pedido indicado en ORDER
    Dado que estoy logueado con el usuario de prueba
    Entonces muestro el estado del pedido indicado en ORDER
