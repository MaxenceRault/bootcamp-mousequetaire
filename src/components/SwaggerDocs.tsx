"use client";

import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

// Version autonome (swagger-ui-dist) hors de notre arbre React : swagger-ui-react déclenchait
// des avertissements UNSAFE_componentWillReceiveProps.
export function SwaggerDocs({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let cancelled = false;

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
