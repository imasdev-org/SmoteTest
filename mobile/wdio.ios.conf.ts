import { sharedConfig } from './wdio.shared.conf';
import { ENV } from './support/env';

/**
 * Corre en la Mac (Xcode + `npx appium driver install xcuitest`).
 *   Simulador:  APP=/ruta/Tienda.app DEVICE_NAME="iPhone 15" PLATFORM_VERSION=17.5 npm run test:ios
 *   Físico:     APP=/ruta/Tienda.ipa UDID=<udid> XCODE_ORG_ID=<team> npm run test:ios
 * IOS_BUNDLE_ID es obligatorio (ningún ambiente tiene default todavía).
 */
if (!ENV.iosBundleId) throw new Error('Falta IOS_BUNDLE_ID (bundle id de la app iOS del ambiente)');

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  cucumberOpts: { ...sharedConfig.cucumberOpts, tags: `(${sharedConfig.cucumberOpts!.tags}) and not @android` },
  capabilities: [{
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.DEVICE_NAME || 'iPhone 15',
    ...(process.env.PLATFORM_VERSION ? { 'appium:platformVersion': process.env.PLATFORM_VERSION } : {}),
    ...(process.env.UDID ? { 'appium:udid': process.env.UDID } : {}),
    ...(process.env.XCODE_ORG_ID ? { 'appium:xcodeOrgId': process.env.XCODE_ORG_ID, 'appium:xcodeSigningId': 'Apple Development' } : {}),
    ...(process.env.APP ? { 'appium:app': process.env.APP } : {}),
    'appium:bundleId': ENV.iosBundleId,
    'appium:noReset': true,
    'appium:autoAcceptAlerts': true,
    'appium:newCommandTimeout': 300,
    // La primera vez compila e instala WebDriverAgent en el dispositivo: puede tardar varios minutos
    'appium:wdaLaunchTimeout': 240_000,
  }],
  before: async () => {
    // Igual que en Android: los banners animados de la home no dejan que la app quede "idle"
    await driver.updateSettings({ waitForIdleTimeout: 0 });
    // Ubicación en Montevideo (Buceo, con cobertura Express). Sólo aplica al simulador
    const [lat, lon] = (process.env.GEO || '-34.8941,-56.1307').split(',').map(Number);
    await driver.setGeoLocation({ latitude: lat, longitude: lon, altitude: 0 }).catch(() => {});
  },
};
