import { windowSize } from './ui';
import { ENV } from './env';

export const appId = () => driver.isAndroid ? ENV.androidPackage : ENV.iosBundleId;

/** Mata la app y la vuelve a abrir (equivale a cerrarla desde el multitarea). */
export async function restartApp() {
  await driver.terminateApp(appId());
  await driver.pause(1_000);
  await driver.activateApp(appId());
  await driver.pause(3_000);
}

/** Manda la app a background N segundos y la vuelve a traer al frente. */
export async function sendToBackground(seconds: number) {
  await driver.background(-1);
  await driver.pause(seconds * 1_000);
  await driver.activateApp(appId());
  await driver.pause(2_000);
}

export async function installedVersion(): Promise<string> {
  if (driver.isAndroid) {
    const out: string = await driver.execute('mobile: shell', { command: 'dumpsys', args: ['package', ENV.androidPackage] });
    const name = out.match(/versionName=(\S+)/)?.[1];
    if (!name) throw new Error(`No se pudo leer la versión de ${ENV.androidPackage}`);
    return name;
  }
  const apps: Record<string, any> = await driver.execute('mobile: listApps', { applicationType: 'User' });
  const info = apps[ENV.iosBundleId];
  if (!info) throw new Error(`La app ${ENV.iosBundleId} no está instalada`);
  return info.CFBundleShortVersionString;
}

/** Ejecuta fn dentro del primer WEBVIEW disponible (ej. formulario de GeoPay). */
export async function inWebview<T>(fn: () => Promise<T>, timeout = 30_000): Promise<T> {
  let webview: string | undefined;
  await driver.waitUntil(async () => {
    const contexts = (await driver.getContexts()) as unknown[];
    webview = contexts.map(c => typeof c === 'string' ? c : (c as any).id).find(c => /WEBVIEW/i.test(c));
    return !!webview;
  }, { timeout, timeoutMsg: 'No apareció ningún WEBVIEW (¿GeoPay abre en el navegador externo?)' });
  await driver.switchContext(webview!);
  try {
    return await fn();
  } finally {
    await driver.switchContext('NATIVE_APP');
  }
}

/**
 * Abre el centro de notificaciones y toca la primera que contenga el texto.
 * Android: openNotifications. iOS: swipe desde arriba y se busca en SpringBoard.
 */
export async function tapNotification(text: string, timeout = 90_000) {
  if (driver.isAndroid) {
    await driver.openNotifications();
    const el = await $(`android=new UiSelector().textMatches("(?is).*${text}.*")`);
    await el.waitForDisplayed({ timeout, timeoutMsg: `No llegó una notificación con "${text}"` });
    await el.click();
    return;
  }
  const { width } = await windowSize();
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(width * 0.3), y: 5 }).down().pause(100)
    .move({ x: Math.round(width * 0.3), y: 600, duration: 400 }).up().perform();
  await driver.updateSettings({ defaultActiveApplication: 'com.apple.springboard' });
  try {
    const el = await $(`-ios predicate string:label CONTAINS[c] '${text}'`);
    await el.waitForDisplayed({ timeout, timeoutMsg: `No llegó una notificación con "${text}"` });
    await el.click();
  } finally {
    await driver.updateSettings({ defaultActiveApplication: 'auto' });
  }
}
