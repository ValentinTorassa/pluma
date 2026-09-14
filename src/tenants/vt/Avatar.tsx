/**
 * Avatar de VT Security: el pingüino de VT Security Labs, monocromo
 * (currentColor), en lugar de una foto. Se usa en la intro del home, la línea
 * de autor y el recuadro del final del artículo.
 *
 * TODO(v3.1): reemplazar el dibujo por la versión a mano de la maqueta v3.1.
 * Mantener la firma (className, title) para que el cambio sea solo el SVG.
 */
export function Avatar({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={`vt-avatar ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* cuerpo */}
      <path d="M128 44C170 44 198 80 198 130c0 26-6 46-16 62-10 14-30 22-54 22s-44-8-54-22c-10-16-16-36-16-62 0-50 28-86 70-86z" />
      {/* cara */}
      <path d="M128 88c-7-13-20-19-32-17-18 3-26 21-24 39 2 22 24 40 56 40s54-18 56-40c2-18-6-36-24-39-12-2-25 4-32 17z" />
      {/* ojos */}
      <circle cx="110" cy="106" r="6" fill="currentColor" stroke="none" />
      <circle cx="146" cy="106" r="6" fill="currentColor" stroke="none" />
      {/* pico */}
      <path d="M120 118h16l-8 12z" fill="currentColor" strokeWidth="4" />
      {/* patas */}
      <path d="M96 214c-10 2-16 8-14 12M160 214c10 2 16 8 14 12" />
    </svg>
  );
}
