// Build and download an .ics calendar invite for a scheduled debate — no email
// infrastructure needed; the browser hands it to the user's calendar app.
const toICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const escapeICS = (text = '') =>
  String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function downloadDebateReminder({ title, description, scheduledAt, id }) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // assume 1 hour

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tark-Vitark//Debate//EN',
    'BEGIN:VEVENT',
    `UID:debate-${id}@tark-vitark`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(`Debate: ${title}`)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Debate starting soon',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debate-${id}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
