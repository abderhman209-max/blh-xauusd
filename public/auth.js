(function () {
  "use strict";
  document.title = "PIPVORIA — Le marché, en perspective";
  const brandLinks = [
    ["manifest", "/manifest.webmanifest", ""],
    ["icon", "/pipvoria-app-icon.jpeg", "image/jpeg"],
    ["apple-touch-icon", "/pipvoria-app-icon.jpeg", "image/jpeg"]
  ];
  brandLinks.forEach(([rel, href, type]) => {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (type) link.type = type;
    document.head.append(link);
  });
  const brandMeta = {
    "theme-color": "#06152f",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "PIPVORIA",
    "application-name": "PIPVORIA"
  };
  Object.entries(brandMeta).forEach(([name, content]) => {
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    if (!meta) { meta = document.createElement("meta"); meta.name = name; document.head.append(meta); }
    meta.content = content;
  });
  const themeMedia = window.matchMedia?.("(prefers-color-scheme: light)");
  let siteTheme;
  try { siteTheme = localStorage.getItem("pipvoria-theme"); } catch {}
  if (!['dark','light'].includes(siteTheme)) siteTheme = themeMedia?.matches ? 'light' : 'dark';
  function applyTheme(next, persist=true) {
    siteTheme = next === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = siteTheme;
    document.documentElement.style.colorScheme = siteTheme;
    const themeMeta = document.head.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = siteTheme === 'light' ? '#f4f8fc' : '#06152f';
    if (persist) try { localStorage.setItem("pipvoria-theme", siteTheme); } catch {}
    document.dispatchEvent(new CustomEvent('pipvoria-theme-change', { detail:{ theme:siteTheme } }));
  }
  window.PIPVORIA_THEME = { get:()=>siteTheme, set:applyTheme, toggle:()=>applyTheme(siteTheme === 'dark' ? 'light' : 'dark') };
  applyTheme(siteTheme, false);
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  const originalLogo = document.querySelector(".logo");
  if (originalLogo) {
    originalLogo.setAttribute("aria-label", "PIPVORIA");
    originalLogo.innerHTML = '<img src="pipvoria-logo.png" alt="PIPVORIA">';
  }
  const authStyles = document.createElement("link");
  authStyles.rel = "stylesheet";
  authStyles.href = "auth-overrides.css";
  document.head.append(authStyles);
  const futureStyles = document.createElement("link");
  futureStyles.rel = "stylesheet";
  futureStyles.href = "future.css";
  document.head.append(futureStyles);
  const marketFx = document.createElement("script");
  marketFx.src = "market-fx.js";
  marketFx.defer = true;
  document.head.append(marketFx);
  const languages = { fr: "Français", en: "English", es: "Español", ar: "العربية" };
  const passwordRuleCopy = {
    fr: ["12 caractères minimum", "Une lettre majuscule", "Une lettre minuscule", "Un chiffre", "Un symbole"],
    en: ["At least 12 characters", "One uppercase letter", "One lowercase letter", "One number", "One symbol"],
    es: ["12 caracteres como mínimo", "Una letra mayúscula", "Una letra minúscula", "Un número", "Un símbolo"],
    ar: ["12 حرفاً على الأقل", "حرف كبير واحد", "حرف صغير واحد", "رقم واحد", "رمز واحد"]
  };
  const copy = {
    fr: { kicker:"ESPACE TRADING PRIVÉ", hero:"Analysez le marché avec clarté.", heroSub:"Graphiques Or et Bitcoin, structure de marché et indicateurs réunis dans un espace sécurisé.", protected:"Session sécurisée", private:"Données privées", realtime:"Marchés en direct", welcome:"Bon retour", welcomeSub:"Connectez-vous pour accéder à votre espace BLH.", create:"Créer votre compte", createSub:"Inscrivez-vous pour ouvrir votre espace d’analyse.", signin:"Connexion", signup:"Inscription", name:"Nom complet", namePh:"Votre nom", email:"Adresse e-mail", emailPh:"vous@exemple.com", password:"Mot de passe", confirm:"Confirmer le mot de passe", passwordPh:"12 caractères minimum", passwordHint:"12 caractères avec majuscule, minuscule, chiffre et symbole.", forgot:"Mot de passe oublié ?", signinAction:"Se connecter", signupAction:"Créer mon compte", security:"Votre mot de passe est chiffré par Supabase et n’est jamais stocké par BLH.", invalid:"E-mail ou mot de passe incorrect.", invalidSignup:"Vérifiez les informations saisies.", mismatch:"Les mots de passe ne correspondent pas.", weak:"Utilisez au moins 12 caractères avec majuscule, minuscule, chiffre et symbole.", confirmation:"Compte créé. Vérifiez votre e-mail pour confirmer l’inscription.", recoverTitle:"Réinitialiser le mot de passe", recoverSub:"Saisissez votre e-mail pour recevoir un lien sécurisé.", send:"Envoyer le lien", back:"Retour à la connexion", sent:"Si ce compte existe, un lien de réinitialisation vient d’être envoyé.", resetTitle:"Choisir un nouveau mot de passe", resetSub:"Saisissez un nouveau mot de passe sécurisé.", update:"Mettre à jour", updated:"Mot de passe mis à jour. Vous pouvez continuer.", service:"L’authentification n’est pas encore configurée.", loading:"Vérification de la session…", logout:"Se déconnecter", show:"Afficher le mot de passe" },
    en: { kicker:"PRIVATE TRADING WORKSPACE", hero:"See the market with clarity.", heroSub:"Gold and Bitcoin charts, market structure and indicators in one secure workspace.", protected:"Secure session", private:"Private data", realtime:"Live markets", welcome:"Welcome back", welcomeSub:"Sign in to access your BLH workspace.", create:"Create your account", createSub:"Sign up to open your analysis workspace.", signin:"Sign in", signup:"Sign up", name:"Full name", namePh:"Your name", email:"Email address", emailPh:"you@example.com", password:"Password", confirm:"Confirm password", passwordPh:"At least 12 characters", passwordHint:"12 characters with uppercase, lowercase, a number and a symbol.", forgot:"Forgot password?", signinAction:"Sign in", signupAction:"Create account", security:"Your password is encrypted by Supabase and is never stored by BLH.", invalid:"Incorrect email or password.", invalidSignup:"Check the information you entered.", mismatch:"Passwords do not match.", weak:"Use at least 12 characters with uppercase, lowercase, a number and a symbol.", confirmation:"Account created. Check your email to confirm your registration.", recoverTitle:"Reset password", recoverSub:"Enter your email to receive a secure reset link.", send:"Send reset link", back:"Back to sign in", sent:"If this account exists, a reset link has been sent.", resetTitle:"Choose a new password", resetSub:"Enter a new secure password.", update:"Update password", updated:"Password updated. You can continue.", service:"Authentication is not configured yet.", loading:"Checking your session…", logout:"Sign out", show:"Show password" },
    es: { kicker:"ESPACIO PRIVADO DE TRADING", hero:"Analiza el mercado con claridad.", heroSub:"Gráficos de oro y Bitcoin, estructura de mercado e indicadores en un espacio seguro.", protected:"Sesión segura", private:"Datos privados", realtime:"Mercados en vivo", welcome:"Bienvenido de nuevo", welcomeSub:"Inicia sesión para acceder a tu espacio BLH.", create:"Crea tu cuenta", createSub:"Regístrate para abrir tu espacio de análisis.", signin:"Iniciar sesión", signup:"Registrarse", name:"Nombre completo", namePh:"Tu nombre", email:"Correo electrónico", emailPh:"tu@ejemplo.com", password:"Contraseña", confirm:"Confirmar contraseña", passwordPh:"Mínimo 12 caracteres", passwordHint:"12 caracteres con mayúscula, minúscula, número y símbolo.", forgot:"¿Olvidaste tu contraseña?", signinAction:"Iniciar sesión", signupAction:"Crear cuenta", security:"Supabase cifra tu contraseña y BLH nunca la almacena.", invalid:"Correo o contraseña incorrectos.", invalidSignup:"Revisa la información introducida.", mismatch:"Las contraseñas no coinciden.", weak:"Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo.", confirmation:"Cuenta creada. Revisa tu correo para confirmar el registro.", recoverTitle:"Restablecer contraseña", recoverSub:"Introduce tu correo para recibir un enlace seguro.", send:"Enviar enlace", back:"Volver al inicio", sent:"Si la cuenta existe, se ha enviado un enlace de restablecimiento.", resetTitle:"Elige una nueva contraseña", resetSub:"Introduce una contraseña nueva y segura.", update:"Actualizar contraseña", updated:"Contraseña actualizada. Ya puedes continuar.", service:"La autenticación aún no está configurada.", loading:"Comprobando la sesión…", logout:"Cerrar sesión", show:"Mostrar contraseña" },
    ar: { kicker:"مساحة تداول خاصة", hero:"حلّل السوق برؤية أوضح.", heroSub:"رسوم الذهب وبيتكوين وبنية السوق والمؤشرات في مساحة واحدة آمنة.", protected:"جلسة آمنة", private:"بيانات خاصة", realtime:"أسواق مباشرة", welcome:"مرحباً بعودتك", welcomeSub:"سجّل الدخول للوصول إلى مساحة BLH.", create:"أنشئ حسابك", createSub:"سجّل لفتح مساحة التحليل الخاصة بك.", signin:"تسجيل الدخول", signup:"إنشاء حساب", name:"الاسم الكامل", namePh:"اسمك", email:"البريد الإلكتروني", emailPh:"you@example.com", password:"كلمة المرور", confirm:"تأكيد كلمة المرور", passwordPh:"12 حرفاً على الأقل", passwordHint:"12 حرفاً مع حرف كبير وصغير ورقم ورمز.", forgot:"نسيت كلمة المرور؟", signinAction:"تسجيل الدخول", signupAction:"إنشاء الحساب", security:"تقوم Supabase بتشفير كلمة المرور ولا تخزنها BLH أبداً.", invalid:"البريد الإلكتروني أو كلمة المرور غير صحيحة.", invalidSignup:"تحقق من المعلومات المدخلة.", mismatch:"كلمتا المرور غير متطابقتين.", weak:"استخدم 12 حرفاً على الأقل مع حرف كبير وصغير ورقم ورمز.", confirmation:"تم إنشاء الحساب. تحقق من بريدك لتأكيد التسجيل.", recoverTitle:"إعادة تعيين كلمة المرور", recoverSub:"أدخل بريدك لتلقي رابط آمن.", send:"إرسال الرابط", back:"العودة لتسجيل الدخول", sent:"إذا كان الحساب موجوداً، فقد تم إرسال رابط إعادة التعيين.", resetTitle:"اختر كلمة مرور جديدة", resetSub:"أدخل كلمة مرور جديدة وآمنة.", update:"تحديث كلمة المرور", updated:"تم تحديث كلمة المرور. يمكنك المتابعة.", service:"لم تتم تهيئة المصادقة بعد.", loading:"جارٍ التحقق من الجلسة…", logout:"تسجيل الخروج", show:"إظهار كلمة المرور" }
  };
  Object.values(copy).forEach(group => Object.keys(group).forEach(key => { group[key] = group[key].replaceAll("BLH", "PIPVORIA"); }));
  const extraCopy = {
    fr: { invalidEmail:"Cette adresse e-mail n’est pas valide.", emailRate:"Trop de demandes d’e-mail. Patientez une minute avant de réessayer.", requestRate:"Trop de tentatives. Patientez quelques minutes avant de réessayer.", accountExists:"Un compte existe déjà avec cette adresse. Essayez de vous connecter.", signupDisabled:"Les nouvelles inscriptions sont momentanément désactivées.", emailProvider:"L’envoi des e-mails d’inscription est indisponible. Réessayez plus tard.", emailUnauthorized:"Cette adresse ne peut pas recevoir l’e-mail de confirmation.", lightMode:"Activer le mode clair", darkMode:"Activer le mode sombre" },
    en: { invalidEmail:"This email address is not valid.", emailRate:"Too many email requests. Wait one minute before trying again.", requestRate:"Too many attempts. Wait a few minutes before trying again.", accountExists:"An account already exists with this address. Try signing in.", signupDisabled:"New registrations are temporarily disabled.", emailProvider:"Registration emails are unavailable. Try again later.", emailUnauthorized:"This address cannot receive the confirmation email.", lightMode:"Switch to light mode", darkMode:"Switch to dark mode" },
    es: { invalidEmail:"Esta dirección de correo no es válida.", emailRate:"Demasiadas solicitudes de correo. Espera un minuto antes de reintentarlo.", requestRate:"Demasiados intentos. Espera unos minutos antes de reintentarlo.", accountExists:"Ya existe una cuenta con esta dirección. Intenta iniciar sesión.", signupDisabled:"Los nuevos registros están desactivados temporalmente.", emailProvider:"Los correos de registro no están disponibles. Inténtalo más tarde.", emailUnauthorized:"Esta dirección no puede recibir el correo de confirmación.", lightMode:"Activar modo claro", darkMode:"Activar modo oscuro" },
    ar: { invalidEmail:"عنوان البريد الإلكتروني غير صالح.", emailRate:"تم طلب رسائل كثيرة. انتظر دقيقة قبل المحاولة مجدداً.", requestRate:"محاولات كثيرة جداً. انتظر بضع دقائق قبل المحاولة مجدداً.", accountExists:"يوجد حساب بهذا البريد. جرّب تسجيل الدخول.", signupDisabled:"إنشاء الحسابات الجديدة متوقف مؤقتاً.", emailProvider:"إرسال رسائل التسجيل غير متاح حالياً. حاول لاحقاً.", emailUnauthorized:"لا يمكن لهذا العنوان استلام رسالة التأكيد.", lightMode:"تفعيل الوضع الفاتح", darkMode:"تفعيل الوضع الداكن" }
  };
  Object.keys(copy).forEach(code => Object.assign(copy[code], extraCopy[code]));
  const feedbackCopy = {
    fr: { requiredEmail:"Saisissez votre adresse e-mail.", requiredPassword:"Saisissez votre mot de passe.", requiredName:"Saisissez votre nom complet.", emailNotConfirmed:"Confirmez votre adresse e-mail avant de vous connecter. Vérifiez également les indésirables.", accountDisabled:"Ce compte est désactivé. Contactez l’assistance.", unavailable:"Le service est momentanément indisponible. Réessayez plus tard.", recoveryUnavailable:"Impossible d’envoyer le lien pour le moment. Réessayez plus tard.", expiredLink:"Le lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien.", updateFailed:"Impossible de modifier le mot de passe. Réessayez avec un nouveau lien.", samePassword:"Choisissez un mot de passe différent de l’ancien.", sending:"Envoi du lien…", signingIn:"Connexion en cours…", creating:"Création du compte…", updating:"Mise à jour du mot de passe…" },
    en: { requiredEmail:"Enter your email address.", requiredPassword:"Enter your password.", requiredName:"Enter your full name.", emailNotConfirmed:"Confirm your email before signing in. Check your spam folder too.", accountDisabled:"This account is disabled. Contact support.", unavailable:"The service is temporarily unavailable. Try again later.", recoveryUnavailable:"The reset link could not be sent right now. Try again later.", expiredLink:"This reset link is invalid or has expired. Request a new one.", updateFailed:"The password could not be updated. Try again with a new link.", samePassword:"Choose a different password.", sending:"Sending the link…", signingIn:"Signing in…", creating:"Creating your account…", updating:"Updating password…" },
    es: { requiredEmail:"Introduce tu correo electrónico.", requiredPassword:"Introduce tu contraseña.", requiredName:"Introduce tu nombre completo.", emailNotConfirmed:"Confirma tu correo antes de iniciar sesión. Revisa también el correo no deseado.", accountDisabled:"Esta cuenta está desactivada. Contacta con soporte.", unavailable:"El servicio no está disponible temporalmente. Inténtalo más tarde.", recoveryUnavailable:"No se puede enviar el enlace ahora. Inténtalo más tarde.", expiredLink:"El enlace no es válido o ha caducado. Solicita uno nuevo.", updateFailed:"No se pudo cambiar la contraseña. Prueba con un enlace nuevo.", samePassword:"Elige una contraseña diferente.", sending:"Enviando enlace…", signingIn:"Iniciando sesión…", creating:"Creando cuenta…", updating:"Actualizando contraseña…" },
    ar: { requiredEmail:"أدخل بريدك الإلكتروني.", requiredPassword:"أدخل كلمة المرور.", requiredName:"أدخل اسمك الكامل.", emailNotConfirmed:"أكّد بريدك الإلكتروني قبل تسجيل الدخول. تحقق أيضاً من البريد غير المرغوب فيه.", accountDisabled:"هذا الحساب معطّل. اتصل بالدعم.", unavailable:"الخدمة غير متاحة مؤقتاً. حاول لاحقاً.", recoveryUnavailable:"تعذّر إرسال الرابط الآن. حاول لاحقاً.", expiredLink:"رابط إعادة التعيين غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.", updateFailed:"تعذّر تغيير كلمة المرور. حاول برابط جديد.", samePassword:"اختر كلمة مرور مختلفة.", sending:"جارٍ إرسال الرابط…", signingIn:"جارٍ تسجيل الدخول…", creating:"جارٍ إنشاء الحساب…", updating:"جارٍ تحديث كلمة المرور…" }
  };
  Object.keys(copy).forEach(code => Object.assign(copy[code], feedbackCopy[code]));
  let language = "fr";
  try { language = localStorage.getItem("blh-language") || "fr"; } catch {}
  if (!languages[language]) language = "fr";
  let mode = "signin";
  let user = null;

  const gate = document.createElement("section");
  gate.className = "auth-gate";
  gate.setAttribute("aria-modal", "true");
  gate.setAttribute("role", "dialog");
  gate.innerHTML = `<div class="auth-visual"><a class="auth-brand" href="/" aria-label="BLH XAUUSD"><img src="blh-logo.png" alt=""><span>BLH <b>XAUUSD</b></span></a><div class="auth-message"><span class="auth-kicker" data-auth="kicker"></span><h2 data-auth="hero"></h2><p data-auth="heroSub"></p></div><div class="auth-trust"><span>✓ <b data-auth="protected"></b></span><span>✓ <b data-auth="private"></b></span><span>✓ <b data-auth="realtime"></b></span></div></div><div class="auth-panel"><label class="auth-language">🌐 <select aria-label="Language">${Object.entries(languages).map(([code,name])=>`<option value="${code}">${name}</option>`).join("")}</select></label><main class="auth-card"><div class="auth-card-header"><h1 data-auth="welcome"></h1><p data-auth="welcomeSub"></p></div><div class="auth-tabs" role="tablist"><button type="button" data-mode="signin" role="tab" aria-selected="true" data-auth="signin"></button><button type="button" data-mode="signup" role="tab" aria-selected="false" data-auth="signup"></button></div><form class="auth-form" id="signin-form"><label class="auth-field"><span data-auth="email"></span><input name="email" type="email" autocomplete="email" required maxlength="254" data-auth-placeholder="emailPh"></label><label class="auth-field"><span data-auth="password"></span><span class="auth-input-wrap"><input name="password" type="password" autocomplete="current-password" required maxlength="128" data-auth-placeholder="passwordPh"><button class="auth-password-toggle" type="button" data-password-toggle aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label><button class="auth-link" type="button" id="forgot-password" data-auth="forgot"></button><button class="auth-primary" type="submit" data-auth="signinAction"></button></form><form class="auth-form" id="signup-form" hidden><label class="auth-field"><span data-auth="name"></span><input name="name" autocomplete="name" required minlength="2" maxlength="80" data-auth-placeholder="namePh"></label><label class="auth-field"><span data-auth="email"></span><input name="email" type="email" autocomplete="email" required maxlength="254" data-auth-placeholder="emailPh"></label><label class="auth-field"><span data-auth="password"></span><span class="auth-input-wrap"><input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" data-auth-placeholder="passwordPh"><button class="auth-password-toggle" type="button" data-password-toggle aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label><label class="auth-field"><span data-auth="confirm"></span><span class="auth-input-wrap"><input name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" data-auth-placeholder="passwordPh"><button class="auth-password-toggle" type="button" data-password-toggle aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label><p class="auth-password-hint" data-auth="passwordHint"></p><button class="auth-primary" type="submit" data-auth="signupAction"></button></form><form class="auth-form auth-recovery" id="recovery-form" hidden><label class="auth-field"><span data-auth="email"></span><input name="email" type="email" autocomplete="email" required maxlength="254" data-auth-placeholder="emailPh"></label><button class="auth-primary" type="submit" data-auth="send"></button><button class="auth-link" type="button" data-back data-auth="back"></button></form><form class="auth-form auth-recovery" id="reset-form" hidden><label class="auth-field"><span data-auth="password"></span><span class="auth-input-wrap"><input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" data-auth-placeholder="passwordPh"><button class="auth-password-toggle" type="button" data-password-toggle aria-label=""><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></span></label><p class="auth-password-hint" data-auth="passwordHint"></p><button class="auth-primary" type="submit" data-auth="update"></button></form><p class="auth-status" id="auth-status" role="status" aria-live="polite"></p><p class="auth-security-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span data-auth="security"></span></p></main></div>`;
  const authBrand = gate.querySelector(".auth-brand");
  authBrand.setAttribute("aria-label", "PIPVORIA");
  authBrand.innerHTML = '<img src="pipvoria-logo.png" alt="PIPVORIA">';
  document.body.append(gate);
  const authThemeButton = document.createElement('button');
  authThemeButton.type = 'button';
  authThemeButton.className = 'auth-theme-toggle';
  gate.querySelector('.auth-language').before(authThemeButton);
  const status = gate.querySelector("#auth-status");
  const header = gate.querySelector(".auth-card-header");
  const tabs = gate.querySelector(".auth-tabs");
  const forms = Object.fromEntries(["signin","signup","recovery","reset"].map(name => [name, gate.querySelector(`#${name}-form`)]));
  const languageSelect = gate.querySelector(".auth-language select");
  const signupPassword = forms.signup.elements.password;
  const signupConfirm = forms.signup.elements.confirm;
  const signupButton = forms.signup.querySelector('[type="submit"]');
  let signupCooldownTimer = 0;
  Object.values(forms).forEach(form => { form.noValidate = true; });
  const passwordRules = document.createElement("ul");
  passwordRules.className = "auth-password-rules";
  passwordRules.setAttribute("aria-label", "Password requirements");
  passwordRules.innerHTML = ["length", "upper", "lower", "number", "symbol"].map(rule => `<li data-password-rule="${rule}"><span aria-hidden="true">×</span><b></b></li>`).join("");
  signupPassword.closest(".auth-field").after(passwordRules);
  const confirmError = document.createElement("p");
  confirmError.className = "auth-inline-error";
  confirmError.setAttribute("role", "alert");
  confirmError.setAttribute("aria-live", "polite");
  confirmError.hidden = true;
  signupConfirm.closest(".auth-field").after(confirmError);
  forms.signup.querySelector(".auth-password-hint").hidden = true;
  languageSelect.value = language;

  function tr(key){ return copy[language][key] || key; }
  function applyLanguage(){
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", language === "ar");
    gate.querySelectorAll("[data-auth]").forEach(node => node.textContent = tr(node.dataset.auth));
    gate.querySelectorAll("[data-auth-placeholder]").forEach(node => node.placeholder = tr(node.dataset.authPlaceholder));
    gate.querySelectorAll("[data-password-toggle]").forEach(node => node.setAttribute("aria-label", tr("show")));
    passwordRules.querySelectorAll("li b").forEach((node, index) => { node.textContent = passwordRuleCopy[language][index]; });
    confirmError.textContent = tr("mismatch");
    renderThemeButton();
    renderMode();
    updateSignupValidation();
  }
  function renderThemeButton(){
    const light = siteTheme === 'light';
    authThemeButton.innerHTML = light
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/></svg>';
    authThemeButton.setAttribute('aria-label', tr(light ? 'darkMode' : 'lightMode'));
    authThemeButton.title = authThemeButton.getAttribute('aria-label');
  }
  function startSignupCooldown(seconds=60){
    clearInterval(signupCooldownTimer);
    const until = Date.now() + seconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until-Date.now())/1000));
      signupButton.disabled = left > 0;
      if (!left) { clearInterval(signupCooldownTimer); signupCooldownTimer=0; }
    };
    tick(); signupCooldownTimer = setInterval(tick, 1000);
  }
  function signupErrorMessage(code){
    return tr({ weak_password:'weak', invalid_email:'invalidEmail', email_rate_limit:'emailRate', request_rate_limit:'requestRate', account_exists:'accountExists', signup_disabled:'signupDisabled', email_provider_disabled:'emailProvider', email_not_authorized:'emailUnauthorized', service_not_configured:'service' }[code] || 'invalidSignup');
  }
  function setStatus(message, success=false){ status.textContent = message; status.classList.toggle("success", success); status.hidden = !message; }
  function authError(code, fallback='unavailable'){
    return tr({ invalid_credentials:'invalid', invalid_email:'invalidEmail', email_not_confirmed:'emailNotConfirmed', account_disabled:'accountDisabled', request_rate_limit:'requestRate', email_rate_limit:'emailRate', email_not_authorized:'emailUnauthorized', service_not_configured:'service', same_password:'samePassword', weak_password:'weak', authentication_required:'expiredLink', password_update_failed:'updateFailed', recovery_unavailable:'recoveryUnavailable' }[code] || fallback);
  }
  function setBusy(form, busy){ form.querySelectorAll("button,input").forEach(node => node.disabled = busy); }
  function passwordChecks(value){
    return {
      length: value.length >= 12,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /\d/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value)
    };
  }
  function updateSignupValidation(forceMismatch=false){
    const checks = passwordChecks(signupPassword.value);
    passwordRules.querySelectorAll("[data-password-rule]").forEach(item => {
      const valid = checks[item.dataset.passwordRule];
      item.classList.toggle("valid", valid);
      item.classList.toggle("invalid", !valid);
      item.querySelector("span").textContent = valid ? "✓" : "×";
    });
    const mismatch = signupPassword.value !== signupConfirm.value;
    const showMismatch = mismatch && (forceMismatch || signupConfirm.value.length > 0);
    confirmError.hidden = !showMismatch;
    signupConfirm.setAttribute("aria-invalid", String(showMismatch));
    return Object.values(checks).every(Boolean) && !mismatch;
  }
  function renderMode(){
    const recovering = mode === "recovery" || mode === "reset";
    tabs.hidden = recovering;
    for (const [name, form] of Object.entries(forms)) form.hidden = name !== mode;
    forms[mode].append(status);
    gate.querySelectorAll("[data-mode]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.mode === mode)));
    header.querySelector("h1").textContent = tr(mode === "signup" ? "create" : mode === "recovery" ? "recoverTitle" : mode === "reset" ? "resetTitle" : "welcome");
    header.querySelector("p").textContent = tr(mode === "signup" ? "createSub" : mode === "recovery" ? "recoverSub" : mode === "reset" ? "resetSub" : "welcomeSub");
    setStatus("");
  }
  async function request(route, options={}){
    const response = await fetch(`/api?route=${encodeURIComponent(route)}`, { credentials:"same-origin", ...options, headers:{ "content-type":"application/json", ...(options.headers||{}) } });
    const result = await response.json().catch(()=>({ error:"server_error" }));
    return { response, result };
  }
  function unlock(nextUser){
    user = nextUser; window.BLH_AUTH.user = user; window.BLH_AUTH.authenticated = true;
    gate.hidden = true; document.body.classList.remove("auth-locked");
    ensureBadge();
    document.dispatchEvent(new CustomEvent("blh-authenticated", { detail:{ user } }));
  }
  function lock(){
    user = null; window.BLH_AUTH.user = null; window.BLH_AUTH.authenticated = false;
    document.body.classList.add("auth-locked"); gate.hidden = false; mode = "signin"; renderMode();
    const badge = document.querySelector(".auth-badge"); if (badge) badge.hidden = true;
  }
  function ensureBadge(){
    let badge = document.querySelector(".auth-badge");
    if (!badge){ badge=document.createElement("div"); badge.className="auth-badge"; badge.innerHTML='<span id="user-name"></span><button id="logout" type="button"></button>'; document.querySelector(".chart-top")?.append(badge); badge.querySelector("#logout").onclick=logout; }
    badge.hidden=false; badge.querySelector("#user-name").textContent=user.name; badge.querySelector("#logout").textContent=tr("logout");
  }
  async function logout(){ await request("auth/sign-out", { method:"POST", body:"{}" }).catch(()=>{}); lock(); }
  window.BLH_AUTH = { authenticated:false, user:null, logout };
  document.addEventListener("blh-session-expired", lock);

  languageSelect.addEventListener("change", () => {
    language = languageSelect.value; try { localStorage.setItem("blh-language", language); } catch {} applyLanguage();
    const appSelect = document.querySelector(".language-picker select");
    if (appSelect && appSelect.value !== language){ appSelect.value=language; appSelect.dispatchEvent(new Event("change",{bubbles:true})); }
  });
  document.addEventListener("blh-language-change",()=>{ const next=document.documentElement.lang; if(languages[next]&&next!==language){ language=next; languageSelect.value=next; applyLanguage(); } });
  authThemeButton.addEventListener('click', () => window.PIPVORIA_THEME.toggle());
  document.addEventListener('pipvoria-theme-change', event => { siteTheme=event.detail.theme; renderThemeButton(); });
  gate.querySelectorAll("[data-mode]").forEach(button=>button.onclick=()=>{mode=button.dataset.mode;renderMode();updateSignupValidation()});
  gate.querySelector("#forgot-password").onclick=()=>{forms.recovery.elements.email.value=forms.signin.elements.email.value;mode="recovery";renderMode();forms.recovery.elements.email.focus()};
  gate.querySelector("[data-back]").onclick=()=>{mode="signin";renderMode()};
  gate.querySelectorAll("[data-password-toggle]").forEach(button=>button.onclick=()=>{const input=button.parentElement.querySelector("input");input.type=input.type==="password"?"text":"password"});
  signupPassword.addEventListener("input", () => updateSignupValidation());
  signupConfirm.addEventListener("input", () => updateSignupValidation());
  signupConfirm.addEventListener("blur", () => updateSignupValidation(true));

  forms.signin.addEventListener("submit", async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(forms.signin));
    if(!data.email){setStatus(tr('requiredEmail'));forms.signin.elements.email.focus();return}
    if(!forms.signin.elements.email.validity.valid){setStatus(tr('invalidEmail'));forms.signin.elements.email.focus();return}
    if(!data.password){setStatus(tr('requiredPassword'));forms.signin.elements.password.focus();return}
    setBusy(forms.signin,true);setStatus(tr('signingIn'));
    try{const {response,result}=await request("auth/sign-in",{method:"POST",body:JSON.stringify(data)});if(!response.ok){setStatus(authError(result.error));return}unlock(result.user)}catch{setStatus(tr('unavailable'))}finally{setBusy(forms.signin,false)}
  });
  forms.signup.addEventListener("submit", async event=>{
    event.preventDefault(); const data=Object.fromEntries(new FormData(forms.signup));
    const invalidIdentity = data.name.trim().length < 2 || !forms.signup.elements.email.validity.valid || !data.email;
    if(invalidIdentity){setStatus(tr(data.name.trim().length < 2 ? (data.name.trim() ? 'invalidSignup' : 'requiredName') : data.email ? 'invalidEmail' : 'requiredEmail'));(data.name.trim().length < 2 ? forms.signup.elements.name : forms.signup.elements.email).focus();return}
    if(!data.password){setStatus(tr('requiredPassword'));signupPassword.focus();return}
    if(data.password!==data.confirm){updateSignupValidation(true);setStatus(tr("mismatch"));signupConfirm.focus();return}
    const strong=updateSignupValidation(true);
    if(!strong){setStatus(tr("weak"));return}
    setBusy(forms.signup,true); setStatus(tr("creating"));
    try{const {response,result}=await request("auth/sign-up",{method:"POST",body:JSON.stringify({name:data.name,email:data.email,password:data.password})});if(!response.ok){setStatus(signupErrorMessage(result.error));if(result.error==='email_rate_limit')startSignupCooldown(result.retryAfter||60);return}if(result.confirmationRequired){const email=data.email;forms.signup.reset();updateSignupValidation();mode="signin";renderMode();forms.signin.elements.email.value=email;setStatus(tr("confirmation"),true);forms.signin.elements.password.focus();return}unlock(result.user)}catch{setStatus(tr("invalidSignup"))}finally{setBusy(forms.signup,false);if(signupCooldownTimer)signupButton.disabled=true}
  });
  forms.recovery.addEventListener("submit",async event=>{
    event.preventDefault();
    const email=forms.recovery.elements.email;
    if(!email.value.trim()){setStatus(tr('requiredEmail'));email.focus();return}
    if(!email.validity.valid){setStatus(tr('invalidEmail'));email.focus();return}
    setBusy(forms.recovery,true);setStatus(tr('sending'));
    try{
      const {response,result}=await request("auth/recover",{method:"POST",body:JSON.stringify({email:email.value.trim()})});
      if(!response.ok){setStatus(authError(result.error,'recoveryUnavailable'));return}
      setStatus(tr('sent'),true);
    }catch{setStatus(tr('recoveryUnavailable'))}finally{setBusy(forms.recovery,false)}
  });
  forms.reset.addEventListener("submit",async event=>{
    event.preventDefault();const password=forms.reset.elements.password;
    if(!password.value){setStatus(tr('requiredPassword'));password.focus();return}
    if(!Object.values(passwordChecks(password.value)).every(Boolean)){setStatus(tr('weak'));password.focus();return}
    setBusy(forms.reset,true);setStatus(tr('updating'));
    try{
      const {response,result}=await request("auth/update-password",{method:"POST",body:JSON.stringify({password:password.value})});
      if(!response.ok){setStatus(authError(result.error,'updateFailed'));return}
      password.value='';setStatus(tr('updated'),true);
      if(user) setTimeout(()=>unlock(user),900);
      else { mode='signin';renderMode();setStatus(tr('updated'),true); }
    }catch{setStatus(tr('updateFailed'))}finally{setBusy(forms.reset,false)}
  });

  async function bootstrap(){
    applyLanguage();
    const hash=new URLSearchParams(location.hash.replace(/^#/,""));
    if(hash.get('error') && (hash.get('error_code') === 'otp_expired' || hash.get('type') === 'recovery')){
      history.replaceState(null,'',location.pathname+location.search);
      lock();mode='recovery';renderMode();setStatus(tr('expiredLink'));return;
    }
    if(hash.get("access_token")&&hash.get("refresh_token")){
      const type=hash.get("type");
      history.replaceState(null,"",location.pathname+location.search);
      try {
        const {response,result}=await request("auth/import-session",{method:"POST",body:JSON.stringify({accessToken:hash.get("access_token"),refreshToken:hash.get("refresh_token"),expiresIn:hash.get("expires_in")})});
        if(response.ok){user=result.user;if(type==="recovery"){window.BLH_AUTH.user=user;window.BLH_AUTH.authenticated=true;mode="reset";renderMode();return}unlock(user);return}
      } catch {}
      if(type==='recovery'){lock();mode='recovery';renderMode();setStatus(tr('expiredLink'));return}
    }
    try{const {response,result}=await request("auth/session",{method:"GET",headers:{}});if(response.ok){unlock(result.user);return}}catch{}
    lock();
  }
  bootstrap();
})();
