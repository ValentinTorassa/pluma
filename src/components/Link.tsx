import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * `next/link` sin prefetch, para el sitio público.
 *
 * Las páginas son dinámicas (la CSP lleva nonce), así que cada prefetch de Next
 * es un render entero en una función. Con el prefetch por defecto, abrir la
 * home disparaba en el mismo segundo los `.rsc` de cada link visible del menú y
 * de las tarjetas: 84 renders contra 63 páginas abiertas en 9,5 h (13/11/2026),
 * y eso cuenta contra el tope de CPU de Vercel Hobby. Sin prefetch, el render
 * sale cuando alguien hace clic. Se puede volver a pedir con `prefetch` a mano.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
