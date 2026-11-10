import Link from "next/link";
import { bookCopy } from "../lib/book-sale";
import { copy } from "../messages";
import { BookCover } from "./BookCover";

const m = copy.book;

/**
 * Aviso del libro al final de cada artículo: la tapa chica y una línea que
 * lleva a /libro. Sin formulario a propósito: el de Apuntes ya cierra la
 * página, y dos formularios seguidos compiten entre sí.
 */
export function BookCard() {
  const { card } = bookCopy();
  return (
    <aside className="bookcard" aria-label={m.card.label}>
      <Link href="/libro">
        <BookCover className="bookcard-cover" sizes="44px" alt="" />
        <span>
          {card.before}
          <cite>{m.title}</cite>
          {m.card.after}
          <span className="bookcard-cta">
            {card.cta}
            <span aria-hidden="true">{" →"}</span>
          </span>
        </span>
      </Link>
    </aside>
  );
}
