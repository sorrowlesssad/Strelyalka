const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;
let page;try{page=fs.readFileSync(path.join(__dirname,'index.html'))}catch{page='server ok'}
const srv=http.createServer((q,r)=>{
  if(q.url.startsWith('/health')){r.writeHead(200,{'Access-Control-Allow-Origin':'*'});return r.end('ok')}
  r.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});r.end(page);
});
const wss=new WebSocketServer({server:srv,maxPayload:4096});
const W=[{d:25,r:450,n:1},{d:9,r:100,n:1},{d:11,r:900,n:8}],NM=['Пистолет','Автомат','Дробовик'];
const IT=[{k:'skin',n:'Скин «Неон»',r:0,w:40},{k:'hp',n:'+50 HP',r:0,w:30},{k:'dbl',n:'Двойной урон 20с',r:1,w:15},{k:'spd',n:'Ускорение 15с',r:1,w:10},{k:'gun',n:'Золотое оружие',r:2,w:4},{k:'jp',n:'ДЖЕКПОТ +3 фрага',r:3,w:1}];
const C=[0xff4444,0x44ff44,0x4488ff,0xffff44,0xff44ff,0x44ffff,0xff8844,0xffffff];
const SP=[[-25,-25],[25,-25],[-25,25],[25,25],[0,-26],[0,26],[-26,0],[26,0]];
const AL='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',L=new Map();let nid=1;const now=Date.now;
const num=(v,a,b)=>{v=+v;return Number.isFinite(v)?Math.max(a,Math.min(b,v)):0};
const send=(ws,o)=>ws.readyState===1&&ws.send(JSON.stringify(o));
const all=(lb,o)=>{const s=JSON.stringify(o);for(const p of lb.players.values())p.ws.readyState===1&&p.ws.send(s)};
const newCode=()=>{let c;do{c='';for(let i=0;i<4;i++)c+=AL[Math.random()*AL.length|0]}while(L.has(c));return c};
function spawn(lb,p){const s=SP[Math.random()*SP.length|0];
  Object.assign(p,{hp:100,dead:0,x:s[0],y:0,z:s[1],ce:now()+lb.cs*1000,dbl:0,gold:-1});send(p.ws,{t:'rs',x:s[0],z:s[1]})}
function kill(lb,p,k,y){p.dead=1;p.rt=now()+3000;if(k&&k!==p)k.f++;
  all(lb,{t:'k',v:p.id,vn:p.name,k:k&&k!==p?k.id:0,kn:k?k.name:'',y:y||''})}
function enter(p,lb,name){
  p.lb=lb;p.name=String(name||'Игрок').replace(/[<>&"']/g,'').slice(0,12)||'Игрок';
  p.c=C[lb.n++%C.length];lb.players.set(p.id,p);
  send(p.ws,{t:'hi',id:p.id,code:lb.code,cs:lb.cs,it:IT.map(({k,n,r})=>({k,n,r}))});spawn(lb,p);
}
wss.on('connection',ws=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  const p={id:nid++,ws,lb:null,f:0,db:0,w:0,r:0,x:0,y:0,z:0,hp:100,dead:0,ce:0,rt:0,dbl:0,gold:-1,ls:0,lo:0};
  ws.on('message',m=>{let d;try{d=JSON.parse(m)}catch{return}
    if(!d||typeof d!=='object')return;
    if(!p.lb){
      if(d.t==='create'){
        const cs=Math.min(60,Math.max(1,Math.round(+d.cs)||30));
        const lb={code:newCode(),cs,players:new Map(),n:0};L.set(lb.code,lb);enter(p,lb,d.name);
      }else if(d.t==='join'){
        const lb=L.get(String(d.code||'').toUpperCase());
        if(!lb)return send(ws,{t:'err',m:'Лобби не найдено'});
        if(lb.players.size>=8)return send(ws,{t:'err',m:'Лобби заполнено'});
        enter(p,lb,d.name);
      }
      return;
    }
    const lb=p.lb;
    if(d.t==='u'){if(!p.dead){p.x=num(d.x,-31,31);p.y=num(d.y,0,20);p.z=num(d.z,-31,31);p.r=num(d.r,-1e4,1e4);p.w=d.w|0}}
    else if(d.t==='s'&&!p.dead&&Array.isArray(d.h)){
      const w=W[d.w|0];if(!w)return;const n=now();if(n-p.ls<w.r*.7)return;p.ls=n;
      for(const [id,c] of d.h.slice(0,8)){const v=lb.players.get(id);if(!v||v.dead||v===p)continue;
        v.hp-=w.d*Math.min(c|0,w.n)*(n<p.dbl?2:1)*(p.gold===(d.w|0)?1.5:1);
        if(v.hp<=0)kill(lb,v,p)}
    }else if(d.t==='c'&&!p.dead&&now()-p.lo>250){
      p.lo=now();let r=Math.random()*IT.reduce((a,i)=>a+i.w,0),it=IT[0];
      for(const i of IT)if((r-=i.w)<0){it=i;break}
      const o={k:it.k,n:it.n,r:it.r};
      if(it.k==='skin')p.c=Math.random()*0xffffff|0;
      else if(it.k==='hp')p.hp=Math.min(150,p.hp+50);
      else if(it.k==='dbl')p.dbl=now()+20000;
      else if(it.k==='gun'){p.gold=Math.random()*3|0;o.n='Золотой '+NM[p.gold]}
      else if(it.k==='jp')p.f+=3;
      p.ce=now()+lb.cs*1000;send(ws,{t:'d',i:o});
    }
  });
  ws.on('close',()=>{if(p.lb){p.lb.players.delete(p.id);if(!p.lb.players.size)L.delete(p.lb.code)}});
});
setInterval(()=>{const n=now();
  for(const lb of L.values()){
    const ps=[...lb.players.values()];
    for(const p of ps){
      if(p.dead){if(n>p.rt)spawn(lb,p)}
      else if(n>p.ce){p.db+=500;kill(lb,p,null,'case')}
    }
    all(lb,{t:'s',cs:lb.cs,p:ps.map(p=>({id:p.id,n:p.name,x:p.x,y:p.y,z:p.z,r:p.r,h:Math.max(0,p.hp)|0,f:p.f,d:p.dead,c:p.c,w:p.w,l:Math.max(0,p.ce-n),db:p.db}))});
  }
},50);
setInterval(()=>wss.clients.forEach(c=>{if(!c.isAlive)return c.terminate();c.isAlive=false;c.ping()}),25000);
srv.listen(PORT,'0.0.0.0',()=>console.log('listening on '+PORT));
