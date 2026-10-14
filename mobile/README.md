# SmoteTest - Mobile (app nativa Android + iOS)

Smoke de la app Smart Devices de Tienda Inglesa con **Appium 3 + WebdriverIO 10 + Cucumber** (Gherkin en español).
Cubre la hoja **TIENDA** del [Smoke Tests](https://docs.google.com/spreadsheets/d/1v7EIRqoiD6drxTD8JZ38gjgaGU-CM4kO4meNaYz2zA0/edit?gid=0) (secciones ANDROID e IOS).

## Cobertura

| Feature | Filas del smoke | Estado |
|---|---|---|
| `01-version` | Validar incremento de versión | ✅ verificado en emulador |
| `02-ciclo1-pilas` | Ciclo de compra 1 (pilas, detalle, envío a domicilio, crédito 2 cuotas, notificación, cancelar) | escrito, falta calibrar textos |
| `03-ciclo2-manzanas` | Ciclo de compra 2 (unidades aproximadas, +/-, Click & Go, débito, widget de status, cancelar) | escrito, falta calibrar textos y tarjeta de débito |
| `04-express` | Express anónimo + topes, cerrar/background de la app, cambio de mundo, quick checkout (iOS) | escrito, falta calibrar textos |
| `06-navegacion` | Home y carruseles (Super y Express), detalle, búsqueda con filtros, paginación (3 páginas) y nueva búsqueda vuelve arriba. No crea pedidos | ✅ verificado en emulador (prod) |
| `99-manual` | Geopoint, componentes de producto, lotties, idioma del dispositivo, home lazy | `@manual` (no se ejecutan) |

Tags: `@ios` / `@android` = sólo esa plataforma, `@manual` y `@pendiente` se excluyen por defecto.

## Setup

```bash
cd mobile
npm install
npm run appium:drivers        # uiautomator2 (+ xcuitest en la Mac)
```

**Android (Windows/Linux/Mac):** Android SDK con `ANDROID_HOME` y un JDK 11+ en `JAVA_HOME` (con el JDK 8 local también corre).
**iOS (sólo Mac):** Xcode + simulador o iPhone. Para iPhone físico: `XCODE_ORG_ID` (team id) y el IPA firmado para ese equipo.

## Ejecutar

```bash
# Android: emulador levantado (o celular con depuración USB) y la app instalada
TEST_ENV=preprod APP_VERSION=34.1533 npm run test:android

# Instalando un build puntual
TEST_ENV=preprod APP=/ruta/sdTiendaPreprod.apk npm run test:android

# iOS en simulador
TEST_ENV=preprod IOS_BUNDLE_ID=<bundle id> APP=/ruta/Tienda.app DEVICE_NAME="iPhone 15" npm run test:ios

# Un solo feature / por tags
npm run test:android -- --spec ./features/02-ciclo1-pilas.feature
TAGS="@express" npm run test:android
```

| Variable | Para qué |
|---|---|
| `TEST_ENV` | `trunk` \| `staging` \| `preprod` (default) \| `prod` |
| `APP` | `.apk` / `.app` / `.ipa` a instalar antes de correr |
| `APP_VERSION` | versión esperada para el chequeo de versión |
| `ANDROID_PACKAGE` / `IOS_BUNDLE_ID` | pisar el identificador del ambiente (prod e iOS no tienen default todavía) |
| `UDID`, `DEVICE_NAME`, `PLATFORM_VERSION` | elegir dispositivo |
| `TEST_USER` / `TEST_PASSWORD` | usuario de prueba (default el mismo que el smoke web) |
| `EXPRESS_ADDRESS` | domicilio con cobertura express |

Reportes: `test-results/junit-<plataforma>.xml` + screenshots de los pasos que fallan.

## Calibrar contra el build actual

La app es GeneXus SD y casi no expone ids, así que los steps buscan por **texto visible**.
Todos los textos están en [`support/texts.ts`](support/texts.ts): cuando algo no se encuentra, abrir
[Appium Inspector](https://github.com/appium/appium-inspector) contra el emulador, ver el texto
real del control y ajustarlo ahí (no en los steps). Si GeneXus expone un accessibility id
(propiedad *Accessibility* del control), mejor pedirlo y usarlo.

## Estructura

```
mobile/
  wdio.shared.conf.ts / wdio.android.conf.ts / wdio.ios.conf.ts
  features/*.feature          escenarios (uno por bloque del smoke)
  features/steps/*.steps.ts   steps (no se importan entre sí)
  support/                    env, textos, helpers de UI, flujos compartidos
```
