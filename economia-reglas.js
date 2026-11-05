// Reglas públicas de la tienda. El servidor (Supabase) sigue siendo autoritativo.
// No añadir aquí datos privados de las ROMs ni precios dependientes de Pokémon secretos.
export function repriceShopItem(item){
  const {id,category,name}=item;
  let {price,quantity}=item;
  if(id===378){price=35;quantity=1;}
  else if(id===379){price=10;quantity=1;}
  else if(id===380){price=3;quantity=1;}
  else if(category==='Fósiles (captura adicional)')price=20;
  else if(category.startsWith('Bayas')){price=1;quantity=5;}
  else if(category.startsWith('Megapiedras'))price=18;
  else if(name==='Huevo aleatorio')price=14;
  else if(category.startsWith('Evolución —') || [84,85,144].includes(id))price=1;
  else if(category==='Competitivo — élite')price=[62,63,64,65,67].includes(id)?5:13;
  else if(category==='Competitivo — alto')price=12;
  else if(category==='Competitivo — medio')price=7;
  else if(category==='Específicos de especie')price=3;
  else if(category==='MT')price=6;
  else if(category==='Tesoros y reventa')price=Math.min(price,15);
  else price=Math.max(1,Math.min(price,24));
  if(id===4)quantity=10; // Ultra Ball: 10 por 1 PF
  if(id===317)quantity=30; // Repelente Máximo: 30 por 1 PF
  if(id===314){price=2;quantity=1;} // Escama Corazón: una unidad por 2 PF
  return {...item,price,quantity};
}
export function extraLifePurchased(events,playerId){
  if(!playerId)return false;
  return events.some(e=>e.player_id===playerId&&Number(e.item_id)===379&&e.kind==='compra');
}

// Identificadores nuevos: nunca reciclar IDs de compras históricas.
// La elección del destinatario, naturaleza y estadística se registra en Supabase.
export const TRAINING_SHOP_ITEMS = Object.freeze([
  {id:381,name:'Baya Grana (PS)',category:'Entrenamiento — bayas EV',price:1,quantity:10,available:true},
  {id:382,name:'Baya Algama (Ataque)',category:'Entrenamiento — bayas EV',price:1,quantity:10,available:true},
  {id:383,name:'Baya Ispero (Defensa)',category:'Entrenamiento — bayas EV',price:1,quantity:10,available:true},
  {id:384,name:'Baya Meluce (Ataque Especial)',category:'Entrenamiento — bayas EV',price:1,quantity:10,available:true},
  {id:385,name:'Baya Uvav (Defensa Especial)',category:'Entrenamiento — bayas EV',price:1,quantity:10,available:true},
  {id:386,name:'Baya Tamate (Velocidad)',category:'Entrenamiento — bayas EV',price:1,quantity:10,available:true},
  {id:387,name:'Más PS (vitamina EV)',category:'Entrenamiento — vitaminas EV',price:2,quantity:10,available:true},
  {id:388,name:'Proteína (vitamina EV)',category:'Entrenamiento — vitaminas EV',price:2,quantity:10,available:true},
  {id:389,name:'Hierro (vitamina EV)',category:'Entrenamiento — vitaminas EV',price:2,quantity:10,available:true},
  {id:390,name:'Calcio (vitamina EV)',category:'Entrenamiento — vitaminas EV',price:2,quantity:10,available:true},
  {id:391,name:'Zinc (vitamina EV)',category:'Entrenamiento — vitaminas EV',price:2,quantity:10,available:true},
  {id:392,name:'Carburante (vitamina EV)',category:'Entrenamiento — vitaminas EV',price:2,quantity:10,available:true},
  {id:393,name:'Menta de naturaleza (a escoger)',category:'Entrenamiento — servicios PKHeX',price:5,quantity:1,available:true},
  {id:394,name:'Reinicio completo de EV',category:'Entrenamiento — servicios PKHeX',price:3,quantity:1,available:true},
  {id:395,name:'Más PP',category:'Entrenamiento — otros',price:2,quantity:1,available:true},
  {id:396,name:'Máx. PP',category:'Entrenamiento — otros',price:5,quantity:1,available:true},
  {id:397,name:'Mejorar un IV en +5 (máximo 31)',category:'Entrenamiento — servicios PKHeX',price:3,quantity:1,available:true},
  {id:398,name:'Maximizar un IV a 31',category:'Entrenamiento — servicios PKHeX',price:7,quantity:1,available:true}
]);
export const TRAINING_SERVICE_IDS = Object.freeze([393,394,397,398]);
export const TRAINING_IV_STATS = Object.freeze(['PS','Ataque','Defensa','Ataque Especial','Defensa Especial','Velocidad']);
