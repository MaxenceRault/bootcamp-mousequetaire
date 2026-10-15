import type { TripDetail } from "@/components/TripPlanner";

type CsvLabels = { headers: string[]; category: (category: string) => string; dayLabel: (number: number) => string };

// Une ligne par activité. « ; » et BOM UTF-8 : ouverture directe dans Excel en français, accents compris.
export function buildTripCsv({ trip, items }: TripDetail, days: string[], labels: CsvLabels) {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = items.map((item) =>
    [
      labels.dayLabel(days.indexOf(item.day) + 1),
      item.day,
      item.start_time,
      labels.category(item.category),
      item.title,
      item.description ?? "",
      item.source_post ? `${item.source_post.title} (/post/${item.source_post.slug})` : "",
    ]
      .map(cell)
      .join(";"),
  );
  return { name: `${fileName(trip.title)}.csv`, content: `﻿${[labels.headers.map(cell).join(";"), ...rows].join("\r\n")}` };
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

// « Kyoto : saveurs d'automne » → « kyoto-saveurs-d-automne ».
function fileName(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "voyage"
  );
}
