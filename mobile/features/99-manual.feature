# language: es

# Ítems del smoke que siguen siendo manuales (visuales o dependientes del
# dispositivo). Quedan acá para que el smoke completo esté trazado en un solo lugar.
# No se ejecutan (tag @manual).

@manual
Característica: Smoke SD - verificaciones manuales

  Escenario: Editar el geopoint de un domicilio
    Dado que estoy logueado con el usuario de prueba

  Escenario: Componentes de producto coherentes en home y search (cocardas, precios, badges, selectores, tamaños)
    Dado que estoy logueado con el usuario de prueba

  Escenario: Nuevo cliente - lotties (animaciones de carga) correctos en todos los mundos
    Dado que estoy logueado con el usuario de prueba

  Escenario: Nuevo cliente - el buscador no muestra el nombre de otro tenant cambiando el idioma del dispositivo (es-ES, en-GB, pt)
    Dado que estoy logueado con el usuario de prueba

  @ios
  Escenario: Nuevo cliente iOS - la home carga lazy (componentes a medida que llegan, sin margarita a pantalla completa)
    Dado que estoy logueado con el usuario de prueba
