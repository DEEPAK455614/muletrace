import puppeteer from 'puppeteer-core';
const root='/home/sandbox/muletrace';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],defaultViewport:{width:1600,height:900}});
const p=await b.newPage(); p.on('dialog',d=>d.accept());
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function go(path){await p.goto('http://127.0.0.1:5173/#'+path);await wait(1000)}
async function click(text){await p.evaluate(t=>{const e=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===t);if(!e)throw new Error('Missing '+t);e.click()},text);await wait(800)}
await go('/platform/upload');
await (await p.$('input[type=file]')).uploadFile(root+'/data/historical/synthetic-training.csv');await wait(1000);
await p.evaluate(()=>{let s=[...document.querySelectorAll('select')].find(x=>[...x.options].some(o=>o.value==='historical'));s.value='historical';s.dispatchEvent(new Event('change',{bubbles:true}))});
await click('Confirm import');console.log('HIST',await p.evaluate(()=>document.body.innerText));
await go('/platform/training');const ds=await p.$eval('select',s=>s.options[1].value);await p.select('select',ds);await click('Train model');await wait(1500);await p.screenshot({path:root+'/video/suraag-r1/captures/training.png'});console.log('TRAIN',await p.evaluate(()=>document.body.innerText));
await go('/platform/upload');await (await p.$('input[type=file]')).uploadFile(root+'/video/suraag-r1/synthetic-current.csv');await wait(900);await click('Confirm import');await go('/platform');console.log('WORKSPACE',await p.evaluate(()=>document.body.innerText));
await click('Analyse');console.log('LAUNCH',await p.evaluate(()=>document.body.innerText));
await click('Start analysis');await wait(1000);console.log('RUNURL',p.url());console.log(await p.evaluate(()=>document.body.innerText));await p.screenshot({path:root+'/video/suraag-r1/captures/dashboard.png'});
await b.close();
