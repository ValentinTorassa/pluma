import jpg540 from "../assets/libro/cover-540.jpg";
import webp360 from "../assets/libro/cover-360.webp";
import webp540 from "../assets/libro/cover-540.webp";
import webp720 from "../assets/libro/cover-720.webp";

const srcSet = (files: { src: string; width: number }[]) => files.map((f) => `${f.src} ${f.width}w`).join(", ");

/**
 * Tapa del libro (la misma que exporta valentorassa.com/libro): WebP en tres
 * anchos y JPG de 540 para lo que no entienda WebP. `sizes` dice qué ancho
 * ocupa en pantalla, así la miniatura del artículo no baja la de 720. Sin AVIF:
 * Turbopack no lo procesa como imagen estática y el build avisa por cada una.
 */
export function BookCover({
  className,
  sizes,
  alt,
  priority = false,
}: {
  className?: string;
  sizes: string;
  alt: string;
  /** La tapa de /libro está arriba de todo: sin lazy */
  priority?: boolean;
}) {
  return (
    <picture className={className}>
      <source type="image/webp" srcSet={srcSet([webp360, webp540, webp720])} sizes={sizes} />
      <img
        src={jpg540.src}
        width={jpg540.width}
        height={jpg540.height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}
