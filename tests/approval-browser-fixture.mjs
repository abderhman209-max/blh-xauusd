import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import handler from '../api/index.js';import {createApprovalProvider} from './account-approval-fixture.mjs';import {fixtureToken} from './auth-fixture.mjs';
process.env.SUPABASE_URL='https://approval-fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture-public';process.env.SUPABASE_SECRET_KEY='fixture-secret';
const root=path.resolve('public'),fixture=createApprovalProvider(),admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',second='33333333-3333-4333-8333-333333333333';
fixture.users.get(member).user_metadata.full_name='Compte test A';fixture.users.get(member).email='test-a@example.invalid';fixture.users.set(second,{...structuredClone(fixture.users.get(member)),id:second,email:'test-b@example.invalid',user_metadata:{full_name:'Compte test B'},email_confirmed_at:'2026-10-12T00:00:00Z'});
const headers=Object.fromEntries(JSON.parse(fs.readFileSync('vercel.json','utf8')).headers[0].headers.map(h=>[h.key,h.value]));
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:4173');
 if(url.pathname==='/__fixture'){const id=url.searchParams.get('role')==='admin'?admin:member;res.writeHead(302,{'set-cookie':'blh_access='+fixtureToken(id)+'; Path=/; HttpOnly','location':id===admin?'/#admin':'/'});return res.end();}
 if(url.pathname==='/api'){let chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const input=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});const output=await handler(input);res.writeHead(output.status,{...Object.fromEntries(output.headers),'set-cookie':output.headers.getSetCookie()});return res.end(Buffer.from(await output.arrayBuffer()));}
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};const content=fs.readFileSync(target);res.writeHead(200,{...headers,'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(content);
 }catch(error){if(!res.headersSent)res.writeHead(error.code==='ENOENT'?404:500);res.end(String(error.message));}}).listen(4173,'127.0.0.1',()=>console.log('Actual API / synthetic provider approval fixture http://127.0.0.1:4173'));

