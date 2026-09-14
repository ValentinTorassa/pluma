import type { LogoProps } from "../types";
import { Avatar } from "./Avatar";

/** Marca chica (admin): el mismo pingüino del avatar. */
export function Logo({ className = "" }: LogoProps) {
  return <Avatar className={className} />;
}
