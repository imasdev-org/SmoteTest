# language: es

# Utilitario (no es parte del smoke): anula un pedido puntual, ej. uno que quedó con KEEP_ORDER=1.
#   ORDER=12919283 TAGS=@util npm run test:android -- --spec ./features/util-anular-pedido.feature
@util
Característica: Utilitario - anular pedido

  Escenario: Anular el pedido indicado en ORDER
    Dado que estoy logueado con el usuario de prueba
    Cuando anulo el pedido indicado en ORDER
    Entonces el pedido queda anulado
