import { config } from "./config";

/**
 * Tema de VT: por defecto sigue al sistema (prefers-color-scheme). Si la
 * lectora eligió uno con el botón, se guarda en `vt:theme` y se aplica como
 * `data-theme` en <html> antes de pintar.
 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(`${config.storagePrefix}:theme`)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
