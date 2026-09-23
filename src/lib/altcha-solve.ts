/**
 * Resuelve en el navegador el challenge de `altcha.ts` con Web Crypto. Seguro
 * para client components: no importa nada del servidor. Cada `digest` es
 * asíncrono, así que el hilo principal no se congela mientras busca.
 */
export type ChallengeToSolve = {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Payload en base64 listo para mandar como `altcha`, o null si no hay solución */
export async function solveChallenge(c: ChallengeToSolve): Promise<string | null> {
  for (let n = 0; n <= c.maxnumber; n++) {
    if ((await sha256Hex(c.salt + n)) === c.challenge) {
      const payload = { algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature };
      return btoa(JSON.stringify(payload));
    }
  }
  return null;
}
