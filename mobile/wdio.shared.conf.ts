import fs from 'node:fs';
import path from 'node:path';
import type { Options } from '@wdio/types';

/**
 * Config compartida Android / iOS.
 *
 * Variables de entorno:
 *   TEST_ENV      trunk | staging | preprod | prod   (default: preprod)
 *   APP           ruta al .apk / .app / .ipa a instalar (opcional si la app ya está instalada)
 *   APP_VERSION   versión esperada para "Validar incremento de versión" (opcional)
 *   TAGS          expresión de tags de Cucumber, ej: "@smoke and not @manual"
 *   WDIO_LOG      nivel de log de WDIO (default warn; info muestra cada comando con su hora)
 */
export const sharedConfig: Options.Testrunner = {
  runner: 'local',
  specs: ['./features/**/*.feature'],
  maxInstances: 1,
  logLevel: (process.env.WDIO_LOG as any) || 'warn',
  bail: 0,
  waitforTimeout: 20_000,
  // Los helpers toman el primer match (ej. el "+" de la primera tarjeta): sin esto WDIO 10 falla con varios matches
  strictSelectors: false,
  connectionRetryTimeout: 180_000,
  connectionRetryCount: 1,

  services: [['appium', { args: { relaxedSecurity: true } }]],

  framework: 'cucumber',
  cucumberOpts: {
    require: ['./features/steps/*.steps.ts'],
    tags: process.env.TAGS || 'not @manual and not @pendiente and not @util',
    timeout: 300_000,
    language: 'es',
  },

  reporters: [
    'spec',
    ['junit', { outputDir: './test-results', outputFileFormat: ({ capabilities }: any) => `junit-${capabilities.platformName}.xml` }],
  ],

  // Cada corrida arranca con capturas y tiempos limpios (si no, se mezclan con los de corridas anteriores)
  onPrepare: () => {
    fs.rmSync('./test-results/capturas', { recursive: true, force: true });
    fs.rmSync('./test-results/tiempos.jsonl', { force: true });
  },

  beforeStep: () => { stepStart = Date.now(); },

  /**
   * Por cada paso: se registra cuánto tardó (test-results/tiempos.jsonl, ver `npm run tiempos`) y se guarda
   * una captura en los pasos de verificación ("Entonces"/"Y" después de un "Entonces") o si falló.
   *   SCREENSHOTS=then (default) | all | fail
   */
  afterStep: async (step: any, scenario: any, result) => {
    const ms = Date.now() - stepStart;
    const keyword = String(step.keyword ?? '').trim();
    if (keyword && !/^(Y|Pero|And|But)$/i.test(keyword)) lastKeyword = keyword;
    const isCheck = /^(Entonces|Then)$/i.test(lastKeyword);
    const feature = path.basename(String(scenario?.uri ?? 'feature'), '.feature');
    const stepNo = String(++stepCounter).padStart(3, '0');
    fs.mkdirSync('./test-results', { recursive: true });
    fs.appendFileSync('./test-results/tiempos.jsonl', JSON.stringify({
      feature, scenario: scenario?.name, step: `${keyword} ${step.text}`.trim(), ms, passed: result.passed,
      platform: driver.isAndroid ? 'Android' : 'iOS',
    }) + '\n');
    const mode = process.env.SCREENSHOTS || 'then';
    if (!result.passed || mode === 'all' || (mode === 'then' && isCheck)) {
      const dir = `./test-results/capturas/${feature}`;
      fs.mkdirSync(dir, { recursive: true });
      const name = `${stepNo}-${result.passed ? 'ok' : 'FALLA'}-${slug(step.text)}.png`;
      await driver.saveScreenshot(`${dir}/${name}`).catch(() => {});
    }
  },
};

let stepStart = Date.now();
let stepCounter = 0;
let lastKeyword = '';
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60);
