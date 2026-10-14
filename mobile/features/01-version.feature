# language: es

@smoke
Característica: Versión de la app
  Smoke SD - "Validar incremento de version"

  Escenario: La app instalada tiene la versión esperada
    Dado que la app está abierta
    Entonces la versión instalada es la esperada
