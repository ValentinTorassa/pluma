import Link from "next/link";
import { redirect } from "next/navigation";
import { config } from "@tenant/config";
import { Logo } from "@tenant/Logo";
import { messages } from "@tenant/messages";
import { publishing } from "@tenant/publishing";
import { isAuthenticated } from "@/lib/auth";
import { getPendingCommentCount } from "@/lib/data";
import { logout } from "../actions";

const a = messages.admin;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  const pending = await getPendingCommentCount();

  const articlesLink = (
    <Link href="/admin" className="text-muted transition-colors hover:text-ink">
      {a.nav.articles}
    </Link>
  );
  const commentsLink = (
    <Link
      href="/admin/comentarios"
      className="text-muted transition-colors hover:text-ink"
    >
      {a.nav.comments}
      {pending > 0 && (
        <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
          {pending}
        </span>
      )}
    </Link>
  );
  const settingsLink = (
    <Link
      href="/admin/configuracion"
      className="text-muted transition-colors hover:text-ink"
    >
      {a.nav.settings}
    </Link>
  );
  // Series (feature `series` + `publishing`). Dos <nav> en vez de `{cond && …}`:
  // un `false` entre los hijos queda en el payload RSC y yanina tiene que salir idéntica.
  const seriesLink =
    config.features.series && publishing ? (
      <Link href="/admin/series" className="text-muted transition-colors hover:text-ink">
        {publishing.messages.nav.series}
      </Link>
    ) : null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="group flex items-center gap-2 font-serif text-xl font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-accent transition-transform duration-300 group-hover:-rotate-12">
                <Logo className="h-4.5 w-4.5" />
              </span>
              {`${a.brand} `}<span className="text-sm font-normal text-muted">{a.brandSuffix}</span>
            </Link>
            {seriesLink ? (
              <nav className="flex items-center gap-4 text-sm">
                {articlesLink}
                {seriesLink}
                {commentsLink}
                {settingsLink}
              </nav>
            ) : (
              <nav className="flex items-center gap-4 text-sm">
                {articlesLink}
                {commentsLink}
                {settingsLink}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {a.nav.viewSite}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-muted transition-colors hover:text-red-700"
              >
                {a.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
