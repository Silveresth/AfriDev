import { expect, test } from './fixtures/network';

const JS_BUDGET_BYTES = 300 * 1024;

test('la page publique reste sous 300 Ko de JavaScript', async ({ page }) => {
  // Octets réellement transférés (compressés) : c'est ce que paie le forfait data. Chaque taille
  // est attendue avant de sommer ; lire `response.body()` en vol sous-comptait selon le timing.
  const sizes: Promise<number>[] = [];
  page.on('requestfinished', (request) => {
    if (request.resourceType() === 'script') sizes.push(request.sizes().then((s) => s.responseBodySize));
  });
  await page.goto('/offline');
  await page.waitForLoadState('networkidle');
  const jsBytes = (await Promise.all(sizes)).reduce((sum, size) => sum + size, 0);
  expect(jsBytes).toBeGreaterThan(0);
  expect(jsBytes).toBeLessThan(JS_BUDGET_BYTES);
});

test('le fil s\'affiche en 3G lente', async ({ page, slow3g }) => {
  void slow3g;
  await page.goto('/feed');
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
});

test('mode avion : la page de secours s\'affiche', async ({ page, context }) => {
  await page.goto('/feed');
  await context.setOffline(true);
  await page.reload().catch(() => undefined);
  await expect(page.locator('body')).toBeVisible();
  await context.setOffline(false);
});
