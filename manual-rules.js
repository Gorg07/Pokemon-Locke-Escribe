// Reglas de registro manual de combates (también validadas en Supabase).
export function normalizeManualGame({gameNo,winnerSlot,kos1,kos2,forfeit=false}) {
  const values=[gameNo,winnerSlot,kos1,kos2].map(Number);
  const [game_no,winner_slot,kos_1,kos_2]=values;
  if (!values.every(Number.isInteger) || game_no<1 || game_no>3 ||
      (winner_slot!==1 && winner_slot!==2) ||
      kos_1<0 || kos_1>6 || kos_2<0 || kos_2>6) {
    throw new Error('Indica combate 1–3, ganador válido y KO reales entre 0 y 6.');
  }
  return {game_no,winner_slot,kos_1,kos_2,forfeit:Boolean(forfeit)};
}

// Tope por jugador y serie: 18 PF. Un forfeit ganado vale 6 PF fijas,
// NO se suman los KO reales del ganador en ese combate.
export function manualSeriesPf(games,slot,koRate=1) {
  if (![1,2].includes(slot) || !Number.isInteger(koRate) || koRate<0)
    throw new Error('Jugador o valor de KO no válido');
  const subtotal=games.reduce((amount,g)=>amount+(
    g.forfeit && g.winner_slot===slot ? 6 : g[`kos_${slot}`]*koRate
  ),0);
  return Math.min(18,subtotal);
}
