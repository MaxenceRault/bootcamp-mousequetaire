// swagger-ui-dist ne fournit pas de types pour ce bundle.
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  type SwaggerUIOptions = {
    url: string;
    domNode: HTMLElement;
    tryItOutEnabled?: boolean;
    persistAuthorization?: boolean;
  };

  const SwaggerUI: (options: SwaggerUIOptions) => unknown;
  export default SwaggerUI;
}
