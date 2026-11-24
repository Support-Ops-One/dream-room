const desktop = matchMedia('(min-width: 51rem)');
const tablist = document.querySelector('.tabs');
const tabs = [...tablist.querySelectorAll('a')];
const panels = tabs.map((tab) => document.getElementById(tab.hash.slice(1)));
const pagination = document.querySelector('.pagination');
const afterPrompt = document.querySelector('.after-prompt');
const progress = pagination?.querySelector('.progress');
const copyStatus = document.querySelector('#copy-status');
const promptStatus = document.querySelector('#prompt-status');
let active = 0;
let copyVersion = 0;
let copyTimer;

function resetCopy(panel) {
  clearTimeout(copyTimer);
  panel.querySelector('.copy-idle').hidden = false;
  panel.querySelector('.copy-done').hidden = true;
  panel.querySelector('.manual-copy').hidden = true;
  copyStatus.textContent = '';
}

function setLayout() {
  const focused = document.activeElement;
  const oldControls = desktop.matches ? [pagination, afterPrompt] : [tablist];
  const moveFocus = oldControls.some((control) => control?.contains(focused));

  tablist.hidden = !desktop.matches;
  if (pagination) {
    pagination.hidden = desktop.matches;
    afterPrompt.hidden = desktop.matches || active === panels.length - 1;
  }
  panels.forEach((panel, index) => {
    const heading = panel.querySelector('h2');
    panel.tabIndex = desktop.matches ? 0 : -1;
    panel.setAttribute('aria-labelledby', desktop.matches ? tabs[index].id : heading.id);
    if (desktop.matches) panel.setAttribute('role', 'tabpanel');
    else panel.removeAttribute('role');
  });
  if (moveFocus) (desktop.matches ? tabs[active] : panels[active]).focus();
}

function showPrompt(index, { announce = false, moveFocus = false } = {}) {
  const changed = index !== active;
  if (changed) {
    copyVersion++;
    resetCopy(panels[active]);
  }
  active = index;
  tabs.forEach((tab, position) => {
    const selected = index === position;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[position].hidden = !selected;
  });

  const label = `Prompt ${index + 1} of ${panels.length}`;
  if (pagination) {
    progress.textContent = label;
    pagination.querySelector('[data-step="-1"]').disabled = index === 0;
    pagination.querySelector('[data-step="1"]').disabled = index === panels.length - 1;
    afterPrompt.hidden = desktop.matches || index === panels.length - 1;
  }
  if (moveFocus) {
    panels[index].focus({ preventScroll: true });
    panels[index].scrollIntoView({ block: 'start' });
  }
  if (announce && changed && !moveFocus) promptStatus.textContent = label;
}

function indexFromUrl() {
  const index = tabs.findIndex((tab) => tab.hash === location.hash);
  return index < 0 ? 0 : index;
}

function selectPrompt(index, moveFocus = false) {
  if (!tabs[index]) return;
  const hash = tabs[index].hash;
  if (location.hash !== hash) history.pushState(null, '', hash);
  showPrompt(index, { moveFocus });
}

tablist.setAttribute('role', 'tablist');
tablist.setAttribute('aria-labelledby', 'session-date');
tablist.setAttribute('aria-orientation', 'vertical');
tabs.forEach((tab, index) => {
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panels[index].id);
  tab.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectPrompt(index);
  });
  tab.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
      event.preventDefault();
      selectPrompt(index);
      return;
    }
    const target = {
      ArrowUp: (index + tabs.length - 1) % tabs.length,
      ArrowDown: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectPrompt(target);
    tabs[target].focus();
  });
});

for (const button of document.querySelectorAll('[data-step]')) {
  button.addEventListener('click', () => selectPrompt(active + Number(button.dataset.step), true));
}

for (const panel of panels) {
  const copy = panel.querySelector('.copy');
  const copyIdle = copy.querySelector('.copy-idle');
  const copyDone = copy.querySelector('.copy-done');
  const fallback = panel.querySelector('.manual-copy');
  const manualText = fallback.querySelector('textarea');
  const original = panel.querySelector('.prompt-source').content.textContent;

  manualText.addEventListener('focus', () => manualText.select());
  copy.addEventListener('click', async () => {
    const version = ++copyVersion;
    resetCopy(panel);
    try {
      await navigator.clipboard.writeText(original);
    } catch {
      if (version !== copyVersion) return;
      manualText.value = original;
      fallback.hidden = false;
      copyStatus.textContent = fallback.querySelector('p').textContent;
      return;
    }
    if (version !== copyVersion) return;
    copyIdle.hidden = true;
    copyDone.hidden = false;
    copyStatus.textContent = 'Prompt copied to clipboard.';
    copyTimer = setTimeout(() => resetCopy(panel), 2400);
  });
  panel.querySelector('.prompt-tools').hidden = false;
}

desktop.addEventListener('change', setLayout);
document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  const main = document.querySelector('#main');
  main.focus({ preventScroll: true });
  main.scrollIntoView({ block: 'start' });
});
window.addEventListener('hashchange', () => {
  const index = indexFromUrl();
  const focused = document.activeElement;
  const focusTab = index !== active && desktop.matches && tablist.contains(focused);
  const moveFocus = index !== active && (!desktop.matches || panels[active].contains(focused));
  showPrompt(index, { announce: !focusTab, moveFocus });
  if (focusTab) tabs[index].focus();
});
showPrompt(indexFromUrl());
setLayout();
