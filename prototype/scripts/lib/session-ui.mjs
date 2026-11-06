// Shared browser checks use fresh contexts; readiness includes ownership of the save.
export async function waitForSession(page) {
  await page.getByRole('button', { name: 'Инструменты пробы', exact: true }).waitFor();
  await page.waitForFunction(() => {
    const saved = localStorage.getItem('chewy.demo-session.v1');
    return saved && JSON.parse(saved).version === 2 && !document.querySelector('[role="alert"]');
  });
}

// Food status lives inside Today. Read-only checks restore the camp; opening a
// result naturally unmounts the journal and does not need a second close action.
export async function withToday(page, check) {
  const journal = page.getByRole('dialog', { name: 'Сегодня', exact: true });
  const opened = !await journal.isVisible();
  if (opened) await page.getByRole('button', { name: 'Открыть дневник еды за сегодня', exact: true }).click();
  try { return await check(); }
  finally {
    if (opened && await journal.isVisible()) {
      await page.getByRole('button', { name: 'Свернуть дневник', exact: true }).click();
      await journal.waitFor({ state: 'hidden' });
    }
  }
}
