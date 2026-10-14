"use client";

import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

// Documentation interactive de l'API (Swagger UI) à partir de la spécification OpenAPI.
// Version autonome (swagger-ui-dist) : elle embarque son propre React et s'affiche dans ce bloc,
// hors du Strict Mode de l'app. swagger-ui-react, rendu dans notre arbre React, déclenchait des
// avertissements (UNSAFE_componentWillReceiveProps) venant de la librairie.
export function SwaggerDocs({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let cancelled = false;

    // Chargé uniquement dans le navigateur (Swagger UI utilise des API du navigateur).
    import("swagger-ui-dist/swagger-ui-es-bundle.js").then(({ default: SwaggerUI }) => {
      if (!cancelled) SwaggerUI({ url, domNode: node, tryItOutEnabled: true, persistAuthorization: false });
    });

    return () => {
      cancelled = true;
      node.replaceChildren();
    };
  }, [url]);

  return <div ref={container} />;
}
