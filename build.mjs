import {readFile,writeFile} from 'node:fs/promises';
const read=name=>readFile(new URL(name,import.meta.url),'utf8');
const plain=source=>source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
const core=(await Promise.all(['geometry','curves','optimizer'].map(name=>read(`dist/${name}.js`)))).map(plain).join('\n');
const worker=core+'\n'+plain(await read('dist/worker.js'));
const app=core+'\nglobalThis.CURVE_WORKER_SOURCE='+JSON.stringify(worker)+';\n'+plain(await read('dist/layout.js'))+'\n'+plain(await read('dist/view3d.js'))+'\n'+plain(await read('dist/app.js'));
const css=(await read('dist/style.css')).replace(/^@import[^;]+;\s*/, '');
const portrait='data:image/png;base64,'+(await readFile(new URL('dist/assets/susan-boyle.png',import.meta.url))).toString('base64');
const frameSource=(await Promise.all(['layout','view3d','frame','frame-app'].map(name=>read(`dist/${name}.js`)))).map(plain).join('\n');
const frameHtml=(await read('frame-template.html')).replace('<script type="module" src="frame-app.js"></script>',()=>`<script>(()=>{
${frameSource}
})();</script>`);
await writeFile(new URL('dist/frame.html',import.meta.url),frameHtml);
const frameAttribute=frameHtml.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const html=(await read('template.html')).replace('FRAME_DOCUMENT',()=>frameAttribute).replaceAll('assets/susan-boyle.png',portrait).replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="app.js"></script>',()=>`<script>\n(()=>{\n${app}\n})();\n</script>`);
await writeFile(new URL('dist/index.html',import.meta.url),html);
await writeFile(new URL('index.html',import.meta.url),html);
console.log('Built self-contained calculator: dist/index.html and index.html');



