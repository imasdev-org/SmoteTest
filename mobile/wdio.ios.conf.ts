import { sharedConfig } from './wdio.shared.conf';
import { ENV } from './support/env';

/**
 * Corre en la Mac (Xcode + `npx appium driver install xcuitest`).
 *   Simulador:  APP=/ruta/Tienda.app DEVICE_NAME="iPhone 15" PLATFORM_VERSION=17.5 npm run test:ios
 *   Físico:     APP=/ruta/Tienda.ipa UDID=<udid> XCODE_ORG_ID=<team> npm run test:ios
 * IOS_BUNDLE_ID sólo para pisar el bundle id del ambiente (support/env.ts).
 */
if (!ENV.iosBundleId) throw new Error('Falta el bundle id de iOS del ambiente (IOS_BUNDLE_ID)');

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  // timeout por paso: en el iPhone 8 cada comando tarda ~1,3 s y algunos pasos (recorrer carruseles) pasan los 5 min.
  // Un paso que se pasa del timeout NO se cancela: sigue corriendo y ensucia el escenario siguiente
  cucumberOpts: { ...sharedConfig.cucumberOpts, timeout: 900_000, tags: `(${sharedConfig.cucumberOpts!.tags}) and not @android` },
  capabilities: [{
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.DEVICE_NAME || 'iPhone 15',
    ...(process.env.PLATFORM_VERSION ? { 'appium:platformVersion': process.env.PLATFORM_VERSION } : {}),
    ...(process.env.UDID ? { 'appium:udid': process.env.UDID } : {}),
    ...(process.env.XCODE_ORG_ID ? {
      'appium:xcodeOrgId': process.env.XCODE_ORG_ID,
      'appium:xcodeSigningId': 'Apple Development',
      // Sin esta cap Appium no pasa -allowProvisioningUpdates y el build firmado de WDA falla en iPhone físico
      'appium:allowProvisioningDeviceRegistration': true,
      'appium:updatedWDABundleId': process.env.WDA_BUNDLE_ID || 'com.imasdev.WebDriverAgentRunner',
    } : {}),
    ...(process.env.APP ? { 'appium:app': process.env.APP } : {}),
    'appium:bundleId': ENV.iosBundleId,
    'appium:noReset': true,
    // autoAcceptAlerts hace que WDA busque una alerta del sistema antes de cada comando: en el iPhone 8 cada comando
    // pasaba de ~1,5 s a ~22 s. Los permisos de la app (ubicación, notificaciones) se aceptan una vez a mano
    ...(process.env.AUTO_ACCEPT_ALERTS ? { 'appium:autoAcceptAlerts': true } : {}),
    'appium:newCommandTimeout': 300,
    // La primera vez compila e instala WebDriverAgent en el dispositivo: puede tardar varios minutos
    'appium:wdaLaunchTimeout': 240_000,
  }],
  before: async () => {
    // Igual que en Android: los banners animados de la home no dejan que la app quede "idle"
    // pageSourceExcludedAttributes: calcular "visible" y "accessible" en todo el árbol (~1100 elementos) hacía que
    // cada getPageSource tardara 27 s en el iPhone 8; sin esos atributos tarda ~2 s
    await driver.updateSettings({ waitForIdleTimeout: 0, pageSourceExcludedAttributes: 'visible,accessible' });
    // Ubicación en Montevideo (Buceo, con cobertura Express). Sólo aplica al simulador
    const [lat, lon] = (process.env.GEO || '-34.8941,-56.1307').split(',').map(Number);
    await driver.setGeoLocation({ latitude: lat, longitude: lon, altitude: 0 }).catch(() => {});
  },
};
