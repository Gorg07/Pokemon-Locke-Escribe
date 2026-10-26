/* Locke Escribe — evoluciones modificadas para Rubí Omega y Zafiro Alfa.
 * Datos extraídos EXCLUSIVAMENTE de los apartados --Removing Impossible Evolutions--
 * y --Removing Timed-Based Evolutions-- de RO_3.cxi.log / ZA_4.cxi.log.
 * Los 46 métodos son idénticos en ambos logs. Ningún encuentro ni secreto se publica.
 * Esta guía es informativa y no interviene en el guardado ni en Supabase.
 */
(function () {
  'use strict';

  const EVOLUTIONS = [
  {
    "from": "Poliwhirl",
    "to": "Politoed",
    "method": "by leveling up holding King’s Rock",
    "category": "impossible"
  },
  {
    "from": "Kadabra",
    "to": "Alakazam",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Machoke",
    "to": "Machamp",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Graveler",
    "to": "Golem",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Slowpoke",
    "to": "Slowking",
    "method": "using a Water Stone",
    "category": "impossible"
  },
  {
    "from": "Haunter",
    "to": "Gengar",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Onix",
    "to": "Steelix",
    "method": "by leveling up holding Metal Coat",
    "category": "impossible"
  },
  {
    "from": "Lickitung",
    "to": "Lickilicky",
    "method": "at level 33",
    "category": "impossible"
  },
  {
    "from": "Rhydon",
    "to": "Rhyperior",
    "method": "by leveling up holding Protector",
    "category": "impossible"
  },
  {
    "from": "Tangela",
    "to": "Tangrowth",
    "method": "at level 38",
    "category": "impossible"
  },
  {
    "from": "Seadra",
    "to": "Kingdra",
    "method": "by leveling up holding Dragon Scale",
    "category": "impossible"
  },
  {
    "from": "Scyther",
    "to": "Scizor",
    "method": "by leveling up holding Metal Coat",
    "category": "impossible"
  },
  {
    "from": "Electabuzz",
    "to": "Electivire",
    "method": "by leveling up holding Electirizer",
    "category": "impossible"
  },
  {
    "from": "Magmar",
    "to": "Magmortar",
    "method": "by leveling up holding Magmarizer",
    "category": "impossible"
  },
  {
    "from": "Porygon",
    "to": "Porygon2",
    "method": "by leveling up holding Up-Grade",
    "category": "impossible"
  },
  {
    "from": "Aipom",
    "to": "Ambipom",
    "method": "at level 32",
    "category": "impossible"
  },
  {
    "from": "Yanma",
    "to": "Yanmega",
    "method": "at level 33",
    "category": "impossible"
  },
  {
    "from": "Piloswine",
    "to": "Mamoswine",
    "method": "at level 45",
    "category": "impossible"
  },
  {
    "from": "Porygon2",
    "to": "Porygon-Z",
    "method": "by leveling up holding Dubious Disc",
    "category": "impossible"
  },
  {
    "from": "Feebas",
    "to": "Milotic",
    "method": "by leveling up holding Prism Scale",
    "category": "impossible"
  },
  {
    "from": "Dusclops",
    "to": "Dusknoir",
    "method": "by leveling up holding Reaper Cloth",
    "category": "impossible"
  },
  {
    "from": "Clamperl",
    "to": "Huntail",
    "method": "by leveling up holding Deep Sea Tooth",
    "category": "impossible"
  },
  {
    "from": "Clamperl",
    "to": "Gorebyss",
    "method": "by leveling up holding Deep Sea Scale",
    "category": "impossible"
  },
  {
    "from": "Bonsly",
    "to": "Sudowoodo",
    "method": "at level 15",
    "category": "impossible"
  },
  {
    "from": "Mime Jr.",
    "to": "Mr. Mime",
    "method": "at level 15",
    "category": "impossible"
  },
  {
    "from": "Boldore",
    "to": "Gigalith",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Gurdurr",
    "to": "Conkeldurr",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Karrablast",
    "to": "Escavalier",
    "method": "by leveling up with Shelmet in the party",
    "category": "impossible"
  },
  {
    "from": "Shelmet",
    "to": "Accelgor",
    "method": "by leveling up with Karrablast in the party",
    "category": "impossible"
  },
  {
    "from": "Spritzee",
    "to": "Aromatisse",
    "method": "by leveling up holding Sachet",
    "category": "impossible"
  },
  {
    "from": "Swirlix",
    "to": "Slurpuff",
    "method": "by leveling up holding Whipped Dream",
    "category": "impossible"
  },
  {
    "from": "Phantump",
    "to": "Trevenant",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Pumpkaboo",
    "to": "Gourgeist",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Pumpkaboo-M",
    "to": "Gourgeist",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Pumpkaboo-L",
    "to": "Gourgeist",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Pumpkaboo-XL",
    "to": "Gourgeist",
    "method": "at level 37",
    "category": "impossible"
  },
  {
    "from": "Eevee",
    "to": "Espeon",
    "method": "using a Sun Stone",
    "category": "time"
  },
  {
    "from": "Eevee",
    "to": "Umbreon",
    "method": "using a Moon Stone",
    "category": "time"
  },
  {
    "from": "Gligar",
    "to": "Gliscor",
    "method": "by leveling up holding Razor Fang",
    "category": "time"
  },
  {
    "from": "Sneasel",
    "to": "Weavile",
    "method": "by leveling up holding Razor Claw",
    "category": "time"
  },
  {
    "from": "Budew",
    "to": "Roselia",
    "method": "by reaching high happiness",
    "category": "time"
  },
  {
    "from": "Chingling",
    "to": "Chimecho",
    "method": "by reaching high happiness",
    "category": "time"
  },
  {
    "from": "Happiny",
    "to": "Chansey",
    "method": "by leveling up holding Oval Stone",
    "category": "time"
  },
  {
    "from": "Riolu",
    "to": "Lucario",
    "method": "by reaching high happiness",
    "category": "time"
  },
  {
    "from": "Tyrunt",
    "to": "Tyrantrum",
    "method": "at level 39",
    "category": "time"
  },
  {
    "from": "Amaura",
    "to": "Aurorus",
    "method": "at level 39",
    "category": "time"
  }
];
  const SOURCES = ['RO_3.cxi.log', 'ZA_4.cxi.log'];
  const searchText = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function methodInSpanish(method) {
    let match = /^at level (\d+)$/.exec(method);
    if (match) return `Al alcanzar el nivel ${match[1]}`;
    match = /^by leveling up holding (.+)$/.exec(method);
    if (match) return `Subir de nivel llevando ${match[1]}`;
    match = /^using a (.+)$/.exec(method);
    if (match) return `Usar ${match[1]}`;
    match = /^by leveling up with (.+) in the party$/.exec(method);
    if (match) return `Subir de nivel con ${match[1]} en el equipo`;
    if (method === 'by reaching high happiness') return 'Alcanzar amistad alta';
    return method; // Se conserva el texto del log si aparece un método no previsto.
  }

  function injectStyles() {
    if (document.getElementById('le-evolution-styles')) return;
    const style = document.createElement('style');
    style.id = 'le-evolution-styles';
    style.textContent = `
      #le-evolutions { margin: 18px 0; min-width: 0; }
      #le-evolutions .le-evol-intro { margin: 6px 0 12px; color: #b3c8d9; line-height: 1.6; }
      #le-evolutions details.le-evol-details > summary { cursor: pointer; font-weight: 700; color: #e9f6ff; padding: 12px 14px; border: 1px solid #365b78; background: #203c55; border-radius: 9px; }
      #le-evolutions details.le-evol-details > summary:focus-visible { outline: 2px solid #a3e3fc; outline-offset: 2px; }
      #le-evolutions details[open] > summary { margin-bottom: 12px; }
      #le-evolutions .le-evol-controls { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; margin: 12px 0; }
      #le-evolutions .le-evol-search { min-width: 185px; flex: 1 1 250px; }
      #le-evolutions .le-evol-filters { display: flex; gap: 6px; flex-wrap: wrap; }
      #le-evolutions .le-evol-filters button { padding: 8px 10px; border-radius: 8px; border: 1px solid #456982; color: #cfe4f3; background: #223e56; cursor: pointer; font: inherit; font-size: 12px; }
      #le-evolutions .le-evol-filters button[aria-pressed="true"] { color: #fff; border-color: #8acbff; background: #326987; }
      #le-evolutions .le-evol-filters button:focus-visible { outline: 2px solid #c3edff; outline-offset: 2px; }
      #le-evolutions .le-evol-count { font-size: 12px; color: #a8c5da; margin-bottom: 8px; }
      #le-evolutions .le-evol-table-container { max-width: 100%; overflow-x: auto; border-radius: 9px; }
      #le-evolutions .le-evol-table { width: 100%; min-width: 500px; border-collapse: collapse; font-size: 13px; text-align: left; }
      #le-evolutions .le-evol-table th { color: #bad5e8; text-align: left; border-bottom: 1px solid #3e5c75; padding: 10px 12px; }
      #le-evolutions .le-evol-table td { padding: 10px 12px; border-bottom: 1px solid #2e4962; vertical-align: top; }
      #le-evolutions .le-evol-table tbody tr:hover { background: #23415b66; }
      #le-evolutions .le-evol-method { line-height: 1.45; }
      #le-evolutions .le-evol-source { font-size: 11px; color: #8fb1cb; margin: 12px 0 0; line-height: 1.5; }
      @media(max-width: 650px) {
        #le-evolutions .le-evol-filters button { flex: 1; }
        #le-evolutions .le-evol-table { min-width: 0; }
        #le-evolutions .le-evol-table thead { display: none; }
        #le-evolutions .le-evol-table tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3px 8px; padding: 9px 2px; border-bottom: 1px solid #35536b; }
        #le-evolutions .le-evol-table tbody td { padding: 3px 6px; border: 0; overflow-wrap: anywhere; }
        #le-evolutions .le-evol-table tbody td:nth-child(2)::before { content: '→ '; color: #8dbddd; }
        #le-evolutions .le-evol-table tbody td:last-child { grid-column: 1 / -1; color: #b5d0e2; }
      }
    `;
    document.head.append(style);
  }

  function makeCard() {
    const section = document.createElement('section');
    section.id = 'le-evolutions';
    section.className = 'card';
    section.setAttribute('aria-label', 'Evoluciones modificadas de ambas ROMs');
    section.innerHTML = `
      <div class="card-head"><h2>Evoluciones modificadas</h2><span class="badge">46 cambios</span></div>
      <p class="small le-evol-intro">Métodos de evolución extraídos de las dos ROMs nuevas. Son idénticos en Rubí Omega y Zafiro Alfa. No incluye las evoluciones que siguen siendo normales.</p>
      <details class="le-evol-details">
        <summary>Consultar las 46 evoluciones modificadas</summary>
        <div class="le-evol-controls">
          <input class="field le-evol-search" type="search" autocomplete="off" placeholder="Buscar Pokémon, nivel u objeto…" aria-label="Buscar evoluciones modificadas" />
          <div class="le-evol-filters" role="group" aria-label="Filtrar tipo de cambio">
            <button type="button" data-category="all" aria-pressed="true">Todas (46)</button>
            <button type="button" data-category="impossible" aria-pressed="false">Métodos imposibles (36)</button>
            <button type="button" data-category="time" aria-pressed="false">Sin horario (10)</button>
          </div>
        </div>
        <div class="le-evol-count" role="status" aria-live="polite"></div>
        <div class="le-evol-table-container">
          <table class="le-evol-table"><thead><tr><th>Pokémon</th><th>Evoluciona a</th><th>Método en estas ROMs</th></tr></thead><tbody></tbody></table>
        </div>
        <p class="le-evol-source">Fuentes: ${SOURCES.join(' y ')} · Randomizer ZX 4.6.1. Los nombres de los objetos se mantienen en inglés, como en los logs. No implica ningún cambio en las probabilidades de captura o de huevos.</p>
      </details>`;
    const input = section.querySelector('.le-evol-search');
    const tbody = section.querySelector('tbody');
    const count = section.querySelector('.le-evol-count');
    const buttons = [...section.querySelectorAll('[data-category]')];
    let category = 'all';

    function update() {
      const query = searchText(input.value.trim());
      const matches = EVOLUTIONS.filter(e =>
        (category === 'all' || category === e.category) &&
        (!query || searchText(`${e.from} ${e.to} ${e.method} ${methodInSpanish(e.method)}`).includes(query))
      );
      count.textContent = `${matches.length} de ${EVOLUTIONS.length} evoluciones`;
      tbody.innerHTML = matches.length ? matches.map(e =>
        `<tr><td><strong>${escapeHtml(e.from)}</strong></td><td><strong>${escapeHtml(e.to)}</strong></td><td class="le-evol-method" title="${escapeHtml(e.method)}">${escapeHtml(methodInSpanish(e.method))}</td></tr>`
      ).join('') : `<tr><td colspan="3">No hay evoluciones que coincidan con la búsqueda.</td></tr>`;
    }
    input.addEventListener('input', update);
    buttons.forEach(button => button.addEventListener('click', () => {
      category = button.dataset.category;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      update();
    }));
    update();
    return section;
  }

  function init() {
    const screen = document.getElementById('screen');
    if (!screen) return;
    injectStyles();
    function inject() {
      if (location.hash.slice(1) !== 'ajustes' || screen.querySelector('#le-evolutions')) return;
      // Después del gestor de partidas (v2.3), antes de las reglas.
      const anchor = screen.querySelector('.v23-settings-run');
      const target = anchor || screen.querySelector('.grid-2');
      if (!target) return;
      const card = makeCard();
      if (anchor) anchor.insertAdjacentElement('afterend', card);
      else target.insertAdjacentElement('beforebegin', card);
    }
    const observer = new MutationObserver(inject);
    observer.observe(screen, {childList: true});
    window.addEventListener('hashchange', inject);
    inject();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
