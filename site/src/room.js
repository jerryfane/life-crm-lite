(() => {
  // Copy the Project instructions: the text sits in a hidden <textarea data-skill>, so the copy needs no network.
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
      const shown = document.querySelector('[data-instr]');
      if (!ok && shown) shown.open = true;  // show the text to select by hand
      btn.textContent = ok ? 'Copied' : 'Copy failed';
      btn.classList.toggle('ok', ok);
      if (status) status.classList.toggle('ok', ok);
      if (status) status.textContent = ok
        ? 'Copied. Paste it as the instructions of a new Claude Project.'
        : 'Your browser blocked copying. Select the instructions above and copy them.';
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.innerHTML = label; btn.classList.remove('ok'); }, 2500);
    });
  });

})();
