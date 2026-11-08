/* LOCKE ESCRIBE — front-end estático + Supabase.
 * Solo edita las DOS constantes siguientes al desplegar.
 * No escribas jamás una clave service_role aquí.
 */
const SUPABASE_URL = 'https://htwoumxhjzmiwnnbempi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5n2Vn1GcFGMgSiTIqaHqKQ_0UsA0sqQ';
const CONNECTED = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU_CLAVE');

/* Gimnasios RO_2.0: la Liga y Calle Victoria siguen pendientes de confirmar. */
import {ORAS_BASE_STATS,getOrasBaseStats} from './oras-base-stats.js';
import {ORAS_SPECIES_NAMES} from './oras-species-names.js';
import {repriceShopItem, extraLifePurchased, TRAINING_SHOP_ITEMS, TRAINING_SERVICE_IDS, TRAINING_IV_STATS} from './economia-reglas.js';
import {normalizeManualGame} from './manual-rules.js';
import {SHOP_CATALOG} from './data/shop-catalog.js';

const BOSSES = [
 ['Petra',18], ['Marcial',21], ['Érico',27], ['Candela',36],
 ['Norman',39], ['Alana',46], ['Vito y Leti',59], ['Plubio',60],
 ['Blasco · Calle Victoria',48], ['Sixto · Alto Mando',52],
 ['Fátima · Alto Mando',53], ['Nívea · Alto Mando',54],
 ['Dracón · Alto Mando',55], ['Máximo · Campeón',59]
];
const ROUTES = Array.from({length:34}, (_,i)=>`Ruta ${101+i}`).concat(['Pueblo Escaso','Pueblo Azuliza','Ciudad Petalia','Ciudad Férrica','Ciudad Portual','Ciudad Malvalona','Pueblo Verdegal','Pueblo Pardal','Ciudad Lavacalda','Pueblo Oromar','Ciudad Arborada','Ciudad Calagua','Ciudad Algaria','Arrecípolis','Ciudad Colosalia','Bosque Petalia','Cueva Granito','Cueva Fervergal','Túnel Fervegal','Monte Pírico','Cueva Cardumen','Caverna Abisal','Calle Victoria','Nueva Malvalona','Monte Cenizo','Cascada Meteoro','Desierto','Isla del Sur','Cueva Ancestral','Zonas SUPER RR (añadir manualmente)']);
const NATURES = ['Fuerte','Huraña','Audaz','Firme','Pícara','Osada','Dócil','Plácida','Agitada','Floja','Miedosa','Activa','Seria','Alegre','Ingenua','Modesta','Afable','Mansa','Tímida','Alocada','Serena','Amable','Grosera','Cauta','Rara'];
const SHUFFLES = [0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2, 2,0,1,3, 3,0,1,2, 2,0,3,1, 3,0,2,1, 1,2,0,3, 1,3,0,2, 2,1,0,3, 3,1,0,2, 2,3,0,1, 3,2,0,1, 1,2,3,0, 1,3,2,0, 2,1,3,0, 3,1,2,0, 2,3,1,0, 3,2,1,0, 0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2];
const $ = sel => document.querySelector(sel);
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => d ? new Date(d).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}) : 'Sin actualizar';
const bar = (v,total=40) => `<div class="progress"><span style="width:${Math.max(0,Math.min(100,100*v/(total||1)))}%"></span></div>`;
const unique = arr=>[...new Set(arr)];
const defaults={life_limit:40, gym_pf:3, ko_pf:1, egg_price:14, cap_bst:601};
const demoPeople=[{user_id:'demo-1',slot:1,display_name:'Jugador 1'},{user_id:'demo-2',slot:2,display_name:'Jugador 2'}];
const SAMPLE=[{player_id:'demo-1',trainer_name:'Jugador 1',badges:0,deaths:0,map_label:'Sin datos',updated_at:null,team_count:0},{player_id:'demo-2',trainer_name:'Jugador 2',badges:0,deaths:0,map_label:'Sin datos',updated_at:null,team_count:0}];
const SHOP = SHOP_CATALOG;
function storedSession(){try{return JSON.parse(sessionStorage.getItem('dualocke_session')||'null')}catch{return null}}
let state={page:'inicio',session:storedSession(), players:demoPeople,progress:SAMPLE,routes:[],specialEncounters:[],confirmations:[],syncError:'',lastSuccessfulSync:null,encounterTab:'routes',reviewShowEmpty:false,adventures:[],resetRequest:null,archivePreview:null,catalog:[],series:[],games:[],economy:[],claims:[],pokemon:[],settings:{...defaults},account:null,dex:{},dexReady:false,selectedRoute:'Ruta 101',selectedMapPlayer:'all',atlasZoom:1,atlasScrollLeft:0,selectedCategory:'Todas',shopQuery:'',pendingSave:null,preview:null,lastEggSuggestion:null};
function toast(msg,type=''){const root=$('#toasts');if(!root)return;const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;root.append(el);setTimeout(()=>el.remove(),5500)}
function modal(title,html){const d=$('#modal');d.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" data-close="1" aria-label="Cerrar">×</button></header>${html}`;d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();return d;}
function guard(){if(state.syncError){toast('No se puede guardar mientras falle la sincronización. Reintenta la carga.','error');return false;}if(!CONNECTED){toast('Modo vista previa: configura Supabase para guardar datos compartidos.','error');return false;}if(!state.account){loginModal();return false;}return true;}
function conf(k){return Number(state.settings[k]??defaults[k]??0)}
function player(n){return state.players.find(p=>p.slot===n)||demoPeople[n-1]}
function prog(n){return state.progress.find(p=>p.player_id===player(n).user_id)||SAMPLE[n-1]}
function pname(n){const p=prog(n);return p.trainer_name||player(n).display_name||`Jugador ${n}`}
function bonusLife(playerId){return extraLifePurchased(state.economy,playerId)?1:0;}
function balance(playerId){return state.economy.filter(e=>e.player_id===playerId).reduce((a,e)=>a+Number(e.amount),0)}
function own(){return state.players.find(x=>x.user_id===state.account?.id)}
function detailHead(eye,title,sub,action=''){return `<div class="page-heading"><div><div class="eyebrow">${eye}</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function card(title,body,classes=''){return `<section class="card ${classes}"><div class="card-head"><h2>${title}</h2></div>${body}</section>`}
function pBadge(v,clazz=''){return `<span class="badge ${clazz}">${esc(v)}</span>`}
// El color representa la ROM, no el orden del usuario en Supabase.
// Brunmega puede incluir caracteres decorativos entre «Brun» y «mega».
function editionForName(value){
 const name=String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 if(/brun.*mega/.test(name))return 'ruby';
 if(/(?:^|[^a-z])(?:varo|alvaro)(?=$|[^a-z])/.test(name))return 'sapphire';
 return null;
}
function playerEdition(n){
 return editionForName(player(n).display_name)||editionForName(prog(n).trainer_name)||(n===1?'ruby':'sapphire');
}
function pcolor(n){return playerEdition(n)==='ruby'?'red':'blue'}
// Ajusta etiquetas y marcas visuales sin modificar el orden ni los datos de los jugadores.
function decoratePlayerColors(){
 $$('.trainer-card .trainer-badge').forEach((badge,i)=>{
   badge.textContent=playerEdition(i+1)==='ruby'?'RUBÍ':'ZAFIRO';
 });
 const decorate=(selector)=> $$(selector).forEach((element,i)=>element.classList.add(`edition-${playerEdition(i+1)}`));
 decorate('.location-player');
 decorate('.atlas-detail-player');
 $$('.atlas-tab[data-map-view]').forEach(tab=>{
   const slot=Number(tab.dataset.mapView);
   if(slot===1||slot===2)tab.classList.add(`edition-${playerEdition(slot)}`);
 });
 $$('.atlas-mini-states').forEach(group=>{
   [...group.children].slice(0,2).forEach((element,i)=>element.classList.add(`edition-${playerEdition(i+1)}`));
 });
 $$('.enc18-player-grid').forEach(group=>{
   [...group.children].slice(0,2).forEach((element,i)=>element.classList.add(`edition-${playerEdition(i+1)}`));
 });
 const map=$('.atlas-map');
 if(!map)return;
 const one=$('.atlas-key .k-one');
 if(!one)return;
 if(map.dataset.focus==='all'){
   const legend=one.parentElement;
   legend.innerHTML='<i class="k-ruby"></i> Solo Rubí';
   legend.insertAdjacentHTML('afterend','<span><i class="k-sapphire"></i> Solo Zafiro</span>');
 }else{
   one.className=`k-${playerEdition(Number(map.dataset.focus))}`;
 }
}

function ensurePage(){const valid=['inicio','mapa','combates','tienda','huevos','historial','ajustes'];state.page=valid.includes(location.hash.slice(1))?location.hash.slice(1):'inicio';}
function $$(s){return [...document.querySelectorAll(s)]}
function render(){
 if(typeof document==='undefined')return;
 ensurePage();
 $$('nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===state.page));
 $('#crumb').textContent={inicio:'RESUMEN',mapa:'MAPA DE HOENN',combates:'COMBATES',tienda:'TIENDA',huevos:'INCUBADORA',historial:'HISTORIAL',ajustes:'CONFIGURACIÓN'}[state.page];
 const connected=CONNECTED&&!!state.account&&!state.syncError;
 $('#conn-label').textContent=state.syncError?'Error de sincronización':CONNECTED?(state.account?'Sesión segura · Supabase':'Acceso requerido'):'Vista previa · Sin sincronizar';
 $('#conn-dot').classList.toggle('online',connected);
 $('#btn-account').textContent=state.account?(own()?.display_name||'✓').charAt(0).toUpperCase():'?';
 const sections={inicio:renderHome,mapa:renderMap,combates:renderBattlesManual,tienda:renderShop,huevos:renderEggsManual,historial:renderHistory,ajustes:renderSettings};
 const atlasOld=$('.atlas-scroll');
 if(atlasOld)state.atlasScrollLeft=atlasOld.scrollLeft;
 const warning=state.syncError?`<div class="notice le20-sync-warning" role="alert"><strong>Datos no sincronizados.</strong> No importes ni registres nuevas operaciones hasta recuperar la conexión. Error: ${esc(state.syncError)} <button type="button" class="button secondary compact" data-action="retry-sync">Reintentar</button></div>`:'';
 $('#screen').innerHTML=warning+sections[state.page]();
 decoratePlayerColors();
 bindPage();
 const atlasNext=$('.atlas-scroll');
 if(atlasNext)atlasNext.scrollLeft=state.atlasScrollLeft||0;
}
function renderHome(){const first = prog(1),second=prog(2);const panels=[first,second].map((p,i)=>{const n=i+1,life=conf('life_limit')+bonusLife(player(n).user_id)-Number(p.deaths||0);if(!state.progress.some(row=>row.player_id===player(n).user_id))return `<article class="card trainer-card ${pcolor(n)}"><div class="trainer-line"><div><div class="eyebrow">ENTRENADOR 0${n}</div><div class="trainer-name">${esc(player(n).display_name||`Jugador ${n}`)}</div></div><span class="badge">Sin partida</span></div><div class="rule-note mt-3">Este jugador todavía no ha importado ningún guardado. Sus vidas, medallas, capturas y Pokéfichas aparecerán cuando se incorpore.</div></article>`;return `<article class="card trainer-card ${pcolor(n)}"><div class="trainer-line"><div><div class="eyebrow">ENTRENADOR 0${n}</div><div class="trainer-name">${esc(pname(n))}</div></div><span class="trainer-badge">${i?'ZAFIRO':'RUBÍ'}</span></div><div class="trainer-grid"><div class="trainer-metric"><small>VIDAS RESTANTES</small><div class="large-stat">${life}<small> / ${conf('life_limit')+bonusLife(player(n).user_id)}</small></div>${bar(life,conf('life_limit')+bonusLife(player(n).user_id))}</div><div class="trainer-metric"><small>POKÉFICHAS</small><div class="large-stat accent-gold">${balance(player(n).user_id)} <small>PF</small></div></div><div class="trainer-metric"><small>MEDALLAS</small><div class="large-stat">${p.badges||0}<small> / 8</small></div></div><div class="trainer-metric"><small>BAJAS</small><div class="large-stat accent-red">${p.deaths||0}</div></div></div><div class="trainer-bottom"><span>⌖ ${esc(p.map_label||'Mapa interno sin identificar')}</span><span>↻ ${esc(fmt(p.updated_at))}</span></div></article>`}).join('');const gym=Math.min(8,Math.max(0,Math.min(Number(first.badges||0),Number(second.badges||0)))),next=BOSSES[gym];return `${detailHead('REGIÓN DE HOENN · DOS ENTRENADORES','Estado del Dualocke','Toda la aventura en un mismo lugar. La información secreta de los equipos nunca aparece en este panel.',`<button class="button" data-action="import">↑ Importar partida</button>`)}<div class="grid-2">${panels}</div><div class="metric-strip section-gap">${[["PRÓXIMO LÍMITE",next[1]+' Nv.','accent-red'],['PRÓXIMO JEFE',next[0],'accent-blue'],['COMBATES REGISTRADOS',state.series.filter(s=>s.status==='finished').length,'accent-gold']].map(([label,value,cl])=>`<div class="card"><div class="kicker">${label}</div><div class="stat-value ${cl}">${esc(value)}</div></div>`).join('')}</div><div class="columns-main section-gap">${card('Progreso de la aventura',BOSSES.map(([name,cap],i)=>`<div class="boss-line"><div class="flex"><span class="monogram">${i+1}</span><div><strong>${esc(name)}</strong><div class="small">Límite: nivel ${cap}</div></div></div><div>${pBadge(i<gym?'Superado':i===gym?'Próximo':'Pendiente',i<gym?'green':i===gym?'amber':'')}</div></div>`).join(''))}${card('Tu siguiente paso',`<p class="muted mb-3">Importa los dos guardados para activar el seguimiento de vidas, medallas, capturas y huevos. Registra manualmente los resultados de los combates, con confirmación de ambos.</p><div class="stack"><button class="button secondary full" data-action="import">↑ Subir mi archivo main</button><button class="button secondary full" data-go="combates">⚔ Registrar un BO3</button><button class="button secondary full" data-go="huevos">◌ Abrir un huevo</button><div class="rule-note">40 vidas iniciales, modificables en Ajustes. Las cajas 30 y 31 cuentan como cementerios; los huevos no cuentan como bajas.</div></div>`)}</div>`}
/* v2.0: claves estables; corregir un rótulo no crea otra captura. */
const ZONE_ALIASES=Object.freeze({
 'Pueblo Lavacalda':'Ciudad Lavacalda',
 'Túnel Fervergal':'Túnel Fervegal'
});
function canonicalZone(zone){const z=String(zone||'').trim();return ZONE_ALIASES[z]||z}
function routeState(id,zone){const key=canonicalZone(zone);return state.routes.find(r=>r.owner_id===id && canonicalZone(r.zone_key)===key)}
// Atlas de Hoenn. Las posiciones del tablero son propias de la aplicación.
function publicRouteStatus(zone,slot){return routeState(player(slot).user_id,zone)?.status||'unknown'}
function zoneStatuses(zone){return [1,2].map(n=>publicRouteStatus(zone,n))}
function zoneCaptureCount(zone){return zoneStatuses(zone).filter(s=>s==='captured').length}
function zoneVisualClass(zone,focus='all'){
 const statuses=zoneStatuses(zone), captured=[statuses[0]==='captured',statuses[1]==='captured'];
 const capturedCount=captured.filter(Boolean).length;
 if(focus==='all')return capturedCount===2?'state-both':capturedCount===1?`state-one edition-${playerEdition(captured[0]?1:2)}`:'state-none';
 const slot=Math.max(1,Math.min(2,Number(focus)||1));
 if(!captured[slot-1])return `state-none focus-slot-${slot}`;
 return `state-player focus-slot-${slot} edition-${playerEdition(slot)} ${capturedCount===2?'state-both':'state-one'}`;
}
function mapStatusLabel(status){return status==='captured'?'Capturada':status==='failed'?'Fallida':status==='free'?'Disponible':'Sin verificar'}
/* v2.1: estados públicos del atlas; sin datos privados ni tablas de encuentros. */
function atlasStatusClass(zone,focus='all'){
 const statuses=zoneStatuses(zone);
 const focused=focus==='all'?statuses:[statuses[Number(focus)-1]||'unknown'];
 if(focus==='all' && statuses.includes('captured'))return statuses.includes('failed')?'atlas-mixed-failed':'';
 if(focused.includes('failed'))return 'atlas-failed';
 if(focused.includes('free'))return 'atlas-available';
 return 'atlas-unknown';
}
const ATLAS_MIN_ZOOM=.35;
function atlasZoomValue(){return Math.max(ATLAS_MIN_ZOOM,Math.min(2,Number(state.atlasZoom)||1))}
function atlasChangeZoom(step){
 const old=$('.atlas-scroll');
 const relative=old?(old.scrollLeft+old.clientWidth/2)/Math.max(1,old.scrollWidth):.5;
 state.atlasZoom=Math.round(Math.max(ATLAS_MIN_ZOOM,Math.min(2,atlasZoomValue()+step))*100)/100;
 render();
 const next=$('.atlas-scroll');
 if(next){next.scrollLeft=Math.max(0,relative*next.scrollWidth-next.clientWidth/2);state.atlasScrollLeft=next.scrollLeft}
}
function atlasFocusSelected(){
 const sc=$('.atlas-scroll');if(!sc)return;
 const target=HOENN_ATLAS.find(n=>n.key===state.selectedRoute);if(!target)return;
 const svg=sc.querySelector('.atlas-map');
 const x=target.x*(svg.getBoundingClientRect().width/900);
 sc.scrollTo({left:Math.max(0,x-sc.clientWidth/2),behavior:'smooth'});
}

/* v2.1.3 · Navegación del mapa, solo lectura de estados ya públicos. */
function atlasFitView(){
 const container=$('.atlas-scroll');if(!container)return;
 const fit=Math.max(ATLAS_MIN_ZOOM,Math.min(2,(container.clientWidth-2)/900));
 atlasChangeZoom(fit-atlasZoomValue());
}
function atlasPeek(zone){
 const card=$('.atlas-peek');if(!card)return;
 const key=canonicalZone(zone||state.selectedRoute);
 const label=card.querySelector('[data-peek-name]');
 const states=card.querySelector('[data-peek-states]');
 if(label)label.textContent=key;
 if(states)states.textContent=[1,2].map(n=>`${pname(n)}: ${mapStatusLabel(publicRouteStatus(key,n))}`).join(' · ');
}

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
/* Cartografía pixel-art y posiciones originales: Hoenn.html / Hoennmin.png, código aportado de BLaDoM.
   Los datos de encuentros del proyecto de referencia NO se importan. */
const HOENN_MAP_IMAGE = new URL('./assets/hoenn-map.png', import.meta.url).href;
const HOENN_ATLAS = [
  {key:'Ruta 101',label:'101',x:154.8,y:349.59,w:28.8,h:37.94,kind:'route'},
  {key:'Ruta 102',label:'102',x:110.25,y:323.57,w:58.5,h:27.1,kind:'route'},
  {key:'Ruta 103',label:'103',x:197.55,y:295.12,w:112.5,h:30.89,kind:'route'},
  {key:'Ruta 104',label:'104',x:42.3,y:291.87,w:28.8,h:90.51,kind:'route'},
  {key:'Ruta 105',label:'105',x:41.4,y:379.4,w:28.8,h:86.72,kind:'water'},
  {key:'Ruta 106',label:'106',x:69.3,y:434.95,w:84.6,h:29.81,kind:'water'},
  {key:'Ruta 107',label:'107',x:155.25,y:463.68,w:85.5,h:30.89,kind:'water'},
  {key:'Ruta 108',label:'108',x:225,y:463.68,w:54,h:30.89,kind:'water'},
  {key:'Ruta 109',label:'109',x:266.85,y:434.95,w:29.7,h:87.26,kind:'water'},
  {key:'Ruta 110',label:'110',x:265.5,y:298.1,w:27,h:86.72,kind:'route'},
  {key:'Ruta 111',label:'111',x:265.5,y:139.84,w:27,h:164.77,kind:'route'},
  {key:'Ruta 112',label:'112',x:225,y:154.47,w:54,h:27.1,kind:'route'},
  {key:'Ruta 113',label:'113',x:198,y:71.27,w:108,h:27.64,kind:'route'},
  {key:'Ruta 114',label:'114',x:81,y:98.37,w:54,h:81.84,kind:'route'},
  {key:'Ruta 115',label:'115',x:40.5,y:154.47,w:27,h:81.3,kind:'route'},
  {key:'Ruta 116',label:'116',x:110.25,y:208.94,w:112.5,h:27.64,kind:'route'},
  {key:'Ruta 117',label:'117',x:211.5,y:238.48,w:81,h:27.1,kind:'route'},
  {key:'Ruta 118',label:'118',x:333,y:238.48,w:54,h:27.1,kind:'route'},
  {key:'Ruta 119',label:'119',x:351,y:142.28,w:27,h:170.73,kind:'route'},
  {key:'Ruta 120',label:'120',x:405,y:112.47,w:27,h:111.11,kind:'route'},
  {key:'Ruta 121',label:'121',x:477,y:154.47,w:117,h:27.1,kind:'route'},
  {key:'Ruta 122',label:'122',x:488.25,y:197.83,w:31.5,h:59.62,kind:'water'},
  {key:'Ruta 123',label:'123',x:432,y:238.48,w:144,h:27.1,kind:'route'},
  {key:'Ruta 124',label:'124',x:643.05,y:184.28,w:110.7,h:86.72,kind:'water'},
  {key:'Ruta 125',label:'125',x:726.75,y:168.02,w:58.5,h:54.2,kind:'water'},
  {key:'Ruta 126',label:'126',x:631.35,y:268.29,w:87.3,h:81.3,kind:'water'},
  {key:'Ruta 127',label:'127',x:715.5,y:268.29,w:81,h:81.3,kind:'water'},
  {key:'Ruta 128',label:'128',x:727.65,y:322.49,w:110.7,h:27.1,kind:'water'},
  {key:'Ruta 129',label:'129',x:729,y:350.94,w:54,h:29.81,kind:'water'},
  {key:'Ruta 130',label:'130',x:657,y:350.94,w:90,h:29.81,kind:'water'},
  {key:'Ruta 131',label:'131',x:571.5,y:350.94,w:81,h:29.81,kind:'water'},
  {key:'Ruta 132',label:'132',x:477,y:350.94,w:54,h:29.81,kind:'water'},
  {key:'Ruta 133',label:'133',x:409.5,y:350.94,w:81,h:29.81,kind:'water'},
  {key:'Ruta 134',label:'134',x:324,y:350.94,w:90,h:29.81,kind:'water'},
  {key:'Pueblo Pardal',label:'Pueblo Pardal',x:125.55,y:70.19,w:31.5,h:31.98,kind:'city'},
  {key:'Ciudad Arborada',label:'Ciudad Arborada',x:378,y:70.46,w:36,h:32.52,kind:'city'},
  {key:'Ciudad Lavacalda',label:'Pueblo Lavacalda',x:182.25,y:155.28,w:31.5,h:31.98,kind:'city'},
  {key:'Ciudad Calagua',label:'Ciudad Calagua',x:561.6,y:154.47,w:61.2,h:27.1,kind:'city'},
  {key:'Ciudad Férrica',label:'Ciudad Férrica',x:42.75,y:224.93,w:31.5,h:59.62,kind:'city'},
  {key:'Pueblo Verdegal',label:'Pueblo Verdegal',x:154.35,y:238.48,w:33.3,h:32.52,kind:'city'},
  {key:'Ciudad Malvalona',label:'Ciudad Malvalona',x:276.75,y:239.84,w:49.5,h:35.23,kind:'city'},
  {key:'Ciudad Petalia',label:'Ciudad Petalia',x:69.75,y:322.49,w:31.5,h:32.52,kind:'city'},
  {key:'Pueblo Escaso',label:'Pueblo Escaso',x:155.25,y:324.39,w:29.7,h:30.89,kind:'city'},
  {key:'Villa Raíz',label:'Villa Raíz',x:154.35,y:378.05,w:31.5,h:29.81,kind:'city'},
  {key:'Pueblo Azuliza',label:'Pueblo Azuliza',x:98.1,y:464.22,w:37.8,h:34.15,kind:'city'},
  {key:'Ciudad Portual',label:'Ciudad Portual',x:266.4,y:365.85,w:32.4,h:59.62,kind:'city'},
  {key:'Pueblo Oromar',label:'Pueblo Oromar',x:517.5,y:350.94,w:36,h:29.81,kind:'city'},
  {key:'Ciudad Algaria',label:'Ciudad Algaria',x:726.75,y:211.38,w:58.5,h:32.52,kind:'city'},
  {key:'Arrecípolis',label:'Arrecípolis',x:630,y:265.58,w:36,h:32.52,kind:'city'},
  {key:'Ciudad Colosalia',label:'Ciudad Colosalia',x:799.65,y:308.94,w:33.3,h:59.62,kind:'city'},
  {key:'Frente Batalla',label:'Frente Batalla',x:666,y:408.4,w:34.2,h:33.06,kind:'city'},
  {key:'Bosque Petalia',label:'Bosque Petalia',x:25.2,y:298.1,w:32.4,h:32.52,kind:'special'},
  {key:'Cueva Granito',label:'Cueva Granito',x:67.5,y:447.15,w:27,h:27.1,kind:'special'},
  {key:'Túnel Fervegal',label:'Túnel Fervegal',x:211.5,y:227.64,w:54,h:24,kind:'special'},
  {key:'Cascada Meteoro',label:'Cascada Meteoro',x:22.5,y:143.63,w:27,h:27.1,kind:'special'},
  {key:'Monte Cenizo',label:'Monte Cenizo',x:209.7,y:124.12,w:30.6,h:27.1,kind:'special'},
  {key:'Desierto',label:'Desierto',x:292.5,y:158.81,w:32.4,h:32.52,kind:'special'},
  {key:'Senda Ígnea',label:'Senda Ígnea',x:220.5,y:132.79,w:45,h:27.1,kind:'special'},
  {key:'Monte Pírico',label:'Monte Pírico',x:508.5,y:203.25,w:27,h:27.1,kind:'special'},
  {key:'Cueva Cardumen',label:'Cueva Cardumen',x:715.5,y:186.99,w:27,h:27.1,kind:'special'},
  {key:'Caverna Abisal',label:'Caverna Abisal',x:670.5,y:322.49,w:27,h:27.1,kind:'special'},
  {key:'Cueva Ancestral',label:'Cueva Ancestral',x:630,y:257.45,w:25,h:24,kind:'special'},
  {key:'Calle Victoria',label:'Calle Victoria',x:814.5,y:311.65,w:27,h:27.1,kind:'special'},
  {key:'Nueva Malvalona',label:'Nueva Malvalona',x:296.55,y:257.45,w:31.5,h:27.1,kind:'special'},
  {key:'Malvamar',label:'Malvamar',x:198,y:452.57,w:36,h:27.1,kind:'special'},
  {key:'Pilar Celeste',label:'Pilar Celeste',x:571.5,y:327.91,w:27,h:27.1,kind:'special'},
  {key:'Isla del Sur',label:'Isla del Sur',x:382.5,y:463.41,w:27,h:27.1,kind:'special'},
  {key:'Zona Safari',label:'Zona Safari',x:490.5,y:138.21,w:27,h:27.1,kind:'special'},
  {key:'Cueva Fervergal',label:'Cueva Fervergal',x:227.7,y:215.99,w:27,h:24.39,kind:'special'},
];

/* v2.2: sugerencias PRIVADAS derivadas de private_pokemon. Nunca consumen una ruta automáticamente.
   Este análisis no se guarda ni se envía al rival: únicamente se publican fichas confirmadas. */
function reviewModel(pokemon=state.pokemon,routes=state.routes,userId=own()?.user_id,specials=state.specialEncounters){
 const result={groups:[],eggs:[],empty:[],incomplete:[],unmapped:0};
 if(!userId)return result;
 const canonRoutes=new Map(routes.filter(r=>r.owner_id===userId).map(r=>[canonicalZone(r.zone_key),r]));
 const validZones=new Set([...HOENN_ATLAS.map(z=>z.key),...ROUTES.filter(z=>z!=='Zonas SUPER RR (añadir manualmente)'),...canonRoutes.keys()].map(canonicalZone));
 const byZone=new Map(),eggDrafts=[];
 const seen=new Set();
 for(const pk of pokemon){
  if(pk.owner_id&&pk.owner_id!==userId)continue;
  if(pk.is_egg)continue; // No revelar ni registrar huevos sin eclosionar.
  const key=String(pk.pokemon_key||'');
  if(key&&seen.has(key))continue;
  if(key)seen.add(key);
  const zone=canonicalZone(locationName(Number(pk.met_location)));
  if(Number(pk.egg_location||0)>0){eggDrafts.push({...pk,_reviewZone:zone});continue}
  if(!validZones.has(zone)||zone.startsWith('Lugar #')){result.unmapped++;continue}
  const recorded=canonRoutes.get(zone)?.status||'unknown';
  if(recorded==='captured'||recorded==='failed')continue;
  if(!byZone.has(zone))byZone.set(zone,[]);
  byZone.get(zone).push(pk);
 }
 result.incomplete=[...canonRoutes].filter(([,r])=>r.status==='captured'&&(r.capture_level==null||r.stat_total==null||!r.encounter_method||r.encounter_method==='unknown')).map(([zone])=>zone).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
 result.groups=[...byZone].map(([zone,candidates])=>({zone,candidates,status:canonRoutes.get(zone)?.status||'unknown'}))
   .sort((a,b)=>(b.candidates.length>1)-(a.candidates.length>1)||a.zone.localeCompare(b.zone,'es',{numeric:true}));
 // Un huevo que eclosionó puede tener ya ficha pública. La comparación es indicativa,
 // no sustituye un identificador único (la base v1.8 no lo almacena en especiales).
 result.eggs=eggDrafts.map(pk=>({pokemon:pk,maybeRegistered:specials.some(e=>e.owner_id===userId&&e.kind==='egg'&&e.nickname===pk.nickname&&Number(e.capture_level||0)===Number(pk.met_level||0))}));
 result.empty=[...validZones].filter(z=>!byZone.has(z)&&(canonRoutes.get(z)?.status||'unknown')==='unknown')
   .sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
 return result;
}
function renderReviewQueue(){
 if(!own())return '';
 const model=reviewModel();
 const {groups,eggs,empty,incomplete,unmapped}=model;
 const items=groups.map(({zone,candidates,status})=>{
  const many=candidates.length>1;
  const choices=candidates.map(pk=>`<div class="rev22-candidate"><div><strong>${esc(pk.nickname||'Sin apodo')}</strong> <span class="small">Nv. ${Number(pk.met_level)||'?'}${pk.present===false?' · histórico':''}</span></div><div class="rev22-buttons"><button type="button" class="button secondary compact" data-review-candidate="${esc(String(pk.pokemon_key||''))}" data-review-zone="${esc(zone)}">Usar como captura</button><button type="button" class="button ghost compact" data-review-special="${esc(String(pk.pokemon_key||''))}" data-review-kind="gift">Es regalo / extra</button></div></div>`).join('');
  return `<article class="rev22-card ${many?'ambiguous':''}"><div class="rev22-card-head"><strong>${esc(zone)}</strong><span class="rev22-tag">${many?candidates.length+' posibles':'1 candidato'} · ${status==='free'?'marcada disponible':'sin verificar'}</span></div>${choices}<p class="small">${many?'Elige cuál consumió el encuentro o clasifica los especiales.':'Coincidir en la zona no demuestra que consumiera su captura normal.'}</p></article>`;
 }).join('');
 const eggItems=eggs.map(({pokemon:pk,maybeRegistered})=>`<article class="rev22-egg"><span><strong>${esc(pk.nickname||'Sin apodo')}</strong> · Nv. ${Number(pk.met_level)||'?'}${maybeRegistered?' · Posible ficha existente':''}</span><button type="button" class="button secondary compact" data-review-special="${esc(String(pk.pokemon_key||''))}" data-review-kind="egg">${maybeRegistered?'Revisar registro':'Registrar huevo eclosionado'}</button></article>`).join('');
 const missing=state.reviewShowEmpty?`<div class="rev22-empty-grid rev22-manual-list">${empty.slice(0,15).map(zone=>`<button type="button" class="button ghost compact" data-review-manual="${esc(zone)}">${esc(zone)} · Revisar</button>`).join('')}</div>${empty.length>15?`<p class="small">Otras ${empty.length-15} zonas sin indicios visibles: consúltalas en el índice del atlas.</p>`:''}`:'';
 return `<section id="review-queue" class="card rev22-shell section-gap"><div class="rev22-heading"><div><div class="kicker">SOLO VISIBLE PARA TU CUENTA</div><h2>Verificaciones de encuentros</h2><p class="small">Revisa los candidatos detectados en tu propio guardado. No se muestran especies ni Pokémon posibles al rival.</p></div><div class="rev22-metrics"><span><strong>${groups.length}</strong> zonas con candidatos</span><span><strong>${groups.filter(g=>g.candidates.length>1).length}</strong> ambiguas</span><span><strong>${eggs.length}</strong> nacidos de huevo</span><span><strong>${incomplete.length}</strong> fichas incompletas</span></div></div>
 ${groups.length?`<div class="rev22-grid">${items}</div>`:'<p class="rev22-no-data">No hay candidatos de ruta sin clasificar en los Pokémon privados que has importado.</p>'}
 ${incomplete.length?`<details class="rev22-sub"><summary>Capturas confirmadas con datos pendientes (${incomplete.length})</summary><div class="rev22-empty-grid">${incomplete.map(zone=>`<button type="button" class="button secondary compact" data-review-manual="${esc(zone)}">${esc(zone)} · Completar ficha</button>`).join('')}</div></details>`:''}
 ${eggs.length?`<details class="rev22-sub"><summary>Huevos eclosionados (${eggs.length}) · no consumen ruta</summary><div class="rev22-eggs">${eggItems}</div></details>`:''}
 <div class="rev22-footer"><span class="small">${empty.length} zonas sin estado confirmado ni candidatos visibles.${unmapped?' · '+unmapped+' Pokémon con ubicación no reconocida.':''} La ausencia de candidatos <strong>no confirma</strong> que la captura esté disponible.</span><button type="button" class="button secondary compact" data-review-toggle-empty="1">${state.reviewShowEmpty?'Ocultar zonas sin indicios':'Revisar zonas sin indicios'}</button></div>${missing}
 <p class="rev22-caution">Seleccionar un Pokémon <strong>solo rellena el formulario privado</strong>; tendrás que confirmar manualmente el estado de la captura. Los regalos, fósiles y extras pueden aparecer como candidatos: clasifícalos aparte. Las capturas confirmadas nunca se sobrescriben al importar.</p></section>`;
}

function renderMap(){
 const selected=state.selectedRoute;
 const focus=['all','1','2'].includes(String(state.selectedMapPlayer||'all'))?String(state.selectedMapPlayer||'all'):'all';
 const search=(state.mapSearch||'').trim().toLocaleLowerCase('es');
 const filter=state.selectedMapFilter||'all';
 const typeFilter=state.hoennTypeFilter||'all';
 const atlasByKey=new Map(HOENN_ATLAS.map(z=>[z.key,z]));
 const zones=unique([...HOENN_ATLAS.map(z=>z.key),...ROUTES.filter(z=>z!=='Zonas SUPER RR (añadir manualmente)'),...state.routes.map(r=>r.zone_key)].map(canonicalZone));
 const capturedIn=(name,slot)=>publicRouteStatus(name,slot)==='captured';
 const statusCount=name=>Number(capturedIn(name,1))+Number(capturedIn(name,2));
 const visible=z=>{
  const item=atlasByKey.get(z),count=statusCount(z);
  const mine=focus==='all'?false:capturedIn(z,Number(focus));
  if(search&&!z.toLocaleLowerCase('es').includes(search))return false;
  if(typeFilter!=='all' && (item?.kind||'special')!==typeFilter)return false;
  if(filter==='one'&&count!==1||filter==='both'&&count!==2||filter==='none'&&count!==0)return false;
  if(filter==='my-captured' && (focus==='all'?count===0:!mine))return false;
  if(filter==='pending' && !(focus==='all'?[1,2]:[Number(focus)]).some(n=>publicRouteStatus(z,n)==='unknown'))return false;
  if(['failed','free','unknown'].includes(filter) && !(focus==='all'?[1,2]:[Number(focus)]).some(n=>publicRouteStatus(z,n)===filter))return false;
  return true;
 };
 const visibleZones=zones.filter(visible);
 const visibleSet=new Set(visibleZones);
 const focusName=focus==='all'?'Ambos jugadores':pname(Number(focus));
 const colorClass=z=>zoneVisualClass(z,focus)+' '+atlasStatusClass(z,focus);
 const getTitle=z=>`${z.key}: ${[1,2].map(n=>`${pname(n)}: ${mapStatusLabel(publicRouteStatus(z.key,n))}`).join(' · ')}`;
 const mapShape=z=>{
  const active=z.key===selected,dim=!visibleSet.has(z.key);
  const title=getTitle(z),numeric=z.kind==='route'||z.kind==='water';
  const compact=z.h>z.w*1.8;
  const isCity=z.kind==='city';
  const marker=numeric?`<text x="0" y=".5" ${compact?'transform="rotate(-90)"':''}>${esc(z.label)}</text>`:isCity?'<circle class="atlas-marker" r="4.5" cx="0" cy="0"/>':'<path class="atlas-marker" d="M0 -5L5 0 0 5 -5 0Z"/>';
  return `<g class="atlas-zone atlas-${z.kind} ${colorClass(z.key)} ${active?'active':''} ${dim?'atlas-dim':''}" data-route="${esc(z.key)}" tabindex="0" role="button" aria-pressed="${active}" aria-label="${esc(title)}" transform="translate(${z.x} ${z.y})"><title>${esc(title)}</title><rect x="${-z.w/2}" y="${-z.h/2}" width="${z.w}" height="${z.h}" rx="${isCity?4:2}"/>${marker}${focus==='all'&&atlasStatusClass(z.key,focus)==='atlas-mixed-failed'?`<text class="atlas-fail-mark" x="${z.w/2-6}" y="${-z.h/2+6}">×</text>`:''}${active?`<text class="atlas-active-zone-name" x="0" y="${-z.h/2-9}">${esc(z.label)}</text>`:''}</g>`;
 };
 const boardSvg=`<div class="atlas-viewer"><div class="atlas-zoom-bar" role="toolbar" aria-label="Zoom del mapa"><button class="atlas-zoom-btn" type="button" data-map-zoom="out" ${atlasZoomValue()<=ATLAS_MIN_ZOOM?'disabled':''} aria-label="Alejar el mapa">−</button><output class="atlas-zoom-label" aria-live="polite">${Math.round(atlasZoomValue()*100)}%</output><button class="atlas-zoom-btn" type="button" data-map-zoom="in" ${atlasZoomValue()>=2?'disabled':''} aria-label="Acercar el mapa">+</button><button class="atlas-zoom-btn atlas-zoom-reset" type="button" data-map-zoom="reset">100%</button><button class="atlas-zoom-btn atlas-zoom-reset" type="button" data-map-zoom="fit" aria-label="Ajustar mapa al ancho disponible">Ajustar</button><button class="atlas-zoom-btn atlas-zoom-center" type="button" data-map-center="1">Centrar zona</button></div><div class="atlas-peek" aria-label="Información pública de la zona"><strong data-peek-name>${esc(selected)}</strong><span data-peek-states>${[1,2].map(n=>`${esc(pname(n))}: ${mapStatusLabel(publicRouteStatus(selected,n))}`).join(' · ')}</span></div><div class="atlas-scroll" tabindex="0" role="region" aria-label="Mapa original interactivo de Hoenn. Desplaza horizontalmente si es necesario"><svg class="atlas-map" style="width:${Math.round(900*atlasZoomValue())}px" viewBox="0 0 900 542" xmlns="http://www.w3.org/2000/svg" data-focus="${focus}" aria-label="Mapa pixel-art de Hoenn, rutas, ciudades y lugares especiales seleccionables"><image class="atlas-map-art" x="0" y="0" width="900" height="542" preserveAspectRatio="none" href="${HOENN_MAP_IMAGE}"/><g class="atlas-zones">${HOENN_ATLAS.map(mapShape).join('')}</g></svg></div></div>`;
 const selectedLocation=atlasByKey.get(selected);
 const nearby=selectedLocation?HOENN_ATLAS.filter(z=>z.key!==selected).map(z=>({zone:z,dist:Math.hypot(z.x-selectedLocation.x,z.y-selectedLocation.y)})).sort((a,b)=>a.dist-b.dist).slice(0,5):[];
 const nearbyHtml=nearby.length?`<div class="atlas-nearby"><span class="kicker">ZONAS PRÓXIMAS</span><div class="atlas-nearby-list">${nearby.map(({zone})=>`<button type="button" data-route="${esc(zone.key)}" title="Seleccionar ${esc(zone.key)}">${esc(zone.key)}</button>`).join('')}</div></div>`:'';
 const details=[1,2].map(slot=>{
  const r=routeState(player(slot).user_id,selected),status=r?.status||'unknown';
  return `<div class="atlas-detail-player ${status==='captured'?'captured':''}"><div class="atlas-player-heading"><span class="atlas-avatar">${slot}</span><strong>${esc(pname(slot))}</strong>${pBadge(mapStatusLabel(status),status==='captured'?'green':status==='failed'?'red':'')}</div>${status==='captured'?`<div class="atlas-nickname">${esc(r.nickname||'Apodo pendiente')}</div><div class="atlas-attrs"><span>${r.capture_level?'Nv. '+Number(r.capture_level):'Nivel sin verificar'}</span><span>${esc(encounterMethod(r.encounter_method))}</span><span>${r.stat_total!=null?Number(r.stat_total)+' stats':'Stats sin verificar'}</span></div>`:`<p class="small">${status==='failed'?'Intento fallido: ya no disponible.':status==='free'?'Captura disponible (confirmada).':'Aún no se ha verificado el estado.'}</p>`}</div>`;
 }).join('');
 const list=visibleZones.map(zone=>{
  const z=atlasByKey.get(zone),status=statusCount(zone);
  return `<button class="atlas-location ${selected===zone?'selected':''}" type="button" data-route="${esc(zone)}"><span class="atlas-location-icon ${z?.kind||'special'}">${z?.kind==='water'?'≈':z?.kind==='city'?'■':z?.kind==='special'?'◆':'▬'}</span><span class="atlas-location-text"><strong>${esc(z?(z.kind==='route'||z.kind==='water'?'Ruta '+z.label:z.label):zone)}</strong><small>${z?(z.kind==='city'?'Ciudad o pueblo':z.kind==='special'?'Lugar especial':z.kind==='water'?'Ruta marítima':'Ruta terrestre'):'Zona personalizada'}</small></span><span class="atlas-mini-states">${[1,2].map(n=>`<span class="atlas-mini-state ${publicRouteStatus(zone,n)}" title="${esc(pname(n)+': '+mapStatusLabel(publicRouteStatus(zone,n)))}" aria-label="${esc('J'+n+': '+mapStatusLabel(publicRouteStatus(zone,n)))}">${publicRouteStatus(zone,n)==='captured'?'✓':publicRouteStatus(zone,n)==='failed'?'×':publicRouteStatus(zone,n)==='free'?'○':'?'}</span>`).join('')}</span><span class="atlas-progress">${status}/2</span></button>`;
 }).join('');
 const sumCaptures=(slot)=>zones.filter(z=>capturedIn(z,slot)).length;
 const totalBoth=zones.filter(z=>statusCount(z)===2).length;
 const tabs=[['all','Resumen'],['1',pname(1)],['2',pname(2)]].map(([v,label])=>`<button class="atlas-tab ${focus===v?'active':''}" type="button" data-map-view="${v}" aria-pressed="${focus===v}">${esc(label)}</button>`).join('');
 const options=(entries,val)=>entries.map(([v,t])=>`<option value="${v}" ${v===val?'selected':''}>${esc(t)}</option>`).join('');
 return `${detailHead('REGIÓN DE HOENN','Atlas de capturas','Mapa de Hoenn basado en la cartografía aportada, con estados de captura y sin especies del randomizer.')}${renderCurrentLocation()}
 <section class="atlas-shell section-gap" aria-label="Atlas de capturas de Hoenn"><div class="atlas-toolbar"><div><div class="kicker">POKÉNAV · RUTAS DE HOENN</div><h2>Explorar Hoenn</h2><p class="small">${zones.length} zonas registradas · ${sumCaptures(1)} de ${esc(pname(1))} · ${sumCaptures(2)} de ${esc(pname(2))} · ${totalBoth} compartidas</p></div><div class="atlas-tabs" role="group" aria-label="Elegir el mapa del jugador">${tabs}</div></div>
 <div class="atlas-columns"><div class="atlas-main">${boardSvg}<div class="atlas-key"><span><i class="k-none"></i> Sin verificar</span><span><i class="k-free"></i> Disponible confirmada</span><span><i class="k-failed"></i> Algún intento fallido</span><span><i class="k-one"></i> ${focus==='all'?'Capturada por uno':'Capturada en esta vista'}</span>${focus==='all'?'<span><i class="k-both"></i> Capturada por ambos</span>':''}</div><p class="atlas-hint">Mapa de BLaDoM adaptado a Locke Escribe: las áreas coloreadas corresponden únicamente a capturas confirmadas. Rutas y ciudades siguen las posiciones del mapa original; el detalle se consulta seleccionando una zona o usando el índice. Usa «Ajustar» para ver la región completa o acerca el mapa para elegir zonas pequeñas.</p></div>
 <aside class="atlas-side" aria-label="Buscar y consultar zonas"><div class="atlas-search"><label for="route-search" class="small">Buscar ubicación</label><input id="route-search" type="search" class="field" value="${esc(state.mapSearch||'')}" placeholder="Ej. Ruta 101, Bosque Petalia"></div><div class="atlas-filter-row"><select class="select" id="atlas-type-filter" aria-label="Tipo de zona">${options([['all','Todos los tipos'],['route','Rutas terrestres'],['water','Rutas de agua'],['city','Ciudades y pueblos'],['special','Lugares especiales']],typeFilter)}</select><select class="select" id="map-filter" aria-label="Estado de captura">${options([['all','Todos los estados'],['none','Ninguna captura'],['one','Solo uno'],['both','Ambos'],['my-captured','Capturadas en vista'],['free','Disponible confirmada'],['unknown','Sin verificar'],['pending','Pendientes de revisar'],['failed','Intento fallido']],filter)}</select></div><div class="atlas-count">${visibleZones.length} ubicaciones encontradas</div><div class="atlas-index">${list||'<p class="empty">No hay zonas con esos filtros.</p>'}</div><div class="atlas-selection"><div class="atlas-selection-head"><div><span class="kicker">ZONA SELECCIONADA</span><h3>${esc(atlasByKey.get(selected)&&['route','water'].includes(atlasByKey.get(selected).kind)?'Ruta '+atlasByKey.get(selected).label:(atlasByKey.get(selected)?.label||selected))}</h3></div><button class="button compact secondary" type="button" data-action="route-edit">Editar</button></div>${details}${nearbyHtml}</div></aside></div></section>
 ${renderReviewQueue()}${renderEncounterTracker()}`;
}

/* Registro público: no renderiza especies, habilidades, movimientos, IV ni Pokémon todavía en huevo. */
function renderEncounterTracker(){
 const tab=state.encounterTab==='special'?'special':'routes';
 const allZones=unique([...ROUTES.filter(z=>z!=='Zonas SUPER RR (añadir manualmente)'),...HOENN_ATLAS.map(n=>n.key),...state.routes.map(r=>r.zone_key)].map(canonicalZone)).filter(Boolean);
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

/* v2.7: los resultados se introducen manualmente; nunca se guardan replays nuevos. */
function renderBattlesManual(){
  const latest=[...state.series].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const open=latest.filter(s=>s.status==='open');
  const defaultGameNo=open.length?state.games.filter(g=>g.series_id===open[0].id).length+1:1;
  const cards=latest.map(series=>{
    const games=state.games.filter(g=>g.series_id===series.id).sort((a,b)=>a.game_no-b.game_no);
    const rows=games.map(g=>{
      const approved=state.confirmations.filter(c=>c.game_id===g.id);
      const mine=approved.some(c=>c.player_id===own()?.user_id);
      const canConfirm=state.account && !mine && series.status==='open';
      // Solo se puede cancelar el último resultado MANUAL antes de su doble confirmación.
      const canCancel=state.account && series.status==='open' && approved.length<2
        && g===games[games.length-1] && String(g.replay_id||'').startsWith('manual-');
      return `<div class="boss-line"><div><strong>Combate ${g.game_no} · ${esc(g.winner_name||'Ganador no indicado')}</strong>
        <div class="small">KO: ${Number(g.kos_1||0)}–${Number(g.kos_2||0)}${g.ended_by_forfeit?' · Forfeit: 6 PF al ganador':''}</div>
        <div class="small">${approved.length}/2 confirmaciones</div></div>
        ${canConfirm||canCancel?`<div class="flex">${canConfirm?`<button type="button" class="button secondary compact" data-confirm-replay="${esc(g.id)}">Confirmar resultado</button>`:''}${canCancel?`<button type="button" class="button ghost compact" data-cancel-manual-game="${esc(g.id)}">Cancelar</button>`:''}</div>`:''}</div>`;
    }).join('');
    return `<div class="card"><div class="between mb-2"><h3>BO3 · ${fmt(series.created_at)}</h3>${pBadge(series.status==='finished'?'Finalizado':'En curso',series.status==='finished'?'green':'amber')}</div>
      ${rows||'<p class="small">Todavía no hay resultados anotados.</p>'}
      <p class="small mt-2">${series.status==='finished'?'Resultado confirmado.': 'La serie se cierra después de confirmar todos los resultados y alcanzar dos victorias.'}</p>
      </div>`;
  }).join('');
  return `${detailHead('PVP · MEJOR DE TRES','Resultados manuales','No se suben ni guardan enlaces o archivos de replay. Los dos jugadores confirman cada resultado.',`<button class="button" data-action="new-series">+ Nuevo BO3</button>`)}
    <div class="grid-3 mb-3">${[
      ['SERIES FINALIZADAS',latest.filter(s=>s.status==='finished').length],
      ['SERIES EN CURSO',open.length],
      ['FORFEIT','6 PF al ganador · máximo 18 PF por jugador y serie']
    ].map(([label,value])=>`<div class="card"><div class="kicker">${label}</div><div class="stat-value">${esc(value)}</div></div>`).join('')}</div>
    ${card('Anotar resultado de un combate',`<p class="small mb-3">Registra ganador, KO reales y si hubo forfeit. Un forfeit ganador concede 6 PF (no suma los KO propios); los demás KO cuentan normalmente, hasta 18 PF por serie y jugador.</p>
      <form id="manual-game-form" class="stack"><div class="form-grid"><div><label class="form-label">Serie abierta</label>
      <select class="select" name="series" required>${open.map(s=>`<option value="${esc(s.id)}">BO3 · ${fmt(s.created_at)}</option>`).join('')}</select></div>
      <div><label class="form-label">N.º de combate</label><select class="select" name="game_no" required>${[1,2,3].map(n=>`<option value="${n}" ${n===defaultGameNo?'selected':''}>${n}</option>`).join('')}</select></div></div>
      <label class="form-label">Ganador</label><select class="select" name="winner_slot" required>${[1,2].map(n=>`<option value="${n}">${esc(pname(n))}</option>`).join('')}</select>
      <div class="form-grid">${[1,2].map(n=>`<div><label class="form-label">KO reales de ${esc(pname(n))}</label><input class="field" name="kos_${n}" type="number" min="0" max="6" value="0" required></div>`).join('')}</div>
      <label class="le20-confirm"><input name="forfeit" type="checkbox"> Terminó por forfeit (6 PF fijas para el ganador)</label>
      <button class="button" type="submit" ${open.length?'':'disabled'}>Registrar resultado manual</button></form>`) }
    <div class="section-gap"><h2>Historial de series</h2><div class="grid-2">${cards||'<div class="empty">Todavía no hay series registradas.</div>'}</div></div>`;
}

function renderEggsManual(){
  const owner=own()?.user_id;
  // Una indicación NO reserva el huevo: claimed puede venir de sorteos antiguos.
  // Solo importa si el Pokémon sigue siendo un huevo presente en el main.
  const available=state.pokemon.filter(p=>p.owner_id===owner && p.is_egg && p.present
    && Number(p.box_num)>=1 && Number(p.box_num)<=29 && Number(p.slot_num)>=1 && Number(p.slot_num)<=30
    && ((p.bst!=null && Number(p.bst)<=conf('cap_bst')) || Number(p.species)===289));
  const imported=Boolean(owner && state.progress.some(p=>p.player_id===owner));
  const finished=state.series.filter(s=>s.status==='finished');
  const completedIds=new Set(finished.map(s=>s.id));
  const ownResults=state.games.filter(g=>completedIds.has(g.series_id) && g.winner_id);
  const wins=ownResults.filter(g=>g.winner_id===owner).length;
  const losses=owner?ownResults.length-wins:0;
  const ownProgress=state.progress.find(p=>p.player_id===owner);
  const lives=ownProgress?Math.max(0,conf('life_limit')+bonusLife(owner)-Number(ownProgress.deaths||0)):null;
  const suggestion=state.lastEggSuggestion?.player_id===owner?state.lastEggSuggestion:null;
  return `${detailHead('INCUBADORA','Sorteo ponderado de huevos','Pulsa cuando quieras: se sugiere una caja y posición de tu propio main. No se gastan créditos ni se reservan huevos.',`<span class="badge green">Sin reservas</span>`)}
    <div class="grid-2">${card('Sortear un huevo aleatorio',`<p class="small">Puedes repetir el sorteo cuantas veces quieras. Si pulsas por error, ignora la sugerencia: el huevo seguirá disponible hasta que eclosione y vuelvas a importar tu main.</p>
      <div class="egg-podium"><div class="egg-art" aria-hidden="true"></div><div class="egg-result">${suggestion?`Última sugerencia de esta sesión: caja ${Number(suggestion.box_num)} · posición ${Number(suggestion.slot_num)}`:'Aún no hay sugerencia en esta sesión'}</div></div>
      <button type="button" class="button full mt-3" data-action="draw-egg" ${imported && available.length>0?'':'disabled'}>Sortear un huevo aleatorio</button>
      <p class="small mt-2">${available.length} huevos elegibles en tu último main importado. No hacen falta créditos.</p>
      <p class="small">${!imported?'Importa primero tu archivo main.':available.length===0?'No hay huevos elegibles en tu último main: importa uno actualizado si has añadido huevos.':'Un huevo puede salir de nuevo hasta que el main importado deje de mostrarlo como huevo.'}</p>`)}
      ${card('Ponderación individual',`<p class="small">Se considera exclusivamente tu situación: vidas perdidas, calidad de tus seis mejores Pokémon vivos y victorias/derrotas en combates BO3 confirmados.</p>
      <p class="small">${lives===null?'Vidas: importa tu main para calcularlas.':`Tus vidas restantes: ${lives}.`} Combates terminados: ${wins} victorias y ${losses} derrotas.</p>
      <p class="small">Cuanto peor sea tu situación, mayor probabilidad relativa de huevos fuertes. Ningún huevo elegible tiene probabilidad cero.</p>
      <p class="small">BST máximo: ${conf('cap_bst')}, con excepción de Slaking. No se revela especie, habilidad, naturaleza ni IV de huevos sin eclosionar.</p>`)}</div>`;
}

async function registerManualGame(e){
  e.preventDefault();
  if(!guard())return;
  const f=new FormData(e.currentTarget);
  try{
    const game=normalizeManualGame({gameNo:f.get('game_no'),winnerSlot:f.get('winner_slot'),
      kos1:f.get('kos_1'),kos2:f.get('kos_2'),forfeit:f.has('forfeit')});
    const series=String(f.get('series')||'');
    if(!state.series.some(s=>s.id===series && s.status==='open'))throw Error('Selecciona una serie abierta.');
    if(!confirm(`¿Registrar combate ${game.game_no}, ganador ${pname(game.winner_slot)}, KO ${game.kos_1}–${game.kos_2}${game.forfeit?' (forfeit)':''}? El otro jugador deberá confirmarlo.`))return;
    await rpc('register_manual_game',{p_series_id:series,p_game_no:game.game_no,p_winner_slot:game.winner_slot,
      p_kos_1:game.kos_1,p_kos_2:game.kos_2,p_forfeit:game.forfeit});
    toast('Resultado anotado. Falta la confirmación de ambos.','success');await loadShared();
  }catch(err){toast(err.message,'error')}
}
async function cancelManualGame(id){
  if(!guard())return;
  if(!confirm('¿Cancelar este resultado BO3 pendiente? Se eliminarán el resultado y las confirmaciones que ya tenga. No se tocarán combates anteriores ni las recompensas concedidas.'))return;
  try{await rpc('cancel_manual_game',{p_game_id:id});toast('Resultado pendiente cancelado. Puedes introducirlo de nuevo.','success');await loadShared()}
  catch(err){toast('No se pudo cancelar el resultado: '+err.message,'error')}
}
function renderShop(){const cats=unique(state.catalog.map(i=>i.category));const chosen=state.selectedCategory;const matches=state.catalog.filter(i=>(chosen==='Todas'||i.category===chosen)&&(!state.shopQuery||String(i.name).toLowerCase().includes(state.shopQuery.toLowerCase())));return `${detailHead('SISTEMA ECONÓMICO','Mercado de Pokéfichas','Lotes de consumibles baratos y premios de alto coste. Reanimar no recupera una vida; la vida adicional solo se compra una vez por partida.',`<div class="flex"><span class="badge amber">Stock ilimitado</span><button type="button" class="button secondary compact" data-action="manual-pf">+ Sumar mis PF</button></div>`)}<div class="grid-2 mb-3">${[1,2].map(n=>`<div class="card between"><div><div class="kicker">${esc(pname(n))}</div><div class="stat-value accent-gold">${balance(player(n).user_id)} PF</div></div><div class="shop-icon">◉</div></div>`).join('')}</div><div class="card"><div class="shop-controls"><input class="field" id="shop-search" placeholder="Buscar cualquier objeto, MT, megapiedra…" value="${esc(state.shopQuery)}" /><select id="shop-cat" class="select"><option>Todas</option>${cats.map(c=>`<option ${chosen===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="shop-grid">${matches.slice(0,200).map(i=>`<article class="shop-item"><div class="between"><span class="shop-icon">${i.category?.includes('Mega')?'◇':i.category==='MT'?'▣':i.category?.includes('Ball')?'◉':'✦'}</span><span class="small">${esc(i.category)}</span></div><h3>${esc(i.name)}</h3><div class="small">${Number(i.quantity)>1?`Lote de ${i.quantity}`:'1 unidad'} · Sin límite de existencias</div><div class="shop-item-bottom"><span class="shop-price">${i.price} <small>PF</small></span><button class="button secondary compact" data-buy="${esc(i.id)}">Comprar</button></div></article>`).join('')||'<div class="empty">No hay artículos que coincidan.</div>'}</div>${matches.length>200?`<p class="small mt-3">Mostrando los primeros 200 de ${matches.length}; utiliza el buscador.</p>`:''}</div>`}
function renderArchiveHistory(){
 const runs=state.adventures||[];
 const oldRuns=runs.filter(r=>r.archived_at);
 const archive=state.archivePreview;
 const archived=oldRuns.map(r=>`<div class="v23-run-row"><div><strong>${esc(r.name)}</strong><p class="small">${fmt(r.started_at)} — ${fmt(r.archived_at)} · Solo lectura</p></div><div class="v23-run-actions"><button class="button secondary compact" type="button" data-run-open="${esc(r.id)}">Ver historial</button><button class="button ghost compact" type="button" data-run-download="${esc(r.id)}" title="Exporta tus Pokémon privados junto con el historial compartido">Exportar archivo</button></div></div>`).join('');
 let detail='';
 if(archive){
  const a=archive.shared_snapshot||{};
  const rows=a.shared_progress||[],routes=a.route_states||[],specials=a.special_encounters||[],series=a.combat_series||[],money=a.money_events||[];
  const nameFor=id=>rows.find(p=>p.player_id===id)?.trainer_name||state.players.find(p=>p.user_id===id)?.display_name||'Entrenador';
  const catches=routes.filter(r=>r.status==='captured').sort((x,y)=>x.zone_key.localeCompare(y.zone_key,'es',{numeric:true}));
  const captures=catches.map(r=>`<div class="v23-record"><strong>${esc(r.zone_key)}</strong><span>${esc(nameFor(r.owner_id))}: ${esc(r.nickname||'Sin apodo')} · ${r.capture_level?'Nv. '+Number(r.capture_level):'Nv. ?'} · ${r.stat_total!=null?Number(r.stat_total)+' stats':'stats ?'} · ${esc(encounterMethod(r.encounter_method))}</span></div>`).join('');
  const specialsHtml=specials.map(e=>`<div class="v23-record"><strong>${esc(e.kind==='egg'?'Huevo':e.kind==='gift'?'Regalo':'Captura extra')}</strong><span>${esc(nameFor(e.owner_id))}: ${esc(e.nickname)}${e.zone_key?' · '+esc(e.zone_key):''}</span></div>`).join('');
  detail=`<section id="v23-archive-detail" class="v23-archive-detail"><div class="between"><h3>${esc(archive.name)} · Histórico</h3><button class="button ghost compact" data-run-close="1">Cerrar</button></div><div class="v23-stats">${rows.map(r=>`<span>${esc(r.trainer_name)}: ${Number(r.badges)||0} medallas, ${Number(r.deaths)||0} bajas</span>`).join('')}<span>${catches.length} capturas · ${specials.length} especiales · ${series.filter(s=>s.status==='finished').length} BO3 · ${money.length} movimientos PF</span></div><details open><summary>Capturas por ruta (${catches.length})</summary><div class="v23-record-list">${captures||'<span class="small">Sin capturas registradas</span>'}</div></details><details><summary>Huevos, regalos y extras (${specials.length})</summary><div class="v23-record-list">${specialsHtml||'<span class="small">Sin especiales registrados</span>'}</div></details><p class="small">Este histórico es inmutable. No revela especies, habilidades, movimientos ni otros datos privados.</p></section>`;
 }
 return `<section class="card v23-history"><div class="card-head"><h2>Partidas archivadas</h2></div><p class="small">Cada partida cerrada conserva sus capturas, progreso, economía y combates. Solo puedes descargar tus propios Pokémon privados.</p>${archived||'<div class="empty">Todavía no habéis archivado ninguna partida.</div>'}${detail}</section>`;
}
function renderHistory(){const entries=[...state.economy.map(x=>({when:x.created_at,heading:`${Number(x.amount)>0?'+':''}${x.amount} PF · ${x.kind}`,desc:state.players.find(p=>p.user_id===x.player_id)?.display_name||'Jugador'})),...state.series.map(s=>({when:s.created_at,heading:'Enfrentamiento BO3 · '+(s.status==='finished'?'finalizado':'en curso'),desc:'BO3 registrado manualmente'})),...state.progress.filter(p=>p.updated_at).map(p=>({when:p.updated_at,heading:'Partida actualizada',desc:p.trainer_name||'Entrenador'}))].sort((a,b)=>String(b.when).localeCompare(String(a.when)));return `${detailHead('REGISTRO DE EVENTOS','Historial compartido','Actividad de la partida en curso y archivo de aventuras anteriores.')}<div class="card"><div class="kicker">ACTIVA · ${esc(state.adventures?.find(r=>!r.archived_at)?.name||'Partida actual')}</div>${entries.length?`<div class="timeline">${entries.slice(0,120).map(e=>`<div class="event"><h3>${esc(e.heading)}</h3><p>${esc(e.desc)} · ${fmt(e.when)}</p></div>`).join('')}</div>`:'<div class="empty">Todavía no hay actividad en esta partida.</div>'}</div><div class="section-gap">${renderArchiveHistory()}</div>`}

function renderAdventureSettings(){
 const active=state.adventures?.find(r=>!r.archived_at),req=state.resetRequest;
 const me=own();
 const pending=req?`<div class="v23-pending"><strong>Propuesta: ${esc(req.next_name)}</strong><p class="small">Propuesta por ${esc(state.players.find(p=>p.user_id===req.requested_by)?.display_name||'Jugador')} · vence ${fmt(req.expires_at)}.</p>${me?(req.requested_by===me.user_id?`<p class="small">Esperando la confirmación del otro jugador.</p><button class="button secondary compact" data-run-cancel="${esc(req.request_id)}">Cancelar solicitud</button>`:`<p class="small">Confirma únicamente si los dos queréis empezar desde cero.</p><button class="button compact" data-run-confirm="${esc(req.request_id)}">Confirmar y comenzar nueva partida</button>`):''}</div>`:'';
 const create=!req?`<form id="new-adventure-form" class="v23-new-form"><label class="form-label" for="v23-adventure-name">Nombre de la próxima partida</label><div class="v23-create"><input id="v23-adventure-name" class="field" name="name" maxlength="90" required placeholder="Ej. Dualocke Randomizer 2"><button class="button secondary" type="submit">Proponer nueva partida</button></div></form>`:'';
 return `<section class="card v23-adventure"><div class="between"><div><div class="kicker">PARTIDA ACTIVA</div><h2>${esc(active?.name||'Sin registrar')}</h2><p class="small">Desde ${active?fmt(active.started_at):'—'}. Los dos jugadores comparten la misma partida.</p></div><button class="button ghost compact" data-go="historial">Ver anteriores</button></div><div class="v23-rule"><strong>Reinicio con archivo, no borrado permanente.</strong><p class="small">Al confirmarlo ambos, se archivan capturas, Pokémon privados, combates, recompensas y Pokéfichas; el progreso activo comienza en cero. Se conservan cuentas, reglas y tienda. Necesitaréis importar nuevos archivos main.</p></div>${pending||create}</section>`;
}
function renderSettings(){return `${detailHead('REGLAS Y ACCESO','Configuración','Parámetros centrales del Dualocke. Los cambios afectan a cálculos posteriores sin alterar compras ya realizadas.')}<div class="v23-settings-run">${renderAdventureSettings()}</div><div class="grid-2">${card('Reglas generales',`<form id="rules-form"><div class="config-row"><div><strong>Vidas iniciales</strong><div class="small">Por jugador, editables después</div></div><input class="field" type="number" name="life_limit" min="1" max="999" value="${conf('life_limit')}"></div><div class="config-row"><div><strong>Pokéfichas por medalla</strong></div><input class="field" type="number" name="gym_pf" min="0" value="${conf('gym_pf')}"></div><div class="config-row"><div><strong>Pokéfichas por KO</strong></div><input class="field" type="number" name="ko_pf" min="0" value="${conf('ko_pf')}"></div><div class="config-row"><div><strong>BST máximo normal</strong><div class="small">Slaking siempre es excepción</div></div><input class="field" type="number" name="cap_bst" min="1" value="${conf('cap_bst')}"></div><div class="config-row"><div><strong>Precio de huevo</strong></div><input class="field" type="number" name="egg_price" min="1" value="${conf('egg_price')}"></div><button class="button full mt-3" type="submit">Guardar reglas</button></form>`)}${card('Conexión',`<div class="rule-note mb-3">${CONNECTED?'Proyecto Supabase configurado.':'Vista previa: configura URL pública y clave anon en app.js; ejecuta database.sql en Supabase.'}</div><div class="stack"><p class="small">Cuenta actual: <strong>${esc(state.account?.email||'Sin sesión')}</strong></p><p class="small">Jugador asociado: <strong>${esc(own()?.display_name||'Pendiente')}</strong></p><button class="button secondary" data-action="account">${state.account?'Cerrar sesión':'Iniciar sesión'}</button><button class="button secondary" data-action="import">Subir un archivo main</button><button class="button ghost" data-action="export">Exportar datos visibles (JSON)</button></div><div class="line"></div><p class="small">Privacidad real: las especies, habilidades, movimientos y huevos de cada jugador se guardan en una tabla con Row Level Security. Ninguna cuenta puede consultar la tabla privada del rival.</p>`)}</div><div class="section-gap">${card('Reglas de progresión',`<div class="table-wrap"><table class="data-table"><thead><tr><th>Enfrentamiento</th><th>Límite nivel</th></tr></thead><tbody>${BOSSES.map(([n,c])=>`<tr><td>${esc(n)}</td><td>${c}</td></tr>`).join('')}</tbody></table></div><div class="rule-note mt-3">Los niveles de jefes son límites obligatorios. Excederlos no resta automáticamente vidas. Las cajas 30/31 son el cementerio.</div>`)}</div>`}
function bindPage(){$$('[data-action]').forEach(b=>b.onclick=()=>actions(b.dataset.action));$$('[data-go]').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);$$('[data-route]').forEach(b=>{b.onclick=()=>{const scroll=$('.atlas-scroll')?.scrollLeft||0;const keyboard=b.tagName.toLowerCase()==='g'&&b.matches(':focus-visible');state.selectedRoute=b.dataset.route;render();if($('.atlas-scroll'))$('.atlas-scroll').scrollLeft=scroll;if(keyboard){const same=$$('.atlas-map .atlas-zone').find(el=>el.dataset.route===state.selectedRoute);same?.focus({preventScroll:true})}};if(b.tagName.toLowerCase()==='g')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.dispatchEvent(new MouseEvent('click',{bubbles:true}))}}});$('#route-search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.mapSearch=e.target.value;render();const f=$('#route-search');f?.focus();f?.setSelectionRange(pos,pos)});$('#map-filter')?.addEventListener('change',e=>{state.selectedMapFilter=e.target.value;render()});$('#atlas-type-filter')?.addEventListener('change',e=>{state.hoennTypeFilter=e.target.value;render()});$$('[data-map-view]').forEach(b=>b.onclick=()=>{state.selectedMapPlayer=b.dataset.mapView;render()});$$('[data-map-zoom]').forEach(b=>b.onclick=()=>{if(b.dataset.mapZoom==='fit')atlasFitView();else if(b.dataset.mapZoom==='reset')atlasChangeZoom(1-atlasZoomValue());else atlasChangeZoom(b.dataset.mapZoom==='in'?.25:-.25)});$$('[data-map-center]').forEach(b=>b.onclick=atlasFocusSelected);$$('.atlas-map .atlas-zone').forEach(zone=>{zone.addEventListener('pointerenter',()=>atlasPeek(zone.dataset.route));zone.addEventListener('pointerleave',()=>atlasPeek());zone.addEventListener('focus',()=>atlasPeek(zone.dataset.route));zone.addEventListener('blur',()=>atlasPeek())});$('.atlas-scroll')?.addEventListener('keydown',e=>{if(['+','='].includes(e.key)){e.preventDefault();atlasChangeZoom(.25)}else if(e.key==='-'){e.preventDefault();atlasChangeZoom(-.25)}else if(e.key==='0'){e.preventDefault();atlasChangeZoom(1-atlasZoomValue())}});$$('[data-encounter-tab]').forEach(b=>b.onclick=()=>{state.encounterTab=b.dataset.encounterTab;render();document.querySelector('.enc18-panel')?.scrollIntoView({block:'nearest'})});$$('[data-review-toggle-empty]').forEach(b=>b.onclick=()=>{state.reviewShowEmpty=!state.reviewShowEmpty;render();$('#review-queue')?.scrollIntoView({block:'nearest'})});$$('[data-review-manual]').forEach(b=>b.onclick=()=>{state.selectedRoute=canonicalZone(b.dataset.reviewManual);editRoute()});$$('[data-review-candidate]').forEach(b=>b.onclick=()=>{state.selectedRoute=canonicalZone(b.dataset.reviewZone);editRoute(b.dataset.reviewCandidate)});$$('[data-review-special]').forEach(b=>b.onclick=()=>editSpecialEncounter(null,b.dataset.reviewSpecial,b.dataset.reviewKind));$$('[data-special-edit]').forEach(b=>b.onclick=()=>editSpecialEncounter(b.dataset.specialEdit));$$('[data-special-remove]').forEach(b=>b.onclick=()=>removeSpecialEncounter(b.dataset.specialRemove));$('#shop-search')?.addEventListener('input',e=>{const pos=e.target.selectionStart;state.shopQuery=e.target.value;render();const f=$('#shop-search');f?.focus();f?.setSelectionRange(pos,pos)});$('#shop-cat')?.addEventListener('change',e=>{state.selectedCategory=e.target.value;render()});$$('[data-buy]').forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));$$('[data-confirm-replay]').forEach(b=>b.onclick=()=>confirmReplay(b.dataset.confirmReplay));$$('[data-cancel-manual-game]').forEach(b=>b.onclick=()=>cancelManualGame(b.dataset.cancelManualGame));$('#manual-game-form')?.addEventListener('submit',registerManualGame);$('#rules-form')?.addEventListener('submit',saveRules);$('#new-adventure-form')?.addEventListener('submit',requestNewAdventure);$$('[data-run-cancel]').forEach(b=>b.onclick=()=>cancelNewAdventure(b.dataset.runCancel));$$('[data-run-confirm]').forEach(b=>b.onclick=()=>confirmNewAdventure(b.dataset.runConfirm));$$('[data-run-open]').forEach(b=>b.onclick=()=>openArchivedAdventure(b.dataset.runOpen));$$('[data-run-download]').forEach(b=>b.onclick=()=>downloadArchivedAdventure(b.dataset.runDownload));$$('[data-run-close]').forEach(b=>b.onclick=()=>{state.archivePreview=null;render()});}
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
async function requestNewAdventure(e){
 e.preventDefault();if(!guard())return;
 const name=String(new FormData(e.currentTarget).get('name')||'').trim();
 if(!name||name.length>90){toast('Indica un nombre válido.','error');return}
 const d=modal('Proponer nueva partida',`<p>Se enviará a la otra persona una propuesta para empezar <strong>${esc(name)}</strong>.</p><p class="small">Todavía no se borrará ni archivará nada. Cuando el otro jugador la confirme, el archivo y el reinicio ocurrirán juntos en Supabase.</p><button class="button full" id="v23-do-request">Enviar propuesta</button>`);
 $('#v23-do-request').onclick=async()=>{try{await rpc('request_new_adventure_v23',{p_next_name:name});d.close();toast('Propuesta enviada al otro jugador.','success');await loadShared()}catch(err){toast(err.message,'error')}};
}
async function cancelNewAdventure(id){if(!guard())return;try{await rpc('cancel_new_adventure_v23',{p_request_id:id});toast('Solicitud cancelada.');await loadShared()}catch(err){toast(err.message,'error')}}
async function confirmNewAdventure(id){if(!guard())return;
 const request=state.resetRequest;if(!request||request.request_id!==id)return;
 const d=modal('Confirmación del segundo jugador',`<div class="notice">Esta acción cambiará la partida activa para ambos jugadores.</div><p>Se archivará el progreso actual y comenzaréis <strong>${esc(request.next_name)}</strong> con capturas, medallas y Pokéfichas a cero.</p><p class="small">No se elimina el historial: seguirá disponible en Historial. No se puede deshacer desde la web.</p><button class="button full" id="v23-do-confirm">Archivar la actual e iniciar la nueva</button>`);
 $('#v23-do-confirm').onclick=async()=>{const btn=$('#v23-do-confirm');btn.disabled=true;try{
  await rpc('confirm_new_adventure_v23',{p_request_id:id});d.close();state.archivePreview=null;state.selectedRoute='Ruta 101';state.pendingSave=null;state.preview=null;
  toast('Nueva partida iniciada. Historial anterior archivado.','success');await loadShared();
 }catch(err){toast('No se ha reiniciado la partida: '+err.message,'error');btn.disabled=false}};
}
async function openArchivedAdventure(id){if(!guard())return;
 try{const rows=await db('adventure_runs',`?select=id,name,started_at,archived_at,shared_snapshot&id=eq.${encodeURIComponent(id)}&archived_at=not.is.null`);
  if(rows.length!==1)throw Error('Historial no encontrado');state.archivePreview=rows[0];render();$('#v23-archive-detail')?.scrollIntoView({block:'nearest'});
 }catch(err){toast('No se pudo abrir el histórico: '+err.message,'error')}}
async function downloadArchivedAdventure(id){if(!guard())return;
 try{
  const [runs,ownPrivate]=await Promise.all([
   db('adventure_runs',`?select=id,name,started_at,archived_at,shared_snapshot&id=eq.${encodeURIComponent(id)}&archived_at=not.is.null`),
   db('adventure_private_archives',`?select=pokemon_snapshot,fingerprints_snapshot&run_id=eq.${encodeURIComponent(id)}`)
  ]);
  if(runs.length!==1||ownPrivate.length!==1)throw Error('Falta el historial archivado de tu usuario');
  const exportData={partida:runs[0],mis_pokemon_privados:ownPrivate[0].pokemon_snapshot,mis_importaciones:ownPrivate[0].fingerprints_snapshot};
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='locke_historial_'+id+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Archivo generado. Contiene tus Pokémon privados: no lo compartas.','success');
 }catch(err){toast('No se pudo exportar el historial: '+err.message,'error')}
}
async function loadShared(){
 if(!CONNECTED||!state.session?.access_token){render();return}
 try{
  const user=await api('/auth/v1/user');
  const requests=[['special_encounters','?select=*&order=created_at.desc'],['players','?select=*&order=slot.asc'],['shared_progress','?select=*'],['route_states','?select=*'],['shop_catalog','?select=*&order=category,name'],['combat_series','?select=*&order=created_at.desc'],['replay_games','?select=*&order=created_at.desc'],['replay_confirmations','?select=game_id,player_id'],['money_events','?select=*&order=created_at.desc'],['egg_claims','?select=*&order=created_at.asc'],['config','?select=*'],['adventure_runs','?select=id,name,started_at,archived_at&order=started_at.desc'],['adventure_reset_request','?select=request_id,run_id,requested_by,next_name,created_at,expires_at']];
  // Primero carga todo; si una tabla falla NO reemplazamos datos existentes por [].
  const data=await Promise.all(requests.map(async([table,q])=>{
   try{return await db(table,q)}catch(err){throw Error(`${table}: ${err.message}`)}
  }));
  const players=data[1],myPlayer=players.find(x=>x.user_id===user.id);
  if(!myPlayer)throw Error('La cuenta no está asociada a Jugador 1 o Jugador 2.');
  const privateMons=await db('private_pokemon',`?owner_id=eq.${encodeURIComponent(user.id)}&select=*`);
  if(!Array.isArray(privateMons))throw Error('No se ha podido leer la colección privada.');
  state.account={id:user.id,email:user.email};
  state.specialEncounters=data[0];state.players=players;state.progress=data[2];state.routes=data[3];
  state.catalog=data[4];state.series=data[5];state.games=data[6];state.confirmations=data[7];
  state.economy=data[8];state.claims=data[9];state.pokemon=privateMons;
  state.settings={...defaults,...(data[10].find(x=>x.id===1)||{})};
  state.adventures=data[11];state.resetRequest=data[12].find(x=>new Date(x.expires_at).getTime()>Date.now())||null;
  state.syncError='';state.lastSuccessfulSync=new Date();
 }catch(err){
  state.syncError=err.message;
  toast('Sincronización fallida: '+err.message,'error');
  console.error('Error al sincronizar Locke Escribe:',err);
  // El llamador debe conocer el fallo, especialmente después de guardar/importar.
  render();throw err;
 }
 render();
}
async function saveRules(e){e.preventDefault();if(!guard())return;const f=new FormData(e.currentTarget);const allowed=['life_limit','gym_pf','ko_pf','cap_bst','egg_price'];const updates={};for(const k of allowed){const v=Number(f.get(k));if(!Number.isInteger(v)||v<0)throw Error('Valor no válido');updates[k]=v}try{await api('/rest/v1/config?id=eq.1',{method:'PATCH',body:updates,headers:{Prefer:'return=minimal'}});toast('Reglas guardadas','success');await loadShared()}catch(err){toast(err.message,'error')}}
// Ajuste manual de Pokéfichas. La operación se valida y registra en Supabase.
async function addManualPf(){
 if(!guard())return;
 const me=own();if(!me)return;
 const requestId=globalThis.crypto?.randomUUID?.();
 if(!requestId){toast('Tu navegador no permite generar un identificador seguro.','error');return;}
 const d=modal('Sumar Pokéfichas',`<p>Se añadirán fichas únicamente a <strong>${esc(me.display_name)}</strong>. El movimiento y el motivo serán visibles para ambos jugadores en el historial.</p><form id="manual-pf-form"><label class="form-label" for="manual-pf-amount">Cantidad de PF</label><input class="field" id="manual-pf-amount" type="number" min="1" max="100" step="1" value="6" required><label class="form-label" for="manual-pf-reason">Motivo (visible para ambos)</label><input class="field" id="manual-pf-reason" maxlength="100" minlength="3" required placeholder="Ej.: premio acordado por combate"><div class="flex mt-3"><button type="submit" class="button" id="manual-pf-submit">Añadir PF</button><button type="button" class="button ghost" id="manual-pf-cancel">Cancelar</button></div></form>`);
 $('#manual-pf-cancel').onclick=()=>d.close();
 $('#manual-pf-form').onsubmit=async e=>{
  e.preventDefault();
  const amount=Number($('#manual-pf-amount').value);
  const reason=String($('#manual-pf-reason').value||'').trim();
  if(!Number.isInteger(amount)||amount<1||amount>100||reason.length<3||reason.length>100){toast('Indica de 1 a 100 PF y un motivo de 3 a 100 caracteres.','error');return;}
  const button=$('#manual-pf-submit');button.disabled=true;
  try{
   await rpc('add_manual_pf_v1',{p_amount:amount,p_reason:reason,p_request_id:requestId});
   d.close();
   try{await loadShared();toast(`Se han añadido ${amount} PF a tu cuenta.`,'success')}
   catch{toast('Las PF se han registrado, pero no se pudo actualizar el saldo. Reintenta la sincronización, sin repetir la compra.','error')}
  }catch(err){button.disabled=false;toast('No se pudieron añadir PF: '+err.message,'error')}
 };
}
async function buyItem(itemId){const i=state.catalog.find(it=>String(it.id)===String(itemId));if(!i)return;if(!guard())return;const d=modal('Confirmar compra',`<p><strong>${esc(i.name)}</strong> (${i.quantity} ${i.quantity>1?'unidades':'unidad'}) por <strong>${i.price} Pokéfichas</strong>.</p><p>El objeto deberá introducirse en el juego con PKHeX. El saldo se descontará una única vez.</p><button class="button full" id="do-buy">Confirmar compra</button>`);$('#do-buy').onclick=async()=>{try{await rpc('buy_shop_item',{p_item_id:i.id});d.close();toast('Compra registrada. Recuerda añadir el objeto al juego.','success');await loadShared()}catch(err){toast(err.message,'error')}}}
async function drawEgg(){
 if(!guard())return;
 const owner=own()?.user_id;
 if(!state.progress.some(p=>p.player_id===owner)){
   toast('Importa tu main antes de sortear huevos.','error');return;
 }
 const d=modal('Sugerencia de huevo',`<p>Se seleccionará una caja y una posición usando tus vidas, tu equipo vivo y tus resultados confirmados. No intervienen los datos del rival.</p>
   <div class="notice mb-3">Esta sugerencia no reserva ni marca ningún huevo. Si pulsas por error, puedes ignorarla y volver a sortear.</div>
   <button id="do-draw" class="button full">Mostrar sugerencia aleatoria</button>`);
 $('#do-draw').onclick=async()=>{
   const button=$('#do-draw');button.disabled=true;
   try{
     const response=await rpc('draw_weighted_egg');
     const result=Array.isArray(response)?response[0]:response;
     const box=Number(result?.box_num),slot=Number(result?.slot_num);
     if(!Number.isInteger(box)||box<1||box>29||!Number.isInteger(slot)||slot<1||slot>30){
       throw Error('El servidor no ha devuelto una posición válida');
     }
     state.lastEggSuggestion={player_id:owner,box_num:box,slot_num:slot};
     d.innerHTML=`<header><h2>Huevo sugerido</h2><button data-close="1">×</button></header><div class="egg-podium"><div class="egg-art"></div><div class="egg-result">Caja ${box} · Posición ${slot}</div></div><p>El huevo no se ha reservado ni marcado. Si no lo abres, puede volver a salir. Cuando lo eclosiones, importa un main actualizado para retirarlo de los sorteos.</p><button class="button full" data-close="1">Entendido</button>`;
     d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
     render();
   }catch(err){
     toast('No se pudo obtener una sugerencia: '+err.message+'. Puedes volver a intentarlo.','error');
     d.close();
   }
 };
}

async function createSeries(){if(!guard())return;try{await api('/rest/v1/combat_series',{method:'POST',body:{status:'open'},headers:{Prefer:'return=minimal'}});toast('Nueva serie BO3 creada','success');await loadShared()}catch(err){toast(err.message,'error')}}
async function editRoute(pokemonKey=null){
  if(!guard())return;
  const me=own();if(!me)return;
  try{await loadDex()}catch(err){toast('No se pudo cargar la Pokédex: '+err.message,'error')}
  const r=routeState(me.user_id,state.selectedRoute);
  const candidates=state.pokemon.filter(pk=>!pk.is_egg && !Number(pk.egg_location||0) && locationName(pk.met_location)===canonicalZone(state.selectedRoute));
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
    const stats=calcStats(getOrasBaseStats(species,state.dex[species]?.baseStats),pk.met_level,pk.ivs,pk.nature);
    const form=$('#route-form');
    form.elements.status.value='captured';form.elements.nickname.value=pk.nickname;form.elements.capture_level.value=pk.met_level||'';
    form.elements.stat_total.value=stats?stats.reduce((a,b)=>a+b,0):'';
    if(!stats)toast('Faltan datos para calcular las estadísticas; introduce el total manualmente.','error');
  });
  if(pokemonKey){
   const i=candidates.findIndex(pk=>String(pk.pokemon_key)===String(pokemonKey));
   const chooser=$('#route-candidate');
   if(i>=0&&chooser){chooser.value=String(i);chooser.dispatchEvent(new Event('change'))}
   else toast('No se encontró ese Pokémon en tus datos privados; verifica la zona manualmente.','error');
  }
  $('#route-form').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const v=f.get('stat_total'),lv=f.get('capture_level'),method=String(f.get('encounter_method')||'unknown');
    if(method&&!Object.hasOwn(ENCOUNTER_METHODS,method))throw Error('Método no válido');
    try{
      await api('/rest/v1/route_states?on_conflict=owner_id,zone_key',{
        method:'POST',body:{owner_id:me.user_id,zone_key:canonicalZone(state.selectedRoute),status:f.get('status'),nickname:String(f.get('nickname')||''),stat_total:v?Number(v):null,capture_level:lv?Number(lv):null,encounter_method:method},
        headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
      });d.close();toast('Zona revisada y guardada','success');await loadShared();
    }catch(err){toast(err.message,'error')}
  };
}


/* Huevos/regalos: registro manual, separado del derecho de captura por ruta. */
async function editSpecialEncounter(id=null,pokemonKey=null,preferredKind=null){
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
  try{await loadDex();const sp=pk.original_species||pk.species,stats=calcStats(getOrasBaseStats(sp,state.dex[sp]?.baseStats),pk.met_level,pk.ivs,pk.nature);form.elements.stat_total.value=stats?stats.reduce((a,v)=>a+v,0):'';}
  catch{toast('No se han calculado las estadísticas. Puedes introducir el total manualmente.','error');}
 });
 if(pokemonKey){
  const i=eligible.findIndex(pk=>String(pk.pokemon_key)===String(pokemonKey));
  const picker=$('#special-candidate');
  if(i>=0&&picker){
   picker.value=String(i);
   picker.dispatchEvent(new Event('change'));
   if(preferredKind&&Object.hasOwn(SPECIAL_KINDS,preferredKind))$('#special-encounter-form').elements.kind.value=preferredKind;
  }else toast('El Pokémon no está disponible en tus datos privados; puedes completar la ficha manualmente.','error');
 }
 $('#special-encounter-form').onsubmit=async e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);
  const kind=String(form.get('kind')),method=String(form.get('encounter_method'));
  if(!Object.hasOwn(SPECIAL_KINDS,kind)||!Object.hasOwn(ENCOUNTER_METHODS,method)){toast('Origen o método incorrecto.','error');return;}
  const rawLevel=form.get('capture_level'),rawStat=form.get('stat_total');
  const row={owner_id:me.user_id,kind,nickname:String(form.get('nickname')||'').trim(),zone_key:canonicalZone(form.get('zone_key')),capture_level:rawLevel?Number(rawLevel):null,stat_total:rawStat?Number(rawStat):null,encounter_method:method};
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

function actions(a){if(a==='manual-pf')addManualPf();if(a==='retry-sync')loadShared().catch(()=>{});if(a==='import')$('#save-file').click();if(a==='account'){if(state.account){state.session=null;state.account=null;sessionStorage.removeItem('dualocke_session');location.reload()}else loginModal()}if(a==='new-series')createSeries();if(a==='route-edit')editRoute();if(a==='special-add')editSpecialEncounter();if(a==='location-edit')editCurrentLocation();if(a==='zone-add')addCustomZone();if(a==='draw-egg')drawEgg();if(a==='export'){const ownId=own()?.user_id;const out={players:state.players,progress:state.progress,routes:state.routes,special_encounters:state.specialEncounters,series:state.series,games:state.games,economy:state.economy,claims:state.claims,own_private_creatures:state.pokemon.filter(p=>p.owner_id===ownId)};const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));link.download='dualocke_export.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1500)}}

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
  return canonicalZone(map[n]||`Lugar #${n}`);
}

// La primera importación no debe adivinar cuál de dos Pokémon de una misma
// ruta es la captura legal. Conservamos la zona pendiente de verificación.
function planCaptureRoutes(save,knownZones,dex){
  const grouped=new Map();
  for(const pk of [...save.party,...save.pc]){
    if(pk.is_egg || Number(pk.egg_location||0)>0)continue;
    const zone_key=canonicalZone(locationName(pk.met_location));
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
function dexRating(pk,mon){if(!mon)return null;const b=getOrasBaseStats(pk.species,mon.baseStats)||{};const bst=Object.values(b).reduce((a,v)=>a+Number(v),0);if(!bst)return null;const av=bst/6,dev=Object.values(b).reduce((a,v)=>a+Math.abs(v-av),0)/6;const efficiency=Math.max(0,1-dev/160);const ivs=pk.ivs||[15,15,15,15,15,15];const ivScore=ivs.reduce((a,v)=>a+v,0)/(31*6);const bstScore=Math.min(1,Math.max(0,(bst-180)/490));const quality=100*(0.70*bstScore+0.15*efficiency+0.10*0.5+0.05*ivScore);
  return {bst,quality:Math.round(quality*100)/100};
}
async function loadDex(){
  if(state.dexReady)return state.dex;
  const byNum={};
  for(let num=1;num<=721;num++){
    const name=ORAS_SPECIES_NAMES[num],baseStats=getOrasBaseStats(num);
    if(!name||!baseStats)throw Error(`Faltan datos locales de la especie #${num}`);
    byNum[num]={num,name,baseStats};
  }
  state.dex=byNum;
  state.dexReady=true;
  return state.dex;
}
async function sha256Hex(buffer){
 if(!globalThis.crypto?.subtle)throw Error('Necesitas HTTPS o localhost para verificar la huella del guardado.');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function handleSave(file){
 if(!file||!guard())return;
 try{
  if(file.size!==0x76000)throw Error('Elige un main válido de Rubí Omega de 483.328 bytes.');
  // Releer estado del servidor ANTES de construir la vista previa.
  await loadShared();
  const raw=await file.arrayBuffer();const digest=await sha256Hex(raw);
  const save=parseSave(raw);await loadDex();
  const owner=own()?.user_id,prev=state.progress.find(p=>p.player_id===owner);
  const notes=[];
  if(prev){
   if(save.badges<Number(prev.badges||0))notes.push('El archivo tiene menos medallas que la partida publicada.');
   if(save.deaths<Number(prev.deaths||0))notes.push('El archivo contiene menos bajas que el último guardado.');
   if(save.trainer!==prev.trainer_name)notes.push('Ha cambiado el nombre del entrenador.');
   notes.push('No se puede determinar la antigüedad de un main solo por su fecha de subida.');
  }
  state.preview=save;
  const d=modal('Validar importación',`<p>El archivo se analiza localmente. Solo se enviarán registros privados autorizados, no el archivo binario.</p><div class="grid-2"><div class="trainer-metric"><small>ENTRENADOR</small><strong>${esc(save.trainer)}</strong></div><div class="trainer-metric"><small>MEDALLAS</small><strong>${save.badges}/8</strong></div><div class="trainer-metric"><small>EQUIPO</small><strong>${save.party.length} Pokémon</strong></div><div class="trainer-metric"><small>HUEVOS / BAJAS</small><strong>${save.eggs} / ${save.deaths}</strong></div></div>${notes.length?`<div class="notice mt-3">${notes.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>`:''}<p class="small mt-3">Se rechazará una importación idéntica o que reduzca medallas o bajas. Si empezáis otra partida, primero se debe reiniciar el historial.</p><label class="le20-confirm mt-3"><input type="checkbox" id="save-verified"> He comprobado que este main es de la partida actual y no una copia antigua.</label><button class="button full mt-3" id="confirm-save" disabled>Importar de forma segura</button>`);
  const button=$('#confirm-save');$('#save-verified').onchange=e=>button.disabled=!e.target.checked;
  button.onclick=async()=>{try{button.disabled=true;await publishSave(save,digest);d.close();toast('Guardado importado en una única transacción','success');await loadShared()}catch(err){toast(err.message,'error');button.disabled=false}};
 }catch(err){toast(err.message,'error')}finally{$('#save-file').value=''}
}
async function publishSave(save,digest){
 if(!guard())throw Error('No hay una sesión sincronizada.');
 const me=own();if(!me)throw Error('Cuenta no asociada a ningún jugador.');
 const owner_id=me.user_id,existing=new Map(state.pokemon.map(p=>[p.pokemon_key,p]));
 const all=[...save.party,...save.pc];
 const privateRows=all.map(pk=>{
  const dex=state.dex[pk.species],score=dexRating(pk,dex),prior=existing.get(pk.pokemon_key);
  return {pokemon_key:pk.pokemon_key,species:pk.species,nickname:pk.nickname,box_num:pk.box,slot_num:pk.slot,is_egg:pk.is_egg,level:pk.level,met_level:pk.met_level,met_location:pk.met_location,egg_location:pk.egg_location||0,original_species:prior?.original_species??pk.species,nature:pk.nature,ability:pk.ability,ivs:pk.ivs,moves:pk.moves,stats:pk.stats,bst:score?.bst??null,quality:score?.quality??null};
 });
 const before=state.progress.find(p=>p.player_id===owner_id);
 const keepManual=before&&Number(before.map_code)===save.mapId&&isConfirmedLocation(before.map_label);
 const known=new Set(state.routes.filter(r=>r.owner_id===owner_id).map(r=>canonicalZone(r.zone_key)));
 const proposals=planCaptureRoutes(save,known,state.dex).map(r=>({...r,zone_key:canonicalZone(r.zone_key)}));
 try{
  await rpc('publish_save_v20',{
   p_fingerprint:digest,p_expected_update:before?.updated_at??null,
   p_trainer_name:save.trainer,p_badges:save.badges,p_deaths:save.deaths,
   p_map_code:save.mapId,p_map_label:keepManual?before.map_label:save.map_label,
   p_team_count:save.party.length,p_pokemon:privateRows,p_routes:proposals
  });
 }catch(err){
  if(/publish_save_v20|Could not find the function|PGRST202/i.test(err.message))throw Error('Falta la migración SQL v2.0 en Supabase. No se ha modificado el guardado.');
  throw err;
 }
 if(proposals.length)toast(`${proposals.length} zonas sin confirmar. Consulta el apartado Verificaciones del mapa.`, 'error');
}

async function confirmReplay(gameId){
 if(!guard())return;
 const game=state.games.find(g=>g.id===gameId);if(!game)return;
 if(!confirm(`¿Has comprobado los resultados introducidos manualmente?${game.ended_by_forfeit?' Es un forfeit: 6 PF para el ganador, conservando los KO reales.':''} La confirmación permite conceder recompensas cuando ambos estéis de acuerdo.`))return;
 try{await rpc('confirm_replay_v20',{p_game_id:gameId});toast('Resultado confirmado. Las recompensas se activan con ambas confirmaciones.','success');await loadShared()}
 catch(err){toast('No se pudo confirmar el resultado: '+err.message,'error')}
}
// Catálogo de 377 productos del reglamento; Supabase tiene su propia copia editable.


// Servicios del reglamento: el servidor conserva la elección de forma privada.
// Cambiar la naturaleza, los IV o reiniciar EV requiere modificar el guardado
// con PKHeX: la compra NO toca automáticamente ningún Pokémon del main.
async function buyTrainingService(itemId){
  if(!guard())return;
  const item=state.catalog.find(i=>Number(i.id)===Number(itemId));
  if(!item)return;
  const candidates=state.pokemon.filter(p=>p.owner_id===state.account?.id&&p.present&&!p.is_egg&&![30,31].includes(Number(p.box_num)));
  if(!candidates.length){toast('Importa un main con algún Pokémon vivo antes de comprar este servicio.','error');return;}
  const needsNature=Number(itemId)===393,needsIV=[397,398].includes(Number(itemId));
  const choices=needsNature?NATURES:needsIV?TRAINING_IV_STATS:[];
  const optionRows=candidates.map(p=>`<option value="${esc(p.pokemon_key)}">${esc(p.nickname||'Pokémon #'+p.species)} · Nv. ${Number(p.level||0)}</option>`).join('');
  const detail=choices.length?`<label class="form-label" for="service-choice">${needsNature?'Naturaleza elegida':'Estadística del IV'}</label><select id="service-choice" class="select">${choices.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`:'';
  const dialog=modal('Confirmar servicio',`<p><strong>${esc(item.name)}: ${item.price} PF</strong>.</p><p>Servicio del Dualocke: después de pagar, aplica el cambio manualmente con PKHeX y vuelve a importar el main. La web no modifica tu guardado.</p><label class="form-label" for="service-pokemon">Pokémon destinatario</label><select id="service-pokemon" class="select">${optionRows}</select>${detail}<button class="button full" id="do-service-buy">Confirmar compra</button>`);
  const button=$('#do-service-buy');
  button.onclick=async()=>{
    button.disabled=true;
    try{
      const pokemonKey=$('#service-pokemon').value;
      const choice=choices.length?$('#service-choice').value:null;
      await rpc('buy_shop_service_v1',{p_item_id:Number(itemId),p_pokemon_key:pokemonKey,p_selection:choice});
      dialog.close();toast('Servicio comprado y destinatario registrado. Aplica el cambio en PKHeX.','success');await loadShared();
    }catch(err){button.disabled=false;toast(err.message,'error')}
  };
}

if(typeof document!=='undefined'){
  // Las fichas del registro de capturas abren su editor directamente.
  // El índice del atlas conserva la selección habitual de zonas.
  document.addEventListener('click',event=>{
    const card=event.target.closest?.('.enc18-route[data-route]');
    if(!card)return;
    event.preventDefault();
    event.stopPropagation();
    state.selectedRoute=canonicalZone(card.dataset.route);
    editRoute().catch(err=>toast('No se pudo abrir la captura: '+err.message,'error'));
  },true);
  // Las recompensas especiales no se introducen como objetos en PKHeX.
  const buyOrdinaryItem=buyItem;
  buyItem=async function(itemId){
    if(TRAINING_SERVICE_IDS.includes(Number(itemId)))return buyTrainingService(itemId);
    if(![378,379].includes(Number(itemId)))return buyOrdinaryItem(itemId);
    if(!guard())return;
    const item=state.catalog.find(x=>Number(x.id)===Number(itemId));
    if(!item)return;
    const life=Number(itemId)===379;
    if(life&&extraLifePurchased(state.economy,own()?.user_id)){
      toast('La vida adicional solo se puede comprar una vez por jugador y partida.','error');return;
    }
    if(!life&&state.economy.filter(e=>e.player_id===own()?.user_id&&Number(e.item_id)===378&&e.kind==='compra').length>=2){
      toast('Solo puedes comprar dos reanimaciones por partida.','error');return;
    }
    const message=life
      ?'Aumenta en una el límite de vidas de tu partida, sin cambiar las bajas ya registradas. Solo se puede comprar una vez por jugador y partida.'
      :'Rescata un Pokémon de las cajas 30 o 31 al importar el próximo main. Su muerte seguirá contando: no recuperas la vida. Cada permiso sirve para un Pokémon.';
    const dialog=modal(life?'Comprar vida adicional':'Confirmar reanimación',`<p><strong>${esc(item.name)}: ${item.price} PF</strong>.</p><p>${message}</p><button class="button full" id="do-special-buy">Confirmar compra</button>`);
    const button=$('#do-special-buy');
    button.onclick=async()=>{
      button.disabled=true;
      try{
        await rpc('buy_shop_item',{p_item_id:item.id});
        dialog.close();
        toast(life?'Vida adicional registrada.':'Permiso de reanimación comprado. Importa el main después de rescatar al Pokémon.','success');
        await loadShared();
      }catch(err){button.disabled=false;toast(err.message,'error')}
    };
  };
  // En modo conectado manda el catálogo de Supabase, sincronizado por la migración.
  state.catalog=[...SHOP.map(repriceShopItem),
    {id:378,name:'Revivir un Pokémon (sin recuperar vida)',category:'Recompensas',price:30,quantity:1,available:true},
    {id:379,name:'Vida adicional (una por partida)',category:'Recompensas',price:10,quantity:1,available:true},
    {id:380,name:'Cápsula Habilidad',category:'Entrenamiento — otros',price:3,quantity:1,available:true},
    ...TRAINING_SHOP_ITEMS];
  document.addEventListener('DOMContentLoaded',async()=>{
    const file=$('#save-file');file.addEventListener('change',e=>handleSave(e.target.files?.[0]));
    $('#btn-import').onclick=()=>actions('import');$('#btn-account').onclick=()=>actions('account');
    $('#menu-toggle').onclick=()=>$('#sidebar').classList.toggle('open');
    document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>$('#sidebar').classList.remove('open')));
    window.addEventListener('hashchange',render);
    render();
    if(CONNECTED){if(state.session){try{await loadShared()}catch(err){if(/invalid.*refresh|jwt expired|sesión caducada|refresh token|\b401\b/i.test(String(err.message))){toast('Sesión caducada; vuelve a iniciar sesión.','error');state.session=null;sessionStorage.removeItem('dualocke_session');loginModal()}/* Otros errores ya se muestran con el aviso persistente de sincronización. */}}else loginModal()}
  });
}
export {parseSave,decodePK6,calcStats,locationName,planCaptureRoutes,canonicalZone,mapStatusLabel,encounterMethod,HOENN_ATLAS,BOSSES,loadDex,editionForName,renderBattlesManual,renderEggsManual};
