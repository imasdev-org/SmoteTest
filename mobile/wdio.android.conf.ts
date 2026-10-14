import { sharedConfig } from './wdio.shared.conf';
import { ENV } from './support/env';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  cucumberOpts: { ...sharedConfig.cucumberOpts, tags: `(${sharedConfig.cucumberOpts!.tags}) and not @ios` },
  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.DEVICE_NAME || 'Android Emulator',
    ...(process.env.UDID ? { 'appium:udid': process.env.UDID } : {}),
    ...(process.env.APP ? { 'appium:app': process.env.APP } : {}),
    'appium:appPackage': ENV.androidPackage,
    'appium:appActivity': 'com.genexus.android.core.activities.StartupActivity',
    'appium:appWaitActivity': '*',
    'appium:noReset': true,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 300,
  }],
  before: async () => {
    // waitForIdleTimeout: la home tiene banners animados y UiAutomator espera un idle que nunca llega.
    // enableMultiWindows: el panel del carrito es otra ventana y sin esto Appium no lo ve.
    await driver.updateSettings({ waitForIdleTimeout: 0, enableMultiWindows: true });
    // Sin el autofill de Google ("Save password to Google?" tapa la app después del login)
    await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'secure', 'autofill_service', 'null'] }).catch(() => {});
    // Sin el diálogo "<app> isn't responding": con el emulador cargado la app tarda en responder, el diálogo
    // tapa la pantalla y el escenario falla aunque la app se recupere sola
    await driver.execute('mobile: shell', { command: 'settings', args: ['put', 'global', 'hide_error_dialogs', '1'] }).catch(() => {});
    // Ubicación en Montevideo (Buceo, con cobertura Express). El emulador la pierde al reiniciarse
    const [lat, lon] = (process.env.GEO || '-34.8941,-56.1307').split(',').map(Number);
    await driver.setGeoLocation({ latitude: lat, longitude: lon, altitude: 0 }).catch(() => {});
  },
};
