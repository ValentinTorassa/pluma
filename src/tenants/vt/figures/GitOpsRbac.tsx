import { copy } from "../messages";
import { FigureFrame, Marks, type FigureProps } from "./parts";

const m = copy.figures.gitopsRbac;

/** El mismo manifest probado con las dos service accounts del laboratorio. */
export function GitOpsRbac({ name, wide, caption }: FigureProps) {
  return (
    <FigureFrame name={name} wide={wide}>
      <div className="fig-canvas">
        <div className="gt-panel gt-rbac">
          <header className="gt-panel-head">
            <div><span className="gt-eyebrow">{m.kicker}</span><h3>{m.title}</h3></div>
            <span className="gt-panel-index">{m.index}</span>
          </header>
          <div className="gt-rbac-manifest">
            <span className="gt-rbac-file">{m.filename}</span>
            <strong>{m.manifestTitle}</strong>
            <div><span>{m.targetAccount}</span><span>{m.targetBinding}</span></div>
          </div>
          <div className="gt-rbac-routes">
            {m.routes.map((route) => (
              <div key={route.name} className="gt-rbac-route" data-kind={route.kind}>
                <div className="gt-rbac-route-head"><span>{route.kicker}</span><strong>{route.name}</strong></div>
                <div className="gt-rbac-scope">
                  <span>{route.scopeLabel}</span>
                  <strong>{route.scope}</strong>
                </div>
                <div className="gt-rbac-verdict"><span>{route.code}</span><strong>{route.result}</strong><p>{route.detail}</p></div>
              </div>
            ))}
          </div>
        </div>
        <Marks />
      </div>
      {caption && <div className="fig-foot"><figcaption>{caption}</figcaption></div>}
    </FigureFrame>
  );
}
