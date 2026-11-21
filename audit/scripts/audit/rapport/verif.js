const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const D='/tmp/claude-0/-home-user/e186b833-ecb1-5c7f-b97c-2e1b9d619629/scratchpad/audit/rapport/';
 for (const [w,h,n,sch] of [[1440,900,'o','light'],[390,800,'t','light'],[1440,900,'s','dark']]){
  const p=await b.newPage({viewport:{width:w,height:h},colorScheme:sch}); const err=[];
  p.on('pageerror',e=>err.push(e.message)); p.on('console',m=>{if(m.type()==='error')err.push(m.text())});
  await p.goto('http://localhost:5199/test.html'); await p.waitForSelector('#liste .page'); await p.addStyleTag({content:'html{scroll-behavior:auto!important}'}); await p.evaluate(()=>document.querySelectorAll('img').forEach(i=>i.loading='eager'));
  const r=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,pages:document.querySelectorAll('#liste .page').length,items:document.querySelectorAll('.it').length,oks:document.querySelectorAll('.okl li').length,cpt:document.getElementById('compteur').textContent,kpi:[...document.querySelectorAll('#kpi b')].map(x=>x.textContent).join('|')}));
  console.log(n,JSON.stringify(r),err.join(' ; '));
  await p.screenshot({path:D+'v-'+n+'-haut.png'});
  await p.evaluate(()=>document.getElementById('pages').scrollIntoView()); await p.waitForTimeout(300);
  await p.screenshot({path:D+'v-'+n+'-pages.png'});
  if(n==='o'){
   await p.goto('http://localhost:5199/test.html#i160'); await p.waitForTimeout(1500);
   await p.screenshot({path:D+'v-o-ancre.png'});
   await p.fill('#q','telephone'); await p.waitForTimeout(400);
   console.log('recherche', await p.textContent('#compteur'));
   await p.click('.puce[data-g="Mineur"]'); await p.waitForTimeout(200); console.log('sans mineur', await p.textContent('#compteur'));
   await p.click('[data-vue="ok"]'); await p.waitForTimeout(200); console.log('ok', await p.textContent('#compteur'));
   await p.click('#raz'); await p.waitForTimeout(200); console.log('raz', await p.textContent('#compteur'));
   await p.evaluate(()=>document.getElementById('images').scrollIntoView()); await p.waitForTimeout(800);
   await p.screenshot({path:D+'v-o-images.png'});
   await p.evaluate(()=>document.getElementById('priorites').scrollIntoView()); await p.waitForTimeout(300);
   await p.screenshot({path:D+'v-o-prio.png'});
  }
  if(n==='t'){ await p.evaluate(()=>document.getElementById('i838').scrollIntoView()); await p.waitForTimeout(300); await p.screenshot({path:D+'v-t-item.png'}); }
  await p.close();
 }
 await b.close();
})();
