import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/assign', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        assignments: [{ name: 'Aron', assignedRoom: '102', note: 'Test' }],
        unassigned: []
      })
    });
  });
  await page.goto('/');
});

test('can add and remove room entries manually', async ({ page }) => {
  await expect(page.locator('#app-status')).toContainText('script lastet');

  await page.fill('#room-input', '102');
  await page.click('#room-add');

  await expect(page.locator('#rooms-hint')).toContainText('Ledige rom (1): 102');
  await expect(page.locator('#rooms-list .room-pill')).toHaveCount(1);

  await page.click('#rooms-list [data-remove-room="102"]');

  await expect(page.locator('#rooms-list .room-pill')).toHaveCount(0);
  await expect(page.locator('#rooms-hint')).toContainText('ingen registrert');
});

test('can run full allocation flow from UI', async ({ page }) => {
  await page.fill('#name', 'Aron');
  await page.fill('#current-room-number', '901');
  await page.selectOption('#current-room', 'Enkeltrom');
  await page.fill('#seniority', '4');
  await page.fill('#preferences', '102');
  await page.click('#applicant-form button[type="submit"]');

  await page.fill('#room-input', '102');
  await page.click('#room-add');

  await page.click('#run-allocation');

  await expect(page.locator('#result')).toContainText('Aron -> 102');
});

test('shows alert when trying allocation without rooms', async ({ page }) => {
  let alertMessage = '';
  page.on('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.fill('#name', 'Aron');
  await page.fill('#current-room-number', '901');
  await page.selectOption('#current-room', 'Enkeltrom');
  await page.fill('#seniority', '4');
  await page.fill('#preferences', '102');
  await page.click('#applicant-form button[type="submit"]');

  await page.click('#run-allocation');
  await expect.poll(() => alertMessage).toContain('Legg til minst ett ledig rom før fordeling.');
});
