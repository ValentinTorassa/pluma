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
} as const satisfies Record<string, FigureDefinition>;

export type FigureName = keyof typeof DEFINITIONS;

export const FIGURES: Record<FigureName, FigureDefinition> = DEFINITIONS;

export const FIGURE_NAMES = Object.keys(FIGURES) as FigureName[];

export function isFigureName(name: string): name is FigureName {
  return Object.hasOwn(FIGURES, name);
}
