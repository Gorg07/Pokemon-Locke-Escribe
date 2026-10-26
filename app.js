/* DUALOCKE SUPER RR — front-end estático + Supabase.
 * Solo edita las DOS constantes siguientes al desplegar.
 * No escribas jamás una clave service_role aquí.
 */
const SUPABASE_URL = 'https://htwoumxhjzmiwnnbempi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5n2Vn1GcFGMgSiTIqaHqKQ_0UsA0sqQ';
const CONNECTED = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU_CLAVE');

const BOSSES = [ ['Petra',18], ['Marcial',23], ['Érico',30], ['Candela',40], ['Norman',44], ['Alana',50], ['Vito y Leti',60], ['Plubio',70], ['Blasco',77], ['Liga Pokémon',100] ];
const ROUTES = Array.from({length:34}, (_,i)=>`Ruta ${101+i}`).concat(['Pueblo Escaso','Pueblo Azuliza','Ciudad Petalia','Ciudad Férrica','Ciudad Portual','Ciudad Malvalona','Pueblo Verdegal','Pueblo Pardal','Ciudad Lavacalda','Pueblo Oromar','Ciudad Arborada','Ciudad Calagua','Ciudad Algaria','Arrecípolis','Ciudad Colosalia','Bosque Petalia','Cueva Granito','Cueva Fervergal','Túnel Fervegal','Monte Pírico','Cueva Cardumen','Caverna Abisal','Calle Victoria','Nueva Malvalona','Monte Cenizo','Cascada Meteoro','Desierto','Isla del Sur','Cueva Ancestral','Zonas SUPER RR (añadir manualmente)']);
const NATURES = ['Fuerte','Huraña','Audaz','Firme','Pícara','Osada','Dócil','Plácida','Agitada','Floja','Miedosa','Activa','Seria','Alegre','Ingenua','Modesta','Afable','Mansa','Tímida','Alocada','Serena','Amable','Grosera','Cauta','Rara'];
const SHUFFLES = [0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2, 2,0,1,3, 3,0,1,2, 2,0,3,1, 3,0,2,1, 1,2,0,3, 1,3,0,2, 2,1,0,3, 3,1,0,2, 2,3,0,1, 3,2,0,1, 1,2,3,0, 1,3,2,0, 2,1,3,0, 3,1,2,0, 2,3,1,0, 3,2,1,0, 0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2];
const $ = sel => document.querySelector(sel);
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => d ? new Date(d).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}) : 'Sin actualizar';
const bar = (v,total=40) => `<div class="progress"><span style="width:${Math.max(0,Math.min(100,100*v/(total||1)))}%"></span></div>`;
const unique = arr=>[...new Set(arr)];
const uid=(globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random());
const defaults={life_limit:40, gym_pf:3, ko_pf:1, egg_price:22, cap_bst:601, base_egg_weight:0.5};
const demoPeople=[{user_id:'demo-1',slot:1,display_name:'Jugador 1'},{user_id:'demo-2',slot:2,display_name:'Jugador 2'}];
const SAMPLE=[{player_id:'demo-1',trainer_name:'Jugador 1',badges:0,deaths:0,map_label:'Sin datos',updated_at:null,team_count:0},{player_id:'demo-2',trainer_name:'Jugador 2',badges:0,deaths:0,map_label:'Sin datos',updated_at:null,team_count:0}];
let SHOP = []; // Se rellena al final del archivo a partir del catálogo de precios elaborado.
function storedSession(){try{return JSON.parse(sessionStorage.getItem('dualocke_session')||'null')}catch{return null}}
let state={page:'inicio',session:storedSession(), players:demoPeople,progress:SAMPLE,routes:[],specialEncounters:[],encounterTab:'routes',catalog:[],series:[],games:[],economy:[],credits:[],claims:[],pokemon:[],settings:{...defaults},account:null,dex:{},dexReady:false,selectedRoute:'Ruta 101',selectedMapPlayer:'all',selectedCategory:'Todas',shopQuery:'',pendingSave:null,preview:null};
function toast(msg,type=''){const root=$('#toasts');if(!root)return;const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;root.append(el);setTimeout(()=>el.remove(),5500)}
function modal(title,html){const d=$('#modal');d.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" data-close="1" aria-label="Cerrar">×</button></header>${html}`;d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();return d;}
function guard(){if(!CONNECTED){toast('Modo vista previa: configura Supabase para guardar datos compartidos.','error');return false;}if(!state.account){loginModal();return false;}return true;}
function conf(k){return Number(state.settings[k]??defaults[k]??0)}
function player(n){return state.players.find(p=>p.slot===n)||demoPeople[n-1]}
function prog(n){return state.progress.find(p=>p.player_id===player(n).user_id)||SAMPLE[n-1]}
function pname(n){const p=prog(n);return p.trainer_name||player(n).display_name||`Jugador ${n}`}
function balance(playerId){return state.economy.filter(e=>e.player_id===playerId).reduce((a,e)=>a+Number(e.amount),0)}
function credits(playerId,type){return state.credits.filter(c=>c.player_id===playerId && c.type===type && !c.used_at).length}
function own(){return state.players.find(x=>x.user_id===state.account?.id)}
function detailHead(eye,title,sub,action=''){return `<div class="page-heading"><div><div class="eyebrow">${eye}</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function card(title,body,classes=''){return `<section class="card ${classes}"><div class="card-head"><h2>${title}</h2></div>${body}</section>`}
function pBadge(v,clazz=''){return `<span class="badge ${clazz}">${esc(v)}</span>`}
function pcolor(n){return n===1?'red':'blue'}
function ensurePage(){const valid=['inicio','mapa','combates','tienda','huevos','historial','ajustes'];state.page=valid.includes(location.hash.slice(1))?location.hash.slice(1):'inicio';$$('nav a');}
function $$(s){return [...document.querySelectorAll(s)]}
function render(){if(typeof document==='undefined')return;ensurePage();$$('nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===state.page));$('#crumb').textContent={inicio:'RESUMEN',mapa:'MAPA DE HOENN',combates:'COMBATES',tienda:'TIENDA',huevos:'INCUBADORA',historial:'HISTORIAL',ajustes:'CONFIGURACIÓN'}[state.page];$('#conn-label').textContent=CONNECTED ? state.account ? 'Sesión segura · Supabase' : 'Acceso requerido' : 'Vista previa · Sin sincronizar';$('#conn-dot').classList.toggle('online',CONNECTED&&!!state.account);$('#btn-account').textContent=state.account?(own()?.display_name||'✓').charAt(0).toUpperCase():'?';const sections={inicio:renderHome,mapa:renderMap,combates:renderBattles,tienda:renderShop,huevos:renderEggs,historial:renderHistory,ajustes:renderSettings};$('#screen').innerHTML=sections[state.page]();bindPage();}
function renderHome(){const first = prog(1),second=prog(2);const panels=[first,second].map((p,i)=>{const n=i+1,life=conf('life_limit')-Number(p.deaths||0);if(!state.progress.some(row=>row.player_id===player(n).user_id))return `<article class="card trainer-card ${pcolor(n)}"><div class="trainer-line"><div><div class="eyebrow">ENTRENADOR 0${n}</div><div class="trainer-name">${esc(player(n).display_name||`Jugador ${n}`)}</div></div><span class="badge">Sin partida</span></div><div class="rule-note mt-3">Este jugador todavía no ha importado ningún guardado. Sus vidas, medallas, capturas y Pokéfichas aparecerán cuando se incorpore.</div></article>`;return `<article class="card trainer-card ${pcolor(n)}"><div class="trainer-line"><div><div class="eyebrow">ENTRENADOR 0${n}</div><div class="trainer-name">${esc(pname(n))}</div></div><span class="trainer-badge">${i?'ZAFIRO':'RUBÍ'}</span></div><div class="trainer-grid"><div class="trainer-metric"><small>VIDAS RESTANTES</small><div class="large-stat">${life}<small> / ${conf('life_limit')}</small></div>${bar(life,conf('life_limit'))}</div><div class="trainer-metric"><small>POKÉFICHAS</small><div class="large-stat accent-gold">${balance(player(n).user_id)} <small>PF</small></div></div><div class="trainer-metric"><small>MEDALLAS</small><div class="large-stat">${p.badges||0}<small> / 8</small></div></div><div class="trainer-metric"><small>BAJAS</small><div class="large-stat accent-red">${p.deaths||0}</div></div></div><div class="trainer-bottom"><span>⌖ ${esc(p.map_label||'Mapa interno sin identificar')}</span><span>↻ ${esc(fmt(p.updated_at))}</span></div></article>`}).join('');const gym=Math.min(Number(first.badges||0),Number(second.badges||0)),next=BOSSES[Math.min(gym,7)];return `${detailHead('REGIÓN DE HOENN · DOS ENTRENADORES','Estado del Dualocke','Toda la aventura en un mismo lugar. La información secreta de los equipos nunca aparece en este panel.',`<button class="button" data-action="import">↑ Importar partida</button>`)}<div class="grid-2">${panels}</div><div class="metric-strip section-gap">${[["PRÓXIMO LÍMITE",next[1]+' Nv.','accent-red'],['PRÓXIMO JEFE',next[0],'accent-blue'],['COMBATES REGISTRADOS',state.series.filter(s=>s.status==='finished').length,'accent-gold']].map(([label,value,cl])=>`<div class="card"><div class="kicker">${label}</div><div class="stat-value ${cl}">${esc(value)}</div></div>`).join('')}</div><div class="columns-main section-gap">${card('Progreso de la aventura',BOSSES.map(([name,cap],i)=>`<div class="boss-line"><div class="flex"><span class="monogram">${i+1}</span><div><strong>${esc(name)}</strong><div class="small">Límite: nivel ${cap}</div></div></div><div>${pBadge(i<gym?'Superado':i===gym?'Próximo':'Pendiente',i<gym?'green':i===gym?'amber':'')}</div></div>`).join(''))}${card('Tu siguiente paso',`<p class="muted mb-3">Importa los dos guardados para activar el seguimiento de vidas, medallas, capturas y huevos. Los combates completados pueden añadirse con enlaces de replay.</p><div class="stack"><button class="button secondary full" data-action="import">↑ Subir mi archivo main</button><button class="button secondary full" data-go="combates">⚔ Registrar un BO3</button><button class="button secondary full" data-go="huevos">◌ Abrir un huevo</button><div class="rule-note">40 vidas iniciales, modificables en Ajustes. Las cajas 30 y 31 cuentan como cementerios; los huevos no cuentan como bajas.</div></div>`)}</div>`}
function routeState(id,zone){return state.routes.find(r=>r.owner_id===id && r.zone_key===zone)}
// Atlas de Hoenn. Las posiciones del tablero son propias de la aplicación.
function publicRouteStatus(zone,slot){return routeState(player(slot).user_id,zone)?.status||'unknown'}
function zoneStatuses(zone){return [1,2].map(n=>publicRouteStatus(zone,n))}
function zoneCaptureCount(zone){return zoneStatuses(zone).filter(s=>s==='captured').length}
function zoneVisualClass(zone,focus='all'){
 const statuses=zoneStatuses(zone), captured=[statuses[0]==='captured',statuses[1]==='captured'];
 const capturedCount=captured.filter(Boolean).length;
 if(focus==='all')return capturedCount===2?'state-both':capturedCount===1?'state-one':'state-none';
 const slot=Math.max(1,Math.min(2,Number(focus)||1));
 if(!captured[slot-1])return `state-none focus-slot-${slot}`;
 return `state-player focus-slot-${slot} ${capturedCount===2?'state-both':'state-one'}`;
}
function mapStatusLabel(status){return status==='captured'?'Capturada':status==='failed'?'Fallida':status==='free'?'Disponible':'Sin verificar'}
const ENCOUNTER_METHODS={unknown:'Por confirmar',grass:'Hierba',surf:'Surf',fish:'Pesca',cave:'Cueva',rock:'Golpe Roca',static:'Encuentro fijo',other:'Otro'};
const SPECIAL_KINDS={egg:'Huevo eclosionado',gift:'Regalo / inicial / fósil',bonus:'Captura extra (BO3)'};
const encounterMethod=m=>ENCOUNTER_METHODS[m]||ENCOUNTER_METHODS.unknown;
const methodOptions=selected=>Object.entries(ENCOUNTER_METHODS).map(([value,name])=>`<option value="${value}" ${value===(selected||'unknown')?'selected':''}>${esc(name)}</option>`).join('');
function isConfirmedLocation(label){return !!label && !/^Mapa interno\s+\d+/i.test(label) && label!=='Sin datos'}
function renderCurrentLocation(){
 const cards=[1,2].map(n=>{
  const p=prog(n),isLoaded=state.progress.some(x=>x.player_id===player(n).user_id);
  const current=isLoaded?(isConfirmedLocation(p.map_label)?p.map_label:`Mapa interno #${p.map_code??'?'} · sin nombre asignado`):'Sin partida importada';
  return `<div class="location-player"><div class="kicker">${esc(pname(n))}</div><div class="location-player-name">${esc(current)}</div>${isLoaded?`<span class="small">ID interno: ${p.map_code??'?'}</span>`:''}</div>`;
 }).join('');
 return `<section class="card current-location-card"><div class="between"><h2>Ubicación de los entrenadores</h2><div class="map-actions"><button type="button" class="button secondary compact" data-action="zone-add">+ Zona SUPER RR</button>${own()&&state.progress.some(x=>x.player_id===own().user_id)?'<button type="button" class="button secondary compact" data-action="location-edit">Asignar mi ubicación</button>':''}</div></div><div class="grid-2 mt-2">${cards}</div><p class="small mt-2">El ID del mapa donde se guarda la partida no es el mismo que el ID de obtención de Pokémon. Puedes asignar su nombre una vez; al importar de nuevo el mismo mapa se conservará. Si cambia el ID, se pedirá verificarlo.</p></section>`;
}
const HOENN_ATLAS = [
  {key:'Ruta 101',label:'101',x:242,y:577,w:54,h:51,kind:'route'},
  {key:'Ruta 102',label:'102',x:165,y:516,w:53,h:30,kind:'route'},
  {key:'Ruta 103',label:'103',x:336,y:467,w:183,h:36,kind:'route'},
  {key:'Ruta 104',label:'104',x:40,y:445,w:44,h:76,kind:'route'},
  {key:'Ruta 110',label:'110',x:442,y:470,w:49,h:165,kind:'route'},
  {key:'Ruta 111',label:'111',x:444,y:188,w:54,h:201,kind:'route'},
  {key:'Ruta 112',label:'112',x:370,y:294,w:90,h:33,kind:'route'},
  {key:'Ruta 113',label:'113',x:435,y:109,w:137,h:36,kind:'route'},
  {key:'Ruta 114',label:'114',x:154,y:108,w:105,h:69,kind:'route'},
  {key:'Ruta 115',label:'115',x:55,y:228,w:54,h:149,kind:'route'},
  {key:'Ruta 116',label:'116',x:226,y:332,w:223,h:34,kind:'route'},
  {key:'Ruta 117',label:'117',x:422,y:365,w:95,h:31,kind:'route'},
  {key:'Ruta 118',label:'118',x:610,y:365,w:132,h:33,kind:'route'},
  {key:'Ruta 119',label:'119',x:567,y:206,w:65,h:237,kind:'route'},
  {key:'Ruta 120',label:'120',x:723,y:175,w:59,h:194,kind:'route'},
  {key:'Ruta 121',label:'121',x:831,y:261,w:196,h:34,kind:'route'},
  {key:'Ruta 123',label:'123',x:715,y:366,w:140,h:33,kind:'route'},
  {key:'Ruta 105',label:'105',x:39,y:602,w:51,h:140,kind:'water'},
  {key:'Ruta 106',label:'106',x:112,y:665,w:108,h:31,kind:'water'},
  {key:'Ruta 107',label:'107',x:240,y:716,w:113,h:31,kind:'water'},
  {key:'Ruta 108',label:'108',x:337,y:716,w:84,h:31,kind:'water'},
  {key:'Ruta 109',label:'109',x:441,y:695,w:50,h:105,kind:'water'},
  {key:'Ruta 122',label:'122',x:852,y:379,w:51,h:153,kind:'water'},
  {key:'Ruta 124',label:'124',x:975,y:265,w:143,h:60,kind:'water'},
  {key:'Ruta 125',label:'125',x:1232,y:283,w:95,h:81,kind:'water'},
  {key:'Ruta 126',label:'126',x:1036,y:391,w:83,h:111,kind:'water'},
  {key:'Ruta 127',label:'127',x:1215,y:394,w:99,h:190,kind:'water'},
  {key:'Ruta 128',label:'128',x:1262,y:603,w:69,h:55,kind:'water'},
  {key:'Ruta 129',label:'129',x:1212,y:638,w:94,h:35,kind:'water'},
  {key:'Ruta 130',label:'130',x:1096,y:635,w:101,h:35,kind:'water'},
  {key:'Ruta 131',label:'131',x:977,y:618,w:98,h:37,kind:'water'},
  {key:'Ruta 132',label:'132',x:834,y:605,w:101,h:36,kind:'water'},
  {key:'Ruta 133',label:'133',x:730,y:604,w:103,h:36,kind:'water'},
  {key:'Ruta 134',label:'134',x:600,y:605,w:103,h:36,kind:'water'},
  {key:'Pueblo Pardal',label:'Pueblo Pardal',x:300,y:105,w:104,h:42,kind:'city'},
  {key:'Ciudad Arborada',label:'Ciudad Arborada',x:635,y:102,w:120,h:42,kind:'city'},
  {key:'Ciudad Lavacalda',label:'Pueblo Lavacalda',x:467,y:305,w:116,h:42,kind:'city'},
  {key:'Ciudad Calagua',label:'Ciudad Calagua',x:950,y:205,w:108,h:42,kind:'city'},
  {key:'Ciudad Férrica',label:'Ciudad Férrica',x:55,y:330,w:99,h:42,kind:'city'},
  {key:'Pueblo Verdegal',label:'Pueblo Verdegal',x:375,y:358,w:105,h:42,kind:'city'},
  {key:'Ciudad Malvalona',label:'Ciudad Malvalona',x:492,y:368,w:115,h:42,kind:'city'},
  {key:'Ciudad Petalia',label:'Ciudad Petalia',x:109,y:505,w:107,h:42,kind:'city'},
  {key:'Pueblo Escaso',label:'Pueblo Escaso',x:239,y:515,w:98,h:42,kind:'city'},
  {key:'Villa Raíz',label:'Villa Raíz',x:242,y:628,w:94,h:42,kind:'city'},
  {key:'Pueblo Azuliza',label:'Pueblo Azuliza',x:117,y:710,w:102,h:42,kind:'city'},
  {key:'Ciudad Portual',label:'Ciudad Portual',x:437,y:619,w:109,h:42,kind:'city'},
  {key:'Pueblo Oromar',label:'Pueblo Oromar',x:891,y:554,w:110,h:42,kind:'city'},
  {key:'Ciudad Algaria',label:'Ciudad Algaria',x:1100,y:282,w:110,h:42,kind:'city'},
  {key:'Arrecípolis',label:'Arrecípolis',x:1040,y:475,w:103,h:42,kind:'city'},
  {key:'Ciudad Colosalia',label:'Ciudad Colosalia',x:1273,y:548,w:118,h:42,kind:'city'},
  {key:'Frente Batalla',label:'Frente Batalla',x:1122,y:693,w:108,h:42,kind:'city'},
  {key:'Bosque Petalia',label:'Bosque Petalia',x:44,y:383,w:44,h:30,kind:'special'},
  {key:'Cueva Granito',label:'Cueva Granito',x:117,y:749,w:52,h:32,kind:'special'},
  {key:'Túnel Fervegal',label:'Túnel Fervegal',x:340,y:326,w:55,h:30,kind:'special'},
  {key:'Cascada Meteoro',label:'Cascada Meteoro',x:54,y:152,w:48,h:33,kind:'special'},
  {key:'Monte Cenizo',label:'Monte Cenizo',x:340,y:205,w:47,h:31,kind:'special'},
  {key:'Desierto',label:'Desierto',x:512,y:171,w:45,h:31,kind:'special'},
  {key:'Senda Ígnea',label:'Senda Ígnea',x:350,y:255,w:45,h:31,kind:'special'},
  {key:'Monte Pírico',label:'Monte Pírico',x:865,y:442,w:48,h:31,kind:'special'},
  {key:'Cueva Cardumen',label:'Cueva Cardumen',x:1232,y:209,w:47,h:32,kind:'special'},
  {key:'Caverna Abisal',label:'Caverna Abisal',x:1242,y:486,w:47,h:31,kind:'special'},
  {key:'Cueva Ancestral',label:'Cueva Ancestral',x:1035,y:425,w:47,h:31,kind:'special'},
  {key:'Calle Victoria',label:'Calle Victoria',x:1299,y:500,w:43,h:28,kind:'special'},
  {key:'Nueva Malvalona',label:'Nueva Malvalona',x:547,y:430,w:43,h:31,kind:'special'},
  {key:'Malvamar',label:'Malvamar',x:332,y:656,w:43,h:30,kind:'special'},
  {key:'Pilar Celeste',label:'Pilar Celeste',x:976,y:663,w:43,h:30,kind:'special'},
  {key:'Isla del Sur',label:'Isla del Sur',x:685,y:710,w:43,h:30,kind:'special'},
  {key:'Zona Safari',label:'Zona Safari',x:832,y:213,w:47,h:30,kind:'special'},
  {key:'Cueva Fervergal',label:'Cueva Fervergal',x:299,y:300,w:43,h:29,kind:'special'},
];
function renderMap(){
 const selected=state.selectedRoute;
 const focus=['all','1','2'].includes(String(state.selectedMapPlayer||'all'))?String(state.selectedMapPlayer||'all'):'all';
 const search=(state.mapSearch||'').trim().toLocaleLowerCase('es');
 const filter=state.selectedMapFilter||'all';
 const typeFilter=state.hoennTypeFilter||'all';
 const atlasByKey=new Map(HOENN_ATLAS.map(z=>[z.key,z]));
 const zones=unique([...HOENN_ATLAS.map(z=>z.key),...ROUTES.filter(z=>z!=='Zonas SUPER RR (añadir manualmente)'),...state.routes.map(r=>r.zone_key)]);
 const capturedIn=(name,slot)=>publicRouteStatus(name,slot)==='captured';
 const statusCount=name=>Number(capturedIn(name,1))+Number(capturedIn(name,2));
 const visible=z=>{
  const item=atlasByKey.get(z),count=statusCount(z);
  const mine=focus==='all'?false:capturedIn(z,Number(focus));
  if(search&&!z.toLocaleLowerCase('es').includes(search))return false;
  if(typeFilter!=='all' && (item?.kind||'special')!==typeFilter && !(typeFilter==='route'&&item?.kind==='water'))return false;
  if(filter==='one'&&count!==1||filter==='both'&&count!==2||filter==='none'&&count!==0)return false;
  if(filter==='my-captured' && (focus==='all'?count===0:!mine))return false;
  if(filter==='failed' && ![1,2].some(n=>publicRouteStatus(z,n)==='failed'))return false;
  return true;
 };
 const visibleZones=zones.filter(visible);
 const visibleSet=new Set(visibleZones);
 const focusName=focus==='all'?'Ambos jugadores':pname(Number(focus));
 const colorClass=z=>zoneVisualClass(z,focus);
 const getTitle=z=>`${z.key}: ${[1,2].map(n=>`${pname(n)}: ${mapStatusLabel(publicRouteStatus(z.key,n))}`).join(' · ')}`;
 const mapShape=z=>{
  const active=z.key===selected,dim=!visibleSet.has(z.key);
  const isSquare=z.kind==='special';
  const cssKind=(z.kind==='water'?'water':z.kind);
  const w=z.w,h=z.h;
  const label=z.kind==='special'?'◆':z.label;
  const isTall=h>76&&w<75;
  const title=getTitle(z);
  return `<g class="atlas-zone atlas-${cssKind} ${colorClass(z.key)} ${active?'active':''} ${dim?'atlas-dim':''}" data-route="${esc(z.key)}" tabindex="0" role="button" aria-pressed="${active}" aria-label="${esc(title)}" transform="translate(${z.x} ${z.y})"><title>${esc(title)}</title><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${isSquare?5:6}"/><text class="${isTall?'atlas-vertical':''}" x="0" y="1" ${isTall?'transform="rotate(-90)"':''}>${esc(label)}</text></g>`;
 };
 const boardSvg=`<div class="atlas-scroll" tabindex="0" role="region" aria-label="Mapa interactivo de Hoenn. Desplaza horizontalmente si es necesario"><svg class="atlas-map" viewBox="0 0 1360 780" xmlns="http://www.w3.org/2000/svg" data-focus="${focus}" aria-label="Mapa de rutas, pueblos y lugares especiales de Hoenn"><defs><pattern id="atlas-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#ffffff" stroke-opacity=".065"/></pattern><linearGradient id="atlas-sea" x2="0.9" y2="1"><stop stop-color="#298ac9"/><stop offset="1" stop-color="#174c83"/></linearGradient><linearGradient id="atlas-land" x2="1" y2="1"><stop stop-color="#2b946d"/><stop offset="1" stop-color="#186c59"/></linearGradient></defs>
  <rect width="1360" height="780" fill="url(#atlas-sea)"/><rect width="1360" height="780" fill="url(#atlas-grid)"/>
  <g class="atlas-geography" aria-hidden="true">
   <path d="M20 118 L46 74 154 74 154 55 368 55 410 72 612 58 700 88 785 93 872 137 939 158 969 208 923 278 899 335 842 386 812 437 735 475 652 485 620 521 528 516 500 557 478 559 422 535 390 551 350 529 300 544 267 515 217 514 173 472 146 431 115 429 106 394 76 390 48 359 30 310 18 262Z" fill="url(#atlas-land)" stroke="#56c29f" stroke-width="3"/>
   <path d="M5 538 H193 V651 H40 V761 H5Z" fill="url(#atlas-land)" opacity=".93" stroke="#56c29f" stroke-width="2"/>
   <path d="M210 597 H283 V657 H210Z" fill="url(#atlas-land)" opacity=".93"/>
   <path d="M1005 345 C1047 333 1110 349 1130 400 L1119 474 1066 502 1015 474Z" fill="url(#atlas-land)" opacity=".85" stroke="#56c29f" stroke-width="2"/>
   <path d="M1144 549 L1246 529 1308 572 1308 651 1198 656 1148 631Z" fill="url(#atlas-land)" opacity=".9" stroke="#56c29f" stroke-width="2"/>
   <path d="M1051 638 L1209 638 1232 708 1060 713Z" fill="url(#atlas-land)" opacity=".87" stroke="#56c29f" stroke-width="2"/>
   <path d="M839 516 L912 513 935 566 831 585Z" fill="url(#atlas-land)" opacity=".78" stroke="#56c29f" stroke-width="2"/>
   <path d="M653 675 Q713 644 766 672 L759 739 677 732Z" fill="url(#atlas-land)" opacity=".72" stroke="#56c29f" stroke-width="2"/>
  </g>
  <g class="atlas-contours" aria-hidden="true"><path d="M114 202 Q286 137 413 209 T862 255"/><path d="M135 328 Q318 265 540 318 T883 354"/><path d="M151 454 Q338 405 499 451 T821 445"/></g>
  <g class="atlas-name" aria-hidden="true"><text x="42" y="42">HOENN</text><text x="192" y="38">REGIÓN 03 · ORAS</text><text x="1090" y="92">MAR DEL ESTE</text></g>
  <g class="atlas-zones">${HOENN_ATLAS.map(mapShape).join('')}</g></svg></div>`;
 const details=[1,2].map(slot=>{
  const r=routeState(player(slot).user_id,selected),status=r?.status||'unknown';
  return `<div class="atlas-detail-player ${status==='captured'?'captured':''}"><div class="atlas-player-heading"><span class="atlas-avatar">${slot}</span><strong>${esc(pname(slot))}</strong>${pBadge(mapStatusLabel(status),status==='captured'?'green':status==='failed'?'red':'')}</div>${status==='captured'?`<div class="atlas-nickname">${esc(r.nickname||'Apodo pendiente')}</div><div class="atlas-attrs"><span>${r.capture_level?'Nv. '+Number(r.capture_level):'Nivel sin verificar'}</span><span>${esc(encounterMethod(r.encounter_method))}</span><span>${r.stat_total!=null?Number(r.stat_total)+' stats':'Stats sin verificar'}</span></div>`:`<p class="small">${status==='failed'?'Intento fallido: ya no disponible.':status==='free'?'Captura disponible (confirmada).':'Aún no se ha verificado el estado.'}</p>`}</div>`;
 }).join('');
 const list=visibleZones.map(zone=>{
  const z=atlasByKey.get(zone),status=statusCount(zone);
  return `<button class="atlas-location ${selected===zone?'selected':''}" type="button" data-route="${esc(zone)}"><span class="atlas-location-icon ${z?.kind||'special'}">${z?.kind==='water'?'≈':z?.kind==='city'?'■':z?.kind==='special'?'◆':'▬'}</span><span class="atlas-location-text"><strong>${esc(z?(z.kind==='route'||z.kind==='water'?'Ruta '+z.label:z.label):zone)}</strong><small>${z?(z.kind==='city'?'Ciudad o pueblo':z.kind==='special'?'Lugar especial':z.kind==='water'?'Ruta marítima':'Ruta terrestre'):'Zona personalizada'}</small></span><span class="atlas-progress">${status}/2</span></button>`;
 }).join('');
 const sumCaptures=(slot)=>zones.filter(z=>capturedIn(z,slot)).length;
 const totalBoth=zones.filter(z=>statusCount(z)===2).length;
 const tabs=[['all','Resumen'],['1',pname(1)],['2',pname(2)]].map(([v,label])=>`<button class="atlas-tab ${focus===v?'active':''}" type="button" data-map-view="${v}" aria-pressed="${focus===v}">${esc(label)}</button>`).join('');
 const options=(entries,val)=>entries.map(([v,t])=>`<option value="${v}" ${v===val?'selected':''}>${esc(t)}</option>`).join('');
 return `${detailHead('REGIÓN DE HOENN','Atlas de capturas','Un mapa interactivo para saber dónde habéis utilizado la captura normal, sin revelar especies ni Pokémon posibles.')}${renderCurrentLocation()}
 <section class="atlas-shell section-gap" aria-label="Atlas de capturas de Hoenn"><div class="atlas-toolbar"><div><div class="kicker">POKÉNAV · RUTAS DE HOENN</div><h2>Explorar Hoenn</h2><p class="small">${zones.length} zonas registradas · ${sumCaptures(1)} de ${esc(pname(1))} · ${sumCaptures(2)} de ${esc(pname(2))} · ${totalBoth} compartidas</p></div><div class="atlas-tabs" role="group" aria-label="Elegir el mapa del jugador">${tabs}</div></div>
 <div class="atlas-columns"><div class="atlas-main">${boardSvg}<div class="atlas-key"><span><i class="k-none"></i> Sin confirmar captura</span><span><i class="k-one"></i> ${focus==='all'?'Capturada por uno':'Capturada por este jugador'}</span>${focus==='all'?'<span><i class="k-both"></i> Capturada por ambos</span>':''}</div><p class="atlas-hint">En gris hasta registrar la captura. Los colores permiten distinguir rápidamente las zonas utilizadas; consulta la ficha para ver su estado exacto. Las figuras son las áreas clicables.</p></div>
 <aside class="atlas-side" aria-label="Buscar y consultar zonas"><div class="atlas-search"><label for="route-search" class="small">Buscar ubicación</label><input id="route-search" type="search" class="field" value="${esc(state.mapSearch||'')}" placeholder="Ej. Ruta 101, Bosque Petalia"></div><div class="atlas-filter-row"><select class="select" id="atlas-type-filter" aria-label="Tipo de zona">${options([['all','Todos los tipos'],['route','Rutas terrestres'],['water','Rutas de agua'],['city','Ciudades y pueblos'],['special','Lugares especiales']],typeFilter)}</select><select class="select" id="map-filter" aria-label="Estado de captura">${options([['all','Todos los estados'],['none','Ninguna captura'],['one','Solo uno'],['both','Ambos'],['my-captured','Capturadas en vista'],['failed','Intento fallido']],filter)}</select></div><div class="atlas-count">${visibleZones.length} ubicaciones encontradas</div><div class="atlas-index">${list||'<p class="empty">No hay zonas con esos filtros.</p>'}</div><div class="atlas-selection"><div class="atlas-selection-head"><div><span class="kicker">ZONA SELECCIONADA</span><h3>${esc(atlasByKey.get(selected)&&['route','water'].includes(atlasByKey.get(selected).kind)?'Ruta '+atlasByKey.get(selected).label:(atlasByKey.get(selected)?.label||selected))}</h3></div><button class="button compact secondary" type="button" data-action="route-edit">Editar</button></div>${details}</div></aside></div></section>
 ${renderEncounterTracker()}`;
}

/* Registro público: no renderiza especies, habilidades, movimientos, IV ni Pokémon todavía en huevo. */
function renderEncounterTracker(){
 const tab=state.encounterTab==='special'?'special':'routes';
 const allZones=unique([...ROUTES.filter(z=>z!=='Zonas SUPER RR (añadir manualmente)'),...HOENN_ATLAS.map(n=>n.key),...state.routes.map(r=>r.zone_key)]).filter(Boolean);
 const normal=allZones.map(zone=>{
  const rows=[1,2].map(slot=>{
   const r=routeState(player(slot).user_id,zone),status=r?.status||'unknown';
   const detail=status==='captured'
    ? `<strong>${esc(r.nickname||'Apodo pendiente')}</strong><span>${r.capture_level?'Nv. '+Number(r.capture_level):'Nv. por confirmar'} · ${esc(encounterMethod(r.encounter_method))} · ${r.stat_total==null?'Estadísticas pendientes':Number(r.stat_total)+' stats'}</span>`
    : `<span>${esc(mapStatusLabel(status))}</span>`;
   return `<div class="enc18-player ${status}"><small>J${slot} · ${esc(pname(slot))}</small>${detail}</div>`;
  }).join('');
  const count=zoneCaptureCount(zone);
  return `<button type="button" class="enc18-route ${zone===state.selectedRoute?'active':''}" data-route="${esc(zone)}"><span class="enc18-route-name">${esc(zone)}</span><span class="enc18-count">${count}/2</span><div class="enc18-player-grid">${rows}</div></button>`;
 }).join('');
 const extras=[...state.specialEncounters].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
 const grouped=extras.length?extras.map(entry=>{
   const slot=state.players.find(p=>p.user_id===entry.owner_id)?.slot||'?';
   const mine=entry.owner_id===own()?.user_id;
   return `<article class="enc18-extra"><div class="enc18-extra-top"><span class="enc18-type">${esc(SPECIAL_KINDS[entry.kind]||'Especial')}</span><span class="small">J${slot} · ${esc(slot==='?'?'Jugador':pname(slot))}</span></div><h3>${esc(entry.nickname||'Sin apodo')}</h3><p class="small">${entry.capture_level?'Nv. '+Number(entry.capture_level)+' · ':''}${entry.stat_total!=null?Number(entry.stat_total)+' stats · ':''}${esc(encounterMethod(entry.encounter_method))}</p><p class="small">Zona: ${esc(entry.zone_key||'No indicada')} · No consume captura normal</p>${mine?`<button class="button secondary compact" type="button" data-special-edit="${esc(entry.id)}">Editar</button> <button class="button ghost compact" type="button" data-special-remove="${esc(entry.id)}">Eliminar</button>`:''}</article>`;
  }).join(''):'<p class="empty">Aún no hay huevos eclosionados ni regalos registrados. Los huevos sin eclosionar no se muestran.</p>';
 return `<section class="card enc18-panel section-gap"><div class="enc18-heading"><div><div class="kicker">REGISTRO DE ENCUENTROS</div><h2>Capturas por ubicación</h2><p class="small">Sin especies ni lista de encuentros del randomizer. Los datos confirmados se conservan al volver a importar.</p></div><div class="enc18-tabs" role="group" aria-label="Tipo de captura"><button type="button" data-encounter-tab="routes" aria-pressed="${tab==='routes'}" class="${tab==='routes'?'active':''}">Capturas normales</button><button type="button" data-encounter-tab="special" aria-pressed="${tab==='special'}" class="${tab==='special'?'active':''}">Huevos y regalos</button></div></div>${tab==='routes'?`<p class="small mb-3">Selecciona una zona para consultar o corregir la captura normal. Gris significa «sin captura confirmada», no necesariamente disponible.</p><div class="enc18-grid">${normal}</div>`:`<div class="enc18-special-bar"><p class="small">Solo Pokémon ya eclosionados o recibidos; también capturas extra. Ninguno consume la captura normal de la ruta.</p><button type="button" class="button compact" data-action="special-add">+ Registrar especial</button></div><div class="enc18-special-grid">${grouped}</div>`}</section>`;
}

function renderBattles(){const latest=[...state.series].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));const current=latest.find(s=>s.status==='open');const cards=latest.map(s=>{const games=state.games.filter(g=>g.series_id===s.id).sort((a,b)=>a.game_no-b.game_no);return `<div class="card"><div class="between mb-2"><h3>BO3 · ${fmt(s.created_at)}</h3>${pBadge(s.status==='finished'?'Finalizado':'En curso',s.status==='finished'?'green':'amber')}</div><div class="flex mb-2">${games.map(g=>`<span class="badge">#${g.game_no} · ${esc(g.winner_name||'—')} · ${Number(g.kos_1||0)}–${Number(g.kos_2||0)} KO</span>`).join('')}</div>${games.map(g=>`<p class="small"><a href="${esc(g.replay_url)}" target="_blank" rel="noopener">Repetición ${g.game_no} ↗</a></p>`).join('')}<p class="small mt-2">${s.status==='finished'?'Recompensas entregadas.':'Se cerrará cuando haya dos victorias de un jugador.'}</p></div>`}).join('');const reveals= [1,2].map(n=>{const monMap=new Map();state.games.forEach(g=>(g.reveals||[]).filter(r=>Number(r.player_slot)===n).forEach(r=>{const k=(r.nickname||r.species||'').toLowerCase()+'|'+(r.species||'').toLowerCase();if(!k.trim())return;const ex=monMap.get(k)||{...r,moves:[]};ex.moves=unique([...(ex.moves||[]),...(r.moves||[])]);ex.ability=r.ability||ex.ability;ex.item=r.item||ex.item;monMap.set(k,ex)}));const mons=[...monMap.values()].slice(-18);return `<div class="card"><div class="between mb-3"><h3>Pokémon revelados · ${esc(pname(n))}</h3>${pBadge(mons.length+' conocidos','blue')}</div><div class="reveal-grid">${mons.length?mons.map(m=>`<div class="reveal-mon"><div class="monogram">${esc((m.species||'?').slice(0,1))}</div><h4>${esc(m.species||'Desconocido')}</h4><div class="details">${m.nickname?esc(m.nickname)+' · ':''}${esc((m.moves||[]).join(', ')||'Movimientos ?')}</div><div class="details">Habilidad: ${esc(m.ability||'?')} · Objeto: ${esc(m.item||'?')}</div></div>`).join(''):'<div class="empty" style="grid-column:1/-1">Aún no hay Pokémon revelados.</div>'}</div></div>`}).join('');return `${detailHead('PVP · MEJOR DE TRES','Arena Showdown','Introduce los enlaces de replay cuando terminéis las partidas. La web extrae resultados, KO e información pública de combate.',`<button class="button" data-action="new-series">+ Nuevo BO3</button>`)}<div class="grid-3 mb-3">${[['COMBATES FINALIZADOS',latest.filter(x=>x.status==='finished').length],['SERIES PENDIENTES',latest.filter(x=>x.status!=='finished').length],['RECOMPENSA POR SERIE','+1 captura · +1 huevo al ganador']].map(([a,b])=>`<div class="card"><div class="kicker">${a}</div><div class="stat-value">${esc(b)}</div></div>`).join('')}</div>${card('Importar replay',`<p class="muted mb-3">Usa el enlace público <strong>replay.pokemonshowdown.com/…</strong>. Las salas psim.us/r no son replays permanentes.</p><form id="replay-form" class="stack"><div class="form-grid"><div><label class="form-label">Serie</label><select class="select" id="replay-series" required>${latest.filter(x=>x.status==='open').map(s=>`<option value="${esc(s.id)}">BO3 · ${fmt(s.created_at)}</option>`).join('')}</select></div><div><label class="form-label">Partida del BO3</label><select id="replay-number" class="select">${[1,2,3].map(n=>`<option>${n}</option>`).join('')}</select></div></div><div><label class="form-label">Enlace</label><input class="field" style="width:100%" id="replay-url" type="url" placeholder="https://replay.pokemonshowdown.com/gen6ou-…" required></div><button class="button" type="submit" ${!current?'disabled':''}>Importar y analizar combate</button></form>`) }<div class="grid-2 section-gap">${reveals}</div><div class="section-gap"><div class="between mb-3"><h2>Historial de series</h2></div><div class="grid-2">${cards||'<div class="empty" style="grid-column:1/-1">Todavía no habéis registrado ningún BO3.</div>'}</div></div>`}
function renderShop(){const cats=unique(state.catalog.map(i=>i.category));const chosen=state.selectedCategory;const matches=state.catalog.filter(i=>(chosen==='Todas'||i.category===chosen)&&(!state.shopQuery||String(i.name).toLowerCase().includes(state.shopQuery.toLowerCase())));return `${detailHead('SISTEMA ECONÓMICO','Mercado de Pokéfichas','Artículos ilimitados, sin medicinas ni Caramelos Raros. El precio queda registrado en cada compra.',`<span class="badge amber">Stock ilimitado</span>`)}<div class="grid-2 mb-3">${[1,2].map(n=>`<div class="card between"><div><div class="kicker">${esc(pname(n))}</div><div class="stat-value accent-gold">${balance(player(n).user_id)} PF</div></div><div class="shop-icon">◉</div></div>`).join('')}</div><div class="card"><div class="shop-controls"><input class="field" id="shop-search" placeholder="Buscar cualquier objeto, MT, megapiedra…" value="${esc(state.shopQuery)}" /><select id="shop-cat" class="select"><option>Todas</option>${cats.map(c=>`<option ${chosen===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="shop-grid">${matches.slice(0,200).map(i=>`<article class="shop-item"><div class="between"><span class="shop-icon">${i.category?.includes('Mega')?'◇':i.category==='MT'?'▣':i.category?.includes('Ball')?'◉':'✦'}</span><span class="small">${esc(i.category)}</span></div><h3>${esc(i.name)}</h3><div class="small">${Number(i.quantity)>1?`Lote de ${i.quantity}`:'1 unidad'} · Sin límite de existencias</div><div class="shop-item-bottom"><span class="shop-price">${i.price} <small>PF</small></span><button class="button secondary compact" data-buy="${esc(i.id)}">Comprar</button></div></article>`).join('')||'<div class="empty">No hay artículos que coincidan.</div>'}</div>${matches.length>200?`<p class="small mt-3">Mostrando los primeros 200 de ${matches.length}; utiliza el buscador.</p>`:''}</div>`}
function renderEggs(){const mine=own();const playerId=mine?.user_id;const owns=(state.pokemon||[]).filter(p=>p.owner_id===playerId && p.is_egg&&p.present&&!p.claimed);const otherIds=[1,2];return `${detailHead('INCUBADORA · SUPER RR','Huevos ponderados','La probabilidad de cada huevo varía según las vidas y la calidad de las plantillas. Nunca se revela su contenido.',`<span class="badge amber">Sorteo irreversible</span>`)}<div class="grid-2 mb-3">${otherIds.map(n=>`<div class="card"><div class="kicker">${esc(pname(n))}</div><div class="between mt-2"><div><div class="stat-value">${credits(player(n).user_id,'egg')}</div><div class="small">Créditos para abrir</div></div><div class="shop-icon">◌</div></div></div>`).join('')}</div><div class="egg-layout">${card('Tu siguiente huevo',`<div class="egg-podium"><div class="egg-art" aria-hidden="true"></div><div class="egg-result">${state.claims.filter(c=>c.player_id===playerId)[0]?`Caja ${state.claims.filter(c=>c.player_id===playerId).slice(-1)[0].box_num} · Posición ${state.claims.filter(c=>c.player_id===playerId).slice(-1)[0].slot_num}`:'Identidad desconocida'}</div><p class="small mt-2">${mine?`Huevos pendientes: ${owns.length}`:'Inicia sesión para consultar tus huevos'}</p></div><button class="button full mt-3" data-action="draw-egg">Sortear un huevo</button><div class="notice mt-3">Una vez confirmado el sorteo, no podrás repetirlo para escoger otro. Solo se muestra la ubicación.</div>`)}${card('Cómo se decide',`<ol class="steps"><li>Se comprueban las vidas restantes de ambos jugadores.</li><li>Se evalúan las seis mejores criaturas vivas de cada uno.</li><li>Se valora cada huevo elegible por su BST y distribución estadística, sin penalizar Ausente.</li><li>El jugador en desventaja recibe más posibilidades de huevos fuertes, sin garantizar ninguno.</li><li>El sistema guarda caja y posición del elegido sin revelar especie, IV ni naturaleza.</li></ol><div class="rule-note">Quedan excluidos los huevos cuyo Pokémon supera 601 BST, salvo Slaking. También los que ya se hayan asignado.</div>`)}</div><div class="section-gap">${card('Historial de sorteos',state.claims.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Jugador</th><th>Resultado</th><th>Fecha</th></tr></thead><tbody>${state.claims.map(c=>`<tr><td>${esc(state.players.find(p=>p.user_id===c.player_id)?.display_name||'Jugador')}</td><td>Caja ${c.box_num}, posición ${c.slot_num}</td><td>${fmt(c.created_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Ningún huevo sorteado todavía.</div>')}</div>`}
function renderHistory(){const entries=[...state.economy.map(x=>({when:x.created_at,heading:`${Number(x.amount)>0?'+':''}${x.amount} PF · ${x.kind}`,desc:state.players.find(p=>p.user_id===x.player_id)?.display_name||'Jugador'})),...state.series.map(s=>({when:s.created_at,heading:'Enfrentamiento BO3 · '+(s.status==='finished'?'finalizado':'en curso'),desc:'Pokémon Showdown'})),...state.progress.filter(p=>p.updated_at).map(p=>({when:p.updated_at,heading:'Partida actualizada',desc:p.trainer_name||'Entrenador'}))].sort((a,b)=>String(b.when).localeCompare(String(a.when)));return `${detailHead('REGISTRO DE EVENTOS','Historial compartido','Evolución de partidas, ganancias, compras y combates registrados en la web.')}<div class="card">${entries.length?`<div class="timeline">${entries.slice(0,120).map(e=>`<div class="event"><h3>${esc(e.heading)}</h3><p>${esc(e.desc)} · ${fmt(e.when)}</p></div>`).join('')}</div>`:'<div class="empty">Todavía no hay actividad registrada.</div>'}</div>`}
function renderSettings(){return `${detailHead('REGLAS Y ACCESO','Configuración','Parámetros centrales del Dualocke. Los cambios afectan a cálculos posteriores sin alterar compras ya realizadas.')}<div class="grid-2">${card('Reglas generales',`<form id="rules-form"><div class="config-row"><div><strong>Vidas iniciales</strong><div class="small">Por jugador, editables después</div></div><input class="field" type="number" name="life_limit" min="1" max="999" value="${conf('life_limit')}"></div><div class="config-row"><div><strong>Pokéfichas por medalla</strong></div><input class="field" type="number" name="gym_pf" min="0" value="${conf('gym_pf')}"></div><div class="config-row"><div><strong>Pokéfichas por KO</strong></div><input class="field" type="number" name="ko_pf" min="0" value="${conf('ko_pf')}"></div><div class="config-row"><div><strong>BST máximo normal</strong><div class="small">Slaking siempre es excepción</div></div><input class="field" type="number" name="cap_bst" min="1" value="${conf('cap_bst')}"></div><div class="config-row"><div><strong>Precio de huevo</strong></div><input class="field" type="number" name="egg_price" min="1" value="${conf('egg_price')}"></div><button class="button full mt-3" type="submit">Guardar reglas</button></form>`)}${card('Conexión',`<div class="rule-note mb-3">${CONNECTED?'Proyecto Supabase configurado.':'Vista previa: configura URL pública y clave anon en app.js; ejecuta database.sql en Supabase.'}</div><div class="stack"><p class="small">Cuenta actual: <strong>${esc(state.account?.email||'Sin sesión')}</strong></p><p class="small">Jugador asociado: <strong>${esc(own()?.display_name||'Pendiente')}</strong></p><button class="button secondary" data-action="account">${state.account?'Cerrar sesión':'Iniciar sesión'}</button><button class="button secondary" data-action="import">Subir un archivo main</button><button class="button ghost" data-action="export">Exportar datos visibles (JSON)</button></div><div class="line"></div><p class="small">Privacidad real: las especies, habilidades, movimientos y huevos de cada jugador se guardan en una tabla con Row Level Security. Ninguna cuenta puede consultar la tabla privada del rival.</p>`)}</div><div class="section-gap">${card('Reglas de progresión',`<div class="table-wrap"><table class="data-table"><thead><tr><th>Enfrentamiento</th><th>Límite nivel</th></tr></thead><tbody>${BOSSES.map(([n,c])=>`<tr><td>${esc(n)}</td><td>${c}</td></tr>`).join('')}</tbody></table></div><div class="rule-note mt-3">Los niveles de jefes son límites obligatorios. Excederlos no resta automáticamente vidas. Las cajas 30/31 son el cementerio.</div>`)}</div>`}
function bindPage(){$$('[data-action]').forEach(b=>b.onclick=()=>actions(b.dataset.action));$$('[data-go]').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);$$('[data-route]').forEach(b=>{b.onclick=()=>{const scroll=$('.atlas-scroll')?.scrollLeft||0;state.selectedRoute=b.dataset.route;render();if($('.atlas-scroll'))$('.atlas-scroll').scrollLeft=scroll};if(b.tagName.toLowerCase()==='g')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.dispatchEvent(new MouseEvent('click',{bubbles:true}))}}});$('#route-search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.mapSearch=e.target.value;render();const f=$('#route-search');f?.focus();f?.setSelectionRange(pos,pos)});$('#map-filter')?.addEventListener('change',e=>{state.selectedMapFilter=e.target.value;render()});$('#atlas-type-filter')?.addEventListener('change',e=>{state.hoennTypeFilter=e.target.value;render()});$$('[data-hoenn-kind]').forEach(ch=>ch.onchange=()=>{state.hoennKinds={...(state.hoennKinds||{city:true,route:true,special:false}),[ch.dataset.hoennKind]:ch.checked};render()});$$('[data-map-view]').forEach(b=>b.onclick=()=>{state.selectedMapPlayer=b.dataset.mapView;render()});$$('[data-encounter-tab]').forEach(b=>b.onclick=()=>{state.encounterTab=b.dataset.encounterTab;render();document.querySelector('.enc18-panel')?.scrollIntoView({block:'nearest'})});$$('[data-special-edit]').forEach(b=>b.onclick=()=>editSpecialEncounter(b.dataset.specialEdit));$$('[data-special-remove]').forEach(b=>b.onclick=()=>removeSpecialEncounter(b.dataset.specialRemove));$('#shop-search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.shopQuery=e.target.value;render();const f=$('#shop-search');f?.focus();f?.setSelectionRange(pos,pos)});$('#shop-cat')?.addEventListener('change',e=>{state.selectedCategory=e.target.value;render()});$$('[data-buy]').forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));$('#replay-form')?.addEventListener('submit',importReplay);$('#rules-form')?.addEventListener('submit',saveRules);}
/* --- Supabase REST + GoTrue: no secrets stored in GitHub Pages --- */
async function api(path,{method='GET',body,auth=true,headers={}}={}){
  if(!CONNECTED)throw Error('Falta configurar Supabase');
  const token=state.session?.access_token;
  const opt={method,headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json',...headers}};
  if(auth&&token)opt.headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)opt.body=JSON.stringify(body);
  let res=await fetch(`${SUPABASE_URL}${path}`,opt);
  if(res.status===401&&auth&&state.session?.refresh_token){await refreshSession();opt.headers.Authorization=`Bearer ${state.session.access_token}`;res=await fetch(`${SUPABASE_URL}${path}`,opt);}
  const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok)throw Error(data?.message||data?.error_description||data?.error||`Error ${res.status}`);
  return data;
}
function db(table,query=''){return api(`/rest/v1/${table}${query}`)}
function rpc(name,body={}){return api(`/rest/v1/rpc/${name}`,{method:'POST',body})}
async function refreshSession(){const data=await api(`/auth/v1/token?grant_type=refresh_token`,{method:'POST',auth:false,body:{refresh_token:state.session.refresh_token}});state.session=data;sessionStorage.setItem('dualocke_session',JSON.stringify(data))}
function loginModal(){const d=modal('Entrar al Dualocke',`<p>Inicia sesión con una de las dos cuentas autorizadas. Ambas veréis la misma interfaz, con datos secretos separados.</p><form id="signin-form"><label class="form-label">Correo electrónico</label><input class="field" type="email" name="email" autocomplete="username" required><label class="form-label">Contraseña</label><input class="field" type="password" name="password" autocomplete="current-password" required><button class="button full">Entrar</button></form><div class="small mt-3">Las cuentas se crean en Supabase Authentication y se asocian manualmente a los dos jugadores en la tabla <code>players</code>.</div>`);$('#signin-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const ss=await api('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:f.get('email'),password:f.get('password')}});state.session=ss;sessionStorage.setItem('dualocke_session',JSON.stringify(ss));await loadShared();d.close();toast('Sesión iniciada','success');render()}catch(err){toast(err.message,'error')}}}
async function loadShared(){if(!CONNECTED||!state.session?.access_token){render();return}const user=await api('/auth/v1/user');state.account={id:user.id,email:user.email};try{
  const requests=[['special_encounters','?select=*&order=created_at.desc'],['players','?select=*&order=slot.asc'],['shared_progress','?select=*'],['route_states','?select=*'],['shop_catalog','?select=*&order=category,name'],['combat_series','?select=*&order=created_at.desc'],['replay_games','?select=*&order=created_at.desc'],['money_events','?select=*&order=created_at.desc'],['reward_credits','?select=*'],['egg_claims','?select=*&order=created_at.asc'],['config','?select=*']];
  const data=await Promise.all(requests.map(async([table,q])=>{try{return await db(table,q)}catch(e){console.warn('No se pudo leer',table,e.message);return[]}}));
  state.specialEncounters=data[0]||[];
  [state.players,state.progress,state.routes,state.catalog,state.series,state.games,state.economy,state.credits,state.claims]=data.slice(1,10);
  const cfg=data[10].find(x=>x.id===1);state.settings={...defaults,...(cfg||{})};
  const account=own();if(!account){toast('Esta cuenta aún no está asignada a uno de los dos jugadores.','error');state.pokemon=[]}else state.pokemon=await db('private_pokemon',`?owner_id=eq.${account.user_id}&select=*`);
 }catch(err){toast(err.message,'error')}
 render();}
async function saveRules(e){e.preventDefault();if(!guard())return;const f=new FormData(e.currentTarget);const allowed=['life_limit','gym_pf','ko_pf','cap_bst','egg_price'];const updates={};for(const k of allowed){const v=Number(f.get(k));if(!Number.isInteger(v)||v<0)throw Error('Valor no válido');updates[k]=v}try{await api('/rest/v1/config?id=eq.1',{method:'PATCH',body:updates,headers:{Prefer:'return=minimal'}});toast('Reglas guardadas','success');await loadShared()}catch(err){toast(err.message,'error')}}
async function buyItem(itemId){const i=state.catalog.find(it=>String(it.id)===String(itemId));if(!i)return;if(!guard())return;const d=modal('Confirmar compra',`<p><strong>${esc(i.name)}</strong> (${i.quantity} ${i.quantity>1?'unidades':'unidad'}) por <strong>${i.price} Pokéfichas</strong>.</p><p>El objeto deberá introducirse en el juego con PKHeX. El saldo se descontará una única vez.</p><button class="button full" id="do-buy">Confirmar compra</button>`);$('#do-buy').onclick=async()=>{try{await rpc('buy_shop_item',{p_item_id:i.id});d.close();toast('Compra registrada. Recuerda añadir el objeto al juego.','success');await loadShared()}catch(err){toast(err.message,'error')}}}
async function drawEgg(){if(!guard())return;const d=modal('Sorteo irreversible',`<p>Se seleccionará un huevo entre los disponibles y permitidos usando las vidas y calidad de plantilla de ambos jugadores.</p><div class="notice mb-3">El resultado quedará registrado y no se podrá repetir para escoger otro.</div><button id="do-draw" class="button full">Confirmar sorteo ponderado</button>`);$('#do-draw').onclick=async()=>{try{const drawResponse=await rpc('draw_weighted_egg');const r=Array.isArray(drawResponse)?drawResponse[0]:drawResponse;d.innerHTML=`<header><h2>Huevo asignado</h2><button data-close="1">×</button></header><div class="egg-podium"><div class="egg-art"></div><div class="egg-result">Caja ${Number(r.box_num)} · Posición ${Number(r.slot_num)}</div></div><p>El huevo está reservado. No se mostrará su especie.</p><button class="button full" data-close="1">Entendido</button>`;d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());await loadShared()}catch(err){toast(err.message,'error')}}}
async function createSeries(){if(!guard())return;try{await api('/rest/v1/combat_series',{method:'POST',body:{status:'open'},headers:{Prefer:'return=minimal'}});toast('Nueva serie BO3 creada','success');await loadShared()}catch(err){toast(err.message,'error')}}
async function editRoute(){
  if(!guard())return;
  const me=own();if(!me)return;
  try{await loadDex()}catch(err){toast('No se pudo cargar la Pokédex: '+err.message,'error')}
  const r=routeState(me.user_id,state.selectedRoute);
  const candidates=state.pokemon.filter(pk=>!pk.is_egg && !Number(pk.egg_location||0) && locationName(pk.met_location)===state.selectedRoute);
  const options=candidates.map((pk,i)=>`<option value="${i}">${esc(pk.nickname)} · ${esc(state.dex[pk.species]?.name||`#${pk.species}`)}${pk.present?'':' (histórico)'}</option>`).join('');
  const d=modal('Estado de '+state.selectedRoute,`<form id="route-form">
    ${candidates.length>1?'<div class="notice mb-3">Hay varios Pokémon obtenidos en esta zona. Elige cuál consumió la captura normal; la web no puede decidirlo automáticamente.</div>':''}
    ${candidates.length?`<label class="form-label">Elegir Pokémon de tu guardado (información privada)</label><select class="select" id="route-candidate"><option value="">— Introducción manual —</option>${options}</select>`:''}
    <label class="form-label">Estado de tu captura</label><select class="select" name="status"><option value="unknown" ${!r||r.status==='unknown'?'selected':''}>Sin verificar</option><option value="free" ${r?.status==='free'?'selected':''}>Disponible (confirmada)</option><option value="captured" ${r?.status==='captured'?'selected':''}>Capturada</option><option value="failed" ${r?.status==='failed'?'selected':''}>Fallida (se perdió el encuentro)</option></select>
    <label class="form-label">Nivel al capturar (visible)</label><input class="field" name="capture_level" type="number" min="1" max="100" value="${r?.capture_level??''}"><label class="form-label">Método de encuentro (visible)</label><select class="select" name="encounter_method">${methodOptions(r?.encounter_method)}</select><label class="form-label">Apodo (visible para el rival)</label><input class="field" name="nickname" value="${esc(r?.nickname||'')}">
    <label class="form-label">Total de estadísticas al capturar (0 EV)</label><input class="field" name="stat_total" type="number" min="1" value="${r?.stat_total??''}">
    <p class="small mt-2">Si evolucionó antes de su primera importación, revisa su etapa al capturarlo: el cálculo automático podría no ser exacto.</p>
    <button class="button full mt-3">Guardar estado</button>
  </form>`);
  $('#route-candidate')?.addEventListener('change',e=>{
    const i=e.target.value;if(i==='')return;
    const pk=candidates[Number(i)];
    const species=pk.original_species||pk.species;
    const stats=calcStats(state.dex[species]?.baseStats,pk.met_level,pk.ivs,pk.nature);
    const form=$('#route-form');
    form.elements.status.value='captured';form.elements.nickname.value=pk.nickname;form.elements.capture_level.value=pk.met_level||'';
    form.elements.stat_total.value=stats?stats.reduce((a,b)=>a+b,0):'';
    if(!stats)toast('Faltan datos para calcular las estadísticas; introduce el total manualmente.','error');
  });
  $('#route-form').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const v=f.get('stat_total'),lv=f.get('capture_level'),method=String(f.get('encounter_method')||'unknown');
    if(method&&!Object.hasOwn(ENCOUNTER_METHODS,method))throw Error('Método no válido');
    try{
      await api('/rest/v1/route_states?on_conflict=owner_id,zone_key',{
        method:'POST',body:{owner_id:me.user_id,zone_key:state.selectedRoute,status:f.get('status'),nickname:String(f.get('nickname')||''),stat_total:v?Number(v):null,capture_level:lv?Number(lv):null,encounter_method:method},
        headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
      });d.close();toast('Zona revisada y guardada','success');await loadShared();
    }catch(err){toast(err.message,'error')}
  };
}


/* Huevos/regalos: registro manual, separado del derecho de captura por ruta. */
async function editSpecialEncounter(id=null){
 if(!guard())return;const me=own();if(!me)return;
 const prev=id?state.specialEncounters.find(r=>r.id===id&&r.owner_id===me.user_id):null;
 if(id&&!prev){toast('Solo puedes editar tus propias capturas especiales.','error');return;}
 const eligible=state.pokemon.filter(p=>!p.is_egg);
 const choices=eligible.map((pk,i)=>`<option value="${i}">${esc(pk.nickname||'Sin apodo')} · ${pk.met_level?'Nv. '+pk.met_level:'Nivel desconocido'}${Number(pk.egg_location||0)>0?' · nacido de huevo':''}</option>`).join('');
 const kindOptions=Object.entries(SPECIAL_KINDS).map(([key,label])=>`<option value="${key}" ${prev?.kind===key?'selected':''}>${esc(label)}</option>`).join('');
 const d=modal(prev?'Editar captura especial':'Registrar captura especial',`<form id="special-encounter-form"><p class="small mb-3">Registra solo Pokémon recibidos o huevos <strong>ya eclosionados</strong>. No revelamos especie ni datos de combate. Esta ficha no consume la captura normal de ninguna ruta.</p>
 <label class="form-label">Tipo de origen</label><select class="select" name="kind">${kindOptions}</select>
 ${eligible.length?`<label class="form-label">Autocompletar desde mis Pokémon privados</label><select class="select" id="special-candidate"><option value="">— Escribir a mano —</option>${choices}</select>`:''}
 <label class="form-label">Apodo público</label><input class="field" name="nickname" maxlength="80" required value="${esc(prev?.nickname||'')}">
 <label class="form-label">Zona de recepción (opcional)</label><input class="field" name="zone_key" maxlength="90" value="${esc(prev?.zone_key||'')}">
 <label class="form-label">Nivel de obtención / eclosión</label><input class="field" name="capture_level" type="number" min="1" max="100" value="${prev?.capture_level??''}">
 <label class="form-label">Método</label><select class="select" name="encounter_method">${methodOptions(prev?.encounter_method)}</select>
 <label class="form-label">Suma de las estadísticas al nivel de obtención (0 EV)</label><input class="field" name="stat_total" type="number" min="1" max="2000" value="${prev?.stat_total??''}">
 <p class="small mt-2">Si el Pokémon evolucionó antes de registrarlo, el cálculo automático puede no reflejar su etapa al obtenerlo.</p>
 <button type="submit" class="button full mt-3">${prev?'Guardar cambios':'Registrar sin consumir ruta'}</button></form>`);
 $('#special-candidate')?.addEventListener('change',async e=>{
  if(e.target.value==='')return;
  const pk=eligible[Number(e.target.value)];const form=$('#special-encounter-form');
  form.elements.nickname.value=pk.nickname||'';form.elements.capture_level.value=pk.met_level||'';
  const zone=locationName(pk.met_location);if(!zone.startsWith('Lugar #'))form.elements.zone_key.value=zone;
  if(Number(pk.egg_location||0)>0)form.elements.kind.value='egg';
  try{await loadDex();const sp=pk.original_species||pk.species,stats=calcStats(state.dex[sp]?.baseStats,pk.met_level,pk.ivs,pk.nature);form.elements.stat_total.value=stats?stats.reduce((a,v)=>a+v,0):'';}
  catch{toast('No se han calculado las estadísticas. Puedes introducir el total manualmente.','error');}
 });
 $('#special-encounter-form').onsubmit=async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);
  const kind=String(form.get('kind')),method=String(form.get('encounter_method'));
  if(!Object.hasOwn(SPECIAL_KINDS,kind)||!Object.hasOwn(ENCOUNTER_METHODS,method)){toast('Origen o método incorrecto.','error');return;}
  const rawLevel=form.get('capture_level'),rawStat=form.get('stat_total');
  const row={owner_id:me.user_id,kind,nickname:String(form.get('nickname')||'').trim(),zone_key:String(form.get('zone_key')||'').trim(),capture_level:rawLevel?Number(rawLevel):null,stat_total:rawStat?Number(rawStat):null,encounter_method:method};
  if(!row.nickname){toast('El apodo es obligatorio.','error');return;}
  try{
   if(prev)await api(`/rest/v1/special_encounters?id=eq.${encodeURIComponent(prev.id)}`,{method:'PATCH',body:row,headers:{Prefer:'return=minimal'}});
   else await api('/rest/v1/special_encounters',{method:'POST',body:row,headers:{Prefer:'return=minimal'}});
   d.close();state.encounterTab='special';toast('Captura especial guardada sin consumir ninguna ruta.','success');await loadShared();
  }catch(err){toast('No se pudo guardar la captura especial: '+err.message,'error')}
 };
}
async function removeSpecialEncounter(id){
 if(!guard())return;const me=own();if(!me)return;
 const row=state.specialEncounters.find(e=>e.id===id&&e.owner_id===me.user_id);if(!row)return;
 if(!confirm(`¿Eliminar del registro público a ${row.nickname}? No se borrará ningún Pokémon de tu partida.`))return;
 try{await api(`/rest/v1/special_encounters?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});toast('Registro eliminado.');await loadShared()}catch(err){toast(err.message,'error')}
}

function actions(a){if(a==='import')$('#save-file').click();if(a==='account'){if(state.account){state.session=null;state.account=null;sessionStorage.removeItem('dualocke_session');location.reload()}else loginModal()}if(a==='new-series')createSeries();if(a==='route-edit')editRoute();if(a==='special-add')editSpecialEncounter();if(a==='location-edit')editCurrentLocation();if(a==='zone-add')addCustomZone();if(a==='draw-egg')drawEgg();if(a==='export'){const ownId=own()?.user_id;const out={players:state.players,progress:state.progress,routes:state.routes,special_encounters:state.specialEncounters,series:state.series,games:state.games,economy:state.economy,claims:state.claims,own_private_creatures:state.pokemon.filter(p=>p.owner_id===ownId)};const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));link.download='dualocke_export.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1500)}}

/* --- Decodificador PK6 y archivos main ORAS (0x76000 bytes) --- */
const read16=(b,i)=>b[i]|b[i+1]<<8;
const read32=(b,i)=>(b[i]|(b[i+1]<<8)|(b[i+2]<<16)|(b[i+3]<<24))>>>0;
function decodeText(buf,offset,len){let result='';for(let i=offset;i<offset+len;i+=2){const c=read16(buf,i);if(!c||c===0xffff)break;result+=String.fromCharCode(c)}return result.replace(/[\u0000-\u001f]/g,'').trim()}
function checksum(buf){let v=0;for(let k=8;k<232;k+=2)v=(v+read16(buf,k))&65535;return v}
function decodePK6(bytes){if(bytes.length!==232&&bytes.length!==260)throw Error('Registro PK6 de longitud no reconocida');if(!read32(bytes,0))return null;let b=new Uint8Array(bytes),expected=read16(b,6);
  if(checksum(b)!==expected){let seed=read32(b,0),x=8;for(;x<232;x+=2){seed=(Math.imul(seed,0x41c64e6d)+0x6073)>>>0;const out=read16(b,x)^(seed>>>16);b[x]=out&255;b[x+1]=out>>>8;}
    // La zona suplementaria del equipo se cifra por separado con la misma semilla.
    if(b.length===260){seed=read32(b,0);for(let k=232;k<260;k+=2){seed=(Math.imul(seed,0x41c64e6d)+0x6073)>>>0;const out=read16(b,k)^(seed>>>16);b[k]=out&255;b[k+1]=out>>>8;}}
    const sv=(read32(b,0)>>>13)&31;const blocks=b.slice(8,232),res=b.slice();for(let i=0;i<4;i++){res.set(blocks.subarray(SHUFFLES[sv*4+i]*56,SHUFFLES[sv*4+i]*56+56),8+i*56);}b=res;
    if(checksum(b)!==expected)return null;
  }
  const species=read16(b,8);if(species<1||species>721)return null;
  const pid=read32(b,0x18),ec=read32(b,0),iv32=read32(b,0x74);
  const ivs=[0,5,10,20,25,15].map(shift=>(iv32>>>shift)&31);
  const moves=[0x5a,0x5c,0x5e,0x60].map(i=>read16(b,i)).filter(Boolean);
  const isEgg=Boolean(iv32&0x40000000);const ownMet=read16(b,0xda);const n=(b[0x1c]%25);const nick=decodeText(b,0x40,26)||`#${species}`;
  const isParty=b.length===260;
  return {pokemon_key:`${ec.toString(16).padStart(8,'0')}-${pid.toString(16).padStart(8,'0')}-${read32(b,0x0c).toString(16)}`,species, nickname:nick,pid,ec,is_egg:isEgg,gender:(b[0x1d]>>1)&3,form:b[0x1d]>>3,ability:b[0x14],nature:n,ivs,evs:[b[0x1e],b[0x1f],b[0x20],b[0x22],b[0x23],b[0x21]],moves,met_level:b[0xdd]&127,met_location:ownMet,egg_location:read16(b,0xd8),level:isParty?b[0xec]:null, stats:isParty?[read16(b,0xf2),read16(b,0xf4),read16(b,0xf6),read16(b,0xfa),read16(b,0xfc),read16(b,0xf8)]:null};
}

async function addCustomZone(){
 if(!guard())return;const me=own();if(!me)return;
 const d=modal('Añadir zona de SUPER RR',`<form id="zone-add-form"><p>Escribe exactamente el nombre que aparece en el letrero del juego. Si ya existe una zona con ese nombre, no la duplicaremos.</p><label for="new-zone-name" class="form-label">Nombre de la zona</label><input id="new-zone-name" class="field" maxlength="70" required autocomplete="off" placeholder="Ej.: Zona secreta"><button type="submit" class="button full mt-3">Guardar zona compartida</button></form>`);
 $('#zone-add-form').onsubmit=async e=>{
  e.preventDefault();const z=String($('#new-zone-name').value||'').trim();
  if(z.length<2||z.length>70){toast('Nombre inválido (2–70 caracteres).','error');return;}
  const known=unique([...ROUTES,...state.routes.map(r=>r.zone_key)]);
  const match=known.find(x=>x.toLocaleLowerCase('es')===z.toLocaleLowerCase('es'));
  if(match){state.selectedRoute=match;d.close();toast('La zona ya existe; la hemos seleccionado.');render();return;}
  try{
   await api('/rest/v1/route_states',{method:'POST',body:{owner_id:me.user_id,zone_key:z,status:'unknown',nickname:'',stat_total:null},headers:{Prefer:'return=minimal'}});
   d.close();state.selectedRoute=z;state.mapSearch='';state.selectedMapFilter='all';toast('Nueva zona añadida.','success');await loadShared();
  }catch(err){toast(err.message,'error')}
 };
}
async function editCurrentLocation(){
 if(!guard())return;
 const me=own();if(!me)return;
 const row=state.progress.find(p=>p.player_id===me.user_id);
 if(!row){toast('Importa primero tu archivo main.','error');return;}
 const known=unique([...ROUTES,...state.routes.map(r=>r.zone_key)]).filter(Boolean);
 const options=known.map(zone=>`<option value="${esc(zone)}"></option>`).join('');
 const label=isConfirmedLocation(row.map_label)?row.map_label:'';
 const d=modal('Asignar ubicación actual',`<form id="location-form"><p>El último archivo main indica el mapa interno <strong>#${Number(row.map_code)}</strong>. Escribe el nombre que muestra el letrero emergente cuando entras en esa zona.</p><label class="form-label" for="location-label">Nombre en el juego</label><input class="field" id="location-label" name="label" list="known-locations" maxlength="90" value="${esc(label)}" placeholder="Ej.: Ruta 102" required autocomplete="off"><datalist id="known-locations">${options}</datalist><div class="rule-note">Solo se publicará el nombre de la zona, no los datos privados de tus Pokémon. Si importas otro main en el mismo mapa, se mantendrá este nombre.</div><button class="button full mt-3" type="submit">Guardar ubicación</button></form>`);
 $('#location-form').onsubmit=async e=>{
  e.preventDefault();
  const value=String(new FormData(e.currentTarget).get('label')||'').trim();
  if(value.length<2||value.length>90){toast('Escribe un nombre de ubicación válido.','error');return;}
  try{
   await api(`/rest/v1/shared_progress?player_id=eq.${encodeURIComponent(me.user_id)}`,{method:'PATCH',body:{map_label:value},headers:{Prefer:'return=minimal'}});
   d.close();toast('Ubicación guardada y compartida.','success');await loadShared();
  }catch(err){toast(err.message,'error')}
 };
}
function locationName(n){
  if(n>=204&&n<=270&&n%2===0)return `Ruta ${101+(n-204)/2}`;
  // IDs de lugar de obtención de Pokémon (PK6), NO IDs de mapa donde se guardó.
  // El catálogo es conservador: no asignamos capturas automáticamente si falta traducción.
  const map={170:'Villa Raíz',172:'Pueblo Escaso',174:'Pueblo Azuliza',176:'Pueblo Lavacalda',178:'Pueblo Pardal',180:'Pueblo Verdegal',182:'Pueblo Oromar',184:'Ciudad Petalia',186:'Ciudad Portual',188:'Ciudad Malvalona',190:'Ciudad Férrica',192:'Ciudad Arborada',194:'Ciudad Calagua',196:'Ciudad Algaria',198:'Arrecípolis',200:'Ciudad Colosalia',202:'Liga Pokémon',
    272:'Cascada Meteoro',274:'Túnel Fervergal',280:'Cueva Granito',282:'Bosque Petalia',284:'Monte Cenizo',286:'Desfiladero',288:'Senda Ígnea',290:'Monte Pírico',294:'Caverna Abisal',296:'Cueva Ancestral',298:'Calle Victoria',300:'Cueva Cardumen',302:'Nueva Malvalona',304:'Malvamar',316:'Pilar Celeste',320:'Isla del Sur',324:'Zona Safari'};
  return map[n]||`Lugar #${n}`;
}

// La primera importación no debe adivinar cuál de dos Pokémon de una misma
// ruta es la captura legal. Conservamos la zona pendiente de verificación.
function planCaptureRoutes(save,knownZones,dex){
  const grouped=new Map();
  for(const pk of [...save.party,...save.pc]){
    if(pk.is_egg || Number(pk.egg_location||0)>0)continue;
    const zone_key=locationName(pk.met_location);
    if(zone_key.startsWith('Lugar #')||knownZones.has(zone_key))continue;
    if(!grouped.has(zone_key))grouped.set(zone_key,[]);
    grouped.get(zone_key).push(pk);
  }
  const proposals=[];
  for(const [zone_key,items] of grouped){
    if(items.length!==1){proposals.push({zone_key,status:'unknown',nickname:'',stat_total:null});continue;}
    // Un Pokémon solo en esta zona también puede ser regalo o extra. No consume una ruta sin confirmación manual.
    proposals.push({zone_key,status:'unknown',nickname:'',stat_total:null});
  }
  return proposals;
}

function parseSave(input){const buf=input instanceof Uint8Array?input:new Uint8Array(input);if(buf.length!==0x76000)throw Error(`Formato de save incorrecto: ${buf.length} bytes. Se esperan 483.328 bytes (main ORAS).`);
  const trainer=decodeText(buf,0x14000+0x48,26)||'Entrenador';const badges=buf[0x04200+0x0c].toString(2).replace(/0/g,'').length;const mapId=read16(buf,0x01400+2),regionId=read16(buf,0x01400+6);
  const party=[];for(let s=0;s<6;s++){const start=0x14200+s*260,pk=decodePK6(buf.subarray(start,start+260));if(pk)party.push({...pk,box:0,slot:s+1})}
  const pc=[];for(let box=0;box<31;box++)for(let s=0;s<30;s++){const start=0x33000+(box*30+s)*232,pk=decodePK6(buf.subarray(start,start+232));if(pk)pc.push({...pk,box:box+1,slot:s+1})}
  if(party.length+pc.length===0)throw Error('No se encontró ningún Pokémon válido; archivo quizá corrupto o cifrado.');
  return {trainer,badges,mapId,regionId,map_label:`Mapa interno ${mapId} · región ${regionId}`,party,pc,deaths:pc.filter(p=>p.box>=30&&!p.is_egg).length,eggs:pc.filter(p=>p.is_egg).length,validPokemon:party.length+pc.length};
}
/* Orden: PS, Ataque, Defensa, Ataque Esp., Defensa Esp., Velocidad. */
function calcStats(base,level,ivs,nature){if(!base||!level)return null;const names=['hp','atk','def','spa','spd','spe'];const b=names.map(k=>base[k]);if(b.some(v=>!Number.isFinite(v)))return null;
  const plus=Math.floor(nature/5),minus=nature%5;// orden de naturalezas: Atk Def Spe SpA SpD
  return b.map((v,i)=>{const raw=Math.floor((2*v+ivs[i])*level/100);if(i===0)return v===1?1:raw+level+10;const nidx=[-1,0,1,3,4,2][i];const mult=plus!==minus&&nidx===plus?1.1:plus!==minus&&nidx===minus?0.9:1;return Math.floor((raw+5)*mult+1e-8)});
}
function dexRating(pk,mon){if(!mon)return null;const b=mon.baseStats||{};const bst=Object.values(b).reduce((a,v)=>a+Number(v),0);if(!bst)return null;const av=bst/6,dev=Object.values(b).reduce((a,v)=>a+Math.abs(v-av),0)/6;const efficiency=Math.max(0,1-dev/160);const ivs=pk.ivs||[15,15,15,15,15,15];const ivScore=ivs.reduce((a,v)=>a+v,0)/(31*6);const bstScore=Math.min(1,Math.max(0,(bst-180)/490));const quality=100*(0.70*bstScore+0.15*efficiency+0.10*0.5+0.05*ivScore);
  return {bst,quality:Math.round(quality*100)/100};
}
async function loadDex(){if(state.dexReady)return;const res=await fetch('https://play.pokemonshowdown.com/data/pokedex.json');if(!res.ok)throw Error('No se pudo cargar el catálogo estadístico de especies');const data=await res.json();const byNum={};for(const v of Object.values(data)){if(!v.num||v.num>721||v.num<1||!v.baseStats)continue;if(!byNum[v.num]||!v.forme)byNum[v.num]=v;}state.dex=byNum;state.dexReady=true;}
async function handleSave(file){if(!file)return;if(!guard())return;try{
  if(file.size!==0x76000)throw Error('Elige el archivo main extraído de Pokémon Rubí Omega (472 KiB).');
  const raw=await file.arrayBuffer();const save=parseSave(raw);await loadDex();state.preview=save;
  const d=modal('Validar importación',`<p>El lector ha descifrado el archivo localmente. No se subirá el archivo binario.</p><div class="grid-2"><div class="trainer-metric"><small>ENTRENADOR</small><strong>${esc(save.trainer)}</strong></div><div class="trainer-metric"><small>MEDALLAS</small><strong>${save.badges}/8</strong></div><div class="trainer-metric"><small>EQUIPO</small><strong>${save.party.length} Pokémon</strong></div><div class="trainer-metric"><small>HUEVOS / BAJAS</small><strong>${save.eggs} / ${save.deaths}</strong></div></div><div class="notice mt-3">Después de importar, asigna tu ubicación en el apartado Mapa. Se conservará mientras el ID interno no cambie. Verifica capturas de Pokémon que evolucionaron antes de su primera importación.</div><button class="button full mt-3" id="confirm-save">Publicar actualización compartida</button>`);
  $('#confirm-save').onclick=async()=>{try{$('#confirm-save').disabled=true;await publishSave(save);d.close();toast('Guardado importado correctamente','success');await loadShared()}catch(err){toast(err.message,'error');$('#confirm-save').disabled=false}};
 }catch(err){toast(err.message,'error')}finally{$('#save-file').value=''}}
async function publishSave(save){const acc=own();if(!acc)throw Error('Esta cuenta no está asignada a uno de los dos jugadores.');const owner_id=acc.user_id;const existing=new Map(state.pokemon.map(p=>[p.pokemon_key,p]));const all=[...save.party,...save.pc];const privateRows=all.map(pk=>{
  const dex=state.dex[pk.species],score=dexRating(pk,dex),prior=existing.get(pk.pokemon_key);
  return {owner_id,pokemon_key:pk.pokemon_key,species:pk.species,nickname:pk.nickname,box_num:pk.box,slot_num:pk.slot,is_egg:pk.is_egg,level:pk.level,met_level:pk.met_level,met_location:pk.met_location,egg_location:pk.egg_location||0,original_species:prior?.original_species??pk.species,nature:pk.nature,ability:pk.ability,ivs:pk.ivs,moves:pk.moves,stats:pk.stats,bst:score?.bst??null,quality:score?.quality??null,present:true};
 });
  // Guardamos primero un lote completo y después marcamos ausentes, sin eliminar el historial de huevos asignados.
  for(let i=0;i<privateRows.length;i+=100)await api('/rest/v1/private_pokemon?on_conflict=owner_id,pokemon_key',{method:'POST',body:privateRows.slice(i,i+100),headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
  const current=new Set(privateRows.map(p=>p.pokemon_key));for(const old of state.pokemon){if(!current.has(old.pokemon_key))await api(`/rest/v1/private_pokemon?owner_id=eq.${owner_id}&pokemon_key=eq.${encodeURIComponent(old.pokemon_key)}`,{method:'PATCH',body:{present:false},headers:{Prefer:'return=minimal'}})}
  // Conservamos solo datos que corresponden al contrato público de información.
  const before=state.progress.find(x=>x.player_id===owner_id);
  const useManual=before && Number(before.map_code)===save.mapId && isConfirmedLocation(before.map_label);
  const effectiveMapLabel=useManual?before.map_label:save.map_label;
  await api('/rest/v1/shared_progress?on_conflict=player_id',{method:'POST',body:{player_id:owner_id,trainer_name:save.trainer,badges:save.badges,deaths:save.deaths,map_label:effectiveMapLabel,map_code:save.mapId,team_count:save.party.length,updated_at:new Date().toISOString()},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
  // No adjudicar ingresos solo por detectar medallas en un save: la transacción en servidor es idempotente.
  await rpc('award_new_badges',{p_badges:save.badges});
  // Distintos Pokémon con el mismo lugar de obtención requieren elección privada.
  // No sobrescribimos zonas que el jugador ya haya revisado manualmente.
  const known=new Set(state.routes.filter(r=>r.owner_id===owner_id).map(r=>r.zone_key));
  const proposals=planCaptureRoutes(save,known,state.dex);
  for(const route of proposals){
    await api('/rest/v1/route_states?on_conflict=owner_id,zone_key',{
      method:'POST',body:{owner_id,...route},
      headers:{Prefer:'resolution=ignore-duplicates,return=minimal'}
    });
  }
  const pending=proposals.filter(r=>r.status==='unknown').length;
  if(pending)toast(`${pending} zona(s) con captura pendiente de verificar. Revísalas en Mapa.`, 'error');
}

/* --- Pokémon Showdown: los replays solo contienen información pública --- */
function normalizedUser(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function getReplayId(raw){let u;try{u=new URL(raw)}catch{throw Error('Pega una URL de replay válida')}if(u.hostname!=='replay.pokemonshowdown.com')throw Error('Guarda y copia el replay de replay.pokemonshowdown.com (no la sala psim.us/r).');const id=u.pathname.split('/').filter(Boolean)[0]?.replace(/\.(json|log)$/,'');if(!/^[a-z0-9-]+$/i.test(id||''))throw Error('Identificador de replay no válido');return id}
function interpretReplay(replay){
  const lines=String(replay.log||'').split('\n');
  const players={}, mon={p1:new Map(),p2:new Map()}, active={p1:null,p2:null}, ko={p1:0,p2:0};
  let winner=replay.winner||'';
  function identify(side,who,details){
    const nickname=String(who||'').split(':').slice(1).join(':').trim()||'Desconocido';
    const species=String(details||'').split(',')[0].trim()||nickname;
    const key=`${nickname}|${species}`;
    if(!mon[side].has(key)){
      const preview=[...mon[side].entries()].find(([,p])=>p.species===species&&!p.nickname);
      if(preview){mon[side].delete(preview[0]);mon[side].set(key,{...preview[1],nickname});}
      else mon[side].set(key,{nickname,species,moves:[],ability:null,item:null});
    }
    active[side]=key;
    return mon[side].get(key);
  }
  function current(who){const side=String(who||'').slice(0,2);return mon[side]?.get(active[side])}
  for(const line of lines){
    const a=line.split('|');
    if(a[1]==='player'&&['p1','p2'].includes(a[2]))players[a[2]]=a[3];
    if(a[1]==='poke'&&['p1','p2'].includes(a[2])){
      const species=String(a[3]||'').split(',')[0].trim();
      if(species)mon[a[2]].set(`preview:${mon[a[2]].size}:${species}`,{nickname:null,species,moves:[],ability:null,item:null});
    }
    if(['switch','drag','replace'].includes(a[1])){
      const side=String(a[2]||'').slice(0,2);
      if(mon[side])identify(side,a[2],a[3]);
    }
    if(a[1]==='move'){
      const x=current(a[2]);if(x&&a[3])x.moves=unique([...x.moves,a[3]]);
    }
    if(a[1]==='-ability'){
      const x=current(a[2]);if(x)x.ability=a[3];
    }
    if(['-item','-enditem'].includes(a[1])){
      const x=current(a[2]);if(x)x.item=a[3];
    }
    if(a[1]==='-mega'||a[1]==='detailschange'){
      const x=current(a[2]);if(x&&a[3])x.revealed_form=a[3];
    }
    if(a[1]==='faint'){
      const side=String(a[2]||'').slice(0,2);
      if(side==='p1')ko.p2++;
      if(side==='p2')ko.p1++;
    }
    if(a[1]==='win')winner=a[2];
  }
  if(!players.p1||!players.p2||!winner)throw Error('El replay no incluye los dos jugadores y un ganador.');
  return {players,winner,ko,reveals:[...mon.p1.values()].map(x=>({...x,side:'p1'})).concat([...mon.p2.values()].map(x=>({...x,side:'p2'})))};
}

async function importReplay(e){e.preventDefault();if(!guard())return;const series=$('#replay-series').value,game_no=Number($('#replay-number').value),link=$('#replay-url').value;try{if(!series)throw Error('Crea antes un BO3');const id=getReplayId(link);const rep=await(await fetch(`https://replay.pokemonshowdown.com/${encodeURIComponent(id)}.json`)).json();const it=interpretReplay(rep);
  const p1=state.players.find(p=>normalizedUser(p.showdown_name)===normalizedUser(it.players.p1));const p2=state.players.find(p=>normalizedUser(p.showdown_name)===normalizedUser(it.players.p2));if(!p1||!p2||p1.user_id===p2.user_id)throw Error('Los nombres de Showdown no coinciden con los configurados. Añádelos primero en Supabase (tabla players).');
  const sl1=it.players.p1===p1.showdown_name?p1.slot:p1.slot;const slotForSide={p1:p1.slot,p2:p2.slot};const winner=normalizedUser(it.winner)===normalizedUser(it.players.p1)?p1:normalizedUser(it.winner)===normalizedUser(it.players.p2)?p2:null;if(!winner)throw Error('No se identificó al ganador');
  const kos_1=it.ko.p1*(p1.slot===1)+it.ko.p2*(p2.slot===1);const kos_2=it.ko.p1*(p1.slot===2)+it.ko.p2*(p2.slot===2);const data={series_id:series,game_no,replay_id:id,replay_url:`https://replay.pokemonshowdown.com/${id}`,winner_id:winner.user_id,winner_name:winner.display_name,kos_1,kos_2,reveals:it.reveals.map(r=>({...r,player_slot:slotForSide[r.side]}))};
  await api('/rest/v1/replay_games',{method:'POST',body:data,headers:{Prefer:'return=minimal'}});let finished=false;try{await rpc('finalize_series',{p_series_id:series});finished=true}catch(err){if(!String(err.message).includes('Aún no hay ganador'))throw err}
  toast(finished?'BO3 cerrado: recompensas contabilizadas':'Replay importado; todavía no hay dos victorias','success');await loadShared();
 }catch(err){toast(err.message,'error')}}

// Catálogo de 377 productos del reglamento; Supabase tiene su propia copia editable.
SHOP = [{"id":1,"name":"Poké Ball","category":"Poké Balls","price":1,"quantity":10},{"id":2,"name":"Honor Ball","category":"Poké Balls","price":1,"quantity":10},{"id":3,"name":"Super Ball","category":"Poké Balls","price":1,"quantity":5},{"id":4,"name":"Ultra Ball","category":"Poké Balls","price":1,"quantity":3},{"id":5,"name":"Malla Ball","category":"Poké Balls","price":1,"quantity":5},{"id":6,"name":"Buceo Ball","category":"Poké Balls","price":1,"quantity":5},{"id":7,"name":"Nido Ball","category":"Poké Balls","price":1,"quantity":5},{"id":8,"name":"Acopio Ball","category":"Poké Balls","price":1,"quantity":5},{"id":9,"name":"Sana Ball","category":"Poké Balls","price":1,"quantity":5},{"id":10,"name":"Lujo Ball","category":"Poké Balls","price":1,"quantity":5},{"id":11,"name":"Ocaso Ball","category":"Poké Balls","price":2,"quantity":5},{"id":12,"name":"Veloz Ball","category":"Poké Balls","price":2,"quantity":5},{"id":13,"name":"Turno Ball","category":"Poké Balls","price":2,"quantity":5},{"id":14,"name":"Master Ball","category":"Poké Balls","price":8,"quantity":1},{"id":15,"name":"Huevo aleatorio","category":"Recompensas","price":22,"quantity":1},{"id":16,"name":"Abomasnowita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":17,"name":"Absolita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":18,"name":"Aggronita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":19,"name":"Ampharosita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":20,"name":"Audinita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":21,"name":"Banettita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":22,"name":"Cameruptita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":23,"name":"Glalita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":24,"name":"Houndoomita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":25,"name":"Pidgeotita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":26,"name":"Steelixita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":27,"name":"Garchompita","category":"Megapiedras estándar","price":25,"quantity":1},{"id":28,"name":"Aerodactylita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":29,"name":"Alakazamita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":30,"name":"Altarianita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":31,"name":"Blastoisita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":32,"name":"Charizardita X","category":"Megapiedras potentes","price":35,"quantity":1},{"id":33,"name":"Charizardita Y","category":"Megapiedras potentes","price":35,"quantity":1},{"id":34,"name":"Galladita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":35,"name":"Gardevoirita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":36,"name":"Gyaradosita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":37,"name":"Heracrossita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":38,"name":"Latiasita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":39,"name":"Latiosita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":40,"name":"Lopunnita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":41,"name":"Manectricita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":42,"name":"Pinsirita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":43,"name":"Sableynita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":44,"name":"Scizorita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":45,"name":"Sceptilita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":46,"name":"Sharpedonita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":47,"name":"Slowbronita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":48,"name":"Swampertita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":49,"name":"Tyranitarita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":50,"name":"Venusaurita","category":"Megapiedras potentes","price":35,"quantity":1},{"id":51,"name":"Beedrillita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":52,"name":"Blazikenita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":53,"name":"Diancita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":54,"name":"Gengarita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":55,"name":"Kangaskhanita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":56,"name":"Lucarita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":57,"name":"Mawilita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":58,"name":"Medichamita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":59,"name":"Metagrossita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":60,"name":"Salamencita","category":"Megapiedras excepcionales","price":45,"quantity":1},{"id":61,"name":"Rocío Bondad","category":"Competitivo — élite","price":38,"quantity":1},{"id":62,"name":"Bola Luminosa","category":"Competitivo — élite","price":15,"quantity":1},{"id":63,"name":"Hueso Grueso","category":"Competitivo — élite","price":14,"quantity":1},{"id":64,"name":"Diente Marino","category":"Competitivo — élite","price":12,"quantity":1},{"id":65,"name":"Escama Marina","category":"Competitivo — élite","price":11,"quantity":1},{"id":66,"name":"Mineral Evolutivo","category":"Competitivo — élite","price":12,"quantity":1},{"id":67,"name":"Lazo Destino","category":"Competitivo — élite","price":3,"quantity":1},{"id":68,"name":"Restos","category":"Competitivo — alto","price":9,"quantity":1},{"id":69,"name":"Vidasfera","category":"Competitivo — alto","price":9,"quantity":1},{"id":70,"name":"Cinta Elegida","category":"Competitivo — alto","price":8,"quantity":1},{"id":71,"name":"Gafas Elegidas","category":"Competitivo — alto","price":8,"quantity":1},{"id":72,"name":"Pañuelo Elegido","category":"Competitivo — alto","price":8,"quantity":1},{"id":73,"name":"Chaleco Asalto","category":"Competitivo — alto","price":8,"quantity":1},{"id":74,"name":"Seguro Debilidad","category":"Competitivo — alto","price":8,"quantity":1},{"id":75,"name":"Casco Dentado","category":"Competitivo — alto","price":7,"quantity":1},{"id":76,"name":"Lodo Negro","category":"Competitivo — alto","price":7,"quantity":1},{"id":77,"name":"Banda Focus","category":"Competitivo — alto","price":7,"quantity":1},{"id":78,"name":"Cinta Experto","category":"Competitivo — medio","price":6,"quantity":1},{"id":79,"name":"Lupa","category":"Competitivo — medio","price":6,"quantity":1},{"id":80,"name":"Gafas Protectoras","category":"Competitivo — medio","price":6,"quantity":1},{"id":81,"name":"Garra Rápida","category":"Competitivo — medio","price":5,"quantity":1},{"id":82,"name":"Periscopio","category":"Competitivo — medio","price":5,"quantity":1},{"id":83,"name":"Polvo Brillo","category":"Competitivo — medio","price":5,"quantity":1},{"id":84,"name":"Garrafilada","category":"Competitivo — medio","price":5,"quantity":1},{"id":85,"name":"Colmillagudo","category":"Competitivo — medio","price":5,"quantity":1},{"id":86,"name":"Tarjeta Roja","category":"Competitivo — medio","price":5,"quantity":1},{"id":87,"name":"Polvo Veloz","category":"Competitivo — medio","price":5,"quantity":1},{"id":88,"name":"Polvo Metálico","category":"Competitivo — medio","price":5,"quantity":1},{"id":89,"name":"Cinta Fuerte","category":"Competitivo — medio","price":4,"quantity":1},{"id":90,"name":"Gafas Especiales","category":"Competitivo — medio","price":4,"quantity":1},{"id":91,"name":"Globo Helio","category":"Competitivo — medio","price":4,"quantity":1},{"id":92,"name":"Botón Escape","category":"Competitivo — medio","price":4,"quantity":1},{"id":93,"name":"Cinta Focus","category":"Competitivo — medio","price":4,"quantity":1},{"id":94,"name":"Hierba Única","category":"Competitivo — medio","price":4,"quantity":1},{"id":95,"name":"Hierba Blanca","category":"Competitivo — medio","price":4,"quantity":1},{"id":96,"name":"Hierba Mental","category":"Competitivo — medio","price":4,"quantity":1},{"id":97,"name":"Garra Recia","category":"Competitivo — medio","price":4,"quantity":1},{"id":98,"name":"Roca Lluvia","category":"Competitivo — medio","price":3,"quantity":1},{"id":99,"name":"Roca Calor","category":"Competitivo — medio","price":3,"quantity":1},{"id":100,"name":"Roca Helada","category":"Competitivo — medio","price":3,"quantity":1},{"id":101,"name":"Roca Suave","category":"Competitivo — medio","price":3,"quantity":1},{"id":102,"name":"Refleluz","category":"Competitivo — medio","price":3,"quantity":1},{"id":103,"name":"Raíz Grande","category":"Competitivo — medio","price":3,"quantity":1},{"id":104,"name":"Campana Concha","category":"Competitivo — medio","price":3,"quantity":1},{"id":105,"name":"Garra Garfio","category":"Competitivo — medio","price":3,"quantity":1},{"id":106,"name":"Metrónomo","category":"Competitivo — medio","price":3,"quantity":1},{"id":107,"name":"Hierro Bola","category":"Competitivo — medio","price":3,"quantity":1},{"id":108,"name":"Cola Plúmbea","category":"Competitivo — medio","price":3,"quantity":1},{"id":109,"name":"Piedra Pómez","category":"Competitivo — medio","price":3,"quantity":1},{"id":110,"name":"Bola Tóxica","category":"Competitivo — medio","price":4,"quantity":1},{"id":111,"name":"Llamasfera","category":"Competitivo — medio","price":4,"quantity":1},{"id":112,"name":"Banda Atadura","category":"Competitivo — medio","price":3,"quantity":1},{"id":113,"name":"Objetivo","category":"Competitivo — medio","price":3,"quantity":1},{"id":114,"name":"Lente Zoom","category":"Competitivo — otros","price":4,"quantity":1},{"id":115,"name":"Lente Ancha","category":"Competitivo — otros","price":4,"quantity":1},{"id":116,"name":"Moneda Amuleto","category":"Competitivo — otros","price":3,"quantity":1},{"id":117,"name":"Campana Alivio","category":"Competitivo — otros","price":3,"quantity":1},{"id":118,"name":"Huevo Suerte","category":"Competitivo — otros","price":3,"quantity":1},{"id":119,"name":"Incienso Suave","category":"Competitivo — otros","price":3,"quantity":1},{"id":120,"name":"Incienso Marino","category":"Competitivo — otros","price":3,"quantity":1},{"id":121,"name":"Incienso Floral","category":"Competitivo — otros","price":3,"quantity":1},{"id":122,"name":"Incienso Raro","category":"Competitivo — otros","price":3,"quantity":1},{"id":123,"name":"Incienso Ondulante","category":"Competitivo — otros","price":3,"quantity":1},{"id":124,"name":"Incienso Puro","category":"Competitivo — otros","price":3,"quantity":1},{"id":125,"name":"Incienso Denso","category":"Competitivo — otros","price":3,"quantity":1},{"id":126,"name":"Incienso Duplo","category":"Competitivo — otros","price":3,"quantity":1},{"id":127,"name":"Incienso Roca","category":"Competitivo — otros","price":3,"quantity":1},{"id":128,"name":"Carbón","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":129,"name":"Agua Mística","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":130,"name":"Semilla Milagro","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":131,"name":"Imán","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":132,"name":"Antiderretir","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":133,"name":"Cinturón Negro","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":134,"name":"Gafas de Sol","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":135,"name":"Pico Afilado","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":136,"name":"Colmillo Dragón","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":137,"name":"Cuchara Torcida","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":138,"name":"Polvo Plata","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":139,"name":"Arena Fina","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":140,"name":"Piedra Dura","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":141,"name":"Hechizo","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":142,"name":"Pañuelo Seda","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":143,"name":"Flecha Venenosa","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":144,"name":"Revestimiento Metálico","category":"Potenciadores de tipo","price":3,"quantity":1},{"id":145,"name":"Tabla Llama","category":"Tablas de tipo","price":4,"quantity":1},{"id":146,"name":"Tabla Linfa","category":"Tablas de tipo","price":4,"quantity":1},{"id":147,"name":"Tabla Pradal","category":"Tablas de tipo","price":4,"quantity":1},{"id":148,"name":"Tabla Trueno","category":"Tablas de tipo","price":4,"quantity":1},{"id":149,"name":"Tabla Helada","category":"Tablas de tipo","price":4,"quantity":1},{"id":150,"name":"Tabla Fuerte","category":"Tablas de tipo","price":4,"quantity":1},{"id":151,"name":"Tabla Tóxica","category":"Tablas de tipo","price":4,"quantity":1},{"id":152,"name":"Tabla Terrax","category":"Tablas de tipo","price":4,"quantity":1},{"id":153,"name":"Tabla Cielo","category":"Tablas de tipo","price":4,"quantity":1},{"id":154,"name":"Tabla Mental","category":"Tablas de tipo","price":4,"quantity":1},{"id":155,"name":"Tabla Bicho","category":"Tablas de tipo","price":4,"quantity":1},{"id":156,"name":"Tabla Pétrea","category":"Tablas de tipo","price":4,"quantity":1},{"id":157,"name":"Tabla Terror","category":"Tablas de tipo","price":4,"quantity":1},{"id":158,"name":"Tabla Draco","category":"Tablas de tipo","price":4,"quantity":1},{"id":159,"name":"Tabla Oscura","category":"Tablas de tipo","price":4,"quantity":1},{"id":160,"name":"Tabla Acero","category":"Tablas de tipo","price":4,"quantity":1},{"id":161,"name":"Tabla Duende","category":"Tablas de tipo","price":4,"quantity":1},{"id":162,"name":"Palo (Farfetch’d)","category":"Específicos de especie","price":5,"quantity":1},{"id":163,"name":"Puño Suerte (Chansey)","category":"Específicos de especie","price":5,"quantity":1},{"id":164,"name":"Módulo Acuático","category":"Específicos de especie","price":6,"quantity":1},{"id":165,"name":"Módulo Eléctrico","category":"Específicos de especie","price":6,"quantity":1},{"id":166,"name":"Módulo Ígneo","category":"Específicos de especie","price":6,"quantity":1},{"id":167,"name":"Módulo Gélido","category":"Específicos de especie","price":6,"quantity":1},{"id":168,"name":"Piedra Fuego","category":"Evolución — piedras","price":2,"quantity":1},{"id":169,"name":"Piedra Agua","category":"Evolución — piedras","price":2,"quantity":1},{"id":170,"name":"Piedra Trueno","category":"Evolución — piedras","price":2,"quantity":1},{"id":171,"name":"Piedra Hoja","category":"Evolución — piedras","price":2,"quantity":1},{"id":172,"name":"Piedra Lunar","category":"Evolución — piedras","price":2,"quantity":1},{"id":173,"name":"Piedra Solar","category":"Evolución — piedras","price":2,"quantity":1},{"id":174,"name":"Piedra Día","category":"Evolución — piedras","price":2,"quantity":1},{"id":175,"name":"Piedra Noche","category":"Evolución — piedras","price":2,"quantity":1},{"id":176,"name":"Piedra Alba","category":"Evolución — piedras","price":2,"quantity":1},{"id":177,"name":"Piedra Oval","category":"Evolución — piedras","price":2,"quantity":1},{"id":178,"name":"Mejora","category":"Evolución — objetos","price":2,"quantity":1},{"id":179,"name":"Disco Extraño","category":"Evolución — objetos","price":2,"quantity":1},{"id":180,"name":"Electrizador","category":"Evolución — objetos","price":2,"quantity":1},{"id":181,"name":"Magmatizador","category":"Evolución — objetos","price":2,"quantity":1},{"id":182,"name":"Protector","category":"Evolución — objetos","price":2,"quantity":1},{"id":183,"name":"Escama Dragón","category":"Evolución — objetos","price":2,"quantity":1},{"id":184,"name":"Tela Terrible","category":"Evolución — objetos","price":2,"quantity":1},{"id":185,"name":"Saquito Fragante","category":"Evolución — objetos","price":2,"quantity":1},{"id":186,"name":"Dulce de Nata","category":"Evolución — objetos","price":2,"quantity":1},{"id":187,"name":"Escama Bella","category":"Evolución — objetos","price":2,"quantity":1},{"id":188,"name":"Roca del Rey","category":"Evolución — objetos","price":5,"quantity":1},{"id":189,"name":"Piedra Eterna","category":"Evolución — entrenamiento","price":1,"quantity":1},{"id":190,"name":"Occa Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":191,"name":"Passho Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":192,"name":"Wacan Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":193,"name":"Rindo Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":194,"name":"Yache Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":195,"name":"Chople Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":196,"name":"Kebia Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":197,"name":"Shuca Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":198,"name":"Coba Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":199,"name":"Payapa Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":200,"name":"Tanga Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":201,"name":"Charti Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":202,"name":"Kasib Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":203,"name":"Haban Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":204,"name":"Colbur Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":205,"name":"Babiri Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":206,"name":"Roseli Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":207,"name":"Chilan Berry","category":"Bayas reductoras de daño","price":2,"quantity":5},{"id":208,"name":"MT01","category":"MT","price":8,"quantity":1},{"id":209,"name":"MT02","category":"MT","price":8,"quantity":1},{"id":210,"name":"MT03","category":"MT","price":8,"quantity":1},{"id":211,"name":"MT04","category":"MT","price":8,"quantity":1},{"id":212,"name":"MT05","category":"MT","price":8,"quantity":1},{"id":213,"name":"MT06","category":"MT","price":8,"quantity":1},{"id":214,"name":"MT07","category":"MT","price":8,"quantity":1},{"id":215,"name":"MT08","category":"MT","price":8,"quantity":1},{"id":216,"name":"MT09","category":"MT","price":8,"quantity":1},{"id":217,"name":"MT10","category":"MT","price":8,"quantity":1},{"id":218,"name":"MT11","category":"MT","price":8,"quantity":1},{"id":219,"name":"MT12","category":"MT","price":8,"quantity":1},{"id":220,"name":"MT13","category":"MT","price":8,"quantity":1},{"id":221,"name":"MT14","category":"MT","price":8,"quantity":1},{"id":222,"name":"MT15","category":"MT","price":8,"quantity":1},{"id":223,"name":"MT16","category":"MT","price":8,"quantity":1},{"id":224,"name":"MT17","category":"MT","price":8,"quantity":1},{"id":225,"name":"MT18","category":"MT","price":8,"quantity":1},{"id":226,"name":"MT19","category":"MT","price":8,"quantity":1},{"id":227,"name":"MT20","category":"MT","price":8,"quantity":1},{"id":228,"name":"MT21","category":"MT","price":8,"quantity":1},{"id":229,"name":"MT22","category":"MT","price":8,"quantity":1},{"id":230,"name":"MT23","category":"MT","price":8,"quantity":1},{"id":231,"name":"MT24","category":"MT","price":8,"quantity":1},{"id":232,"name":"MT25","category":"MT","price":8,"quantity":1},{"id":233,"name":"MT26","category":"MT","price":8,"quantity":1},{"id":234,"name":"MT27","category":"MT","price":8,"quantity":1},{"id":235,"name":"MT28","category":"MT","price":8,"quantity":1},{"id":236,"name":"MT29","category":"MT","price":8,"quantity":1},{"id":237,"name":"MT30","category":"MT","price":8,"quantity":1},{"id":238,"name":"MT31","category":"MT","price":8,"quantity":1},{"id":239,"name":"MT32","category":"MT","price":8,"quantity":1},{"id":240,"name":"MT33","category":"MT","price":8,"quantity":1},{"id":241,"name":"MT34","category":"MT","price":8,"quantity":1},{"id":242,"name":"MT35","category":"MT","price":8,"quantity":1},{"id":243,"name":"MT36","category":"MT","price":8,"quantity":1},{"id":244,"name":"MT37","category":"MT","price":8,"quantity":1},{"id":245,"name":"MT38","category":"MT","price":8,"quantity":1},{"id":246,"name":"MT39","category":"MT","price":8,"quantity":1},{"id":247,"name":"MT40","category":"MT","price":8,"quantity":1},{"id":248,"name":"MT41","category":"MT","price":8,"quantity":1},{"id":249,"name":"MT42","category":"MT","price":8,"quantity":1},{"id":250,"name":"MT43","category":"MT","price":8,"quantity":1},{"id":251,"name":"MT44","category":"MT","price":8,"quantity":1},{"id":252,"name":"MT45","category":"MT","price":8,"quantity":1},{"id":253,"name":"MT46","category":"MT","price":8,"quantity":1},{"id":254,"name":"MT47","category":"MT","price":8,"quantity":1},{"id":255,"name":"MT48","category":"MT","price":8,"quantity":1},{"id":256,"name":"MT49","category":"MT","price":8,"quantity":1},{"id":257,"name":"MT50","category":"MT","price":8,"quantity":1},{"id":258,"name":"MT51","category":"MT","price":8,"quantity":1},{"id":259,"name":"MT52","category":"MT","price":8,"quantity":1},{"id":260,"name":"MT53","category":"MT","price":8,"quantity":1},{"id":261,"name":"MT54","category":"MT","price":8,"quantity":1},{"id":262,"name":"MT55","category":"MT","price":8,"quantity":1},{"id":263,"name":"MT56","category":"MT","price":8,"quantity":1},{"id":264,"name":"MT57","category":"MT","price":8,"quantity":1},{"id":265,"name":"MT58","category":"MT","price":8,"quantity":1},{"id":266,"name":"MT59","category":"MT","price":8,"quantity":1},{"id":267,"name":"MT60","category":"MT","price":8,"quantity":1},{"id":268,"name":"MT61","category":"MT","price":8,"quantity":1},{"id":269,"name":"MT62","category":"MT","price":8,"quantity":1},{"id":270,"name":"MT63","category":"MT","price":8,"quantity":1},{"id":271,"name":"MT64","category":"MT","price":8,"quantity":1},{"id":272,"name":"MT65","category":"MT","price":8,"quantity":1},{"id":273,"name":"MT66","category":"MT","price":8,"quantity":1},{"id":274,"name":"MT67","category":"MT","price":8,"quantity":1},{"id":275,"name":"MT68","category":"MT","price":8,"quantity":1},{"id":276,"name":"MT69","category":"MT","price":8,"quantity":1},{"id":277,"name":"MT70","category":"MT","price":8,"quantity":1},{"id":278,"name":"MT71","category":"MT","price":8,"quantity":1},{"id":279,"name":"MT72","category":"MT","price":8,"quantity":1},{"id":280,"name":"MT73","category":"MT","price":8,"quantity":1},{"id":281,"name":"MT74","category":"MT","price":8,"quantity":1},{"id":282,"name":"MT75","category":"MT","price":8,"quantity":1},{"id":283,"name":"MT76","category":"MT","price":8,"quantity":1},{"id":284,"name":"MT77","category":"MT","price":8,"quantity":1},{"id":285,"name":"MT78","category":"MT","price":8,"quantity":1},{"id":286,"name":"MT79","category":"MT","price":8,"quantity":1},{"id":287,"name":"MT80","category":"MT","price":8,"quantity":1},{"id":288,"name":"MT81","category":"MT","price":8,"quantity":1},{"id":289,"name":"MT82","category":"MT","price":8,"quantity":1},{"id":290,"name":"MT83","category":"MT","price":8,"quantity":1},{"id":291,"name":"MT84","category":"MT","price":8,"quantity":1},{"id":292,"name":"MT85","category":"MT","price":8,"quantity":1},{"id":293,"name":"MT86","category":"MT","price":8,"quantity":1},{"id":294,"name":"MT87","category":"MT","price":8,"quantity":1},{"id":295,"name":"MT88","category":"MT","price":8,"quantity":1},{"id":296,"name":"MT89","category":"MT","price":8,"quantity":1},{"id":297,"name":"MT90","category":"MT","price":8,"quantity":1},{"id":298,"name":"MT91","category":"MT","price":8,"quantity":1},{"id":299,"name":"MT92","category":"MT","price":8,"quantity":1},{"id":300,"name":"MT93","category":"MT","price":8,"quantity":1},{"id":301,"name":"MT94","category":"MT","price":8,"quantity":1},{"id":302,"name":"MT95","category":"MT","price":8,"quantity":1},{"id":303,"name":"MT96","category":"MT","price":8,"quantity":1},{"id":304,"name":"MT97","category":"MT","price":8,"quantity":1},{"id":305,"name":"MT98","category":"MT","price":8,"quantity":1},{"id":306,"name":"MT99","category":"MT","price":8,"quantity":1},{"id":307,"name":"MT100","category":"MT","price":8,"quantity":1},{"id":308,"name":"Brazal Recio","category":"Entrenamiento — equipables","price":2,"quantity":1},{"id":309,"name":"Cinto Recio","category":"Entrenamiento — equipables","price":2,"quantity":1},{"id":310,"name":"Lente Recia","category":"Entrenamiento — equipables","price":2,"quantity":1},{"id":311,"name":"Banda Recia","category":"Entrenamiento — equipables","price":2,"quantity":1},{"id":312,"name":"Franja Recia","category":"Entrenamiento — equipables","price":2,"quantity":1},{"id":313,"name":"Pesa Recia","category":"Entrenamiento — equipables","price":2,"quantity":1},{"id":314,"name":"Escama Corazón","category":"Entrenamiento — otros","price":2,"quantity":5},{"id":315,"name":"Repelente","category":"Captura y exploración","price":1,"quantity":10},{"id":316,"name":"Superrepelente","category":"Captura y exploración","price":1,"quantity":10},{"id":317,"name":"Repelente Máximo","category":"Captura y exploración","price":1,"quantity":10},{"id":318,"name":"Cuerda Huida","category":"Captura y exploración","price":1,"quantity":10},{"id":319,"name":"Miel","category":"Captura y exploración","price":2,"quantity":5},{"id":320,"name":"Poké Muñeco","category":"Captura y exploración","price":2,"quantity":5},{"id":321,"name":"Flauta Negra","category":"Captura y exploración","price":3,"quantity":1},{"id":322,"name":"Flauta Blanca","category":"Captura y exploración","price":3,"quantity":1},{"id":323,"name":"Parte Roja","category":"Captura y exploración","price":2,"quantity":1},{"id":324,"name":"Parte Azul","category":"Captura y exploración","price":2,"quantity":1},{"id":325,"name":"Parte Verde","category":"Captura y exploración","price":2,"quantity":1},{"id":326,"name":"Parte Amarilla","category":"Captura y exploración","price":2,"quantity":1},{"id":327,"name":"Ataque X","category":"Combate — potenciadores mochila","price":9,"quantity":1},{"id":328,"name":"Defensa X","category":"Combate — potenciadores mochila","price":9,"quantity":1},{"id":329,"name":"Velocidad X","category":"Combate — potenciadores mochila","price":9,"quantity":1},{"id":330,"name":"Precisión X","category":"Combate — potenciadores mochila","price":9,"quantity":1},{"id":331,"name":"Ataque Especial X","category":"Combate — potenciadores mochila","price":9,"quantity":1},{"id":332,"name":"Defensa Especial X","category":"Combate — potenciadores mochila","price":9,"quantity":1},{"id":333,"name":"Directo","category":"Combate — potenciadores mochila","price":10,"quantity":1},{"id":334,"name":"Protec. Especial","category":"Combate — potenciadores mochila","price":6,"quantity":1},{"id":335,"name":"Fósil Helix","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":336,"name":"Fósil Domo","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":337,"name":"Ámbar Viejo","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":338,"name":"Fósil Raíz","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":339,"name":"Fósil Garra","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":340,"name":"Fósil Coraza","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":341,"name":"Fósil Cráneo","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":342,"name":"Fósil Tapa","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":343,"name":"Fósil Pluma","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":344,"name":"Fósil Mandíbula","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":345,"name":"Fósil Aleta","category":"Fósiles (captura adicional)","price":25,"quantity":1},{"id":346,"name":"Pañuelo Rojo","category":"Concursos y ocio","price":2,"quantity":1},{"id":347,"name":"Pañuelo Azul","category":"Concursos y ocio","price":2,"quantity":1},{"id":348,"name":"Pañuelo Verde","category":"Concursos y ocio","price":2,"quantity":1},{"id":349,"name":"Pañuelo Amarillo","category":"Concursos y ocio","price":2,"quantity":1},{"id":350,"name":"Abono Fértil","category":"Concursos y ocio","price":1,"quantity":5},{"id":351,"name":"Abono Fijador","category":"Concursos y ocio","price":1,"quantity":5},{"id":352,"name":"Abono Rápido","category":"Concursos y ocio","price":1,"quantity":5},{"id":353,"name":"Abono Lento","category":"Concursos y ocio","price":1,"quantity":5},{"id":354,"name":"Abono Sorpresa","category":"Concursos y ocio","price":1,"quantity":5},{"id":355,"name":"Abono Rico","category":"Concursos y ocio","price":1,"quantity":5},{"id":356,"name":"Abono Acelerador","category":"Concursos y ocio","price":1,"quantity":5},{"id":357,"name":"Abono Increíble","category":"Concursos y ocio","price":1,"quantity":5},{"id":358,"name":"Mini Seta","category":"Tesoros y reventa","price":5,"quantity":5},{"id":359,"name":"Polvoestelar","category":"Tesoros y reventa","price":5,"quantity":5},{"id":360,"name":"Perla","category":"Tesoros y reventa","price":5,"quantity":5},{"id":361,"name":"Pluma Bella","category":"Tesoros y reventa","price":5,"quantity":5},{"id":362,"name":"Seta Grande","category":"Tesoros y reventa","price":10,"quantity":3},{"id":363,"name":"Trozo Estrella","category":"Tesoros y reventa","price":10,"quantity":3},{"id":364,"name":"Perla Grande","category":"Tesoros y reventa","price":10,"quantity":3},{"id":365,"name":"Hueso Raro","category":"Tesoros y reventa","price":10,"quantity":3},{"id":366,"name":"Pepita","category":"Tesoros y reventa","price":15,"quantity":1},{"id":367,"name":"Perla Triple","category":"Tesoros y reventa","price":15,"quantity":1},{"id":368,"name":"Trozo Cometa","category":"Tesoros y reventa","price":15,"quantity":1},{"id":369,"name":"Seta Aroma","category":"Tesoros y reventa","price":15,"quantity":1},{"id":370,"name":"Pepita Grande","category":"Tesoros y reventa","price":35,"quantity":1},{"id":371,"name":"Corona Antigua","category":"Tesoros y reventa","price":35,"quantity":1},{"id":372,"name":"Estatua Antigua","category":"Tesoros y reventa","price":35,"quantity":1},{"id":373,"name":"Jarrón Antiguo","category":"Tesoros y reventa","price":35,"quantity":1},{"id":374,"name":"Moneda Antigua","category":"Tesoros y reventa","price":15,"quantity":1},{"id":375,"name":"Moneda Plata Antigua","category":"Tesoros y reventa","price":15,"quantity":1},{"id":376,"name":"Moneda Oro Antigua","category":"Tesoros y reventa","price":15,"quantity":1},{"id":377,"name":"Brazalete Antiguo","category":"Tesoros y reventa","price":15,"quantity":1}];

if(typeof document!=='undefined'){
  state.catalog=SHOP;
  document.addEventListener('DOMContentLoaded',async()=>{
    const file=$('#save-file');file.addEventListener('change',e=>handleSave(e.target.files?.[0]));
    $('#btn-import').onclick=()=>actions('import');$('#btn-account').onclick=()=>actions('account');
    $('#menu-toggle').onclick=()=>$('#sidebar').classList.toggle('open');
    document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>$('#sidebar').classList.remove('open')));
    window.addEventListener('hashchange',render);
    render();
    if(CONNECTED){if(state.session){try{await loadShared()}catch(err){toast('Sesión caducada; vuelve a iniciar sesión.','error');state.session=null;sessionStorage.removeItem('dualocke_session');loginModal()}}else loginModal()}
  });
}
export {parseSave,decodePK6,calcStats,interpretReplay,getReplayId,locationName,planCaptureRoutes};
