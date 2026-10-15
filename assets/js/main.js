(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('#navLinks');
  const toast = document.querySelector('#toast');
  const year = document.querySelector('#year');

  year.textContent = String(new Date().getFullYear());

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toast.classList.remove('show'), 4000);
  }

  function closeMenu(){
    if(!links) return;
    links.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  // Sticky header shadow
  const onScroll = () => {
    if (window.scrollY > 8) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  if (toggle && links){
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // close after click
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

    // close on outside click
    document.addEventListener('click', (e) => {
      if (!links.classList.contains('open')) return;
      const isInside = links.contains(e.target) || toggle.contains(e.target);
      if (!isInside) closeMenu();
    });
  }

  // Copy helpers
  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    }catch{
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Copied to clipboard');
    }
  }

  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn.getAttribute('data-copy')));
  });

  // Quote form: submit to your lead list (Google Sheet / CRM) + email notification
  // Works for the homepage quote form and the Sell Your Route form (data-lead-form).
  const form = document.querySelector('#quoteForm, [data-lead-form]');
  const copyBtn = document.querySelector('#copyMessage');
  const endpoint = (window.SAC_LEAD_ENDPOINT || '').trim();
  const leadType = (form?.dataset.leadType || '').trim();          // e.g. "Sell inquiry"
  const leadTitle = (form?.dataset.leadTitle || 'New Quote Request — Southern Amusement Company, LLC').trim();

  // Prefix the free-text message so sell inquiries stand out in the lead sheet/email.
  function taggedMessage(raw){
    const msg = String(raw || '').trim();
    return leadType ? `[${leadType}] ${msg}` : msg;
  }

  function buildMessage(){
    const data = new FormData(form);
    const lines = [
      leadTitle,
      '',
      `Name: ${data.get('name')}`,
      `Venue: ${data.get('venue')}`,
      `City: ${data.get('city')}`,
      `Phone: ${data.get('phone')}`,
      `Email: ${data.get('email')}`,
      '',
      'Request:',
      taggedMessage(data.get('message')),
    ];
    return lines.join('\n');
  }

  function safeGtagEvent(name, params){
    try{
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    }catch{ /* ignore */ }
  }

  // Basic click tracking (optional)
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    a.addEventListener('click', () => safeGtagEvent('click_phone', { href: a.getAttribute('href') || '' }));
  });

  async function submitLead(){
    const fd = new FormData(form);

    // Honeypot: if bots fill it, pretend success and do nothing.
    if (String(fd.get('website') || '').trim()) {
      return { ok: true, skipped: true };
    }

    const payload = {
      name: String(fd.get('name') || '').trim(),
      venue: String(fd.get('venue') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      message: taggedMessage(fd.get('message')),
      lead_type: leadType || 'Quote request',
      consent: String(fd.get('consent') || '').trim(),
      page_url: String(location.href),
      user_agent: String(navigator.userAgent),
      timestamp: new Date().toISOString(),
    };

    // If no endpoint is configured, fall back to copy-to-clipboard workflow.
    if (!endpoint || endpoint.includes('REPLACE_WITH')) {
      return { ok: false, reason: 'no-endpoint', payload };
    }

    // NOTE: Google Apps Script web apps don't support OPTIONS preflight, so we avoid
    // triggering it by using a "simple" content type, and we send with no-cors.
    // When the request succeeds, the response is "opaque" (we can't read status),
    // but the lead will still be captured.
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
      cache: 'no-store',
    });

    return { ok: true };
  }

  // Visible confirmation: swap the form for a success panel so people don't resubmit.
  let submitting = false;
  const submitBtn = form?.querySelector('button[type="submit"]');
  const submitLabel = submitBtn ? submitBtn.textContent : 'Send';

  function setBusy(busy){
    submitting = busy;
    if (submitBtn){
      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? 'Sending…' : submitLabel;
    }
    if (copyBtn) copyBtn.disabled = busy;
  }

  function showSuccess(firstName){
    const panel = document.createElement('div');
    panel.className = 'form-success';
    panel.setAttribute('role', 'status');
    panel.setAttribute('tabindex', '-1');
    const who = firstName ? `Thanks, ${firstName}.` : 'Thanks.';
    const what = leadType ? 'your inquiry' : 'your request';
    panel.innerHTML = `
      <div class="form-success-icon" aria-hidden="true">✓</div>
      <h3>Successfully submitted</h3>
      <p>${who} We received ${what} and will get back to you within one business day. No need to send it again.</p>
      <p class="tiny muted">Need us sooner? Call or text <a class="text-link" href="tel:+17312349797">(731) 234-9797</a>.</p>
      <button class="btn btn-ghost" type="button" data-send-another>Send another</button>
    `;
    form.hidden = true;
    form.insertAdjacentElement('afterend', panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    panel.focus({ preventScroll: true });
    panel.querySelector('[data-send-another]').addEventListener('click', () => {
      panel.remove();
      form.hidden = false;
      form.querySelector('input[name="name"]')?.focus();
    });
  }

  async function handleSubmit(e){
    e.preventDefault();
    if (submitting) return;
    if(!form.checkValidity()){
      showToast('Please fill out the form first');
      form.reportValidity();
      return;
    }

    const firstName = String(new FormData(form).get('name') || '').trim().split(/\s+/)[0];
    setBusy(true);
    let result;
    try{
      result = await submitLead();
    }catch{
      result = { ok: false, reason: 'network' };
    }finally{
      setBusy(false);
    }

    if (result.ok) {
      safeGtagEvent('lead_submit', { method: 'website_form', lead_type: leadType || 'quote' });
      showToast('Successfully submitted — we’ll reach out soon');
      form.reset();
      showSuccess(firstName);
      return;
    }

    // Fallback: copy-to-clipboard so you never lose the lead.
    const msg = buildMessage();
    await copyText(msg);
    safeGtagEvent('lead_submit', { method: 'clipboard_fallback' });
    showToast('Couldn’t send — details copied, please text them to (731) 234-9797');
  }

  async function handleCopy(){
    if(!form.checkValidity()){
      showToast('Please fill out the form first');
      form.reportValidity();
      return;
    }
    const msg = buildMessage();
    await copyText(msg);
    showToast('Copied — paste into text/email');
  }

  form?.addEventListener('submit', handleSubmit);
  copyBtn?.addEventListener('click', handleCopy);
})();
