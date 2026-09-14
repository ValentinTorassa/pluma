import { Penguin } from "./Penguin";

/**
 * Avatar de VT Security: el pingüino de frente (variante 2) dentro del círculo,
 * en currentColor, en lugar de una foto. Se usa en la intro del home, la línea
 * de autor y el recuadro del final del artículo. El dibujo es más alto que
 * ancho: ocupa ~70% de la altura del círculo, centrado (ver .vt-avatar en site.css).
 */
export function Avatar({ className = "", title }: { className?: string; title?: string }) {
  return (
    <span
      className={`vt-avatar ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <Penguin variant={2} />
    </span>
  );
}
