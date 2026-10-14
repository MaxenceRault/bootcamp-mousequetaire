// Types minimaux du bundle navigateur de Swagger UI : swagger-ui-dist n'en fournit pas pour ce fichier.
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
