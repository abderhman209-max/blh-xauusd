import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of ['api','lib','public'].flatMap(files).filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
const html=fs.readFileSync('public/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="(\/[^"{}]+)"/g))if(!fs.existsSync('public'+match[1]))throw Error('Missing asset: '+match[1]);
if(/(?:portal|dashboard|professional|desk|auth-overrides|future)\.(css|js)/.test(html))throw Error('Obsolete interface reference');
const runtime=fs.readFileSync('public/vendor/design-runtime.js','utf8');
if(/\bnew Function\b|\beval\s*\(/.test(runtime))throw Error('Dynamic code execution is not allowed');
console.log('Frontend, API syntax and local assets verified.');
