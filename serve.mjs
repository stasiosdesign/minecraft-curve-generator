import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(root,relative||'index.html');if(!file.startsWith(root)){res.writeHead(403);res.end();return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8765 is already in use. Close the other local calculator, then try again.':e.message);process.exitCode=1;});
server.listen(8765,'127.0.0.1',()=>console.log('Curve generator is ready: http://127.0.0.1:8765\nOpen this address in your browser. Press Ctrl+C to stop.'));

