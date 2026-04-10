(async (page) => {
  const wait = async (ms) => page.waitForTimeout(ms);
  const summarize = async () => page.evaluate(() => ({
    activeView: Array.from(document.querySelectorAll('[data-view]')).find((n) => n.className.includes('is-active'))?.getAttribute('data-view') ?? null,
    activeMode: Array.from(document.querySelectorAll('[data-ui-mode]')).find((n) => n.className.includes('is-active'))?.getAttribute('data-ui-mode') ?? null,
    logOpen: !document.querySelector('#log-drawer')?.classList.contains('is-hidden'),
    inspectorOpen: !document.querySelector('#inspector')?.classList.contains('is-hidden'),
    selectedPack: document.querySelector('[data-pack-card][open] strong')?.textContent?.trim() ?? null,
    blockedButtons: Array.from(document.querySelectorAll('[data-pack-action="blocked"]')).map((n) => ({ text: n.textContent?.trim() ?? '', disabled: n.hasAttribute('disabled') })),
    title: document.querySelector('h1')?.textContent?.trim() ?? null,
    focusedInspector: document.querySelector('#inspector h2')?.textContent?.trim() ?? null,
  }));
  async function test(name, selector, expectChange = true) {
    const before = await summarize();
    const locator = page.locator(selector).first();
    const count = await locator.count();
    let error = null;
    if (count > 0) {
      try {
        await locator.click();
        await wait(200);
      } catch (err) {
        error = String(err && err.message ? err.message : err);
      }
    }
    const after = await summarize();
    return { name, selector, count, expectChange, changed: JSON.stringify(before) != JSON.stringify(after), error, before, after };
  }
  const results = [];
  results.push(await test('mode-inspection', '[data-ui-mode="inspection"]'));
  results.push(await test('mode-execution', '[data-ui-mode="execution"]'));
  results.push(await test('theme-toggle', '[data-theme-toggle]'));
  results.push(await test('logs-open', '[data-toggle-logs]'));
  results.push(await test('logs-tab-validation', '[data-log-tab="validation"]'));
  results.push(await test('logs-tab-history', '[data-log-tab="history"]'));
  results.push(await test('logs-close', '[data-toggle-logs]'));
  results.push(await test('inspector-close', '[data-toggle-inspector]'));
  results.push(await test('inspector-open', '[data-toggle-inspector]'));
  for (const view of ['overview','context','graph','tokens','feedback','mcps','specialists','system','validation','machine']) {
    results.push(await test(`view-${view}`, `[data-view="${view}"]`));
  }
  await page.click('[data-view="context"]'); await wait(200);
  results.push(await test('context-focus-first', '[data-tree-action="focus"]'));
  results.push(await test('context-include-first', '[data-tree-action="include"]'));
  results.push(await test('context-exclude-first', '[data-tree-action="exclude"]'));
  results.push(await test('context-undo', '[data-tree-bulk="undo"]'));
  results.push(await test('context-reset', '[data-tree-bulk="reset"]'));
  await page.click('[data-view="graph"]'); await wait(200);
  results.push(await test('graph-depth-up', '[data-graph-action="depth-up"]'));
  results.push(await test('graph-depth-down', '[data-graph-action="depth-down"]'));
  results.push(await test('graph-reset-view', '[data-graph-action="reset-view"]', false));
  results.push(await test('graph-first-node', '[data-graph-node]'));
  await page.click('[data-view="validation"]'); await wait(200);
  results.push(await test('validation-all', '[data-validation-tab="all"]', false));
  results.push(await test('validation-issues', '[data-validation-tab="issues"]'));
  results.push(await test('validation-pending', '[data-validation-tab="pending"]'));
  await page.click('[data-view="overview"]'); await wait(200);
  results.push(await test('inspector-approve', '[data-inspector-action="approve"]'));
  results.push(await test('inspector-reject', '[data-inspector-action="reject"]'));
  results.push(await test('inspector-add-to-context', '[data-inspector-action="add-to-context"]'));
  await page.click('[data-view="mcps"]'); await wait(200);
  const blocked = await page.evaluate(() => Array.from(document.querySelectorAll('[data-pack-action="blocked"]')).map((n) => ({ text: n.textContent?.trim() ?? '', disabled: n.hasAttribute('disabled') })));
  return { results, blocked, final: await summarize() };
})