"use client";

import { useEffect, useRef, useState } from "react";
import { copy } from "../messages";

const m = copy.article;

/** Copia el texto del <pre> del mismo `.codeblock` */
export function CopyButton() {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick(event: React.MouseEvent<HTMLButtonElement>) {
    const pre = event.currentTarget.closest(".codeblock")?.querySelector("pre");
    try {
      await navigator.clipboard.writeText(pre?.innerText ?? "");
      setState("ok");
    } catch {
      setState("fail");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  }

  return (
    <button type="button" className="copy" onClick={onClick} aria-live="polite">
      {state === "ok" ? m.copied : state === "fail" ? m.copyFailed : m.copy}
    </button>
  );
}
