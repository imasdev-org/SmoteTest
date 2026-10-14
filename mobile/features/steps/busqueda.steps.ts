import { Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { findAllByText, waitForLoading } from '../../support/ui';

Then('la grilla está al principio', async () => {
  await waitForLoading();
  // La grilla nueva tarda en cargar (se ve vacía y oscurecida): esperar a que aparezcan tarjetas
  await driver.waitUntil(async () => (await findAllByText(['Var Product Image'])).length > 0, { timeout: 30_000, interval: 1_000 }).catch(() => {});
  // Si la grilla quedó al principio, la primera tarjeta está en la parte de arriba de la pantalla
  // (no se usa un swipe hacia abajo: dispara el "pull to refresh" y cambia los productos)
  const [first] = await findAllByText(['Var Product Image']);
  const { height } = await driver.getWindowSize();
  console.log(`Primera tarjeta en y=${first?.y} (pantalla ${height})`);
  expect(first).toBeDefined();
  expect(first.y).toBeLessThan(height * 0.4);
});
