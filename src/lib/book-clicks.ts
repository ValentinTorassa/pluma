import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { bookClicks } from "@/db/schema";
import type { BookEvent, BookRef } from "./book-event";

/** Counts clicks, not unique people, completed downloads, readings or sign-ups. */
export async function recordBookClick(day: string, event: BookEvent, ref: BookRef): Promise<boolean> {
  try {
    await db.insert(bookClicks).values({ day, event, ref, count: 1 }).onConflictDoUpdate({
      target: [bookClicks.day, bookClicks.event, bookClicks.ref],
      set: { count: sql`${bookClicks.count} + 1` },
    });
    return true;
  } catch {
    // A missing migration or database outage must not prevent opening the PDF or form.
    console.error("[pluma] no se pudo contar el clic del libro, sigue de largo");
    return false;
  }
}
