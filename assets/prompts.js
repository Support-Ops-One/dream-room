const tablist = document.querySelector('.tabs');
const tabs = [...tablist.querySelectorAll('a')];
const panels = tabs.map((tab) => document.getElementById(tab.hash.slice(1)));
const copy = document.querySelector('.copy');
const status = document.querySelector('#copy-status');
const copyError = document.querySelector('.copy-error');
let active;
let resetTimer;

function resetCopy() {
  clearTimeout(resetTimer);
  copy.textContent = 'Copy prompt';
  status.textContent = '';
  copyError.hidden = true;
}

function showPrompt(index) {
  active = index;
  resetCopy();
  tabs.forEach((tab, position) => {
    const selected = index === position;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[position].hidden = !selected;
  });
  const tab = tabs[index];
  if (tab.offsetLeft < tablist.scrollLeft || tab.offsetLeft + tab.offsetWidth > tablist.scrollLeft + tablist.clientWidth) {
    tablist.scrollLeft = tab.offsetLeft;
  }
}

function showFromUrl() {
  const index = tabs.findIndex((tab) => tab.hash === location.hash);
  showPrompt(index < 0 ? 0 : index);
}

function selectTab(index) {
  const hash = tabs[index].hash;
  if (location.hash !== hash) history.pushState(null, '', hash);
  showPrompt(index);
}

tablist.setAttribute('role', 'tablist');
tabs.forEach((tab, index) => {
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panels[index].id);
  panels[index].setAttribute('role', 'tabpanel');
  panels[index].setAttribute('aria-labelledby', tab.id);
  panels[index].tabIndex = 0;
  tab.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectTab(index);
  });
  tab.addEventListener('keydown', (event) => {
    const target = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
      ' ': index,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectTab(target);
    tabs[target].focus();
  });
});

function copyFallback(text) {
  const previous = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.className = 'clipboard-input';
  document.body.append(input);
  input.select();
  input.setSelectionRange(0, text.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input.remove();
    previous?.focus({ preventScroll: true });
  }
}

copy.addEventListener('click', async () => {
  const index = active;
  const prompt = panels[index].querySelector('.prompt-text');
  const text = prompt.textContent;
  let copied;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    if (active !== index) return;
    copied = copyFallback(text);
  }
  if (active !== index) return;
  resetCopy();
  if (copied) {
    copy.textContent = 'Copied!';
    status.textContent = 'Prompt copied to clipboard.';
    resetTimer = setTimeout(resetCopy, 2200);
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(prompt);
  selection.removeAllRanges();
  selection.addRange(range);
  copyError.hidden = false;
  status.textContent = copyError.textContent;
});

window.addEventListener('hashchange', showFromUrl);
showFromUrl();
copy.hidden = false;
