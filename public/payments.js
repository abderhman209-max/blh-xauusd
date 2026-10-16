/* Checkout UI. All payment creation and confirmation happen on the server. */
window.PipvoriaPayments=(()=>{
  let active=null;
  const messages={billing_not_configured:'Les paiements ne sont pas encore activés. Contactez le support.',payment_provider_unavailable:'Le prestataire ne répond pas. Aucun paiement n’a été confirmé. Réessayez plus tard.',order_in_progress:'Cette demande est déjà en cours. Attendez avant de réessayer.',order_already_paid:'Cette commande est déjà payée.',checkout_rate_limit:'Trop de demandes. Réessayez plus tard.'};
  function close(){active?.close();}
  function open(app,{orderId=null,cancelled=false}={}){
    close();if(!app.session?.user||app.session.pendingLogout)return;
    const session=app.session,epoch=session.epoch,owner=session.user.id,previous=document.activeElement,previousOverflow=document.body.style.overflow;
    const dialog=document.createElement('dialog');dialog.className='pv-checkout';dialog.setAttribute('aria-labelledby','pv-payment-title');
    dialog.innerHTML=`<form method="dialog" class="pv-payment-close"><button aria-label="Fermer">×</button></form>
      <div class="pv-payment-brand">PIPVORIA <span>CHECKOUT</span></div>
      <h2 id="pv-payment-title">Comment souhaitez-vous payer ?</h2>
      <div class="pv-payment-summary"><div><strong>Pipvoria</strong><span>Accès aux outils · 30 jours</span></div><b data-price>49,00 USD</b></div>
      <p class="pv-payment-intro">Choisissez votre moyen de paiement</p>
      <div class="pv-payment-methods" role="group" aria-label="Moyen de paiement"></div>
      <p class="pv-payment-help">Avec PayerURL, choisissez ensuite votre crypto et son réseau sur la page de paiement. Les frais éventuels sont indiqués avant l’envoi.</p>
      <label class="pv-payment-consent"><input type="checkbox"><span>J’ai vérifié le montant et je comprends qu’un paiement crypto confirmé est irréversible.</span></label>
      <p class="pv-payment-status" role="status" aria-live="polite">Chargement des moyens de paiement…</p>
      <div class="pv-payment-actions"><button type="button" data-back>Retour</button><button type="button" data-continue disabled>Continuer vers le paiement <span aria-hidden="true">→</span></button></div>
      <button type="button" class="pv-payment-refresh" data-refresh hidden>Vérifier le paiement</button>`;
    const status=dialog.querySelector('[role=status]'),next=dialog.querySelector('[data-continue]'),consent=dialog.querySelector('input[type=checkbox]'),refresh=dialog.querySelector('[data-refresh]');
    let selected='',busy=false,id=orderId,timer=null,checks=0;
    const valid=()=>active?.dialog===dialog&&session.user?.id===owner&&session.epoch===epoch&&!session.pendingLogout;
    const update=()=>{next.disabled=busy||!selected||!consent.checked;};
    const cleanup=()=>{clearTimeout(timer);if(active?.dialog===dialog)active=null;dialog.remove();document.body.style.overflow=previousOverflow;previous?.isConnected&&previous.focus();};
    dialog.addEventListener('close',cleanup,{once:true});dialog.querySelector('[data-back]').onclick=()=>dialog.close();
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    consent.onchange=update;document.body.append(dialog);document.body.style.overflow='hidden';active={dialog,close:()=>dialog.close()};dialog.showModal();
    async function check(){
      if(!valid()||!id)return;
      refresh.disabled=true;
      try {const result=await session.request('billing/status',{query:{id}});if(!valid())return;
        if(result.order.status==='paid'){status.textContent='Paiement confirmé. Votre abonnement est activé pour 30 jours supplémentaires.';status.dataset.success='true';refresh.hidden=true;await app.loadBilling();return;}
        status.textContent=cancelled?'Vous avez quitté le paiement. Aucun règlement confirmé pour cette commande.':'Paiement en attente de confirmation. Votre accès sera mis à jour après vérification.';
        if(++checks<60)timer=setTimeout(check,5000);
      }catch(error){if(valid())status.textContent=messages[error.message]||'Vérification indisponible. Vous pouvez réessayer ; aucun paiement n’est considéré comme confirmé.';}
      finally{refresh.disabled=false;}
    }
    refresh.onclick=()=>{clearTimeout(timer);check();};
    next.onclick=async()=>{
      if(!valid()||next.disabled)return;busy=true;update();next.textContent='Ouverture du paiement…';status.textContent='Création de votre commande…';
      id=crypto.randomUUID();
      try {const result=await session.request('billing/checkout',{body:{method:selected,plan:'monthly',accepted:true,orderId:id}});if(!valid())return;
        const target=new URL(result.redirectUrl);if(target.protocol!=='https:'||target.hostname!=='dash.payerurl.com'||target.username||target.password)throw Error('invalid_checkout');
        location.assign(target.href);
      }catch(error){if(valid()){status.textContent=messages[error.message]||'Impossible d’ouvrir le paiement. Aucun règlement n’a été confirmé.';next.textContent='Réessayer';busy=false;update();}}
    };
    (async()=>{try{const config=await session.request('billing/config');if(!valid())return;
      dialog.querySelector('[data-price]').textContent=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(config.plan.amountMinor/100)+' '+config.plan.currency;
      const methods=dialog.querySelector('.pv-payment-methods');
      for(const method of config.methods){const label=document.createElement('label');label.className='pv-payment-method';label.dataset.available=String(method.available);
        const radio=document.createElement('input');radio.type='radio';radio.name='payment-method';radio.value=method.id;radio.disabled=!method.available;
        if(method.available&&!selected){selected=method.id;radio.checked=true;}
        radio.onchange=()=>{selected=method.id;update();};
        const text=document.createElement('span'),title=document.createElement('strong'),description=document.createElement('small');title.textContent=method.name;description.textContent=method.description;text.append(title,description);
        label.append(radio,text);if(!method.available){const tag=document.createElement('em');tag.textContent='Indisponible';label.append(tag);}methods.append(label);}
      status.textContent=config.configured?'Le montant en crypto et les réseaux disponibles seront précisés par PayerURL.':'Les paiements ne sont pas encore activés. Vous pouvez contacter le support.';update();
      if(orderId){next.hidden=true;consent.closest('label').hidden=true;refresh.hidden=false;check();}
    }catch{if(valid())status.textContent='Impossible de charger les moyens de paiement. Fermez cette fenêtre et réessayez.';}})();
  }
  return {open,close};
})();
