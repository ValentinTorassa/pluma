import type { HomeHeroProps } from "../../types";
import { Avatar } from "../Avatar";
import { copy } from "../messages";

/** Intro corta del home: avatar, nombre y el texto en serif */
export function HomeHero({ site }: HomeHeroProps) {
  return (
    <div className="intro">
      <div className="intro-who">
        <Avatar />
        <p>
          <b>{site.authorName}</b>
          {site.authorRole}
        </p>
      </div>
      <p className="intro-text">{copy.home.intro}</p>
    </div>
  );
}
