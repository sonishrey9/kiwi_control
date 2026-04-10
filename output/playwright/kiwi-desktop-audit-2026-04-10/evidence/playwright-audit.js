(async (page) => {
  const screenshotDir = '/Volumes/shrey ssd/shrey-junior/output/playwright/kiwi-desktop-audit-2026-04-10/screenshots';
  const actions = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const wait = async (ms) => { await page.waitForTimeout(ms); };

  async function capture(name) {
    const file = `${screenshotDir}/${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }

  async function state() {
    return await page.evaluate(() => {
      const activeView = Array.from(document.querySelectorAll('[data-view]')).find((node) => node.className.includes('is-active'))?.getAttribute('data-view') ?? null;
      const activeMode = Array.from(document.querySelectorAll('[data-ui-mode]')).find((node) => node.className.includes('is-active'))?.getAttribute('data-ui-mode') ?? null;
      const logOpen = !document.querySelector('#log-drawer')?.classList.contains('is-hidden');
      const inspectorOpen = !document.querySelector('#inspector')?.classList.contains('is-hidden');
      const visibleSections = Array.from(document.querySelectorAll('[data-render-section]')).map((node) => node.getAttribute('data-render-section'));
      const title = document.querySelector('h1')?.textContent?.trim() ?? null;
      const selectedPack = document.querySelector('[data-pack-card][open] strong')?.textContent?.trim() ?? null;
      const blockedPackButtons = Array.from(document.querySelectorAll('[data-pack-action="blocked"]')).map((node) => ({
        text: node.textContent?.trim() ?? '',
        disabled: node.hasAttribute('disabled')
      }));
      return {
        activeView,
        activeMode,
        logOpen,
        inspectorOpen,
        visibleSections,
        title,
        selectedPack,
        blockedPackButtons
      };
    });
  }

  async function record(name, location, selector, action, expectChange, fn) {
    const before = await state();
    const beforeShot = await capture(`${name}-before`);
    let error = null;
    try {
      await fn();
      await wait(300);
    } catch (err) {
      error = String(err && err.message ? err.message : err);
    }
    const after = await state();
    const afterShot = await capture(`${name}-after`);
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    actions.push({
      name,
      location,
      selector,
      action,
      expectChange,
      changed,
      status: error ? 'broken' : expectChange && !changed ? 'no-op' : expectChange ? 'correct' : changed ? 'correct' : 'no-op',
      error,
      before,
      after,
      screenshots: { before: beforeShot, after: afterShot }
    });
  }

  await page.setViewportSize({ width: 1440, height: 1100 });
  await capture('00-overview-initial');

  await record('topbar-theme-toggle', 'top bar', '[data-theme-toggle]', 'click', true, async () => {
    await page.click('[data-theme-toggle]');
  });

  await record('topbar-mode-inspection', 'top bar', '[data-ui-mode="inspection"]', 'click', true, async () => {
    await page.click('[data-ui-mode="inspection"]');
  });

  await record('topbar-mode-execution', 'top bar', '[data-ui-mode="execution"]', 'click', true, async () => {
    await page.click('[data-ui-mode="execution"]');
  });

  await record('toggle-log-drawer-open', 'top bar', '[data-toggle-logs]', 'click', true, async () => {
    await page.click('[data-toggle-logs]');
  });

  const logTabs = await page.locator('[data-log-tab]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-log-tab')));
  for (const tab of logTabs) {
    await record(`log-tab-${tab}`, 'log drawer', `[data-log-tab="${tab}"]`, 'click', true, async () => {
      await page.click(`[data-log-tab="${tab}"]`);
    });
  }

  await record('toggle-log-drawer-close', 'top bar', '[data-toggle-logs]', 'click', true, async () => {
    await page.click('[data-toggle-logs]');
  });

  await record('toggle-inspector-close', 'top bar', '[data-toggle-inspector]', 'click', true, async () => {
    await page.click('[data-toggle-inspector]');
  });

  await record('toggle-inspector-open', 'top bar', '[data-toggle-inspector]', 'click', true, async () => {
    await page.click('[data-toggle-inspector]');
  });

  const views = ['overview','context','graph','tokens','feedback','mcps','specialists','system','validation','machine'];
  for (const view of views) {
    await record(`nav-${view}`, 'sidebar navigation', `[data-view="${view}"]`, 'click', true, async () => {
      await page.click(`[data-view="${view}"]`);
    });

    if (view === 'context') {
      const bulkButtons = await page.locator('[data-tree-bulk]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tree-bulk')));
      for (const bulk of bulkButtons) {
        await record(`context-bulk-${bulk}`, 'context view', `[data-tree-bulk="${bulk}"]`, 'click', bulk !== 'undo', async () => {
          await page.click(`[data-tree-bulk="${bulk}"]`);
        });
      }
      const focusButton = page.locator('[data-tree-action="focus"]').first();
      if (await focusButton.count()) {
        await record('context-first-focus', 'context tree', '[data-tree-action="focus"]:first', 'click', true, async () => {
          await focusButton.click();
        });
      }
      const includeButton = page.locator('[data-tree-action="include"]').first();
      if (await includeButton.count()) {
        await record('context-first-include', 'context tree', '[data-tree-action="include"]:first', 'click', true, async () => {
          await includeButton.click();
        });
      }
      const excludeButton = page.locator('[data-tree-action="exclude"]').first();
      if (await excludeButton.count()) {
        await record('context-first-exclude', 'context tree', '[data-tree-action="exclude"]:first', 'click', true, async () => {
          await excludeButton.click();
        });
      }
    }

    if (view === 'graph') {
      const graphButtons = await page.locator('[data-graph-action]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-graph-action')));
      for (const actionName of graphButtons) {
        await record(`graph-action-${actionName}`, 'graph view', `[data-graph-action="${actionName}"]`, 'click', true, async () => {
          await page.click(`[data-graph-action="${actionName}"]`);
        });
      }
      const firstNode = page.locator('[data-graph-node]').first();
      if (await firstNode.count()) {
        await record('graph-first-node', 'graph canvas', '[data-graph-node]:first', 'click', true, async () => {
          await firstNode.click();
        });
      }
    }

    if (view === 'validation') {
      const validationTabs = await page.locator('[data-validation-tab]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-validation-tab')));
      for (const tab of validationTabs) {
        await record(`validation-tab-${tab}`, 'validation view', `[data-validation-tab="${tab}"]`, 'click', true, async () => {
          await page.click(`[data-validation-tab="${tab}"]`);
        });
      }
    }

    if (view === 'mcps') {
      await capture('mcps-view');
      const detailsSummaries = page.locator('details summary');
      const count = await detailsSummaries.count();
      for (let index = 0; index < Math.min(count, 6); index += 1) {
        await record(`mcps-expand-${index+1}`, 'MCP / Tool Integrations view', `details summary:nth-of-type(${index+1})`, 'click', false, async () => {
          await detailsSummaries.nth(index).click();
        });
      }
    }

    if (view === 'machine') {
      const summaries = page.locator('summary');
      const count = await summaries.count();
      for (let index = 0; index < Math.min(count, 6); index += 1) {
        await record(`machine-expand-${index+1}`, 'machine view', `summary:nth-of-type(${index+1})`, 'click', false, async () => {
          await summaries.nth(index).click();
        });
      }
    }
  }

  const inspectorActions = await page.locator('[data-inspector-action]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-inspector-action')));
  for (const actionName of inspectorActions) {
    if (['validate','handoff'].includes(actionName)) continue;
    await record(`inspector-${actionName}`, 'inspector panel', `[data-inspector-action="${actionName}"]`, 'click', true, async () => {
      await page.click(`[data-inspector-action="${actionName}"]`);
    });
  }

  await page.setViewportSize({ width: 900, height: 900 });
  await capture('narrow-width-overview');
  await page.click('[data-view="mcps"]');
  await wait(300);
  await capture('narrow-width-mcps');

  return {
    actions,
    consoleErrors,
    pageErrors,
    finalState: await state()
  };
})
