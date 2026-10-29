/**
 * Datos por ambiente. Los package / bundle id se pueden pisar con
 * ANDROID_PACKAGE / IOS_BUNDLE_ID si el build usa otro identificador.
 */
type EnvName = 'trunk' | 'staging' | 'preprod' | 'prod';

const ENVS: Record<EnvName, { androidPackage: string; iosBundleId: string; productoFinanciable: string }> = {
  trunk:   { androidPackage: 'com.imasdev.tiendatrunk',   iosBundleId: 'com.imasdev.tiendatrunk', productoFinanciable: 'camara digital nikon' },
  staging: { androidPackage: 'com.imasdev.tiendastaging', iosBundleId: 'com.imasdev.tiendastaging', productoFinanciable: 'camara digital nikon' },
  preprod: { androidPackage: 'com.imasdev.tiendapreprod', iosBundleId: 'com.imasdev.tiendapreprod', productoFinanciable: 'pilas' },
  prod:    { androidPackage: 'com.imasdev.tiendainglesa', iosBundleId: 'uy.com.imasdev.tiendainglesa', productoFinanciable: 'pilas' },
};

const name = (process.env.TEST_ENV || 'preprod') as EnvName;
if (!ENVS[name]) throw new Error(`TEST_ENV desconocido: ${name}. Usar trunk | staging | preprod | prod`);

export const ENV = {
  name,
  ...ENVS[name],
  androidPackage: process.env.ANDROID_PACKAGE || ENVS[name].androidPackage,
  iosBundleId: process.env.IOS_BUNDLE_ID || ENVS[name].iosBundleId,
  expectedVersion: process.env.APP_VERSION,
  // KEEP_ORDER=1: confirma el pedido pero NO lo anula (para revisarlo a mano en el backoffice)
  keepOrder: process.env.KEEP_ORDER === '1',
};

// Las credenciales del usuario de prueba van SIEMPRE por variables de entorno (no se guardan en el repo)
function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (usuario de prueba del ambiente)`);
  return v;
}

export const USER = {
  get email() { return required('TEST_USER'); },
  get password() { return required('TEST_PASSWORD'); },
};

export const PASSCARD = { number: '6280261111113352', expiry: '12/28', cvv: '123' };
