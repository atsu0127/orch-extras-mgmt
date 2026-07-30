export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function buildInquiryMailtoUrl(
  email: string,
  concertName: string,
): string {
  const normalizedConcertName = concertName.replace(/[\r\n]+/g, ' ')
  const subject = `【${normalizedConcertName}】エキストラからの問い合わせ`
  const body = `演奏会名：${normalizedConcertName}\r\n氏名：\r\n問い合わせ内容：`

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

type CalendarVenue = {
  name: string
  address: string
}

export type PerformanceCalendarInput = {
  concertName: string
  date: string
  venue: CalendarVenue | null
}

export type PracticeCalendarInput = {
  concertName: string
  date: string
  startTime: string | null
  endTime: string | null
  venue: CalendarVenue | null
}

type LocalDate = {
  year: number
  month: number
  day: number
}

const GOOGLE_CALENDAR_BASE_URL =
  'https://calendar.google.com/calendar/render?action=TEMPLATE'

export function buildPerformanceCalendarUrl(
  input: PerformanceCalendarInput,
): string | null {
  const date = parseLocalDate(input.date)
  if (!date) return null

  const dates = buildAllDayRange(date)
  return dates ? buildCalendarUrl(input.concertName, dates, input.venue) : null
}

export function buildPracticeCalendarUrl(
  input: PracticeCalendarInput,
): string | null {
  const date = parseLocalDate(input.date)
  if (!date) return null

  const startTime = parseLocalTime(input.startTime)
  const endTime = parseLocalTime(input.endTime)
  if (startTime === undefined || endTime === undefined) return null

  const compactDate = formatCompactDate(date)
  if (startTime !== null && endTime !== null) {
    if (endTime <= startTime) return null
    return buildCalendarUrl(
      `${input.concertName} 練習`,
      `${compactDate}T${startTime}/${compactDate}T${endTime}`,
      input.venue,
      true,
    )
  }

  const dates = buildAllDayRange(date)
  return dates
    ? buildCalendarUrl(`${input.concertName} 練習`, dates, input.venue)
    : null
}

function buildCalendarUrl(
  text: string,
  dates: string,
  venue: CalendarVenue | null,
  withTimeZone = false,
): string {
  const url = new URL(GOOGLE_CALENDAR_BASE_URL)
  url.searchParams.set('text', text)
  url.searchParams.set('dates', dates)
  if (venue) url.searchParams.set('location', `${venue.name} ${venue.address}`)
  if (withTimeZone) url.searchParams.set('ctz', 'Asia/Tokyo')
  return url.toString()
}

function parseLocalDate(value: string): LocalDate | null {
  if (value.length !== 10) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null
  }

  return { year, month, day }
}

function parseLocalTime(value: string | null): string | null | undefined {
  if (value === null || value === '') return null
  if (value.length !== 5 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return undefined
  }
  return `${value.slice(0, 2)}${value.slice(3)}00`
}

function buildAllDayRange(date: LocalDate): string | null {
  const endDate = nextDay(date)
  return endDate
    ? `${formatCompactDate(date)}/${formatCompactDate(endDate)}`
    : null
}

function nextDay(date: LocalDate): LocalDate | null {
  if (date.day < daysInMonth(date.year, date.month)) {
    return { ...date, day: date.day + 1 }
  }
  if (date.month < 12) {
    return { year: date.year, month: date.month + 1, day: 1 }
  }
  if (date.year === 9999) return null
  return { year: date.year + 1, month: 1, day: 1 }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function formatCompactDate(date: LocalDate): string {
  return `${String(date.year).padStart(4, '0')}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}`
}
