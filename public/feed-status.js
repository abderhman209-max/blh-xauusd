/* Public feed diagnostics. Provider credentials never reach the browser. */
(function(root){
  'use strict';
  const copy={
    waiting:['Aucune donnée reçue','No data received','Sin datos recibidos','Keine Daten empfangen','لم تصل بيانات'],
    provider_not_configured:['Données XAU/USD non configurées · connexion Twelve Data requise','XAU/USD data not configured · Twelve Data connection required','Datos XAU/USD sin configurar · conexión Twelve Data necesaria','XAU/USD-Daten nicht eingerichtet · Twelve-Data-Verbindung erforderlich','بيانات الذهب غير مربوطة · يلزم ربط Twelve Data'],
    provider_unavailable:['Données du fournisseur indisponibles','Provider data unavailable','Datos del proveedor no disponibles','Anbieterdaten nicht verfügbar','بيانات المزود غير متاحة'],
    authentication_required:['Connexion au compte requise','Sign in required','Inicia sesión','Anmeldung erforderlich','يلزم تسجيل الدخول']
  };
  const allowed=reason=>Object.hasOwn(copy,reason)&&reason!=='waiting';
  function text(reason,language='en') { const index=({fr:0,en:1,es:2,de:3,ar:4,ary:4})[language]??1;return (copy[reason]||copy.provider_unavailable)[index]; }
  function read(snapshot,now=Date.now()) {
    const received=Number(snapshot?.receivedAt),age=Number.isFinite(received)&&received>0?Math.max(0,Math.floor((now-received)/1000)):null;
    return {age,stale:!!snapshot?.stale||age===null||age>120,reason:allowed(snapshot?.feedError)?snapshot.feedError:null};
  }
  root.PIPVORIA_FEED=Object.freeze({text,read,allowed});
})(typeof window!=='undefined'?window:globalThis);
