// Share public quote requests across users without sharing session responses.
export function createQuoteCache(load,{clock=()=>Date.now(),interval=1000,retryDelay=15000}={}){
  let value=null,updatedAt=0,pending=null,retryAt=0;
  return async()=>{
    const now=clock();if(value&&now-updatedAt<interval)return value;
    if(pending)return pending;
    if(now<retryAt)throw Error('price_feed_unavailable');
    pending=Promise.resolve().then(load).then(result=>{value=result;updatedAt=clock();retryAt=0;return result;},error=>{retryAt=clock()+retryDelay;throw error;}).finally(()=>pending=null);
    return pending;
  };
}
