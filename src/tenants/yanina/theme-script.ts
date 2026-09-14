import { config } from "./config";

/**
 * Tema noche guardado por la lectora (clase `dark` en <html>).
 * REGLA: string idéntico al que servía app/layout.tsx en producción.
 */
export const themeInitScript = `try{if(localStorage.getItem(${JSON.stringify(`${config.storagePrefix}:theme`)})==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
