# language: es

# Recorrido de la app SIN crear pedidos: se puede correr siempre, sin vigilancia.
@smoke @navegacion
Característica: Navegación - home, carruseles, detalle, búsqueda y filtros

  Antecedentes:
    Dado que estoy logueado con el usuario de prueba

  Escenario: Home de Super - los carruseles muestran productos con precio y se deslizan
    Dado estoy en el mundo Supermercado
    Cuando recorro los carruseles de la home
    Entonces cada carrusel muestra productos con nombre y precio
    Y los carruseles se deslizan mostrando productos nuevos

  Escenario: Home de Super - "Ver todos" de un carrusel lista productos
    Dado estoy en el mundo Supermercado
    Cuando abro "Ver todos" del primer carrusel de la home
    Entonces veo al menos 4 productos con nombre y precio
    Y puedo volver a la home

  Escenario: Detalle de producto desde un carrusel de la home
    Dado estoy en el mundo Supermercado
    Cuando entro al detalle de un producto de un carrusel de la home
    Entonces el detalle muestra imagen, nombre, código de caja, EAN, precio y agregar al carrito
    Y el detalle muestra productos relacionados con precio
    Y puedo volver a la home

  # Una sola búsqueda de "leche" para todas las validaciones sobre sus resultados (cada búsqueda en prod cuesta 3-50 s)
  Escenario: Búsqueda - resultados con precio, filtros por marca y categoría y detalle
    Dado estoy en el mundo Supermercado
    Cuando busco "leche"
    Entonces veo al menos 4 productos con nombre y precio
    Cuando filtro por la marca "Conaprole"
    Entonces todos los productos de los resultados son de la marca "Conaprole"
    Cuando quito los filtros
    Entonces hay productos de otras marcas además de "Conaprole"
    Cuando filtro por la categoría "Frescos"
    Entonces la búsqueda muestra sólo la categoría "Frescos" con productos con precio
    Cuando entro al detalle del primer producto
    Entonces el detalle muestra imagen, nombre, código de caja, EAN, precio y agregar al carrito

  # Smoke SD - filas de scroll de búsqueda. La paginación se valida con 3 páginas, no hasta el final
  # de la grilla (recorrer todos los resultados costaba ~110 s por búsqueda)
  Escenario: Búsqueda - la paginación suma productos con precio y una nueva búsqueda vuelve la grilla al principio
    Dado estoy en el mundo Supermercado
    Cuando busco "galletitas"
    Entonces veo al menos 4 productos con nombre y precio
    Cuando scrolleo la búsqueda 3 veces
    Entonces en cada scroll aparecen productos nuevos con precio
    Cuando busco "leche"
    Entonces la grilla está al principio

  Escenario: Home de Express - los carruseles muestran productos con precio y se deslizan
    Dado estoy en el mundo Express con productos en el carrito
    Cuando recorro los carruseles de la home
    Entonces cada carrusel muestra productos con nombre y precio
    Y los carruseles se deslizan mostrando productos nuevos

  Escenario: Detalle de producto desde un carrusel de Express
    Dado estoy en el mundo Express con productos en el carrito
    Cuando entro al detalle de un producto de un carrusel de la home
    Entonces el detalle muestra imagen, nombre, código de caja, EAN, precio y agregar al carrito
    Y puedo volver a la home
