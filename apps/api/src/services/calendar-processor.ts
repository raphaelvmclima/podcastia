/**
 * Google Calendar / iCal Processor for PodcastIA
 * Parses iCal (.ics) feeds to extract events for today and tomorrow.
 * Supports public/shared calendar URLs (no OAuth needed).
 */

export interface CalendarConfig {
  icalUrl: string;
  calendarId?: string;
  credentials?: object;
}

export interface CalendarItem {
  group_name: string;
  sender: string;
  content: string;
}

const USER_AGENT = 'PodcastIA-Calendar/1.0';

interface ParsedEvent {
  summary: string;
  description: string;
  location: string;
  dtstart: Date | null;
  dtend: Date | null;
  allDay: boolean;
}

/**
 * Parse an iCal date string (DTSTART/DTEND) into a JS Date.
 * Handles formats: 20260403T140000Z, 20260403T140000, 20260403, TZID=America/Sao_Paulo:20260403T140000
 */
function parseICalDate(raw: string): { date: Date | null; allDay: boolean } {
  if (!raw) return { date: null, allDay: false };

  // Remove TZID prefix if present
  let dateStr = raw;
  const tzMatch = raw.match(/TZID=[^:]+:(.*)/);
  if (tzMatch) dateStr = tzMatch[1];

  // All-day event: just YYYYMMDD
  if (/^\d{8}$/.test(dateStr)) {
    const y = parseInt(dateStr.slice(0, 4));
    const m = parseInt(dateStr.slice(4, 6)) - 1;
    const d = parseInt(dateStr.slice(6, 8));
    return { date: new Date(y, m, d), allDay: true };
  }

  // Date with time: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const dtMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dtMatch) {
    const [, y, mo, d, h, mi, s, z] = dtMatch;
    if (z) {
      return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
    }
    // Assume local time (BRT)
    return { date: new Date(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };
  }

  // Fallback: try native parsing
  const fallback = new Date(dateStr);
  return { date: isNaN(fallback.getTime()) ? null : fallback, allDay: false };
}

/**
 * Unfold iCal lines (lines starting with space/tab are continuations).
 */
function unfoldIcal(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Extract a property value from an iCal component block.
 */
function getICalProp(block: string, prop: string): string {
  const regex = new RegExp(`^(${prop})(?:;[^:]*)?:(.*)`, 'mi');
  const match = block.match(regex);
  if (!match) return '';
  return match[2]
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Get the raw line for date properties (need full line for TZID parsing).
 */
function getICalDateRaw(block: string, prop: string): string {
  const regex = new RegExp(`^(${prop})(?:;([^:]*))?:(.*)`, 'mi');
  const match = block.match(regex);
  if (!match) return '';
  const params = match[2] || '';
  const value = match[3].trim();
  if (params.includes('TZID=')) {
    return `${params.match(/TZID=[^;]*/)?.[0]}:${value}`;
  }
  return value;
}

/**
 * Parse VEVENT blocks from iCal text.
 */
function parseEvents(icalText: string): ParsedEvent[] {
  const unfolded = unfoldIcal(icalText);
  const events: ParsedEvent[] = [];

  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(unfolded)) !== null) {
    const block = match[1];

    const summary = getICalProp(block, 'SUMMARY');
    const description = getICalProp(block, 'DESCRIPTION');
    const location = getICalProp(block, 'LOCATION');
    const dtStartRaw = getICalDateRaw(block, 'DTSTART');
    const dtEndRaw = getICalDateRaw(block, 'DTEND');

    const start = parseICalDate(dtStartRaw);
    const end = parseICalDate(dtEndRaw);

    events.push({
      summary: summary || '(Sem titulo)',
      description: description?.slice(0, 500) || '',
      location: location || '',
      dtstart: start.date,
      dtend: end.date,
      allDay: start.allDay,
    });
  }

  return events;
}

/**
 * Check if a date falls on a given day (same year/month/day in BRT).
 */
function isSameDay(date: Date, refDate: Date): boolean {
  const d = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const r = new Date(refDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth() && d.getDate() === r.getDate();
}

/**
 * Format an event for display.
 */
function formatEvent(event: ParsedEvent, label: string): string {
  const parts: string[] = [];

  if (event.allDay) {
    parts.push(`${label} (dia inteiro): ${event.summary}`);
  } else if (event.dtstart) {
    const timeStr = event.dtstart.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    parts.push(`${label} ${timeStr}: ${event.summary}`);
  } else {
    parts.push(`${label}: ${event.summary}`);
  }

  if (event.location) parts.push(`Local: ${event.location}`);
  if (event.description) {
    const shortDesc = event.description.split('\n')[0].slice(0, 200);
    if (shortDesc) parts.push(shortDesc);
  }

  return parts.join(' | ');
}

/**
 * Main entry point - fetch iCal feed and return today/tomorrow events.
 */
export async function fetchCalendarContent(config: CalendarConfig): Promise<CalendarItem[]> {
  const url = config.icalUrl;
  if (!url) {
    console.error('[calendar-processor] Missing icalUrl');
    return [];
  }

  console.log(`[calendar-processor] Fetching calendar from ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/calendar, */*',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[calendar-processor] HTTP ${res.status} from ${url}`);
      return [];
    }

    const icalText = await res.text();
    const events = parseEvents(icalText);

    console.log(`[calendar-processor] Parsed ${events.length} events total`);

    // Filter for today and tomorrow (BRT)
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEvents: ParsedEvent[] = [];
    const tomorrowEvents: ParsedEvent[] = [];

    for (const event of events) {
      if (!event.dtstart) continue;
      if (isSameDay(event.dtstart, today)) {
        todayEvents.push(event);
      } else if (isSameDay(event.dtstart, tomorrow)) {
        tomorrowEvents.push(event);
      }
    }

    // Sort by time
    const sortByTime = (a: ParsedEvent, b: ParsedEvent) => {
      const ta = a.dtstart?.getTime() || 0;
      const tb = b.dtstart?.getTime() || 0;
      return ta - tb;
    };
    todayEvents.sort(sortByTime);
    tomorrowEvents.sort(sortByTime);

    const items: CalendarItem[] = [];

    if (todayEvents.length > 0) {
      const todayStr = todayEvents.map(e => formatEvent(e, 'Hoje')).join('\n');
      items.push({
        group_name: 'Agenda',
        sender: 'Google Calendar',
        content: todayStr,
      });
    }

    if (tomorrowEvents.length > 0) {
      const tomorrowStr = tomorrowEvents.map(e => formatEvent(e, 'Amanha')).join('\n');
      items.push({
        group_name: 'Agenda',
        sender: 'Google Calendar',
        content: tomorrowStr,
      });
    }

    if (items.length === 0) {
      items.push({
        group_name: 'Agenda',
        sender: 'Google Calendar',
        content: 'Nenhum evento encontrado para hoje ou amanha.',
      });
    }

    console.log(`[calendar-processor] Returning ${items.length} items (hoje: ${todayEvents.length}, amanha: ${tomorrowEvents.length})`);
    return items;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error('[calendar-processor] Timeout fetching calendar');
    } else {
      console.error(`[calendar-processor] Error: ${err.message}`);
    }
    return [];
  }
}
