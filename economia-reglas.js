// Reglas públicas de la tienda. El servidor (Supabase) sigue siendo autoritativo.
// No añadir aquí datos privados de las ROMs ni precios dependientes de Pokémon secretos.
export function repriceShopItem(item){
  const {id,category,name}=item;
  let {price,quantity}=item;
  if(id===378){price=30;quantity=1;}
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
  if(id===314){price=1;quantity=3;} // Escama Corazón: tres por PF
  return {...item,price,quantity};
}
export function extraLifePurchased(events,playerId){
  if(!playerId)return false;
  return events.some(e=>e.player_id===playerId&&Number(e.item_id)===379&&e.kind==='compra');
}
