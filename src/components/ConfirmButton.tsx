"use client";

import { useState } from "react";
import { messages } from "@tenant/messages";

/** Botón que pide confirmación antes de ejecutar el submit del form padre */
export function ConfirmButton({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <button type="submit" className={className}>
          {confirmText}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-muted hover:text-ink"
        >
          {messages.admin.confirmCancel}
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setArmed(true)} className={className}>
      {children}
    </button>
  );
}
