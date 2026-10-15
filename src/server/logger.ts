import "server-only";

// Format lu par Cloud Logging (severity). Le @type range l'erreur dans Error Reporting, qui regroupe et alerte.
const ERROR_EVENT = "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

// Logs serveur uniquement : jamais renvoyés au client.
export function logError(scope: string, error: unknown) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(JSON.stringify({ severity: "ERROR", "@type": ERROR_EVENT, serviceContext: { service: "brb" }, scope, message }));
}

export function logInfo(scope: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({ severity: "INFO", scope, ...data }));
}
