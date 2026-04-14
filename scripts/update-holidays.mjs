import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outputPath = path.resolve(__dirname, '../src/holiday-data.js')

const TURKISH_MONTHS = {
  OCAK: '01',
  SUBAT: '02',
  MART: '03',
  NISAN: '04',
  MAYIS: '05',
  HAZIRAN: '06',
  TEMMUZ: '07',
  AGUSTOS: '08',
  EYLUL: '09',
  EKIM: '10',
  KASIM: '11',
  ARALIK: '12',
}

const DIYANET_HISTORICAL_SOURCE_URL = 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=141'
const DIYANET_YEAR_SOURCE_URLS = {
  2022: 'https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2022',
  2023: 'https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2023',
  2024: 'https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2024',
  2025: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=152',
  2026: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=153',
  2027: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154',
  2028: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=185',
  2029: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=186',
  2030: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=187',
  2031: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=188',
  2032: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=189',
  2033: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=190',
  2034: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=191',
  2035: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=192',
}

const DIYANET_MANUAL_ENTRIES = {
  2021: [
    {
      dateKey: '2021-05-12',
      label: 'Ramazan Bayramı Arefesi',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-05-13',
      label: 'Ramazan Bayramı (1. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-05-14',
      label: 'Ramazan Bayramı (2. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-05-15',
      label: 'Ramazan Bayramı (3. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-07-19',
      label: 'Kurban Bayramı Arefesi',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-07-20',
      label: 'Kurban Bayramı (1. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-07-21',
      label: 'Kurban Bayramı (2. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-07-22',
      label: 'Kurban Bayramı (3. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
    {
      dateKey: '2021-07-23',
      label: 'Kurban Bayramı (4. Gün)',
      category: 'religious',
      source: 'diyanet',
      sourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
    },
  ],
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Guml;/g, 'Ğ')
    .replace(/&guml;/g, 'ğ')
    .replace(/&Scedil;/g, 'Ş')
    .replace(/&scedil;/g, 'ş')
    .replace(/&Iuml;/g, 'İ')
    .replace(/&iuml;/g, 'i')
    .replace(/&#304;/g, 'İ')
    .replace(/&#305;/g, 'ı')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toAsciiUpper(value) {
  return String(value ?? '')
    .toLocaleUpperCase('tr-TR')
    .replace(/Ç/g, 'C')
    .replace(/Ğ/g, 'G')
    .replace(/İ/g, 'I')
    .replace(/Ö/g, 'O')
    .replace(/Ş/g, 'S')
    .replace(/Ü/g, 'U')
}

function parseTurkishDateParts(dayText, monthYearText) {
  const day = String(dayText ?? '').replace(/\D/g, '').padStart(2, '0')
  const monthYearMatch = toAsciiUpper(monthYearText).match(/([A-Z]+)\s*-\s*(\d{4})/)

  if (!day || !monthYearMatch) {
    return null
  }

  const month = TURKISH_MONTHS[monthYearMatch[1]]
  const year = monthYearMatch[2]

  if (!month) {
    return null
  }

  return `${year}-${month}-${day}`
}

function getYearFromDateKey(dateKey) {
  return Number(String(dateKey).slice(0, 4))
}

function addEntry(collection, entry) {
  const year = getYearFromDateKey(entry.dateKey)

  if (!collection[year]) {
    collection[year] = []
  }

  if (!collection[year].some((existing) => existing.dateKey === entry.dateKey && existing.label === entry.label)) {
    collection[year].push(entry)
  }
}

function parseDiyanetHolidayEntries(html, fallbackYear, sourceUrl) {
  const entries = []
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []

  rows.forEach((row) => {
    const cells = row.match(/<td[\s\S]*?<\/td>/gi)

    if (!cells || cells.length < 7) {
      return
    }

    const miladiDay = normalizeText(cells[3])
    const miladiMonthYear = normalizeText(cells[4])
    const label = normalizeText(cells[6])
    const upperLabel = toAsciiUpper(label)

    if (!upperLabel.includes('AREFE') && !upperLabel.includes('RAMAZAN BAYRAMI') && !upperLabel.includes('KURBAN BAYRAMI')) {
      return
    }

    const dateKey = parseTurkishDateParts(miladiDay, miladiMonthYear)

    if (!dateKey) {
      return
    }

    const entryYear = getYearFromDateKey(dateKey)

    if (entryYear !== fallbackYear && entryYear !== fallbackYear - 1 && entryYear !== fallbackYear + 1) {
      return
    }

    entries.push({
      dateKey,
      label,
      category: 'religious',
      source: 'diyanet',
      sourceUrl,
    })
  })

  return entries
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; HafizlikCountdownHolidayBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

async function buildHolidayData() {
  const byYear = structuredClone(DIYANET_MANUAL_ENTRIES)

  for (const [yearText, sourceUrl] of Object.entries(DIYANET_YEAR_SOURCE_URLS)) {
    const year = Number(yearText)
    const html = await fetchText(sourceUrl)
    const entries = parseDiyanetHolidayEntries(html, year, sourceUrl)

    entries.forEach((entry) => addEntry(byYear, entry))
  }

  return Object.fromEntries(
    Object.entries(byYear)
      .sort(([leftYear], [rightYear]) => Number(leftYear) - Number(rightYear))
      .map(([year, entries]) => [
        year,
        entries
          .slice()
          .sort((left, right) => (
            left.dateKey.localeCompare(right.dateKey, 'tr')
            || left.category.localeCompare(right.category, 'tr')
            || left.label.localeCompare(right.label, 'tr')
          )),
      ]),
  )
}

function buildSourceSummary() {
  return {
    diyanet: {
      manualYears: [2021],
      fetchedYears: Object.keys(DIYANET_YEAR_SOURCE_URLS).map(Number),
      historicalSourceUrl: DIYANET_HISTORICAL_SOURCE_URL,
      yearlySourceUrls: DIYANET_YEAR_SOURCE_URLS,
    },
  }
}

function buildModuleSource(holidayData) {
  const sourceSummary = buildSourceSummary()
  const generatedAt = new Date().toISOString()

  return `// This file is generated by scripts/update-holidays.mjs
// Generated at: ${generatedAt}

export const HOLIDAY_DATA = Object.freeze(${JSON.stringify(holidayData, null, 2)})

export const HOLIDAY_SOURCES = Object.freeze(${JSON.stringify(sourceSummary, null, 2)})

export function getHolidayEntries(year) {
  return HOLIDAY_DATA[String(year)] ?? []
}

export function getHolidaySet(year) {
  return new Set(getHolidayEntries(year).map((entry) => entry.dateKey))
}

export function getHolidayDetails(dateKey) {
  const year = String(dateKey ?? '').slice(0, 4)
  return (HOLIDAY_DATA[year] ?? []).filter((entry) => entry.dateKey === dateKey)
}
`
}

async function main() {
  const holidayData = await buildHolidayData()
  const moduleSource = buildModuleSource(holidayData)
  await writeFile(outputPath, moduleSource, 'utf8')
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
