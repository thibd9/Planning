const ux = require('./ux');
(async () => { const b = await ux.lancer(); const { p } = await ux.ouvrir(b, { plie: true });
 const r = await p.evaluate(() => { const out=[]; for (const e of [...document.querySelectorAll('.content *')].filter(e=>/Titulaire principal|cette semaine|1 absent/.test([...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(''))).slice(0,3)) { const ch=[]; for (let x=e;x;x=x.parentElement){const s=getComputedStyle(x); ch.push(`${x.tagName}.${String(x.className).slice(0,20)} bg=${s.backgroundColor} img=${s.backgroundImage.slice(0,30)}`); if (ch.length>8) break;} out.push(getComputedStyle(e).color+' | '+ch.join(' > ')); } return out; });
 console.log(r.join('\n\n')); await b.close(); })();
