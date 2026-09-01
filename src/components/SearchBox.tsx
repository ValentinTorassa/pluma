export function SearchBox({
  defaultValue = "",
  large = false,
}: {
  defaultValue?: string;
  large?: boolean;
}) {
  return (
    <form action="/buscar" className={large ? "w-full" : "shrink-0"}>
      <label htmlFor={large ? "q-page" : "q-nav"} className="sr-only">
        Buscar artículos
      </label>
      <input
        id={large ? "q-page" : "q-nav"}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Buscar…"
        className={
          large
            ? "w-full rounded-full border border-line bg-white px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
            : "w-24 rounded-full border border-line bg-white px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent sm:w-32"
        }
      />
    </form>
  );
}
