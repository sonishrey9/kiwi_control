(async (page) => {
  const screenshotDir = '/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots';
  const actions = [];
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const wait = async (ms) => page.waitForTimeout(ms);
  const shot = async (name) => {
    const path = `${screenshotDir}/${name}.png`;
    await page.screenshot({ path });
    return path;
  };
  const summarize = async () => page.evaluate(() => ({
    activeView: Array.from(document.querySelectorAll('[data-view]')).find((n) => n.className.includes('is-active'))?.getAttribute('data-view') ?? null,
    activeMode: Array.from(document.querySelectorAll('[data-ui-mode]')).find((n) => n.className.includes('is-active'))?.getAttribute('data-ui-mode') ?? null,
    logOpen: !document.querySelector('#log-drawer')?.classList.contains('is-hidden'),
    inspectorOpen: !document.querySelector('#inspector')?.classList.contains('is-hidden'),
    visibleSections: Array.from(document.querySelectorAll('[data-render-section]')).map((n) => n.getAttribute('data-render-section')),
    selectedPack: document.querySelector('[data-pack-card][open] strong')?.textContent?.trim() ?? null,
    selectablePackIds: Array.from(document.querySelectorAll('[data-pack-action="set"][data-pack-id]')).map((n) => n.getAttribute('data-pack-id')),
    blockedPackButtons: Array.from(document.querySelectorAll('[data-pack-action="blocked"]')).map((n) => ({ text: n.textContent?.trim() ?? '', disabled: n.hasAttribute('disabled') })),
    title: document.querySelector('h1')?.textContent?.trim() ?? null,
  }));
  async function clickAndRecord({name, location, selector, expectChange=true, screenshot=true}) {
    const before = await summarize();
    let error = null;
    let clickable = false;
    try {
      const locator = page.locator(selector).first();
      clickable = await locator.count() > 0;
      if (clickable) {
        await locator.click();
        await wait(250);
      }
    } catch (err) {
      error = String(err && err.message ? err.message : err);
    }
    const after = await summarize();
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    let screenshotPath = null;
    if (screenshot) {
      screenshotPath = await shot(name);
    }
    actions.push({
      name, location, selector, clickable,
      changed, expectChange,
      status: error ? 'broken' : !clickable ? 'untested' : expectChange && !changed ? 'no-op' : 'correct',
      error, before, after, screenshotPath
    });
  }

  await page.setViewportSize({ width: 1440, height: 1100 });
  const inventory = await page.evaluate(() => ({
    views: Array.from(document.querySelectorAll('[data-view]')).map((n) => ({ id: n.getAttribute('data-view'), label: n.textContent?.trim() })),
    modes: Array.from(document.querySelectorAll('[data-ui-mode]')).map((n) => ({ id: n.getAttribute('data-ui-mode'), label: n.textContent?.trim() })),
    commands: Array.from(document.querySelectorAll('[data-ui-command]')).map((n) => n.getAttribute('data-ui-command')),
    logTabs: Array.from(document.querySelectorAll('[data-log-tab]')).map((n) => n.getAttribute('data-log-tab')),
    validationTabs: Array.from(document.querySelectorAll('[data-validation-tab]')).map((n) => n.getAttribute('data-validation-tab')),
    inspectorActions: Array.from(document.querySelectorAll('[data-inspector-action]')).map((n) => n.getAttribute('data-inspector-action')),
    treeBulk: Array.from(document.querySelectorAll('[data-tree-bulk]')).map((n) => n.getAttribute('data-tree-bulk')),
    treeActions: Array.from(document.querySelectorAll('[data-tree-action]')).slice(0, 15).map((n) => ({ action: n.getAttribute('data-tree-action'), path: n.getAttribute('data-path') })),
    graphActions: Array.from(document.querySelectorAll('[data-graph-action]')).map((n) => ({ action: n.getAttribute('data-graph-action'), path: n.getAttribute('data-path') })),
  }));

  const screenshots = [];
  screenshots.push(await shot('audit-overview-initial'));

  await clickAndRecord({ name:'mode-inspection', location:'top bar', selector:'[data-ui-mode="inspection"]' });
  await clickAndRecord({ name:'mode-execution', location:'top bar', selector:'[data-ui-mode="execution"]' });
  await clickAndRecord({ name:'theme-toggle', location:'top bar', selector:'[data-theme-toggle]' });
  await clickAndRecord({ name:'logs-open', location:'top bar', selector:'[data-toggle-logs]' });
  await clickAndRecord({ name:'logs-tab-validation', location:'log drawer', selector:'[data-log-tab="validation"]' });
  await clickAndRecord({ name:'logs-tab-history', location:'log drawer', selector:'[data-log-tab="history"]' });
  await clickAndRecord({ name:'logs-close', location:'top bar', selector:'[data-toggle-logs]' });
  await clickAndRecord({ name:'inspector-close', location:'top bar', selector:'[data-toggle-inspector]' });
  await clickAndRecord({ name:'inspector-open', location:'top bar', selector:'[data-toggle-inspector]' });

  const views = ['overview','context','graph','tokens','feedback','mcps','specialists','system','validation','machine'];
  for (const view of views) {
    await clickAndRecord({ name:`view-${view}`, location:'sidebar', selector:`[data-view="${view}"]`, screenshot:true });
    if (view === 'context') {
      await clickAndRecord({ name:'context-focus-first', location:'context tree', selector:'[data-tree-action="focus"]', screenshot:true });
      await clickAndRecord({ name:'context-include-first', location:'context tree', selector:'[data-tree-action="include"]', screenshot:true });
      await clickAndRecord({ name:'context-exclude-first', location:'context tree', selector:'[data-tree-action="exclude"]', screenshot:true });
      await clickAndRecord({ name:'context-bulk-undo', location:'context view', selector:'[data-tree-bulk="undo"]', screenshot:true });
      await clickAndRecord({ name:'context-bulk-reset', location:'context view', selector:'[data-tree-bulk="reset"]', screenshot:true });
    }
    if (view === 'graph') {
      await clickAndRecord({ name:'graph-depth-up', location:'graph view', selector:'[data-graph-action="depth-up"]', screenshot:true });
      await clickAndRecord({ name:'graph-depth-down', location:'graph view', selector:'[data-graph-action="depth-down"]', screenshot:true });
      await clickAndRecord({ name:'graph-reset-view', location:'graph view', selector:'[data-graph-action="reset-view"]', screenshot:true });
      await clickAndRecord({ name:'graph-first-node', location:'graph canvas', selector:'[data-graph-node]', screenshot:true });
    }
    if (view === 'validation') {
      for (const tab of ['all','issues','pending']) {
        await clickAndRecord({ name:`validation-${tab}`, location:'validation view', selector:`[data-validation-tab="${tab}"]`, screenshot:true });
      }
    }
    if (view === 'mcps') {
      screenshots.push(await shot('audit-mcps-view'));
      const summaryCount = await page.locator('details summary').count();
      for (let i = 0; i < Math.min(summaryCount, 4); i += 1) {
        await page.locator('details summary').nth(i).click();
        await wait(150);
      }
      screenshots.push(await shot('audit-mcps-expanded'));
    }
    if (view === 'machine') {
      const summaryCount = await page.locator('summary').count();
      for (let i = 0; i < Math.min(summaryCount, 4); i += 1) {
        await page.locator('summary').nth(i).click();
        await wait(150);
      }
      screenshots.push(await shot('audit-machine-expanded'));
    }
  }

  await page.click('[data-view="overview"]');
  await wait(250);
  await clickAndRecord({ name:'inspector-approve', location:'inspector panel', selector:'[data-inspector-action="approve"]', screenshot:true });
  await clickAndRecord({ name:'inspector-reject', location:'inspector panel', selector:'[data-inspector-action="reject"]', screenshot:true });
  await clickAndRecord({ name:'inspector-add-to-context', location:'inspector panel', selector:'[data-inspector-action="add-to-context"]', screenshot:true });

  await page.setViewportSize({ width: 900, height: 900 });
  screenshots.push(await shot('audit-narrow-overview'));
  await page.click('[data-view="mcps"]');
  await wait(250);
  screenshots.push(await shot('audit-narrow-mcps'));

  return { inventory, actions, consoleMessages, pageErrors, screenshots, finalState: await summarize() };
})
