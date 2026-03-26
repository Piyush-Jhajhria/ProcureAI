const http=require('http'),https=require('https'),fs=require('fs'),path=require('path');
const PORT=parseInt(process.env.PORT)||3000;

function readBody(req){return new Promise((r,j)=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(d));req.on('error',j);});}
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
function send(res,code,obj){cors(res);res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));}

function proxySSE(clientRes,apiKey,body){
  cors(clientRes);
  clientRes.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache,no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  if(typeof clientRes.flushHeaders==='function')clientRes.flushHeaders();
  const bs=JSON.stringify(body);
  const req=https.request({hostname:'agent.tinyfish.ai',path:'/v1/automation/run-sse',method:'POST',timeout:600000,
    headers:{'Content-Type':'application/json','X-API-Key':apiKey,'Content-Length':Buffer.byteLength(bs)}},res=>{
    res.on('data',chunk=>{try{clientRes.write(chunk);if(typeof clientRes.flush==='function')clientRes.flush();}catch(_){}});
    res.on('end',()=>{try{clientRes.end();}catch(_){}});
  });
  req.on('timeout',()=>{req.destroy();try{clientRes.write('data: '+JSON.stringify({type:'ERROR',message:'Timeout'})+'\n\n');clientRes.end();}catch(_){}});
  req.on('error',err=>{try{clientRes.write('data: '+JSON.stringify({type:'ERROR',message:err.message})+'\n\n');clientRes.end();}catch(_){}});
  req.write(bs);req.end();
}

http.createServer(async(req,res)=>{
  const p=req.url.split('?')[0];
  if(req.method==='OPTIONS'){cors(res);res.writeHead(204);res.end();return;}
  if(req.method==='GET'&&p==='/'){
    try{const h=fs.readFileSync(path.join(__dirname,'index.html'));cors(res);res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(h);}
    catch(_){send(res,404,{error:'index.html not found'});}
    return;
  }
  if(req.method==='POST'&&p==='/api/stream'){
    let b;try{b=JSON.parse(await readBody(req));}catch(_){send(res,400,{error:'bad json'});return;}
    const{apiKey,url:u,goal,profile}=b;
    if(!apiKey||!u||!goal){send(res,400,{error:'missing fields'});return;}
    const tf={url:u,goal};if(profile==='stealth')tf.browser_profile='stealth';
    proxySSE(res,apiKey,tf);return;
  }
  send(res,404,{error:'not found'});
}).on('error',err=>{
  if(err.code==='EADDRINUSE'){console.error('Port '+PORT+' busy.\nPowerShell: $env:PORT=3001; node server.js');}
  else console.error(err.message);process.exit(1);
}).listen(PORT,()=>{
  console.log('\n  ProcureAI ready → http://localhost:'+PORT+'\n');
});