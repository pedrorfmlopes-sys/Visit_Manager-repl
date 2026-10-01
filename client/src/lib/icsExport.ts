import type { TarefaWithRelations } from "@shared/schema";

function sanitizeICSText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function exportTarefaAsICS(tarefa: TarefaWithRelations) {
  const now = new Date();
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const dueDate = tarefa.dueDate ? new Date(tarefa.dueDate) : null;
  const dtstart = dueDate ? formatDate(dueDate) : formatDate(now);
  const dtend = dueDate ? formatDate(new Date(dueDate.getTime() + 60 * 60 * 1000)) : formatDate(new Date(now.getTime() + 60 * 60 * 1000));
  
  // Reminder 1 hour before
  const reminderDate = dueDate ? new Date(dueDate.getTime() - 60 * 60 * 1000) : null;
  const reminderTrigger = reminderDate ? formatDate(reminderDate) : "";

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Commercial Visits PWA//Task//PT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:tarefa-${tarefa.id}@commercial-visits.app`,
    `DTSTAMP:${formatDate(now)}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${sanitizeICSText(tarefa.titulo)}`,
    tarefa.descricao ? `DESCRIPTION:${sanitizeICSText(tarefa.descricao)}` : "",
    tarefa.entidade ? `LOCATION:${sanitizeICSText(tarefa.entidade.nome)}` : "",
    reminderDate ? [
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${sanitizeICSText(tarefa.titulo)}`,
      "END:VALARM"
    ].join("\r\n") : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tarefa-${tarefa.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
