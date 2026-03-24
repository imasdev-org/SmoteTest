# SmoteTest

Smoke test automatizado para Tienda Inglesa con Playwright.

## Ambientes

| Ambiente | URL | Producto de prueba |
|----------|-----|--------------------|
| Trunk    | `https://trunk-web.imasdev.com` | camara digital nikon |
| Staging  | `https://staging-web.imasdev.com` | camara digital nikon |
| Prod     | `https://www.tiendainglesa.com.uy` | pilas |

## Ejecución

```bash
# Trunk (default)
BASE_URL=https://trunk-web.imasdev.com npx playwright test

# Staging
BASE_URL=https://staging-web.imasdev.com npx playwright test

# Prod
BASE_URL=https://www.tiendainglesa.com.uy npx playwright test
```

## Flujo del test

1. Login con `laguiar@adinet.com.uy`
2. Vaciar carrito si tiene productos
3. Buscar producto financiable y agregar al carrito
4. Checkout → Envío a domicilio → Seleccionar fecha lejana
5. Forma de Pago → Tarjetas → Nueva tarjeta de crédito → Pass Card
6. **[PENDIENTE - requiere GeoPay]** Ingresar datos PASSCARD (6280261111113352, 12/28, CVV 123)
7. Seleccionar 2 cuotas
8. Confirmar y verificar datos en pantalla final

## Estado

- Tests 1-2: funcionando (login, carrito, búsqueda, checkout entrega, fecha, forma de pago)
- Test 3: pendiente - el popup de GeoPay (procesador de tarjetas) no está disponible
- Tests 4-5: pendientes (cuotas, confirmación)

## Setup

```bash
npm install
npx playwright install chromium
```
