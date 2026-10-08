/* All private requests use the existing HttpOnly session and account boundaries. */
(function(root){
  'use strict';
  class TerminalSession {
    user=null; epoch=0; locked=true; pendingLogout=false;
    constructor({fetcher=(...args)=>fetch(...args),storage=root.localStorage,onLock=()=>{}}={}) {
      this.fetcher=fetcher;this.storage=storage;this.onLock=onLock;
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
      if(!response.ok){if(response.status===401&&!publicRequest)this.lock(result.error);const error=Error(result.error||'request_failed');error.result=result;error.status=response.status;throw error;}
      return result;
    }
    async restore(){if(this.pendingLogout){this.lock('logout_pending');return null;}const epoch=this.epoch,data=await this.request('auth/session',{publicRequest:true});if(epoch!==this.epoch||this.pendingLogout)return null;return this.accept(data.user)?data.user:null;}
    async signOut(){this.pendingLogout=true;try{this.storage?.setItem('pipvoria-logout-pending','1');}catch{}this.lock('logout_pending');
      const result=await this.request('auth/sign-out',{publicRequest:true,body:{}});if(result.signedOut!==true)throw Error('signout_unconfirmed');
      this.pendingLogout=false;try{this.storage?.removeItem('pipvoria-logout-pending');}catch{}return true;}
  }
  root.TerminalSession=TerminalSession;
})(typeof window==='undefined'?globalThis:window);
