(function () {
  'use strict';
  const customerPage = document.querySelector('#view-support');
  const adminPage = document.querySelector('#view-admin');
  if (!customerPage || !adminPage) return;
  const languages = { en: 0, de: 1, fr: 2, es: 3, ar: 4, ary: 5 };
  const copy = {
    title: ['Contact support', 'Support kontaktieren', 'Contacter le support', 'Contactar con soporte', 'تواصل مع الدعم', 'هضر مع الدعم'],
    sub: ['A private conversation with the site team. Replies appear here.', 'Eine private Unterhaltung mit dem Team. Antworten erscheinen hier.', 'Une conversation privée avec l’équipe du site. Les réponses apparaissent ici.', 'Una conversación privada con el equipo. Las respuestas aparecen aquí.', 'محادثة خاصة مع فريق الموقع. تظهر الردود هنا.', 'محادثة خاصة مع فريق الموقع. الجواب كيبان هنا.'],
    inbox: ['Support inbox', 'Support-Postfach', 'Messages du support', 'Bandeja de soporte', 'رسائل الدعم', 'رسائل الدعم'],
    inboxSub: ['Choose a conversation to read and reply.', 'Unterhaltung auswählen und antworten.', 'Choisissez une conversation pour lire et répondre.', 'Elige una conversación para leer y responder.', 'اختر محادثة للقراءة والرد.', 'ختار المحادثة باش تقرا وتجاوب.'],
    empty: ['No messages yet. Tell us how we can help.', 'Noch keine Nachrichten. Wie können wir helfen?', 'Aucun message. Dites-nous comment vous aider.', 'Sin mensajes todavía. Dinos cómo ayudarte.', 'لا توجد رسائل بعد. كيف يمكننا مساعدتك؟', 'ما كايناش رسائل دابا. كتب لينا شنو نعاونوك فيه.'],
    emptyInbox: ['No support conversations yet.', 'Noch keine Support-Anfragen.', 'Aucune conversation pour le moment.', 'Todavía no hay conversaciones.', 'لا توجد محادثات دعم بعد.', 'ما كايناش محادثات دابا.'],
    choose: ['Choose a conversation', 'Unterhaltung auswählen', 'Choisissez une conversation', 'Elige una conversación', 'اختر محادثة', 'ختار محادثة'],
    input: ['Your message', 'Deine Nachricht', 'Votre message', 'Tu mensaje', 'رسالتك', 'الرسالة ديالك'],
    placeholder: ['Describe your question…', 'Beschreibe deine Frage…', 'Décrivez votre question…', 'Describe tu pregunta…', 'اكتب سؤالك…', 'كتب السؤال ديالك…'],
    send: ['Send message', 'Nachricht senden', 'Envoyer', 'Enviar mensaje', 'إرسال الرسالة', 'صيفط الرسالة'],
    sending: ['Sending…', 'Wird gesendet…', 'Envoi…', 'Enviando…', 'جارٍ الإرسال…', 'كنصيفط…'],
    sent: ['Message sent.', 'Nachricht gesendet.', 'Message envoyé.', 'Mensaje enviado.', 'تم إرسال الرسالة.', 'تصيفطات الرسالة.'],
    loading: ['Loading messages…', 'Nachrichten laden…', 'Chargement des messages…', 'Cargando mensajes…', 'جارٍ تحميل الرسائل…', 'كنحمّل الرسائل…'],
    error: ['Unable to load messages. Try refreshing.', 'Nachrichten nicht geladen. Bitte aktualisieren.', 'Impossible de charger les messages. Réessayez.', 'No se pueden cargar los mensajes. Actualiza.', 'تعذر تحميل الرسائل. حاول التحديث.', 'الرسائل ما تحملوش. جرب التحديث.'],
    sendError: ['Message not confirmed. Retry to check or send it.', 'Nachricht nicht bestätigt. Erneut versuchen.', 'Envoi non confirmé. Réessayez pour vérifier ou envoyer.', 'Envío sin confirmar. Reintenta para verificar o enviar.', 'لم يتأكد الإرسال. أعد المحاولة للتحقق أو الإرسال.', 'الإرسال ما تأكدش. عاود جرب باش نتأكدو ولا نصيفطو.'],
    invalid: ['Write a message of 1–2,000 characters.', 'Nachricht mit 1–2.000 Zeichen eingeben.', 'Écrivez un message de 1 à 2 000 caractères.', 'Escribe de 1 a 2.000 caracteres.', 'اكتب رسالة من 1 إلى 2000 حرف.', 'كتب رسالة من حرف حتى 2000 حرف.'],
    rate: ['Too many messages. Wait a minute and retry.', 'Zu viele Nachrichten. Eine Minute warten.', 'Trop de messages. Attendez une minute.', 'Demasiados mensajes. Espera un minuto.', 'رسائل كثيرة. انتظر دقيقة وحاول مجدداً.', 'رسائل بزاف. تسنى دقيقة وعاود جرب.'],
    conflict: ['This message changed. Edit it before retrying.', 'Nachricht geändert. Vor erneutem Senden bearbeiten.', 'Le message a changé. Modifiez-le avant de réessayer.', 'El mensaje cambió. Edítalo antes de reintentar.', 'تغيرت الرسالة. عدلها قبل إعادة المحاولة.', 'الرسالة تبدلات. بدلها قبل ما تعاود تصيفط.'],
    you: ['You', 'Du', 'Vous', 'Tú', 'أنت', 'نتا'],
    team: ['Support team', 'Support-Team', 'Équipe support', 'Equipo de soporte', 'فريق الدعم', 'فريق الدعم'],
    customer: ['Member', 'Mitglied', 'Membre', 'Miembro', 'عضو', 'عضو'],
    older: ['Earlier messages', 'Ältere Nachrichten', 'Messages précédents', 'Mensajes anteriores', 'الرسائل السابقة', 'الرسائل السابقة'],
    more: ['More conversations', 'Weitere Anfragen', 'Plus de conversations', 'Más conversaciones', 'محادثات أخرى', 'محادثات أخرى'],
    refresh: ['Refresh', 'Aktualisieren', 'Actualiser', 'Actualizar', 'تحديث', 'تحديث'],
    awaiting: ['Awaiting a reply', 'Antwort ausstehend', 'En attente de réponse', 'Pendiente de respuesta', 'بانتظار الرد', 'كتسنى الجواب'],
    answered: ['Replied', 'Beantwortet', 'Répondu', 'Respondido', 'تم الرد', 'تجاوبات'],
    conversation: ['Conversation', 'Unterhaltung', 'Conversation', 'Conversación', 'المحادثة', 'المحادثة'],
    privacy: ['Only you and site administrators can read this conversation.', 'Nur du und die Website-Admins können diese Unterhaltung lesen.', 'Seuls vous et les administrateurs du site pouvez lire cette conversation.', 'Solo tú y los administradores del sitio pueden leer esta conversación.', 'يمكنك أنت ومشرفو الموقع فقط قراءة هذه المحادثة.', 'غير نتا ومشرفين الموقع يقدرو يقراو هاد المحادثة.'],
  };
  const t = key => copy[key]?.[languages[document.documentElement.lang] ?? 0] || key;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const span = key => `<span data-support-copy="${key}"></span>`;
  function panel(admin) {
    const node = el('section', `support-panel surface${admin ? ' support-admin' : ''}`);
    node.innerHTML = `<header class="support-heading"><div><h2>${span(admin ? 'inbox' : 'title')}</h2><p>${span(admin ? 'inboxSub' : 'sub')}</p></div><button type="button" class="support-refresh">↻ ${span('refresh')}</button></header>
      ${admin ? '<div class="support-admin-grid"><aside class="support-inbox-list" aria-label=""></aside><div class="support-chat-pane">' : ''}
      <h3 class="support-conversation-title" ${admin ? '' : 'hidden'}></h3>
      <button type="button" class="support-older" hidden>${span('older')}</button>
      <div class="support-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
      <form class="support-compose"><label><span data-support-copy="input"></span><textarea rows="3" maxlength="2000" required></textarea></label><footer><small class="support-count">0 / 2000</small><button type="submit" class="support-send">${span('send')}</button></footer></form>
      <p class="support-status" role="status" aria-live="polite"></p>
      ${admin ? '</div></div><button type="button" class="support-more" hidden>' + span('more') + '</button>' : '<p class="support-privacy">' + span('privacy') + '</p>'}`;
    const state = { admin, node, messages: [], userId: null, thread: null, threads: [], hasOlder: false,
      hasMore: false, loading: false, sending: false, version: 0, initialized: false, status: '', retry: null, inboxLoading: false };
    state.log = node.querySelector('.support-messages');
    state.form = node.querySelector('form');
    state.input = node.querySelector('textarea');
    state.button = node.querySelector('.support-send');
    state.older = node.querySelector('.support-older');
    state.statusNode = node.querySelector('.support-status');
    state.list = node.querySelector('.support-inbox-list');
    state.more = node.querySelector('.support-more');
    state.input.addEventListener('input', () => {
      node.querySelector('.support-count').textContent = `${state.input.value.length} / 2000`;
      state.retry = null;
    });
    node.querySelector('.support-refresh').onclick = () => admin ? refreshAdmin(state) : loadMessages(state, state.initialized ? 'new' : 'initial');
    state.older.onclick = () => loadMessages(state, 'older');
    if (state.more) state.more.onclick = () => loadInbox(state, true);
    state.form.onsubmit = event => { event.preventDefault(); send(state); };
    return state;
  }
  const customer = panel(false), admin = panel(true);
  customerPage.querySelector('.page-title').after(customer.node);
  adminPage.querySelector('.admin-stats').after(admin.node);
  let accountId = null, authEpoch = 0;
  function active(state) {
    return !!accountId && window.BLH_AUTH?.user?.id === accountId && !document.hidden &&
      (state.admin ? location.hash === '#admin' && window.BLH_AUTH.user.isAdmin : location.hash === '#support');
  }
  function status(state, key, failure = false) {
    state.status = key;
    state.statusNode.textContent = key ? t(key) : '';
    state.statusNode.classList.toggle('support-error', failure);
  }
  async function api(route, params = {}, data) {
    const epoch = authEpoch;
    const query = new URLSearchParams({ route, ...params });
    const response = await fetch(`/api?${query}`, { credentials: 'same-origin', cache: 'no-store',
      ...(data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 && epoch === authEpoch && accountId) document.dispatchEvent(new CustomEvent('blh-session-expired', { detail: { reason: result.error } }));
    if (!response.ok) throw Object.assign(new Error('support request failed'), { code: result.error });
    return result;
  }
  function updateControls(state) {
    state.button.disabled = state.sending || state.admin && !state.userId;
    state.input.disabled = state.sending || state.admin && !state.userId;
    state.button.textContent = t(state.sending ? 'sending' : 'send');
    state.older.hidden = !state.hasOlder;
    state.older.disabled = state.loading;
    if (state.more) { state.more.hidden = !state.hasMore; state.more.disabled = state.inboxLoading; }
  }
  function date(value) {
    return new Date(value).toLocaleString(document.documentElement.lang === 'ary' ? 'ar-MA' : document.documentElement.lang, { dateStyle: 'short', timeStyle: 'short' });
  }
  function renderMessages(state, forceBottom = false) {
    const bottom = state.log.scrollHeight - state.log.scrollTop - state.log.clientHeight < 60;
    state.log.replaceChildren();
    state.log.setAttribute('aria-label', t('conversation'));
    if (!state.messages.length) state.log.append(el('p', 'support-empty', t(state.admin && !state.userId ? 'choose' : 'empty')));
    for (const message of state.messages) {
      const own = message.role === (state.admin ? 'admin' : 'customer');
      const article = el('article', `support-message ${own ? 'support-outgoing' : 'support-incoming'}`);
      const meta = el('header', 'support-message-meta');
      meta.append(el('strong', '', t(own ? 'you' : state.admin ? 'customer' : 'team')));
      const time = el('time', '', date(message.createdAt)); time.dateTime = message.createdAt; meta.append(time);
      article.append(meta, el('p', 'support-message-body', message.text));
      state.log.append(article);
    }
    const title = state.node.querySelector('.support-conversation-title');
    title.textContent = state.thread?.name || t('choose');
    if (bottom || forceBottom) state.log.scrollTop = state.log.scrollHeight;
    updateControls(state);
  }
  function mergeMessages(state, messages) {
    const rows = new Map(state.messages.map(message => [message.id, message]));
    for (const message of messages) rows.set(message.id, message);
    state.messages = [...rows.values()].sort((a, b) => a.seq - b.seq);
  }
  async function loadMessages(state, mode = 'initial') {
    if (state.loading || !active(state) || state.admin && !state.userId) return;
    const version = state.version, params = state.admin ? { userId: state.userId } : {};
    if (mode === 'older' && state.messages.length) params.before = state.messages[0].seq;
    if (mode === 'new' && state.messages.length) params.after = state.messages.at(-1).seq;
    state.loading = true; updateControls(state);
    if (mode !== 'new') status(state, 'loading');
    const height = state.log.scrollHeight, scroll = state.log.scrollTop;
    try {
      const result = await api(state.admin ? 'admin/support/messages' : 'support/messages', params);
      if (version !== state.version) return;
      state.thread = result.thread;
      mergeMessages(state, result.messages);
      if (mode !== 'new') state.hasOlder = result.hasMore;
      state.initialized = true;
      if (result.messages.length || mode !== 'new') renderMessages(state, mode === 'initial');
      if (mode === 'older') state.log.scrollTop = scroll + state.log.scrollHeight - height;
      if (['loading', 'error'].includes(state.status)) status(state, '');
    } catch {
      if (version === state.version) status(state, 'error', true);
    } finally {
      if (version === state.version) { state.loading = false; updateControls(state); }
    }
  }
  function renderInbox(state) {
    state.list.replaceChildren(); state.list.setAttribute('aria-label', t('inbox'));
    if (!state.threads.length) state.list.append(el('p', 'support-empty', t('emptyInbox')));
    for (const thread of state.threads) {
      const button = el('button', `support-thread-choice${state.userId === thread.userId ? ' selected' : ''}`);
      button.type = 'button'; button.disabled = state.sending;
      button.setAttribute('aria-pressed', String(state.userId === thread.userId));
      button.append(el('strong', '', thread.name || t('customer')),
        el('small', 'support-thread-id', thread.userId.slice(0, 8)),
        el('p', 'support-thread-preview', thread.preview),
        el('span', `support-thread-state${thread.awaitingReply ? ' pending' : ''}`, t(thread.awaitingReply ? 'awaiting' : 'answered')),
        el('time', '', date(thread.lastMessageAt)));
      button.onclick = () => {
        if (state.userId === thread.userId || state.sending) return;
        state.version++; state.userId = thread.userId; state.thread = thread; state.messages = [];
        state.initialized = false; state.loading = false; state.hasOlder = false; state.retry = null;
        state.input.value = ''; state.node.querySelector('.support-count').textContent = '0 / 2000';
        status(state, ''); renderInbox(state); renderMessages(state); loadMessages(state);
      };
      state.list.append(button);
    }
    updateControls(state);
  }
  async function loadInbox(state, more = false) {
    if (state.inboxLoading || !active(state)) return;
    const version = state.version, offset = more ? state.threads.length : 0;
    state.inboxLoading = true; updateControls(state);
    try {
      const result = await api('admin/support/inbox', { offset });
      if (version !== state.version) return;
      state.threads = more ? [...new Map([...state.threads, ...result.threads].map(thread => [thread.userId, thread])).values()] : result.threads;
      state.hasMore = result.hasMore; renderInbox(state);
      if (state.status === 'error') status(state, '');
    } catch { if (version === state.version) status(state, 'error', true); }
    finally { state.inboxLoading = false; updateControls(state); }
  }
  async function refreshAdmin(state) { await loadInbox(state); await loadMessages(state, state.initialized ? 'new' : 'initial'); }
  async function send(state) {
    if (!active(state) || state.sending || state.admin && !state.userId) return;
    const text = state.input.value.trim();
    if (!text || text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) { status(state, 'invalid', true); return; }
    const target = state.admin ? state.userId : accountId;
    if (!state.retry || state.retry.text !== text || state.retry.target !== target) state.retry = { id: crypto.randomUUID(), text, target };
    const version = state.version, data = { id: state.retry.id, text, ...(state.admin ? { userId: target } : {}) };
    state.sending = true; updateControls(state); if (state.admin) renderInbox(state); status(state, 'sending');
    try {
      const result = await api(state.admin ? 'admin/support/send' : 'support/send', {}, data);
      if (version !== state.version) return;
      mergeMessages(state, [result.message]); state.input.value = ''; state.retry = null;
      state.node.querySelector('.support-count').textContent = '0 / 2000';
      renderMessages(state, true); status(state, 'sent');
      if (state.admin) await loadInbox(state);
    } catch (error) {
      if (version === state.version) status(state, ({ invalid_support_message: 'invalid', support_rate_limit: 'rate', support_message_conflict: 'conflict' })[error.code] || 'sendError', true);
    } finally { if (version === state.version) { state.sending = false; updateControls(state); if (state.admin) renderInbox(state); } }
  }
  function reset(state) {
    state.version++; state.messages = []; state.threads = []; state.thread = null; state.userId = null;
    state.loading = false; state.sending = false; state.initialized = false; state.inboxLoading = false;
    state.hasOlder = false; state.hasMore = false; state.retry = null; state.input.value = '';
    state.node.querySelector('.support-count').textContent = '0 / 2000'; status(state, '');
    renderMessages(state); if (state.admin) renderInbox(state);
  }
  function translate() {
    for (const state of [customer, admin]) {
      state.node.querySelectorAll('[data-support-copy]').forEach(node => node.textContent = t(node.dataset.supportCopy));
      state.input.placeholder = t('placeholder');
      state.node.querySelector('.support-refresh').setAttribute('aria-label', t('refresh'));
      state.statusNode.textContent = state.status ? t(state.status) : '';
      renderMessages(state); if (state.admin) renderInbox(state);
    }
  }
  function refresh() {
    if (active(customer)) loadMessages(customer, customer.initialized ? 'new' : 'initial');
    if (active(admin)) refreshAdmin(admin);
  }
  document.addEventListener('blh-authenticated', event => {
    authEpoch++; accountId = event.detail.user.id; reset(customer); reset(admin); refresh();
  });
  document.addEventListener('blh-session-expired', () => { authEpoch++; accountId = null; reset(customer); reset(admin); });
  document.addEventListener('blh-language-change', translate);
  window.addEventListener('hashchange', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(refresh, 15000);
  accountId = window.BLH_AUTH?.user?.id || null;
  translate(); refresh();
})();
