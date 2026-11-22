import { expect, test, type Browser, type Page } from '@playwright/test';

const PASSWORD = 'password-e2e-sicura';
const uid = () => Math.random().toString(36).slice(2, 10);
const shot = async (page: Page, name: string) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  return page.screenshot({ path: `docs/screenshots/${test.info().project.name}-${name}.png`, fullPage: !name.includes('lesson-room') });
};

async function registerVia(browser: Browser, role: 'teacher' | 'student', name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByTestId(role === 'teacher' ? 'role-teacher' : 'role-student').click();
  await page.getByLabel('Nome visualizzato').fill(name);
  await page.getByLabel('Email').fill(`${role}-${uid()}@e2e.local`);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Accetto i termini/).check();
  await page.getByLabel(/informativa privacy/).check();
  await page.getByRole('button', { name: 'Crea account' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  return page;
}

test('home: logo, brand, two roles, footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Logo FPM' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Scegli il tuo strumento' })).toBeVisible();
  // Una card fotografica per ogni disciplina.
  for (const id of ['canto', 'pianoforte', 'chitarra', 'basso', 'batteria', 'violino', 'flauto', 'archi', 'teoria']) {
    await expect(page.getByTestId(`discipline-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId('role-teacher')).toBeVisible();
  await expect(page.getByTestId('role-student')).toBeVisible();
  await expect(page.locator('footer')).toContainText('© 2026 FP Morelli — Web Design Tech');
  // Nessuna barra di scorrimento orizzontale (layout responsive).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, '01-home');
});

test('teacher invites, student requests, teacher approves, then revokes', async ({ browser }) => {
  const teacher = await registerVia(browser, 'teacher', 'Prof. Morelli');

  // Disciplina: cambia strumenti e copertina, non i colori.
  await teacher.goto('/discipline');
  await teacher.getByTestId('discipline-canto').click();
  await expect(teacher).toHaveURL(/\/discipline\/canto$/);
  await teacher.getByTestId('save-discipline').click();
  await expect(teacher.getByRole('status')).toContainText('Disciplina salvata');
  await shot(teacher, '02-discipline');

  await teacher.goto('/docente');
  await expect(teacher.getByText('Disciplina: Canto')).toBeVisible();
  // Senza prova/licenza non si possono creare inviti.
  await expect(teacher.getByTestId('create-invite')).toBeDisabled();
  await teacher.getByTestId('start-trial').click();
  await expect(teacher.getByText(/Prova attiva fino al/)).toBeVisible();
  await teacher.getByTestId('create-invite').click();
  const code = (await teacher.getByTestId('invite-code').textContent())!.trim();
  expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  await shot(teacher, '03-teacher-invite');

  const student = await registerVia(browser, 'student', 'Giulia');
  await student.goto('/allievo');
  await student.getByLabel('Codice invito').fill(code);
  await student.getByTestId('redeem').click();
  await expect(student.getByTestId('pending')).toContainText('Prof. Morelli');
  await expect(student.getByTestId('lessons')).toHaveCount(0);
  await shot(student, '04-student-pending');

  await teacher.reload();
  await expect(teacher.getByTestId('pending-request')).toContainText('Giulia');
  // La campanella mostra il numero reale di richieste in attesa.
  await expect(teacher.getByTestId('notif-count')).toHaveText('1');
  await teacher.getByTestId('pending-request').getByRole('button', { name: 'Approva' }).click();
  await expect(teacher.getByTestId('student-row')).toContainText('Giulia');

  await teacher.getByLabel('Titolo').fill('Vocalizzi e respirazione');
  await teacher.getByLabel('Data e ora').fill('2026-12-01T18:30');
  await teacher.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(teacher.getByRole('cell', { name: 'Vocalizzi e respirazione' })).toBeVisible();
  await shot(teacher, '05-teacher-dashboard');

  await student.reload();
  await expect(student.getByTestId('my-teacher')).toContainText('Prof. Morelli');
  await expect(student.getByTestId('lessons')).toContainText('Vocalizzi e respirazione');
  await shot(student, '06-student-approved');

  // Revoca: l'allievo perde subito l'accesso.
  await teacher.getByTestId('student-row').getByRole('button', { name: 'Revoca accesso' }).click();
  await expect(teacher.getByTestId('student-row')).toHaveCount(0);
  await student.reload();
  await expect(student.getByText('Il collegamento con il docente è stato chiuso.')).toBeVisible();
  await expect(student.getByTestId('lessons')).toHaveCount(0);
});

test('smart setup with (fake) microphone and camera, network test, save', async ({ browser }) => {
  const page = await registerVia(browser, 'student', 'Setup');
  await page.getByTestId('setup-next').click(); // → Microfono
  await page.getByTestId('mic-start').click();
  await expect(page.getByRole('meter', { name: 'Livello microfono' })).toBeVisible();
  await page.getByTestId('setup-next').click(); // → Cuffie
  await page.getByLabel(/Sento i suoni in cuffia/).check();
  await page.getByTestId('setup-next').click(); // → Videocamera
  await page.getByTestId('cam-start').click();
  await expect
    .poll(() => page.locator('video.preview').evaluate((v: HTMLVideoElement) => v.videoWidth))
    .toBeGreaterThan(0);
  await shot(page, '07-setup-camera');
  await page.getByTestId('setup-next').click(); // → MIDI
  await expect(page.getByLabel('Pianoforte virtuale')).toBeVisible();
  await page.getByTestId('setup-next').click(); // → Rete
  await page.getByRole('radio', { name: 'Wi-Fi di casa' }).click();
  await page.getByTestId('net-run').click();
  await expect(page.getByTestId('net-result')).toContainText('Ritardo andata/ritorno', { timeout: 20_000 });
  await page.getByTestId('setup-next').click(); // → Riepilogo
  await page.getByTestId('setup-save').click();
  await expect(page.getByText('Preferenze salvate per questo dispositivo')).toBeVisible();
  await shot(page, '08-setup-summary');
});

test('info page shows copyright and honest feature status', async ({ page }) => {
  await page.goto('/info');
  await expect(page.getByTestId('copyright')).toHaveText('© 2026 FP Morelli — Web Design Tech');
  await expect(page.getByText('Multicamera batteria (1–4 per lato)')).toBeVisible();
  await expect(page.getByText('Verificato', { exact: true })).toHaveCount(0);
  await shot(page, '09-info');
});

test('protected areas redirect anonymous users to login', async ({ page }) => {
  await page.goto('/docente');
  await expect(page).toHaveURL(/\/accedi/);
  const res = await page.request.get('/api/teacher/students');
  expect(res.status()).toBe(401);
});

/** Collega docente e allievo via API (stessi cookie dei browser): invito → richiesta → approvazione. */
async function linkPair(teacher: Page, student: Page) {
  const h = { 'x-fpm-client': 'web' };
  expect((await teacher.request.post('/api/teacher/license/purchase', { headers: h, data: {} })).ok()).toBe(true);
  const inv = await (await teacher.request.post('/api/teacher/invitations', { headers: h, data: { expiresInHours: 24 } })).json();
  const req = await (await student.request.post('/api/student/link-requests', { headers: h, data: { code: inv.code } })).json();
  expect((await teacher.request.post(`/api/teacher/links/${req.id}/decision`, { headers: h, data: { decision: 'approve' } })).ok()).toBe(true);
}

test('lesson room needs an approved link before starting', async ({ browser }) => {
  const page = await registerVia(browser, 'teacher', 'Prof. Solo');
  await page.goto('/lezione?d=canto');
  await expect(page.getByText(/Nessun allievo collegato/)).toBeVisible();
  await expect(page.getByTestId('room-start')).toBeDisabled();
});

test('LIVE lesson between teacher and student: video both ways, shared piano (MIDI), stats', async ({ browser }) => {
  const teacher = await registerVia(browser, 'teacher', 'Prof. Canto');
  const student = await registerVia(browser, 'student', 'Giulia');
  await linkPair(teacher, student);
  await teacher.goto('/lezione?d=canto');
  await student.goto('/lezione?d=canto');
  await expect(teacher.getByRole('heading', { name: 'Sezione Canto' })).toBeVisible();
  await teacher.getByTestId('room-start').click();
  await expect(teacher.getByTestId('lesson-state')).toContainText('In attesa');
  await student.getByTestId('room-start').click();
  for (const p of [teacher, student]) {
    await expect(p.getByTestId('lesson-state')).toContainText('In diretta', { timeout: 20_000 });
    await expect.poll(() => p.locator('[data-testid="remote-tile"] video').evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);
  }
  // Il docente tiene premuto Do4: sull'allievo il tasto si accende (evento MIDI ricevuto).
  const key = teacher.getByRole('button', { name: 'Do4', exact: true });
  await key.scrollIntoViewIfNeeded();
  const box = (await key.boundingBox())!;
  await teacher.mouse.move(box.x + box.width / 2, box.y + box.height - 15);
  await teacher.mouse.down();
  await expect(student.getByRole('button', { name: 'Do4', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await teacher.mouse.up();
  await expect(student.getByRole('button', { name: 'Do4', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(teacher.getByTestId('lesson-stats')).toContainText('Ritardo', { timeout: 15_000 });
  // Strumenti locali
  await expect(teacher.getByTestId('tuner')).toBeVisible();
  await teacher.getByRole('button', { name: 'Accelera' }).click();
  await expect(teacher.getByTestId('bpm')).toHaveText('♩ = 81');
  await teacher.getByRole('button', { name: 'Microfono', exact: true }).click();
  await expect(teacher.getByRole('button', { name: 'Muto', exact: true })).toBeVisible();
  await expect(teacher.getByRole('button', { name: /Condividi/ })).toBeDisabled();
  await expect(teacher.getByRole('button', { name: /Riproduci base/ })).toBeDisabled();
  await shot(teacher, '10-lesson-room-canto-live');
  // L'allievo esce: il docente torna in attesa.
  await student.getByRole('button', { name: 'Termina lezione' }).click();
  await expect(teacher.getByTestId('lesson-state')).toContainText('In attesa', { timeout: 10_000 });
});

test('lesson room (batteria): multicam layout only as planned preview', async ({ browser }) => {
  const teacher = await registerVia(browser, 'teacher', 'Prof. Batteria');
  const page = await registerVia(browser, 'student', 'Batterista');
  await linkPair(teacher, page);
  await page.goto('/lezione?d=batteria');
  await expect(page.getByRole('heading', { name: 'Batteria e Percussioni' })).toBeVisible();
  const multicam = page.getByRole('region', { name: 'Regia multicamera (opzionale)' });
  await expect(multicam.getByText('Pianificato')).toBeVisible();
  await page.getByTestId('room-start').click();
  await multicam.getByRole('radio', { name: /4 camere/ }).click();
  await expect(page.locator('.stage.multicam .tile')).toHaveCount(4);
  await expect(page.locator('.remote-strip')).toContainText('In attesa del docente');
  await expect(page.getByText('Camera aggiuntiva')).toHaveCount(3);
  await shot(page, '11-lesson-room-batteria');
});

test('lesson room for other disciplines (violino/archi, fiati)', async ({ browser }) => {
  const page = await registerVia(browser, 'teacher', 'Prof. Archi');
  const student = await registerVia(browser, 'student', 'Violinista');
  await linkPair(page, student);
  await page.goto('/lezione?d=archi');
  await expect(page.getByRole('region', { name: 'Accordatore' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Spartito' })).toBeVisible();
  await page.getByTestId('room-start').click();
  await expect(page.getByText('✓ Dispositivi pronti')).toBeVisible();
  await shot(page, '12-lesson-room-archi');
  await page.goto('/lezione?d=fiati');
  await expect(page.getByRole('heading', { name: 'Flauto e Fiati' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Respirazione' })).toBeVisible();
});
