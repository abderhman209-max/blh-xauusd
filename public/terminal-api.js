/* All private requests use the existing HttpOnly session and account boundaries. */
(function(root){
  'use strict';
  class TerminalSession {
    user=null; epoch=0; locked=true; pendingLogout=false;
    constructor({fetcher=(...args)=>fetch(...args),storage=root.localStorage,onLock=()=>{},onPaymentRequired=()=>{}}={}) {
      this.fetcher=fetcher;this.storage=storage;this.onLock=onLock;this.onPaymentRequired=onPaymentRequired;
      try{this.pendingLogout=storage?.getItem('pipvoria-logout-pending')==='1';}catch{}
    }
    lock(reason='authentication_required') {this.epoch++;this.user=null;this.locked=true;this.onLock(reason);}
    accept(user) {if(this.pendingLogout||!user?.id)return false;this.epoch++;this.user=user;this.locked=false;return true;}
    async request(route,{body,publicRequest=false,query={},...options}={}) {
      if(!publicRequest&&(this.locked||this.pendingLogout))throw Error('authentication_required');
      const epoch=this.epoch;
      const params=new URLSearchParams({route,...query});
      const response=await this.fetcher('/api?'+params,{credentials:'same-origin',...options,
        headers:{'content-type':'application/json',...options.headers},...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{})});
      const result=await response.json().catch(()=>({error:'server_error'}));
      if(!publicRequest&&epoch!==this.epoch)throw Error('session_changed');
      if(!response.ok){if(response.status===401&&!publicRequest)this.lock(result.error);if(!publicRequest&&(response.status===402||result.error==='subscription_access_unavailable'))this.onPaymentRequired(result.error,result.access);const error=Error(result.error||'request_failed');error.result=result;error.status=response.status;throw error;}
      return result;
    }
    async restore(){if(this.pendingLogout){this.lock('logout_pending');return null;}const epoch=this.epoch,data=await this.request('auth/session',{publicRequest:true});if(epoch!==this.epoch||this.pendingLogout)return null;return this.accept(data.user)?data.user:null;}
    async stream(route,{body,signal,onEvent=()=>{}}={}){
      if(this.locked||this.pendingLogout)throw Error('authentication_required');
      const epoch=this.epoch;
      const response=await this.fetcher('/api?'+new URLSearchParams({route}),{method:'POST',credentials:'same-origin',signal,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      if(epoch!==this.epoch)throw Error('session_changed');
      if(!response.ok){
        const result=await response.json().catch(()=>({error:'server_error'}));
        if(epoch!==this.epoch)throw Error('session_changed');
        if(response.status===401)this.lock(result.error);
        if(response.status===402||result.error==='subscription_access_unavailable')this.onPaymentRequired(result.error,result.access);
        const error=Error(result.error||'request_failed');error.status=response.status;throw error;
      }
      if(!response.headers.get('content-type')?.startsWith('application/x-ndjson')||!response.body)throw Error('invalid_analysis_stream');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result;
      const line=value=>{
        if(!value.trim())return;
        const event=JSON.parse(value);
        if(epoch!==this.epoch||this.locked||this.pendingLogout)throw Error('session_changed');
        if(event.type==='error')throw Error(event.error||'analysis_unavailable');
        if(event.type==='result')result=event.result;
        else if(event.type==='stage')onEvent(event);
      };
      try{
        while(true){
          const chunk=await reader.read();
          if(epoch!==this.epoch||this.locked||this.pendingLogout)throw Error('session_changed');
          buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});
          if(buffer.length>65536)throw Error('invalid_analysis_stream');
          let end;while((end=buffer.indexOf('\n'))>=0){line(buffer.slice(0,end));buffer=buffer.slice(end+1);}
          if(chunk.done)break;
        }
        line(buffer);if(!result)throw Error('incomplete_analysis_stream');return result;
      }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    }
    async signOut(){this.pendingLogout=true;try{this.storage?.setItem('pipvoria-logout-pending','1');}catch{}this.lock('logout_pending');
      const result=await this.request('auth/sign-out',{publicRequest:true,body:{}});if(result.signedOut!==true)throw Error('signout_unconfirmed');
      this.pendingLogout=false;try{this.storage?.removeItem('pipvoria-logout-pending');}catch{}return true;}
  }
  root.TerminalSession=TerminalSession;
})(typeof window==='undefined'?globalThis:window);

