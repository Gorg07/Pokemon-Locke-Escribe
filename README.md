# Locke Escribe

Panel estático para el Dualocke de Pokémon Rubí Omega y Zafiro Alfa.
GitHub Pages sirve la interfaz y Supabase gestiona las cuentas, permisos y
operaciones compartidas. Cada usuario debe consultar sus Pokémon privados
solo mediante su propia cuenta.

## Estructura

- `index.html`, `style.css`, `app.js`: interfaz y lógica del cliente.
- `assets/hoenn-map.png`: cartografía utilizada por el atlas.
- `data/shop-catalog.js`: catálogo público inicial (377 artículos).
- `economia-reglas.js`: reglas locales de precios; **Supabase valida las compras**.
- `manual-rules.js`: validación local de los resultados BO3.
- `oras-base-stats.js`, `oras-species-names.js`: datos públicos de ORAS.
- `evoluciones-modificadas.js`: guía pública de evoluciones.

## Comprobación local

Se necesita Node.js. Ejecuta `npm run check` para validar la sintaxis de
los módulos JavaScript. **No es una prueba funcional**: no comprueba los
permisos RLS, las funciones RPC, el navegador ni el guardado `main` real.
La suite de tests anterior fue retirada del proyecto.

Para abrir el sitio en local, utiliza un servidor HTTP (no `file://`),
porque `app.js` utiliza módulos JavaScript y recursos relativos.

## Privacidad y despliegue

- No publiques guardados `main`, logs de randomización, secretos de ROM ni
  exportaciones privadas. `.gitignore` ayuda, pero **no protege archivos ya
  rastreados por Git**.
- La clave `sb_publishable_*` del frontend es pública por diseño. **Nunca**
  incluyas una clave `service_role` en GitHub Pages.
- Las reglas de seguridad y las compras deben validarse en Supabase, no
  únicamente en JavaScript.
- Antes de desplegar, revisa los cambios con `git diff --check`, comprueba
  `npm run check` y prueba manualmente importación, tienda, capturas,
  confirmaciones BO3 e incubadora.
- No ejecutes migraciones SQL antiguas para sincronizar el frontend. Los
  cambios de esquema y funciones deben verificarse contra Supabase primero.
- El código actual no incluye todas las migraciones históricas: conserva
  un respaldo de las definiciones SQL instaladas si necesitas reconstruir
  el proyecto desde cero.

## Incubadora

El sorteo lo efectúa `draw_weighted_egg()` en Supabase. La interfaz solo
solicita una **sugerencia**, sin consumir créditos ni reservar huevos.
Un huevo deja de ser elegible tras eclosionar y volver a importar el
`main` actualizado. El servidor debe evaluar solo el progreso propio.
