import "server-only";

export type TripCalendarEvent = {
  id: number;
  day: string;
  startTime: string;
  title: string;
  description: string | null;
};

// Une activité n'a pas de fin : durée par défaut, jusqu'à la suivante du même jour au plus.
const DEFAULT_MINUTES = 60;

// Calendrier iCalendar (RFC 5545). Heures « flottantes » : l'heure locale de la destination, quel que soit le fuseau du téléphone.
export function buildTripCalendar({
  tripId,
  name,
  location,
  events,
}: {
  // Identifiant public du voyage (UID des événements).
  tripId: string;
  name: string;
  location: string;
  events: TripCalendarEvent[];
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Brb//Trip planner//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeText(name)}`];

  events.forEach((event, index) => {
    const next = events[index + 1];
    const start = toMinutes(event.startTime);
    const end = next?.day === event.day && toMinutes(next.startTime) > start ? Math.min(toMinutes(next.startTime), start + DEFAULT_MINUTES) : start + DEFAULT_MINUTES;
    lines.push(
      "BEGIN:VEVENT",
      `UID:trip-${tripId}-item-${event.id}@brb`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dateTime(event.day, start)}`,
      `DTEND:${dateTime(event.day, end)}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      `LOCATION:${escapeText(location)}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Une fin après minuit passe au lendemain.
function dateTime(day: string, minutes: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCMinutes(minutes);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

// Texte saisi par les utilisateurs ou l'IA : échappé, sinon un retour à la ligne injecterait une propriété.
function escapeText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lignes de 75 octets maximum, suite précédée d'une espace (sans couper un caractère UTF-8).
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = "";
    }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
