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
