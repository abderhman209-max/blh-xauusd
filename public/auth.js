(function () {
  "use strict";
  const authStyles = document.createElement("link");
  authStyles.rel = "stylesheet";
  authStyles.href = "auth-overrides.css";
  document.head.append(authStyles);
  const languages = { fr: "Français", en: "English", es: "Español", ar: "العربية" };
  const copy = {
    fr: { kicker:"ESPACE TRADING PRIVÉ", hero:"Analysez le marché avec clarté.", heroSub:"Graphiques Or et Bitcoin, structure de marché et indicateurs réunis dans un espace sécurisé.", protected:"Session sécurisée", private:"Données privées", realtime:"Marchés en direct", welcome:"Bon retour", welcomeSub:"Connectez-vous pour accéder à votre espace BLH.", create:"Créer votre compte", createSub:"Inscrivez-vous pour ouvrir votre espace d’analyse.", signin:"Connexion", signup:"Inscription", name:"Nom complet", namePh:"Votre nom", email:"Adresse e-mail", emailPh:"vous@exemple.com", password:"Mot de passe", confirm:"Confirmer le mot de passe", passwordPh:"12 caractères minimum", passwordHint:"12 caractères avec majuscule, minuscule, chiffre et symbole.", forgot:"Mot de passe oublié ?", signinAction:"Se connecter", signupAction:"Créer mon compte", security:"Votre mot de passe est chiffré par Supabase et n’est jamais stocké par BLH.", invalid:"E-mail ou mot de passe incorrect.", invalidSignup:"Vérifiez les informations saisies.", mismatch:"Les mots de passe ne correspondent pas.", weak:"Utilisez au moins 12 caractères avec majuscule, minuscule, chiffre et symbole.", confirmation:"Compte créé. Vérifiez votre e-mail pour confirmer l’inscription.", recoverTitle:"Réinitialiser le mot de passe", recoverSub:"Saisissez votre e-mail pour recevoir un lien sécurisé.", send:"Envoyer le lien", back:"Retour à la connexion", sent:"Si ce compte existe, un lien de réinitialisation vient d’être envoyé.", resetTitle:"Choisir un nouveau mot de passe", resetSub:"Saisissez un nouveau mot de passe sécurisé.", update:"Mettre à jour", updated:"Mot de passe mis à jour. Vous pouvez continuer.", service:"L’authentification n’est pas encore configurée.", loading:"Vérification de la session…", logout:"Se déconnecter", show:"Afficher le mot de passe" },
    en: { kicker:"PRIVATE TRADING WORKSPACE", hero:"See the market with clarity.", heroSub:"Gold and Bitcoin charts, market structure and indicators in one secure workspace.", protected:"Secure session", private:"Private data", realtime:"Live markets", welcome:"Welcome back", welcomeSub:"Sign in to access your BLH workspace.", create:"Create your account", createSub:"Sign up to open your analysis workspace.", signin:"Sign in", signup:"Sign up", name:"Full name", namePh:"Your name", email:"Email address", emailPh:"you@example.com", password:"Password", confirm:"Confirm password", passwordPh:"At least 12 characters", passwordHint:"12 characters with uppercase, lowercase, a number and a symbol.", forgot:"Forgot password?", signinAction:"Sign in", signupAction:"Create account", security:"Your password is encrypted by Supabase and is never stored by BLH.", invalid:"Incorrect email or password.", invalidSignup:"Check the information you entered.", mismatch:"Passwords do not match.", weak:"Use at least 12 characters with uppercase, lowercase, a number and a symbol.", confirmation:"Account created. Check your email to confirm your registration.", recoverTitle:"Reset password", recoverSub:"Enter your email to receive a secure reset link.", send:"Send reset link", back:"Back to sign in", sent:"If this account exists, a reset link has been sent.", resetTitle:"Choose a new password", resetSub:"Enter a new secure password.", update:"Update password", updated:"Password updated. You can continue.", service:"Authentication is not configured yet.", loading:"Checking your session…", logout:"Sign out", show:"Show password" },
    es: { kicker:"ESPACIO PRIVADO DE TRADING", hero:"Analiza el mercado con claridad.", heroSub:"Gráficos de oro y Bitcoin, estructura de mercado e indicadores en un espacio seguro.", protected:"Sesión segura", private:"Datos privados", realtime:"Mercados en vivo", welcome:"Bienvenido de nuevo", welcomeSub:"Inicia sesión para acceder a tu espacio BLH.", create:"Crea tu cuenta", createSub:"Regístrate para abrir tu espacio de análisis.", signin:"Iniciar sesión", signup:"Registrarse", name:"Nombre completo", namePh:"Tu nombre", email:"Correo electrónico", emailPh:"tu@ejemplo.com", password:"Contraseña", confirm:"Confirmar contraseña", passwordPh:"Mínimo 12 caracteres", passwordHint:"12 caracteres con mayúscula, minúscula, número y símbolo.", forgot:"¿Olvidaste tu contraseña?", signinAction:"Iniciar sesión", signupAction:"Crear cuenta", security:"Supabase cifra tu contraseña y BLH nunca la almacena.", invalid:"Correo o contraseña incorrectos.", invalidSignup:"Revisa la información introducida.", mismatch:"Las contraseñas no coinciden.", weak:"Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo.", confirmation:"Cuenta creada. Revisa tu correo para confirmar el registro.", recoverTitle:"Restablecer contraseña", recoverSub:"Introduce tu correo para recibir un enlace seguro.", send:"Enviar enlace", back:"Volver al inicio", sent:"Si la cuenta existe, se ha enviado un enlace de restablecimiento.", resetTitle:"Elige una nueva contraseña", resetSub:"Introduce una contraseña nueva y segura.", update:"Actualizar contraseña", updated:"Contraseña actualizada. Ya puedes continuar.", service:"La autenticación aún no está configurada.", loading:"Comprobando la sesión…", logout:"Cerrar sesión", show:"Mostrar contraseña" },
    ar: { kicker:"مساحة تداول خاصة", hero:"حلّل السوق برؤية أوضح.", heroSub:"رسوم الذهب وبيتكوين وبنية السوق والمؤشرات في مساحة واحدة آمنة.", protected:"جلسة آمنة", private:"بيانات خاصة", realtime:"أسواق مباشرة", welcome:"مرحباً بعودتك", welcomeSub:"سجّل الدخول للوصول إلى مساحة BLH.", create:"أنشئ حسابك", createSub:"سجّل لفتح مساحة التحليل الخاصة بك.", signin:"تسجيل الدخول", signup:"إنشاء حساب", name:"الاسم الكامل", namePh:"اسمك", email:"البريد الإلكتروني", emailPh:"you@example.com", password:"كلمة المرور", confirm:"تأكيد كلمة المرور", passwordPh:"12 حرفاً على الأقل", passwordHint:"12 حرفاً مع حرف كبير وصغير ورقم ورمز.", forgot:"نسيت كلمة المرور؟", signinAction:"تسجيل الدخول", signupAction:"إنشاء الحساب", security:"تقوم Supabase بتشفير كلمة المرور ولا تخزنها BLH أبداً.", invalid:"البريد الإلكتروني أو كلمة المرور غير صحيحة.", invalidSignup:"تحقق من المعلومات المدخلة.", mismatch:"كلمتا المرور غير متطابقتين.", weak:"استخدم 12 حرفاً على الأقل مع حرف كبير وصغير ورقم ورمز.", confirmation:"تم إنشاء الحساب. تحقق من بريدك لتأكيد التسجيل.", recoverTitle:"إعادة تعيين كلمة المرور", recoverSub:"أدخل بريدك لتلقي رابط آمن.", send:"إرسال الرابط", back:"العودة لتسجيل الدخول", sent:"إذا كان الحساب موجوداً، فقد تم إرسال رابط إعادة التعيين.", resetTitle:"اختر كلمة مرور جديدة", resetSub:"أدخل كلمة مرور جديدة وآمنة.", update:"تحديث كلمة المرور", updated:"تم تحديث كلمة المرور. يمكنك المتابعة.", service:"لم تتم تهيئة المصادقة بعد.", loading:"جارٍ التحقق من الجلسة…", logout:"تسجيل الخروج", show:"إظهار كلمة المرور" }
  };
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
  document.body.append(gate);
  const status = gate.querySelector("#auth-status");
  const header = gate.querySelector(".auth-card-header");
  const tabs = gate.querySelector(".auth-tabs");
  const forms = Object.fromEntries(["signin","signup","recovery","reset"].map(name => [name, gate.querySelector(`#${name}-form`)]));
  const languageSelect = gate.querySelector(".auth-language select");
  languageSelect.value = language;

  function tr(key){ return copy[language][key] || key; }
  function applyLanguage(){
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", language === "ar");
    gate.querySelectorAll("[data-auth]").forEach(node => node.textContent = tr(node.dataset.auth));
    gate.querySelectorAll("[data-auth-placeholder]").forEach(node => node.placeholder = tr(node.dataset.authPlaceholder));
    gate.querySelectorAll("[data-password-toggle]").forEach(node => node.setAttribute("aria-label", tr("show")));
    renderMode();
  }
  function setStatus(message, success=false){ status.textContent = message; status.classList.toggle("success", success); }
  function setBusy(form, busy){ form.querySelectorAll("button,input").forEach(node => node.disabled = busy); }
  function renderMode(){
    const recovering = mode === "recovery" || mode === "reset";
    tabs.hidden = recovering;
    for (const [name, form] of Object.entries(forms)) form.hidden = name !== mode;
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
  gate.querySelectorAll("[data-mode]").forEach(button=>button.onclick=()=>{mode=button.dataset.mode;renderMode()});
  gate.querySelector("#forgot-password").onclick=()=>{mode="recovery";renderMode()};
  gate.querySelector("[data-back]").onclick=()=>{mode="signin";renderMode()};
  gate.querySelectorAll("[data-password-toggle]").forEach(button=>button.onclick=()=>{const input=button.parentElement.querySelector("input");input.type=input.type==="password"?"text":"password"});

  forms.signin.addEventListener("submit", async event=>{
    event.preventDefault(); setBusy(forms.signin,true); setStatus(tr("loading"));
    const data=Object.fromEntries(new FormData(forms.signin));
    try{const {response,result}=await request("auth/sign-in",{method:"POST",body:JSON.stringify(data)});if(!response.ok){setStatus(result.error==="service_not_configured"?tr("service"):tr("invalid"));return}unlock(result.user)}catch{setStatus(tr("invalid"))}finally{setBusy(forms.signin,false)}
  });
  forms.signup.addEventListener("submit", async event=>{
    event.preventDefault(); const data=Object.fromEntries(new FormData(forms.signup));
    if(data.password!==data.confirm){setStatus(tr("mismatch"));return}
    const strong=data.password.length>=12&&/[a-z]/.test(data.password)&&/[A-Z]/.test(data.password)&&/\d/.test(data.password)&&/[^A-Za-z0-9]/.test(data.password);
    if(!strong){setStatus(tr("weak"));return}
    setBusy(forms.signup,true); setStatus(tr("loading"));
    try{const {response,result}=await request("auth/sign-up",{method:"POST",body:JSON.stringify({name:data.name,email:data.email,password:data.password})});if(!response.ok){setStatus(result.error==="weak_password"?tr("weak"):result.error==="service_not_configured"?tr("service"):tr("invalidSignup"));return}if(result.confirmationRequired){setStatus(tr("confirmation"),true);forms.signup.reset();return}unlock(result.user)}catch{setStatus(tr("invalidSignup"))}finally{setBusy(forms.signup,false)}
  });
  forms.recovery.addEventListener("submit",async event=>{event.preventDefault();setBusy(forms.recovery,true);try{await request("auth/recover",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(forms.recovery)))});setStatus(tr("sent"),true)}catch{setStatus(tr("sent"),true)}finally{setBusy(forms.recovery,false)}});
  forms.reset.addEventListener("submit",async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(forms.reset));setBusy(forms.reset,true);try{const {response}=await request("auth/update-password",{method:"POST",body:JSON.stringify(data)});if(!response.ok){setStatus(tr("weak"));return}setStatus(tr("updated"),true);setTimeout(()=>unlock(user),900)}finally{setBusy(forms.reset,false)}});

  async function bootstrap(){
    applyLanguage();
    const hash=new URLSearchParams(location.hash.replace(/^#/,""));
    if(hash.get("access_token")&&hash.get("refresh_token")){
      const type=hash.get("type");
      const {response,result}=await request("auth/import-session",{method:"POST",body:JSON.stringify({accessToken:hash.get("access_token"),refreshToken:hash.get("refresh_token"),expiresIn:hash.get("expires_in")})});
      history.replaceState(null,"",location.pathname+location.search);
      if(response.ok){user=result.user;if(type==="recovery"){window.BLH_AUTH.user=user;window.BLH_AUTH.authenticated=true;mode="reset";renderMode();return}unlock(user);return}
    }
    try{const {response,result}=await request("auth/session",{method:"GET",headers:{}});if(response.ok){unlock(result.user);return}}catch{}
    lock();
  }
  bootstrap();
})();
