(() => {
  // Copy the skill: the full text sits in a hidden <textarea data-skill>, so the copy needs no network.
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); return ok;
  };
  const skill = document.querySelector('[data-skill]');
  document.querySelectorAll('[data-copy-skill]').forEach((btn) => {
    if (!skill || !skill.value.trim()) return;
    const label = btn.innerHTML;
    const status = document.querySelector('[data-copied]');
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      const ok = await copyText(skill.value);
      btn.textContent = ok ? 'Copied' : 'Copy failed';
      btn.classList.toggle('ok', ok);
      if (status) status.classList.toggle('ok', ok);
      if (status) status.textContent = ok
        ? 'Copied. Now paste it as the instructions of a new Project in Claude or ChatGPT.'
        : 'Your browser blocked copying. Open life-crm-lite.jerryfane.com/skill.txt, select all the text and copy it.';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.innerHTML = label; btn.classList.remove('ok'); }, 2500);
    });
  });

  // Tabs (Connect Google Drive): arrow keys move between them.
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const show = (tab) => tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const next = tabs[(i + d + tabs.length) % tabs.length];
        show(next); next.focus();
      });
    });
  });
})();
