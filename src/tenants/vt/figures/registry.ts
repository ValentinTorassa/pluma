/**
 * Figuras que el contenido puede usar con `::figure{name="…"}`. Es la allowlist
 * del pipeline: un nombre que no está acá no se renderiza. Cada nombre tiene
 * su componente (client) en components/FigureSlot.tsx.
 */
export type FigureDefinition = {
  /** Descripción accesible (aria-label del dibujo) */
  label: string;
  /** Ocupa la columna ancha del artículo */
  wide: boolean;
  /** Pie por defecto (el de la maqueta) si la directiva no trae `caption` */
  caption?: string;
  /** aria-label de la versión chica del home, si la figura la tiene */
  mini?: string;
};

const DEFINITIONS = {
  "gitops-signal": {
    label: "El mismo manifest inseguro ante dos configuraciones del namespace: sin restricted corren los Pods privilegiados; con restricted se crea el Deployment pero Pod Security rechaza los Pods.",
    wide: true,
    mini: "De Git al cluster: el manifest inseguro se sincroniza y deja Pods privilegiados con la raíz del nodo montada.",
    caption: "Laboratorio local con kind y kubectl apply; no configuré checks obligatorios para el merge.",
  },
  "gitops-gates": {
    label: "Cinco estaciones muestran la evidencia del laboratorio: firma, política, RBAC, admisión y resultado en los pods. Se puede seleccionar cada una para leer su salida.",
    wide: true,
    caption: "Resultados del lab local: la firma falló, Kyverno detectó dos violaciones y Pod Security rechazó los Pods.",
  },
  "gitops-rbac": {
    label: "El mismo manifest intenta crear un nuevo administrador del cluster. Una cuenta con cluster-admin lo logra; una cuenta con Role limitado a prod recibe Forbidden.",
    wide: true,
    caption: "La cuenta amplia aplicó el manifest. La acotada recibió Forbidden en un dry-run.",
  },
  "gitops-drift": {
    label: "Git dice dos réplicas e imagen fijada. Un cambio manual deja cinco réplicas e imagen latest; kubectl diff lo muestra y un sync explícito restaura Git. Abajo, un rollback se representa como git revert y nuevo sync.",
    wide: true,
    caption: "El script volvió a sincronizar de forma explícita. No simulé self-heal automático.",
  },
  "evidence-stack": {
    label: "Tres documentos en perspectiva: un laboratorio, una contribución y un informe. Cada uno muestra una tarea y también su límite.",
    wide: true,
    mini: "Tres hojas en perspectiva: lab, contribución e informe. Cada una deja una evidencia distinta del trabajo.",
    caption: "Elegí una hoja. La evidencia vale por lo que deja comprobar y por el límite que aclara.",
  },
  "role-proof": {
    label: "Tres ejemplos de roles: SOC, AppSec y Cloud. Para cada uno cambia la tarea, la evidencia útil y el límite de lo probado.",
    wide: true,
    caption: "Ejemplos de un entorno de práctica; no son requisitos universales de contratación.",
  },
  "git-history": {
    label: "Cuatro commits de un repo: el .env entra en el segundo y sale del último, que es HEAD. Un clone se lleva todos.",
    wide: true,
    caption: "Repo de ejemplo. Cada hoja es la foto que guarda un commit.",
    mini: "Tres commits. El .env está en los dos primeros y sale del último, que es HEAD.",
  },
  "scanner-race": {
    label: "Línea de tiempo de 30 minutos desde el push: los scanners leen la key en los primeros 6 minutos y la usan cuatro veces antes de que te des cuenta. El tramo rojo es cuánto estuvo expuesta.",
    wide: true,
    mini: "Línea de tiempo del push: los scanners leen la key a los 4 minutos y la usan cuatro veces antes de que te des cuenta.",
    caption: "Tiempos ilustrativos. Varían según el tipo de secreto.",
  },
  "rotate-vs-clean": {
    label: "La key en el proveedor conectada con tres copias: tu repo, un fork y el clone de un bot. Rotar primero la invalida en todas.",
    wide: true,
    mini: "La key del proveedor y las tres copias que la tienen: rotarla la invalida en todas a la vez.",
    caption: "Los minutos son un ejemplo: reescribir, forzar el push y avisarle al equipo lleva su rato.",
  },
  chmod: {
    label: "Permisos de config.env: dueño, grupo y otros, cada uno con leer, escribir y ejecutar, y su valor octal.",
    wide: false,
    mini: "Los nueve permisos de un archivo: 777 los abre todos y 640 deja sólo al dueño y al grupo.",
  },
  "bind-scope": {
    label: "Un servidor escuchando en el puerto 3000. En 0.0.0.0 otra máquina de la red se baja el .env; en 127.0.0.1 solo llega el navegador de la misma máquina. El router corta lo que viene de internet.",
    wide: true,
    caption: "Red de ejemplo. El router corta lo que entra de internet mientras nadie le abra el puerto.",
    mini: "Un puerto en 0.0.0.0 le contesta a otra máquina de la red; en 127.0.0.1, a nadie más.",
  },
  "term-vs-kill": {
    label: "Un programa atiende pedidos y cada tanto guarda en el disco. Con kill termina lo que tenía, guarda y borra su lock; con kill -9 el kernel lo saca: se cortan los pedidos a medio atender, se pierde lo que tenía en memoria y el lock queda.",
    wide: true,
    caption: "Programa y tiempos de ejemplo. No todos dejan un lock, pero cualquiera pierde lo que no alcanzó a escribir.",
  },
  respawn: {
    label: "Un cliente manda pedidos a un servicio que vigila systemd. Si matás el proceso, rebotan hasta que systemd lo levanta con otro PID; con systemctl stop rebotan todos.",
    wide: true,
    caption: "Los dos primeros PID son los de la prueba real; los que siguen, de ejemplo.",
  },
  "webhook-retry": {
    label: "Un proveedor manda el pago aprobado de la orden 1041 a tu receptor, que acredita $ 25.000 y contesta 200. El 200 no llega a tiempo y el proveedor reintenta el mismo evento. El receptor ingenuo acredita otra vez y la orden queda con $ 50.000; el que anota el id del evento antes de aplicar lo descarta como duplicado.",
    wide: true,
    mini: "El mismo evento llega dos veces: con el id anotado antes de acreditar, la orden 1041 queda con $ 25.000 y no con $ 50.000.",
    caption: "Tiempo comprimido: en el laboratorio el reintento llegó a los 30 segundos.",
  },
  "webhook-recon": {
    label: "Las cinco órdenes del laboratorio conciliadas contra el proveedor. Con el receptor ingenuo las cinco quedan mal y sobran $ 115.500; con el que busca y después anota, probado con los dos reintentos, queda una diferencia de $ 18.500; con el endurecido, ninguna.",
    wide: true,
    caption: "Montos y estados de la conciliación del laboratorio.",
  },
  "webhook-race": {
    label: "Dos workers reciben a la vez la misma entrega de evt_0002. Si cada uno busca el id y lo anota al final, los dos leen «no visto», los dos acreditan y la orden 1042 queda con $ 37.000. Si anotan el id primero dentro de la transacción, B espera el lock, su INSERT choca y la orden queda con $ 18.500.",
    wide: true,
    caption: "Los pasos y los montos son los del laboratorio; el ancho de cada paso es ilustrativo.",
  },
  "webhook-order": {
    label: "La orden 1045 recibe el reembolso antes que la aprobación. Si gana el último evento, pasa de created a refunded y después a paid, con $ 0 acreditados. Con las transiciones escritas, el reembolso va a dead-letter con un 409, la aprobación la pasa a paid y el reintento del proveedor la deja refunded.",
    wide: true,
    caption: "Los eventos, los códigos y los tiempos son los del laboratorio.",
  },
  "allowlist-egress": {
    label: "Una aduana que solo lee etiquetas. Un agente manda tres paquetes a docs.python.org: curl -d @.env, WebFetch con la key en el query y WebFetch con la key en base64. En 0.3.0 la allowlist lee la herramienta y el destino de cada etiqueta, las tres están en regla y llegan: docs.python.org recibe el .env y la key. En 0.4.0 un escáner mira adentro antes que cualquier otra regla: secret-egress rechaza las dos que llevan la key y sh-paths rechaza la de @.env. No llega nada.",
    wide: true,
    mini: "Un paquete con la key pasa la aduana de la allowlist porque su etiqueta está en regla; en 0.4.0 el escáner la encuentra adentro y lo rechaza.",
    caption: "Proyecto sintético con una key falsa: cada paquete es una request y su etiqueta, la herramienta y el destino. Las decisiones son las que dio el hook de cada versión.",
  },
  "self-disable": {
    label: "En la sesión N el agente crea .claude/settings.local.json con disableAllHooks. En 0.3.0 el firewall no protege ese archivo y lo deja pasar: en la sesión N+1 el host lo lee, el firewall no se carga y el agente lee el .env sin que nadie pregunte. En 0.4.0 el hook protege ese archivo aunque no exista: rechaza la escritura con fs-protected, sigue cargado en la sesión siguiente y rechaza Read .env con fs-protected.",
    wide: true,
    caption: "Raíz del proyecto con permiso de escritura, como en las pruebas del artículo.",
  },
  "egress-tripwire": {
    label: "La key del .env sale en una request de distintas formas. secret-egress la reconoce tal cual, con percent-encoding, en base64 y en hex; partida en dos, al revés o cifrada no la reconoce y la request pasa.",
    wide: true,
    caption: "Key de ejemplo. La búsqueda es la de 0.4.0; el cifrado es un XOR con una clave fija.",
  },
  "jwt-firma": {
    label: "Un JWT de ejemplo en sus tres partes, header, payload y firma, con el payload decodificado: sub user-123, name Ana, role user, iat y exp. Cualquiera que tenga el token puede leerlo. Si se cambia role por admin, el payload cambia y la firma sigue igual. El servidor recalcula la firma con su clave secreta y la compara con la del token: con el payload original coinciden y lo acepta; con el payload cambiado no coinciden y lo rechaza.",
    wide: true,
    caption: "Las firmas son reales: HMAC-SHA256 con una clave de ejemplo de 256 bits.",
  },
  "jwt-checks": {
    label: "Seis tokens pasan de a uno por los controles de la verificación: algorithms, firma, exp e issuer / audience. El token correcto llega al handler. A cada uno de los otros lo frena un control, con el código de error que devolvió jose en la demo: el de alg none lo frena algorithms; el de rol cambiado, la firma; el vencido y el que no trae exp, el control de exp; el emitido para otra app, issuer / audience. Cada control se puede apagar, y entonces el token que frenaba llega al handler marcado como intrusión.",
    wide: true,
    caption: "Los códigos son los que devolvió jose 6.1.0 en la demo. Con un control apagado, la figura muestra una verificación que no hace ese chequeo.",
  },
  "request-capas": {
    label: "El recorrido de una request leído de afuera hacia adentro: tu terminal, DNS, TLS, proxy (Nginx) y app (contenedor). Se elige una corrida del lab y la request avanza hasta la capa donde muere; abajo, lo que ve curl y qué log tiene una línea nueva. Sano: llega a la app y vuelve con 200, y el access.log del proxy y el log de la app tienen la misma request. DNS: el nombre apunta a 203.0.113.50, el servidor viejo, y curl corta por timeout. TLS: el servidor presenta el certificado de www.demo.test y curl corta con el error 60. En esas dos, ni Nginx ni la app tienen líneas nuevas. Proxy: Nginx manda la request al puerto 8000 y la app escucha en el 3000. App en 127.0.0.1: la app escucha solo en el localhost de su contenedor. En las dos últimas, curl recibe un 502 que escribió Nginx: el access.log y el error.log del proxy tienen la request, con Connection refused, y el log de la app no.",
    wide: true,
    caption: "Salidas del lab local (Docker, CoreDNS, Nginx y una app en Python). Los id y las IP internas cambian en cada corrida.",
  },
  "request-502": {
    label: "Los dos 502 del lab lado a lado: el proxy que apunta al puerto 8000 y la app que escucha en 127.0.0.1. Para el cliente son iguales: HTTP/1.1 502 Bad Gateway, Server: nginx y el mismo Connection refused en el error.log de Nginx. Paso a paso aparece lo que cambia: el upstream del error.log dice :8000 en uno y :3000 en el otro; el proxy_pass apunta a app:8000 o a app:3000; la app escucha en 0.0.0.0:3000 o solo en 127.0.0.1:3000; y probada desde el proxy en app:3000, la primera contesta y la segunda da Connection refused. En el dibujo, dos contenedores en la red de Docker: en el primer caso Nginx llega al puerto 8000 de la app, donde no escucha nada; en el segundo llega al 3000 de su interfaz 172.18.0.2, pero la app solo escucha en el 127.0.0.1 de adentro de su contenedor.",
    wide: true,
    caption: "Mismo síntoma, dos arreglos: uno en la config de Nginx, el otro en la app.",
  },
  "ufw-cadenas": {
    label: "Ilustración, según la documentación de Docker, del camino de un paquete que llega de otra máquina (203.0.113.7) al puerto 5432 del host. Primero pasa por PREROUTING, en la tabla nat; después, la decisión de ruteo lo manda a INPUT si el destino es el host, o a FORWARD si es otra IP. En INPUT están las reglas de ufw: deny 5432/tcp y default deny incoming. FORWARD salta a las cadenas DOCKER-USER, DOCKER-FORWARD y DOCKER, y de ahí al contenedor db, en 172.17.0.2:5432. Con ports: 5432:5432, la regla de Docker en la tabla nat le cambia el destino a la IP del contenedor: el paquete va por FORWARD, DOCKER lo acepta y llega a la base, y ufw nunca lo ve. Con ports: 127.0.0.1:5432:5432, la documentación dice que solo el host llega al puerto: en el dibujo, el paquete no se desvía, sigue hacia el host y ufw lo descarta en INPUT. Sin ports no hay regla de Docker para el 5432: el paquete va a INPUT y ufw lo descarta.",
    wide: true,
    caption: "Ilustración según la documentación de Docker. No es una captura de un servidor.",
  },
  "ufw-arreglos": {
    label: "Quién llega a la base según cómo se la declara, de acuerdo con la documentación de Docker. Cuatro orígenes: tu app, en la misma red de Docker, por db:5432; un proceso del host, como psql o un backup, por localhost:5432; otra máquina de tu red e internet, por la IP del host. Con 5432:5432 sin nada más llegan los cuatro, y ufw no frena a los de afuera. Sin ports solo llega tu app: el 5432 no está publicado en el host, aunque según la documentación el host sí llega a la IP del contenedor. Con 127.0.0.1:5432:5432 llegan tu app y el host, y de afuera nadie; antes de Docker 28.0.0, una máquina del mismo segmento de red sí podía. Con 5432:5432 y la regla iptables -I DOCKER-USER -i ext_if ! -s 192.0.2.2 -j DROP llegan tu app y el host, y de afuera solo 192.0.2.2. Debajo, la línea del compose de cada opción y, en la última, la regla.",
    wide: true,
    caption: "Según la documentación de Docker. La regla de DOCKER-USER es el ejemplo de la doc; adaptá la interfaz.",
  },
  "blackice-modos": {
    label: "Cuatro conexiones de la corrida del 6 de noviembre pasan de a una por blackice: Claude Code a api.anthropic.com, Claude Code a su telemetría en Datadog, la misma conexión 105 segundos después y nscurl a www.wikipedia.org. En accept-all pasan las cuatro y quedan en el log. En block-all pasa solo la de api.anthropic.com, que cubre una regla. En ask también pasa esa; las otras esperan a Claude Code como agente, que niega la telemetría en 3.780 ms y Wikipedia en 3.460 ms, y la segunda conexión a Datadog se cae sin preguntar porque blackice recuerda la negativa. Después de aprobar Wikipedia con Touch ID, el nscurl siguiente pasa sin evento nuevo.",
    wide: true,
    caption: "Las conexiones, los tiempos y las respuestas son los de la corrida P5-10, con blackice 0.4.5. La espera del agente se ve al doble de velocidad.",
  },
  "blackice-dia": {
    label: "Las respuestas de Claude Code como agente de blackice entre el jueves 5 de noviembre a las 9:40 y el viernes 6 a las 9:40, hora argentina, un punto por respuesta, apiladas por hora: 242 aprobadas y 107 negadas. Antes de las 15 no hay respuestas; la hora con más es la de 21 a 22 del jueves, con 41. Por tipo, las negativas son 41 de telemetría, 33 de ellas de Claude Code a Datadog, 21 de servicios de Apple, 18 de otros agentes y apps de IA, 15 de curl y 12 otras.",
    wide: true,
    caption: "Cada punto es una respuesta de Claude Code en el log de mi Mac, en hora argentina. El log tiene 107 de las 108 negativas; las 26 respuestas de fx de ese día no están.",
  },
  "oauth-cinco": {
    label: "La cadena de una llamada de agente: una persona consiente una vez, el agente decide cada llamada, un control con la política y el broker de credenciales, y la API de mail y calendario. Cinco marcas señalan dónde se rompe OAuth: el scope que queda abierto, el refresh token que no muere, autenticar sin autorizar, el delegado confundido y el control que se calla. Para cada una, sin el control el pedido del agente llega a la API; con el control lo frena el broker, la política o la API, y abajo se ve la salida de los tests del laboratorio.",
    wide: true,
    caption: "Las salidas son las de los tests de VT-Agent-Firewall. En la falla 5, sin el control, se ve el error de antes del arreglo.",
  },
} as const satisfies Record<string, FigureDefinition>;

export type FigureName = keyof typeof DEFINITIONS;

export const FIGURES: Record<FigureName, FigureDefinition> = DEFINITIONS;

export const FIGURE_NAMES = Object.keys(FIGURES) as FigureName[];

export function isFigureName(name: string): name is FigureName {
  return Object.hasOwn(FIGURES, name);
}
