/* Shared UI layer. Changes presentation only; never writes rating configuration. */
(function () {
  'use strict';
  if (window.vxUX) return;
  const page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  document.body.dataset.uxPage = page;
  let sequence = 0, active = null, timer = null, queued = false, restoringFocus = false, scheduledFrame = null;
  const bindings = new WeakMap();
  const popup = document.createElement('div');
  popup.id = 'vxContextHelp'; popup.className = 'vx-help-popup'; popup.hidden = true;
  document.body.appendChild(popup);
  const cleanText = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const interactive = el => el.querySelector('input,select,textarea,button,[contenteditable],canvas,[onclick]');

  function position(el, trigger) {
    const r = trigger.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    const top = r.bottom + h + 12 <= window.innerHeight ? r.bottom + 8 : Math.max(12, r.top - h - 8);
    el.style.left = left + 'px'; el.style.top = top + 'px';
  }
  function close(restoreFocus) {
    clearTimeout(timer);
    const old = active;
    if (old) {
      old.setAttribute('aria-expanded', 'false');
      old.removeAttribute('aria-describedby'); old.dataset.pinned = 'false';
    }
    active = null; popup.hidden = true; popup.replaceChildren();
    if (restoreFocus && old && old.isConnected) { restoringFocus = true; old.focus(); restoringFocus = false; }
  }
  function open(button) {
    const record = bindings.get(button);
    if (!record) return;
    clearTimeout(timer);
    if (active !== button) close(false);
    active = button;
    popup.replaceChildren();
    const title = document.createElement('h3'); title.textContent = record.label;
    popup.appendChild(title);
    const content = document.createElement('div');
    record.sources.forEach(source => {
      const block = document.createElement('div');
      // Clone explanatory content only. IDs must remain unique in the live UI.
      for (const child of source.childNodes) block.appendChild(child.cloneNode(true));
      block.querySelectorAll('[id],[hidden],[style]').forEach(el => {
        el.removeAttribute('id'); el.removeAttribute('hidden'); el.removeAttribute('style');
      });
      block.querySelectorAll('.vx-help-button,script,style').forEach(el => el.remove());
      content.appendChild(block);
    });
    popup.appendChild(content);
    const hasLinks = !!content.querySelector('a[href]');
    popup.setAttribute('role', hasLinks ? 'dialog' : 'tooltip');
    popup.setAttribute('aria-label', record.label);
    if (hasLinks) {
      const dismiss = document.createElement('button'); dismiss.type = 'button';
      dismiss.className = 'vx-help-close'; dismiss.textContent = '×';
      dismiss.setAttribute('aria-label', 'Close help'); dismiss.onclick = () => close(true);
      popup.prepend(dismiss);
    }
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-describedby', popup.id);
    popup.hidden = false; position(popup, button);
  }
  function attach(target, source, label, hide = true) {
    if (!target || !source || !cleanText(source) || source.dataset.uxHelp) return;
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'vx-help-button';
    button.setAttribute('aria-label', 'Help: ' + (label || cleanText(target)));
    button.setAttribute('aria-expanded', 'false');
    bindings.set(button, { sources: [source], label: label || cleanText(target) || 'Help' });
    source.dataset.uxHelp = 'true';
    if (hide) { source.hidden = true; source.classList.add('vx-help-source'); }
    if (target.matches('label,a,button,.ag-header-cell-text')) target.insertAdjacentElement('afterend', button);
    else target.appendChild(button);
    return button;
  }
  function helpTarget(source) {
    let prev = source.previousElementSibling;
    if (prev && prev.matches('h1,h2,h3,h4,h5,h6,label,.vx-form-section-hd')) return prev;
    const field = source.closest('[data-fw],.mb-3,.mb-2,[class*="col-"]');
    if (source.matches('[data-field-help]') && field) return field.querySelector('label');
    const body = source.closest('.bd');
    if (body && source === body.firstElementChild) {
      const section = body.parentElement;
      return section.querySelector(':scope > .hd,:scope > h3,:scope > h2');
    }
    return null;
  }
  function wrapSection(card, title) {
    if (!card || card.hidden || card.style.display === 'none' || card.closest('.vx-ux-disclosure') || card.dataset.uxSectionDone) return;
    card.dataset.uxSectionDone = 'true';
    const details = document.createElement('details'); details.className = 'vx-ux-disclosure';
    const summary = document.createElement('summary'); summary.textContent = title;
    card.before(details); details.append(summary, card);
    const heading = card.querySelector('h2');
    if (heading && cleanText(heading) === title) {
      heading.querySelectorAll('.vx-help-button').forEach(button => summary.appendChild(button));
      heading.hidden = true;
    }
    details.addEventListener('toggle', () => {
      if (details.open) requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  }

  const secondary = {
    dashboard: ['Recent Activity', 'Rating Data Loaded', 'Quotes by Line of Business', 'Premium Distribution by LOB'],
    analytics: ['Agency Performance', 'Top Rating Factors by Impact', 'Configuration Change Activity', 'AI Suggestion Adoption'],
    'loss-runs': ['Premium & Incurred Losses — Monthly', 'Loss Ratio by Line of Business'],
    roles: ['Access simulator', 'Effective access'],
    api: ['Who Consumes This API', 'Authentication', 'Limits & Conventions'],
    integration: ['Two meanings of “underwriter”', 'Data flow: CRM → Underwriting → Rating', 'Rules the underwriting service must respect', 'Submission shape by application type', 'Deployment boundary', 'Storage contract', 'Feedback loop', 'Integration checklist'],
    'engine-flow': ['ISO and program rating'],
    'formula-builder': [],
  };
  function enhance() {
    queued = false;
    if (active && !active.isConnected) close(false);
    document.querySelectorAll('.vx-help-button').forEach(button => {
      const record = bindings.get(button);
      if (record && record.sources.every(source => !source.isConnected)) {
        if (active === button) close(false);
        button.remove();
      }
    });
    document.querySelectorAll('[data-page-help]').forEach(source =>
      attach(source.closest('.vx-page-head')?.querySelector('h1'), source, 'About this page'));
    // Explicit field hints, and short help attached to a clear section heading.
    document.querySelectorAll('[data-field-help],.sub,.form-text,.vx-form-section-sub').forEach(source => {
      if (source.dataset.uxHelp || source.closest('.vx-help-popup,.vx-ux-disclosure>summary')) return;
      if (interactive(source) || source.matches('[data-ux-keep]')) return;
      // Counts, empty states, warning results and live financial values stay visible.
      if (!source.matches('[data-field-help]') && /^(?:\d|\$|No |Not |Awaiting |Required |Missing )|subtotal|not wired|does not change|not executed/i.test(cleanText(source))) return;
      attach(helpTarget(source), source);
    });
    // Help after fields in the quote workflow (actual result rows are excluded).
    document.querySelectorAll('small[data-field-help]').forEach(source => attach(helpTarget(source), source));
    document.querySelectorAll('.vx-stat .dt.flat').forEach(source => {
      if (!/\d/.test(cleanText(source))) attach(source.closest('.vx-stat')?.querySelector('.lbl'), source);
    });
    // Parenthetical instructions move off the field label; units stay in place.
    document.querySelectorAll('label').forEach(label => {
      if (label.childElementCount || label.dataset.uxLabel || label.closest('.vx-help-popup')) return;
      const match = cleanText(label).match(/^(.+?)\s+\(([^)]{12,})\)$/);
      if (!match) return;
      label.dataset.uxLabel = 'true'; label.textContent = match[1];
      const source = document.createElement('span'); source.textContent = match[2]; label.after(source);
      attach(label, source, match[1]);
    });
    // Existing title help gains a keyboard/touch target beside its own label.
    document.querySelectorAll('.hintdot[title]').forEach(label => {
      if (label.dataset.uxTitle || label.closest('.vx-help-popup')) return;
      label.dataset.uxTitle = 'true';
      const source = document.createElement('span'); source.textContent = label.title;
      label.removeAttribute('title'); label.after(source);
      const isMore = cleanText(label) === 'More';
      const target = isMore ? label.closest('.vx-page-head')?.querySelector('h1') || label.parentElement : label;
      attach(target, source, isMore ? 'About this page' : cleanText(label));
      if (isMore) label.remove();
    });
    // Explanatory blocks become a compact label plus info button. Operational
    // warnings and blocks with actions remain present, never hidden as help.
    document.querySelectorAll('.vx-exp2').forEach(box => {
      if (box.dataset.uxExplain) return;
      box.dataset.uxExplain = 'true';
      const head = box.querySelector(':scope > .hd'), body = box.querySelector(':scope > .bd');
      if (!head || !body || interactive(body)) return;
      const toggle = head.querySelector('.tog');
      if (!toggle) return;
      const label = head.querySelector(':scope > b') || head.querySelector(':scope > span');
      if (!label) return;
      const warning = /warn|danger|bad/.test(box.getAttribute('style') || '') || !!head.querySelector('.fa-triangle-exclamation');
      if (warning) {
        attach(label, body, cleanText(label)); toggle.remove();
        return;
      }
      const source = document.createElement('div');
      const summary = head.querySelector(':scope > span');
      if (summary && summary !== label) source.appendChild(summary.cloneNode(true));
      for (const child of body.childNodes) source.appendChild(child.cloneNode(true));
      box.appendChild(source); attach(label, source, cleanText(label));
      body.hidden = true; body.classList.add('vx-help-source'); toggle.remove();
      if (summary && summary !== label) summary.hidden = true;
      box.classList.add('vx-compact-explainer');
    });
    // Native labels correctly name their own controls, including generated modals.
    document.querySelectorAll('label:not([for])').forEach(label => {
      if (label.querySelector('input,select,textarea') || label.closest('.vx-help-popup')) return;
      const field = label.parentElement;
      const controls = [...field.querySelectorAll('input:not([type=hidden]),select,textarea')];
      if (controls.length !== 1) return;
      const control = controls[0];
      if (!control.id) control.id = 'vxField' + (++sequence);
      label.htmlFor = control.id;
    });
    // Table headers use the same information sign as form labels.
    document.querySelectorAll('.vx-t th,.ag-header-cell').forEach(cell => {
      if (cell.querySelector('.vx-help-button') || cell.closest('.vx-help-popup')) return;
      const target = cell.querySelector('.ag-header-cell-text') || cell;
      const label = cleanText(target);
      const entry = (window.VX_TIPS || {})[label];
      if (!entry) return;
      const source = document.createElement('span');
      source.textContent = typeof entry === 'string' ? entry : [entry.d, entry.w, entry.e].filter(Boolean).join(' ');
      target.appendChild(source); attach(target, source, label);
      cell.removeAttribute('title');
    });
    // Keep Add visible; collect less frequent grid utilities without replacing
    // the original controls, IDs or listeners.
    document.querySelectorAll('.vx-tools > .r').forEach(tools => {
      if (tools.querySelector('.vx-more-tools')) return;
      const utility = [...tools.children].filter(el => /(?:cols|imp|exp)$/.test(el.id));
      if (utility.length < 2) return;
      const details = document.createElement('details'); details.className = 'vx-more-tools';
      const summary = document.createElement('summary'); summary.textContent = 'Table options';
      const panel = document.createElement('div'); details.append(summary, panel); tools.appendChild(details);
      utility.forEach(el => panel.appendChild(el));
      panel.addEventListener('click', e => { if (e.target.closest('button')) details.open = false; });
    });
    document.querySelectorAll('.vx-card h2').forEach(heading => {
      const text = cleanText(heading);
      if ((secondary[page] || []).some(title => text === title)) wrapSection(heading.closest('.vx-card'), text);
    });
    document.querySelectorAll('[data-ux-section]').forEach(el => wrapSection(el, el.dataset.uxSection));
  }
  function schedule() {
    if (!queued) { queued = true; scheduledFrame = requestAnimationFrame(enhance); }
  }
  document.addEventListener('pointerover', e => {
    const button = e.target.closest('.vx-help-button');
    if (button && e.pointerType !== 'touch') { clearTimeout(timer); timer = setTimeout(() => open(button), 180); }
    if (popup.contains(e.target)) clearTimeout(timer);
  });
  document.addEventListener('pointerout', e => {
    if ((e.target.closest('.vx-help-button') || popup.contains(e.target)) && !popup.contains(e.relatedTarget)) {
      clearTimeout(timer); timer = setTimeout(() => {
        if (!popup.contains(document.activeElement) && document.activeElement !== active) close(false);
      }, 250);
    }
  });
  document.addEventListener('focusin', e => { if (!restoringFocus && e.target.matches('.vx-help-button')) open(e.target); });
  document.addEventListener('focusout', e => {
    if (e.target === active || popup.contains(e.target)) setTimeout(() => {
      if (document.activeElement !== active && !popup.contains(document.activeElement)) close(false);
    }, 0);
  });
  document.addEventListener('click', e => {
    const button = e.target.closest('.vx-help-button');
    if (button) { e.preventDefault(); e.stopPropagation(); if (active === button && button.dataset.pinned === 'true') { button.dataset.pinned = 'false'; close(false); } else { open(button); button.dataset.pinned = 'true'; } return; }
    if (!popup.contains(e.target)) close(false);
    document.querySelectorAll('.vx-more-tools[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active) { e.preventDefault(); e.stopPropagation(); close(true); }
    if (e.key === 'Tab' && active && e.target === active && !e.shiftKey) {
      const link = popup.querySelector('a[href]');
      if (link) { e.preventDefault(); link.focus(); }
    }
  }, true);
  window.addEventListener('resize', () => { if (active) position(popup, active); });
  window.addEventListener('scroll', () => close(false), { passive: true });
  const observer = new MutationObserver(records => {
    if (records.some(r => !popup.contains(r.target))) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  let menuCleanup = null;
  function showActions(trigger, items) {
    if (menuCleanup) menuCleanup(false);
    close(false);
    const menu = document.createElement('div'); menu.className = 'vx-action-menu';
    menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Row actions');
    trigger.setAttribute('aria-expanded', 'true');
    const finish = (focus = true) => {
      menu.remove(); trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      menuCleanup = null;
      if (focus && trigger.isConnected) trigger.focus();
    };
    const outside = e => { if (!menu.contains(e.target) && e.target !== trigger) finish(false); };
    const dismiss = () => finish(false);
    items.forEach(item => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = item.label; button.setAttribute('role', 'menuitem');
      if (item.danger) button.className = 'del';
      button.onclick = () => { finish(); item.run(); };
      menu.appendChild(button);
    });
    menu.addEventListener('keydown', e => {
      const buttons = [...menu.querySelectorAll('button')], current = buttons.indexOf(document.activeElement);
      let next;
      if (e.key === 'ArrowDown') next = (current + 1) % buttons.length;
      if (e.key === 'ArrowUp') next = (current + buttons.length - 1) % buttons.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { e.preventDefault(); buttons[next].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      if (e.key === 'Tab') finish(true);
    });
    document.body.appendChild(menu); position(menu, trigger); menu.firstElementChild?.focus();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', dismiss, true); window.addEventListener('resize', dismiss);
    menuCleanup = finish;
  }
  window.vxUX = { showActions, enhance,
    dispose() { observer.disconnect(); cancelAnimationFrame(scheduledFrame); clearTimeout(timer); if (menuCleanup) menuCleanup(false); close(false); popup.remove(); }, closeHelp: () => close(false), attachHelp: attach };
  enhance();
})();
