# Figuras, dibujos y animaciones de VT Security

Reglas para diseñar y programar las figuras del blog (tenant `vt`). El estilo es el de la maqueta v3.1 aprobada (`~/Documents/VT-Blog-Design/mockups-v3.1.html`), inspirado en nan.fyi: **tinta sobre papel cuadriculado, tranquilo, una idea por figura**. Referencias: nan.fyi (estilo), ciechanow.ski (ilustración), samwho.dev (solo animación), joshwcomeau.com (terminación).

El código vive en `src/tenants/vt/figures/`. Ejemplo completo para copiar: `GitHistory.tsx`.

## Cuándo va una figura

- **Sí:** cuando algo **cambia de estado** y verlo cambiar lo explica mejor que un párrafo (commits que se suman, una ventana de tiempo, un orden de pasos, bits que se prenden).
- **No:** si la información es estática. Para eso hay una tabla, un bloque de código o un `:::aside`.
- **Una idea por figura.** Si hace falta explicar dos cosas, son dos figuras.
- **Como mucho tres figuras por artículo.** Entre figura y figura tiene que haber texto.
- **El texto de alrededor invita a usarla** ("Mové tu marca y mirá qué alcanzó a pasar"), pero el artículo se entiende aunque nadie la toque.

## Lenguaje visual

**Papel y marco**
- Fondo `--fig-paper` con cuadrícula de 20 u (`<Paper step={20} />`): líneas menores `--fig-grid` y una mayor cada 5.
- El dibujo va dentro de `.fig-canvas`: marco punteado con una × en cada esquina (`<Marks />`).

**Formas**
- **Todo contorno se dibuja a mano** con `drawn()` / `rl()` de `ink.ts`: la línea se pasa un poco de las puntas y se curva apenas.
- **Cada forma tiene su semilla fija** (`seed`), así el trazo es igual en el servidor y en el cliente. Nunca `Math.random()`.
- Relleno `--fig-node` (blanco del papel) debajo del trazo.
- **Vocabulario de piezas:**
  - hoja con la esquina doblada (`sheetPts`) para archivos y commits;
  - nodo blanco (`<Node />`) para puntos de una cadena;
  - guía punteada (`.s-guide`) para relaciones;
  - recuadro de selección con × (`<SelBox />`) para "esto es lo que importa ahora";
  - glifos de 16×16 (`GLYPHS`: eye, bot, server, fork, repo, check, file).
- **Si falta un glifo, se agrega a `GLYPHS`** con el mismo trazo de 1.5. Nada de librerías de íconos.

**Grosores** (clases en `figures.css`)

| Uso | Clase | Grosor |
|---|---|---|
| Contorno principal | `.s-ink` | 2.25 |
| Detalle | `.s-ink-thin`, `.s-glyph` | 1.5 |
| Cadena o regla fuerte | `.s-chain` / `.s-ruler` | 3.5 / 2.5 |
| Guías y selección | `.s-guide`, `.s-sel` | 1.25 punteado |

**Color: tinta y nada más**
- Todo en `--color-ink`, `--color-ink-2` y `--color-ink-3`.
- **Rojo (`--color-key`) solo para lo expuesto o peligroso**: la key, el permiso 777, la copia que todavía sirve.
- **Verde (`--color-safe`) solo para lo que quedó seguro.**
- **Azul (`--color-accent`) solo para el foco del teclado.**
- Sin degradés, sombras, 3D, emojis ni colores nuevos. Todo color sale de un token, así el modo oscuro funciona solo.

**Texto dentro del dibujo**
- Etiquetas en sans de 12 px (`.s-lab`, gris).
- Hashes, archivos, comandos y marcas de tiempo en mono (`.s-hash`, `.s-file`, `.s-cmd`, `.s-tick`).
- Serif solo para un número grande que es el protagonista (el octal de chmod, `.s-oct`).
- Pocas palabras. Lo que necesita una frase va abajo, en el texto del paso.

## Animación

- **Se mueve porque el lector hizo algo.** Sin loops automáticos, sin animaciones al hacer scroll, sin nada que arranque solo.
- **El estado inicial es el interesante** y se entiende sin tocar nada. En git-history arranca en HEAD con el .env ya borrado.
- **Transiciones CSS sobre estilos inline:**
  - movimiento: `transform 0.8s var(--fig-ease)`;
  - aparición: `opacity 0.5s`;
  - respuesta rápida: `.quick`, 0.28s con `--fig-ease-out`.
- **Varias piezas que entran se escalonan 110 ms.**
- **Contadores:** `useTweenNumber` (700 ms, ease in-out). Si algo va cuadro a cuadro, `requestAnimationFrame` y `noTransition()`.
- **Trazos que se dibujan:** `strokeDasharray` + `strokeDashoffset` (el `.s-chain` de git-history). Para curvas, `cubic()` da el largo y el punto por distancia, sin `getTotalLength`.
- **Un cambio de estado que no se debe animar lleva `.snap`.**
- **Con `prefers-reduced-motion` todo es instantáneo** (`prefersReducedMotion()`) y la figura se entiende igual.
- **Moderación:** una sola cosa se mueve a la vez, o un grupo con el mismo gesto. Si hay que mirar dos lugares al mismo tiempo, la figura está mal pensada.

## Controles

- **Un solo control por figura**, centrado debajo del dibujo:
  - `Stepper` (flechas + puntos, hasta 6 pasos) para una secuencia;
  - `seg` (segmented) para comparar dos o tres órdenes o modos;
  - `presets` (botones mono) para valores típicos (640, 755, 777);
  - `scrub` (range) para una línea de tiempo continua.
- **Abajo del control, una oración que explica el paso actual** (`st-label` / `fig-result`). Ahí se puede usar una marca (`rich()`): `**negrita**` o el rojo de `fig-bad`.
- **Teclado:** ← → en steppers y segmented, Espacio/Enter en celdas. El resultado se anuncia con una región `aria-live`; en los contadores, solo el valor final.
- **Nunca un panel con varios controles**, ni sliders y toggles juntos. Nada que parezca un widget.

## Gráficos y líneas de tiempo

- **Misma tinta:** el eje es una regla dibujada (`.s-ruler`) con marcas (`.s-ticks`) y números mono (`.s-tick`), sin caja ni fondo aparte.
- **Escala honesta:** una sola escala ubica marcas, etiquetas y datos, y cada etiqueta nombra un valor que el gráfico alcanza.
- **Si los tiempos o valores son de ejemplo, el pie lo dice** ("Tiempos ilustrativos.").
- **Formas:** franjas rayadas (`.s-hatch` + `.s-bandedge`) para una ventana de exposición; líneas punteadas para señales o "lanes".
- **Nada de tortas, barras 3D, leyendas de colores ni grillas densas.** Si hace falta una leyenda, conviene rotular directo sobre el dibujo.

## Geometría y responsive

- **Cada escena se diseña dos veces:** ancha (~720 × alto, `wide: true` en el registro) y angosta (~380 de ancho, en vertical).
- **Las dos se renderizan en el servidor** (`svg.geo-w` / `svg.geo-n`) y un container query muestra una debajo de 600 px de ancho de figura. **Sin medir en JS**, así no hay salto al hidratar.
- **`frame(W, H, M)` da el viewBox con margen:** las etiquetas de los bordes tienen que entrar.
- **Coordenadas en unidades del viewBox** y `tr(x, y)` para mover grupos.

## Textos

- **Todo texto de una figura va en `messages.ts` → `copy.figures.<figura>`**, nunca suelto en el componente, y sigue [voz.md](./voz.md).
- **`label` (registry.ts) describe la conclusión** para lector de pantalla, no la forma: "Rotar primero la invalida en todas", no "Un diagrama con líneas".
- **El pie (`caption`) dice qué es de ejemplo** y qué representa cada pieza.

## Agregar una figura

1. **Boceto en papel o en una maqueta HTML** en `~/Documents/VT-Blog-Design/`, con los dos anchos y cada estado. Si el cambio es visual, Valen lo aprueba antes de programar.
2. **Componente client** en `src/tenants/vt/figures/<Nombre>.tsx`, con la estructura de `GitHistory.tsx`: `Geo` ancha y angosta, `Scene` pura, estado en la figura y `FigureFrame` + `Marks` + control.
3. **Registro:**
   - nombre y `label`/`caption` en `registry.ts`;
   - el componente en `components/FigureSlot.tsx`;
   - los textos en `messages.ts`.
4. **Test en `tests/unit/vt-figures.test.ts`** si hay lógica (orden de pasos, cálculos).
5. **Capturas** a 1280 y 390 px, claro y oscuro, en el estado inicial y en cada paso. Además, una pasada con reduced motion y sin errores de CSP en consola.
6. **En el artículo:** `::figure{name="<nombre>" caption="…"}`.

## Ilustraciones que no se mueven (pingüino y afines)

- **Sin fotos de Valen.** El personaje es el pingüino (`assets/penguins/`, `<Penguin variant={1|2|3} />`).
- **Ilustraciones nuevas:** dibujo de tinta negra sobre blanco, línea a mano con algo de rayado, sin color ni sombras ni fondo. Se vectorizan con potrace (`potrace -s --tight -k 0.55 -t 12 -O 0.4 --flat`) y el negro pasa a `fill="currentColor"`, para que sigan el tema.
- **Prompt base para generar una:** "Simple hand-drawn ink illustration of <tema>, black ink line art on a plain white background, slightly rough pen strokes with light cross-hatching for shading, minimal detail, no color, no gradients, no text, no background scenery, centered, calm and friendly, in the style of a technical notebook sketch."
