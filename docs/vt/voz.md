# Voz de VT Security

Reglas para escribir en blog.valentorassa.com y en Apuntes (el newsletter). Valen o un agente, da igual: el texto tiene que sonar a Valen explicándole algo a alguien que está aprendiendo, no a un texto generado.

El blog es **lo que Valen va aprendiendo de ciberseguridad y siente que vale la pena compartir con la comunidad**. Eso define el tono: alguien que lo probó, que se equivocó y que lo cuenta. No es un experto dando cátedra ni una marca vendiendo.

## Cómo suena

- **Español rioplatense, con voseo**: "fijate", "probá", "te vas a dar cuenta". Nunca "tú" ni un español neutro de traducción.
- **Primera persona cuando hay una opinión o algo probado**: "para mí ese es el error más común", "lo probé en un repo de prueba".
- **Frases cortas.** Si una oración necesita dos comas y un punto y coma, son dos oraciones.
- **Primero el caso concreto, después la idea.** Arrancar con lo que pasa ("armás un proyecto chico, ponés la API key en un .env…"), no con una definición.
- **Datos reales:** comandos que funcionan, salidas copiadas de la terminal, versiones, prefijos de tokens, minutos. Si un número es ilustrativo, se dice.
- **Honestidad sobre los límites:** "no lo probé en Windows", "depende del proveedor", "no hay forma de probar que nadie la leyó".
- **Cerrar con el criterio o con lo que sigue** (la próxima parte de la serie), no con una moraleja.

## Lo que delata a un texto generado (no usar)

**Frases hechas y aforismos**
- Remates de párrafo con tono de frase para taza: "No podés defender lo que no entendés", "La seguridad es un proceso, no un producto".
- El molde "No es X, es Y" repetido. Una vez por artículo como mucho, y solo si aclara algo real.
- Preguntas retóricas para abrir ("¿Alguna vez te preguntaste…?").
- Anuncios de lo que viene: "En este artículo vamos a explorar…", "Sin más preámbulos", "Veamos".

**Vocabulario de relleno**
- "sumergirnos", "adentrarnos", "en el mundo de", "el panorama", "clave", "crucial", "fundamental", "potenciar", "robusto", "integral", "de manera eficiente", "cabe destacar", "es importante mencionar", "en definitiva", "sin lugar a dudas", "un antes y un después".
- Adjetivos que no dicen nada: "increíble", "poderoso", "fascinante".

**Estructura de plantilla**
- Todo en grupos de tres ("rápido, seguro y simple").
- Listas con viñetas donde iba un párrafo, y **negritas** en media oración.
- Títulos con fórmula: "X: la guía definitiva", "Todo lo que tenés que saber sobre…".
- Resumen final que repite lo que ya se dijo ("En resumen…", "Conclusión").
- Rayas (—) para dramatizar. En español casi no se usan; poné punto o dos puntos.
- Emojis, signos de exclamación en serie y llamados tipo "¡Vamos!".

**Sobre el blog**
- "Paso a paso", "desde cero", "explicado de forma simple" como promesa en textos de presentación. Que se note en el contenido, no en el eslogan.
- Frases de la tarjeta del blog como "lo que no entra en un video". El blog no se define contra los videos.

## Antes y después

> ✗ Hago videos de ciberseguridad y acá escribo lo que en un video no entra: el mecanismo, paso a paso, con figuras que podés mover. No podés defender lo que no entendés cómo funciona.
>
> ✓ Lo que voy aprendiendo de ciberseguridad y siento que vale la pena compartir con la comunidad.

> ✗ En este artículo vamos a sumergirnos en el fascinante mundo de los secretos expuestos en GitHub, un tema crucial para cualquier desarrollador.
>
> ✓ Pasa así: armás un proyecto chico, ponés la API key en un .env, te olvidás del .gitignore y hacés git push.

> ✗ En resumen, la seguridad no es un destino, es un camino.
>
> ✓ Si una key tocó un repo público, aunque sea un minuto, tratala como comprometida.

## Títulos y bajadas

- **El título es lo que alguien buscaría o preguntaría:** "Subiste el .env a GitHub: qué pasa en los primeros minutos", "Permisos: quién puede hacer qué, y por qué chmod 777 no es la respuesta".
- **La bajada dice qué te llevás, en una o dos frases**, sin repetir el título.
- Sin mayúsculas en cada palabra ("Qué Pasa En…").

## Apuntes (newsletter)

Mismas reglas. Cada bloque abre con el dato, no con un saludo largo. El saludo es una línea ("Hola, esta quincena…") y la despedida también. Nada de "¡Espero que te sirva!" en cada bloque.

## Checklist antes de publicar

1. Leelo en voz alta. Si una frase no la dirías hablando, cambiala.
2. Buscá las palabras de la lista de arriba (Ctrl+F) y sacalas.
3. Cada párrafo tiene algo concreto: un comando, un número, un caso o una decisión.
4. El último párrafo da un criterio o manda a lo que sigue; no resume.
5. Los comandos se probaron y las salidas son reales (o se dice que son de ejemplo).
6. Si hay figuras, siguen [figuras.md](./figuras.md).
