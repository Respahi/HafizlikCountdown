import './style.css'
import { renderMainView } from './main-table.js'
import { renderScenarioView } from './scenario-view.js'

const ROWS = 20
const COLUMNS = 30
const TOTAL_CELLS = ROWS * COLUMNS
const STORAGE_KEY = 'hafizlik-countdown-state'
const ONE_DAY = 24 * 60 * 60 * 1000
const WEEK_LENGTH = 7
const STUDY_DAYS_PER_WEEK = 6
const SCENARIO_FILL_DELAY_STEP = 44
const SCENARIO_FILL_DURATION = 400
const SCENARIO_POST_FILL_HOLD = 260
const SCENARIO_WAVE_DELAY_STEP = 26
const SCENARIO_WAVE_DURATION = 340
const HAM_OPTIONS = [1, 2, 3, 4, 5]
const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const HAM_CONFIG = {
  1: {
    scenarioFillClass: 'scenario-tile-fill-green',
    mainFillClass: 'cell-fill-green',
    penaltyFillClass: 'cell-fill-red',
  },
  2: {
    scenarioFillClass: 'scenario-tile-fill-orange',
    mainFillClass: 'cell-fill-orange',
    penaltyFillClass: 'cell-fill-orange-deep',
  },
  3: {
    scenarioFillClass: 'scenario-tile-fill-blue',
    mainFillClass: 'cell-fill-blue',
    penaltyFillClass: 'cell-fill-blue-deep',
  },
  4: {
    scenarioFillClass: 'scenario-tile-fill-pink',
    mainFillClass: 'cell-fill-pink',
    penaltyFillClass: 'cell-fill-pink-deep',
  },
  5: {
    scenarioFillClass: 'scenario-tile-fill-gold',
    mainFillClass: 'cell-fill-gold',
    penaltyFillClass: 'cell-fill-gold-deep',
  },
  repeat: {
    scenarioFillClass: 'scenario-tile-fill-repeat',
    mainFillClass: 'cell-fill-repeat',
    penaltyFillClass: 'cell-fill-red',
  },
}

const RELIGIOUS_HOLIDAYS = {
  2026: {
    ramadan: ['2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22', '2026-03-23'],
    sacrifice: ['2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'],
  },
  2027: {
    ramadan: ['2027-03-09', '2027-03-10', '2027-03-11', '2027-03-12'],
    sacrifice: ['2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'],
  },
  2028: {
    ramadan: ['2028-02-26', '2028-02-27', '2028-02-28', '2028-02-29'],
    sacrifice: ['2028-05-04', '2028-05-05', '2028-05-06', '2028-05-07', '2028-05-08'],
  },
}

const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
const normalizedSavedMarks = Array.isArray(savedState.committedMarks)
  ? savedState.committedMarks.map((mark) => ({
      progressIndex: clampNumber(mark.progressIndex ?? 0, 0, TOTAL_CELLS),
      badgeValue: mark.badgeValue ?? null,
      fillClass: mark.fillClass ?? null,
    }))
  : Array.isArray(savedState.attemptBadges)
    ? savedState.attemptBadges.map((badge) => ({
        progressIndex: clampNumber(badge.progressIndex ?? 0, 0, TOTAL_CELLS),
        badgeValue: badge.value ?? null,
      }))
    : []

const state = {
  pace: clampNumber(savedState.pace ?? 0, 0, ROWS),
  juz: clampNumber(savedState.juz ?? 0, 0, COLUMNS),
  inputPace: clampNumber(
    savedState.inputPace ?? ((savedState.filledCount ?? 0) > 0 ? (savedState.pace ?? 1) : 1),
    0,
    ROWS,
  ),
  inputJuz: clampNumber(
    savedState.inputJuz ?? ((savedState.filledCount ?? 0) > 0 ? (savedState.juz ?? 0) : 0),
    0,
    COLUMNS,
  ),
  inputHamCount: normalizeHamSelection(savedState.inputHamCount ?? 1),
  filledCount: clampNumber(savedState.filledCount ?? 0, 0, TOTAL_CELLS),
  baselineCount: clampNumber(savedState.baselineCount ?? savedState.filledCount ?? 0, 0, TOTAL_CELLS),
  animate: false,
  committedMarks: normalizedSavedMarks,
  carryRedCount: clampNumber(savedState.carryRedCount ?? 0, 0, 999),
  spentStudyDays: clampNumber(savedState.spentStudyDays ?? 0, 0, 9999),
  view: 'main',
  scenario: null,
  forecastEndDateKey: typeof savedState.forecastEndDateKey === 'string' ? savedState.forecastEndDateKey : null,
  completionDateKey: typeof savedState.completionDateKey === 'string' ? savedState.completionDateKey : null,
  completionModalOpen: false,
  preferredScenarioHam: savedState.preferredScenarioHam === 'repeat'
    ? 'repeat'
    : (savedState.preferredScenarioHam != null ? clampNumber(savedState.preferredScenarioHam, 1, 5) : null),
}

const app = document.querySelector('#app')
let scenarioDateTimer = null
let scenarioRevealTimer = null
let scenarioRollTimer = null
let scenarioIncomingTimer = null

function normalizeHamSelection(value, fallback = 1) {
  if (value === 'repeat') {
    return 'repeat'
  }

  const parsed = Number(value)

  if (Number.isNaN(parsed)) {
    return fallback
  }

  if (parsed < 1) {
    return 'repeat'
  }

  return Math.min(Math.max(parsed, 1), 5)
}

function getHamSelectionNumericValue(value) {
  return value === 'repeat' ? 1 : value
}

function getHamSelectionLabel(value) {
  return value === 'repeat' ? 'Tekrar' : String(value)
}

function shiftHamSelection(value, direction) {
  const order = ['repeat', 1, 2, 3, 4, 5]
  const currentIndex = order.indexOf(normalizeHamSelection(value))
  const safeIndex = currentIndex === -1 ? 1 : currentIndex
  const nextIndex = Math.min(Math.max(safeIndex + direction, 0), order.length - 1)

  return order[nextIndex]
}

function clampNumber(value, min, max) {
  const parsed = Number(value)

  if (Number.isNaN(parsed)) {
    return min
  }

  return Math.min(Math.max(parsed, min), max)
}

function calculateFilledCount(pace, juz, hamCount = 1) {
  if (pace <= 0 && juz <= 0) {
    return 0
  }

  const normalizedHamSelection = normalizeHamSelection(hamCount)
  const normalizedHamCount = getHamSelectionNumericValue(normalizedHamSelection)

  if (normalizedHamSelection === 'repeat') {
    return Math.min(Math.max(pace * COLUMNS, 0), TOTAL_CELLS)
  }

  return Math.min(((pace - normalizedHamCount) * COLUMNS) + (normalizedHamCount * juz), TOTAL_CELLS)
}

function filledCountToProgress(count) {
  if (count <= 0) {
    return {
      pace: 0,
      juz: 0,
    }
  }

  const normalized = Math.min(Math.max(count, 1), TOTAL_CELLS)

  return {
    pace: Math.floor((normalized - 1) / COLUMNS) + 1,
    juz: ((normalized - 1) % COLUMNS) + 1,
  }
}

function padNumber(value) {
  return String(value).padStart(2, '0')
}

function toDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeekMonday(date) {
  const normalized = startOfDay(date)
  const day = normalized.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return addDays(normalized, offset)
}

function endOfWeekSunday(date) {
  const normalized = startOfDay(date)
  const day = normalized.getDay()
  const offset = day === 0 ? 0 : 7 - day
  return addDays(normalized, offset)
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function isSameMonth(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
}

function getTodayDateKey() {
  return toDateKey(startOfDay(new Date()))
}

function formatDate(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function getDateParts(date) {
  const parts = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date)

  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '',
    month: parts.find((part) => part.type === 'month')?.value ?? '',
    year: parts.find((part) => part.type === 'year')?.value ?? '',
  }
}

function renderScenarioDate(currentDate, previousDate, version, widthReferenceDate) {
  const current = getDateParts(currentDate)
  const widthReference = widthReferenceDate ? getDateParts(widthReferenceDate) : null
  const renderSizer = (values) => values
    .filter((value, index, array) => value && array.indexOf(value) === index)
    .map((value) => `<span class="scenario-date-part-sizer">${value}</span>`)
    .join('')
  const renderStaticPart = (value, sizeValues = [value]) => `
    <span class="scenario-date-part-wrap">
      ${renderSizer(sizeValues)}
      <span class="scenario-date-part scenario-date-part-static">${value}</span>
    </span>
  `

  if (!previousDate) {
    return `
      ${renderStaticPart(current.day, [current.day, widthReference?.day])}
      <span class="scenario-date-separator"> </span>
      ${renderStaticPart(current.month, [current.month, widthReference?.month])}
      <span class="scenario-date-separator"> </span>
      ${renderStaticPart(current.year, [current.year, widthReference?.year])}
    `
  }

  const previous = getDateParts(previousDate)

  return ['day', 'month', 'year']
    .map((key, index) => {
      const separator = index < 2 ? '<span class="scenario-date-separator"> </span>' : ''
      const sizeValues = [current[key], previous[key], widthReference?.[key]]

      if (current[key] === previous[key]) {
        return `${renderStaticPart(current[key], sizeValues)}${separator}`
      }

      return `
        <span class="scenario-date-part-wrap">
          ${renderSizer(sizeValues)}
          <span class="scenario-date-part scenario-date-old" data-version="${version}">${previous[key]}</span>
          <span class="scenario-date-part scenario-date-new" data-version="${version}">${current[key]}</span>
        </span>${separator}
      `
    })
    .join('')
}

function estimateProjectedEndDate(remainingPages, spentStudyDays) {
  return estimateCompletion(Math.max(remainingPages, 0), spentStudyDays).endDate
}

function setForecastEndDate(date) {
  state.forecastEndDateKey = date ? toDateKey(startOfDay(date)) : null
}

function getProjectedEndDate(
  remainingPages,
  spentStudyDays,
  forecastDateKey = state.forecastEndDateKey,
  completionDateKey = state.completionDateKey,
) {
  if (remainingPages <= 0 && completionDateKey) {
    return parseDateKey(completionDateKey)
  }

  if (forecastDateKey) {
    return parseDateKey(forecastDateKey)
  }

  return estimateProjectedEndDate(remainingPages, spentStudyDays)
}

function shouldReuseScenarioHam(filledCount = state.filledCount, preferredScenarioHam = state.preferredScenarioHam) {
  return filledCount < TOTAL_CELLS && preferredScenarioHam != null
}

function syncCompletionState(previousFilledCount, nextFilledCount, completionDate = null) {
  const isNowComplete = nextFilledCount >= TOTAL_CELLS
  const wasComplete = previousFilledCount >= TOTAL_CELLS

  if (isNowComplete && !wasComplete) {
    const resolvedCompletionDate = completionDate
      ?? (state.forecastEndDateKey ? parseDateKey(state.forecastEndDateKey) : null)

    if (!resolvedCompletionDate) {
      return
    }

    const completionDateKey = toDateKey(startOfDay(resolvedCompletionDate))

    state.completionDateKey = completionDateKey
    state.forecastEndDateKey = completionDateKey
    state.completionModalOpen = true
    state.preferredScenarioHam = null
    return
  }

  if (!isNowComplete) {
    state.completionDateKey = null
    state.completionModalOpen = false
  }
}

function closeCompletionModal() {
  state.completionModalOpen = false
  render()
}

function triggerApplyButtonValidationError(button) {
  button.classList.remove('apply-button-invalid')
  void button.offsetWidth
  button.classList.add('apply-button-invalid')
  window.setTimeout(() => {
    button.classList.remove('apply-button-invalid')
  }, 420)
}

function renderCompletionModal() {
  if (!state.completionModalOpen || state.filledCount < TOTAL_CELLS || !state.completionDateKey) {
    return ''
  }

  const confettiColors = ['#4f9b59', '#dc8a2f', '#417fd1', '#d96ca4', '#d4aa2a', '#8f969d']
  const confettiPieces = Array.from({ length: 28 }, (_, index) => {
    const color = confettiColors[index % confettiColors.length]
    const left = (index * 13) % 100
    const delay = ((index % 7) * 110)
    const duration = 2400 + ((index % 5) * 180)
    const rotate = ((index * 37) % 60) - 30
    const drift = ((index % 2 === 0 ? 1 : -1) * (12 + (index % 4) * 6))
    const size = 8 + (index % 3) * 3

    return `
      <span
        class="completion-confetti-piece"
        style="--confetti-left:${left}%; --confetti-delay:${delay}ms; --confetti-duration:${duration}ms; --confetti-rotate:${rotate}deg; --confetti-drift:${drift}px; --confetti-size:${size}px; --confetti-color:${color};"
      ></span>
    `
  }).join('')

  return `
    <div class="completion-modal-backdrop">
      <div class="completion-modal">
        <div class="completion-confetti" aria-hidden="true">
          ${confettiPieces}
        </div>
        <p class="eyebrow">Tebrikler</p>
        <h2>Hafızlığınız Bitti</h2>
        <p class="completion-date">Hafızlık Bitiş Tarihi: ${formatDate(parseDateKey(state.completionDateKey))}</p>
        <button id="close-completion-modal" class="back-button completion-close-button" type="button">Kapat</button>
      </div>
    </div>
  `
}

function createDateRange(startDateKey, days) {
  const dates = []
  let cursor = parseDateKey(startDateKey)

  for (let index = 0; index < days; index += 1) {
    dates.push(toDateKey(cursor))
    cursor = addDays(cursor, 1)
  }

  return dates
}

function getApproximateBreaks(year) {
  return [
    ...createDateRange(`${year}-01-15`, 7),
    ...createDateRange(`${year}-06-01`, 7),
    ...createDateRange(`${year}-08-25`, 7),
  ]
}

function getHolidaySet(year) {
  const fixedHolidays = [
    `${year}-01-01`,
    `${year}-04-23`,
    `${year}-05-01`,
    `${year}-05-19`,
    `${year}-07-15`,
    `${year}-08-30`,
    `${year}-10-28`,
    `${year}-10-29`,
  ]

  if (year >= 2026) {
    fixedHolidays.push(`${year}-03-21`)
  }

  const religious = RELIGIOUS_HOLIDAYS[year]
    ? [...RELIGIOUS_HOLIDAYS[year].ramadan, ...RELIGIOUS_HOLIDAYS[year].sacrifice]
    : []

  return new Set([...fixedHolidays, ...religious, ...getApproximateBreaks(year)])
}

function isNonStudyDay(date, holidaySet) {
  return date.getDay() === 0 || holidaySet.has(toDateKey(date))
}

function estimateCompletion(remainingPages, spentStudyDays = 0) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const totalStudyDaysNeeded = Math.max(remainingPages + spentStudyDays, 0)

  if (totalStudyDaysNeeded === 0) {
    return {
      endDate: start,
      extraDays: 0,
      sundays: 0,
      holidays: 0,
    }
  }

  let cursor = start
  let studyDaysLeft = totalStudyDaysNeeded
  let sundays = 0
  let holidays = 0

  while (studyDaysLeft > 0) {
    const holidaySet = getHolidaySet(cursor.getFullYear())

    if (isNonStudyDay(cursor, holidaySet)) {
      if (cursor.getDay() === 0) {
        sundays += 1
      } else {
        holidays += 1
      }
    } else {
      studyDaysLeft -= 1
    }

    if (studyDaysLeft > 0) {
      cursor = addDays(cursor, 1)
    }
  }

  const totalDays = Math.round((cursor - start) / ONE_DAY) + 1

  return {
    endDate: cursor,
    extraDays: totalDays - totalStudyDaysNeeded,
    sundays,
    holidays,
  }
}

function getFillSequenceIndex(index) {
  const rowFromTop = Math.floor(index / COLUMNS)
  const column = index % COLUMNS
  const rowFromBottom = ROWS - 1 - rowFromTop

  return rowFromBottom * COLUMNS + column
}

function getMarkMap(marks) {
  return new Map(marks.map((mark) => [mark.progressIndex, mark]))
}

function getCellState(progressIndex, baselineCount, markMap) {
  if (progressIndex <= baselineCount) {
    return {
      fillClass: 'cell-fill-gray',
      labelValue: null,
      labelClass: '',
    }
  }

  const mark = markMap.get(progressIndex)

  if (mark) {
    return {
      fillClass: mark.fillClass ?? (mark.badgeValue ? 'cell-fill-red' : 'cell-fill-green'),
      labelValue: mark.badgeValue ?? null,
      labelClass: mark.badgeValue ? 'cell-label-red' : '',
    }
  }

  return {
    fillClass: '',
    labelValue: null,
    labelClass: '',
  }
}

function getHamConfig(hamLevel) {
  return HAM_CONFIG[hamLevel] ?? HAM_CONFIG[1]
}

function getScenarioVisual(entry) {
  if (!entry) {
    return {
      tileClass: 'scenario-tile-pending',
      fillClass: '',
      label: '',
    }
  }

  if (entry.type === 'sunday') {
    return {
      tileClass: 'scenario-tile-sunday',
      fillClass: 'scenario-tile-fill-sunday',
      label: 'Pazar',
    }
  }

  if (entry.type === 'holiday') {
    return {
      tileClass: 'scenario-tile-holiday',
      fillClass: 'scenario-tile-fill-holiday',
      label: 'Tatil',
    }
  }

  if (entry.type === 'repeat-summary') {
    return {
      tileClass: 'scenario-tile-repeat',
      fillClass: 'scenario-tile-fill-repeat',
      label: '',
    }
  }

  const hamConfig = getHamConfig(entry.hamLevel)

  if (entry.type === 'success') {
    return {
      tileClass: `scenario-tile-ham-${entry.hamLevel}${entry.isSundayStudy ? ' scenario-tile-sunday-study' : ''}`,
      fillClass: `${hamConfig.scenarioFillClass}${entry.isSundayStudy ? ' scenario-tile-fill-sunday-study' : ''}`,
      label: entry.isSundayStudy ? 'Pazar' : '',
    }
  }

  return {
    tileClass: `scenario-tile-penalty-${entry.hamLevel}`,
    fillClass: hamConfig.penaltyFillClass.replace('cell-', 'scenario-tile-'),
    label: '',
  }
}

function getScenarioDayMeta(date) {
  const normalized = startOfDay(date)
  const dateKey = toDateKey(normalized)
  const holidaySet = getHolidaySet(normalized.getFullYear())
  const isSunday = normalized.getDay() === 0
  const isHoliday = holidaySet.has(dateKey)

  return {
    dateKey,
    dayNumber: normalized.getDate(),
    isSunday,
    isHoliday,
    isClosed: isSunday || isHoliday,
  }
}

function getScenarioMonthView(anchorDate) {
  const monthStart = startOfMonth(anchorDate)
  const monthEnd = endOfMonth(anchorDate)
  const gridStart = startOfWeekMonday(monthStart)
  const gridEnd = endOfWeekSunday(monthEnd)
  const dayCount = Math.round((gridEnd - gridStart) / ONE_DAY) + 1
  const weekCount = dayCount / WEEK_LENGTH
  const visibleDays = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(gridStart, index)
    const meta = getScenarioDayMeta(date)

    return {
      ...meta,
      isCurrentMonth: isSameMonth(date, monthStart),
      weekIndex: Math.floor(index / WEEK_LENGTH),
      weekdayIndex: index % WEEK_LENGTH,
    }
  })

  return {
    monthStartKey: toDateKey(monthStart),
    weekCount,
    visibleDays,
  }
}

function getActiveScenarioWeekDays(scenario) {
  return scenario.visibleDays.filter((day) => day.weekIndex === scenario.activeWeekIndex)
}

function isScenarioPastStartDay(scenario, day) {
  return day.isCurrentMonth
    && scenario.monthStartKey === scenario.startMonthStartKey
    && day.weekIndex === scenario.startWeekIndex
    && day.dateKey < scenario.startDateKey
}

function getScenarioWeekStudyCount(scenario, weekIndex = scenario.activeWeekIndex) {
  return scenario.visibleDays.filter(
    (day) => day.weekIndex === weekIndex && day.isCurrentMonth && !day.isHoliday && !isScenarioPastStartDay(scenario, day),
  ).length
}

function getScenarioWeekRemainingStudyCount(scenario, weekIndex = scenario.activeWeekIndex) {
  return scenario.visibleDays.filter(
    (day) => (
      day.weekIndex === weekIndex
      && day.isCurrentMonth
      && !day.isHoliday
      && !isScenarioPastStartDay(scenario, day)
      && !scenario.windowResults[day.dateKey]
    ),
  ).length
}

function getScenarioWeekMaxChoice(scenario) {
  return Math.min(
    getMaxScenarioChoice(scenario.virtualJuz),
    getScenarioCompletionChoiceLimit(scenario),
    getScenarioWeekRemainingStudyCount(scenario),
  )
}

function doesScenarioChoiceIncludeSunday(scenario, choice) {
  if (choice <= 0) {
    return false
  }

  const sundayChoice = getActiveScenarioWeekDays(scenario)
    .filter((day) => day.isCurrentMonth && !day.isHoliday && !isScenarioPastStartDay(scenario, day) && !scenario.windowResults[day.dateKey])
    .reduce((match, day, index) => {
      if (match !== null) {
        return match
      }

      return day.isSunday ? index + 1 : null
    }, null)

  return sundayChoice !== null && choice === sundayChoice
}

function createScenarioClosedEntry(day) {
  return {
    type: day.isSunday ? 'sunday' : 'holiday',
    dateKey: day.dateKey,
  }
}

function advanceScenarioWeek(scenario) {
  if (scenario.activeWeekIndex < scenario.weekCount - 1) {
    scenario.activeWeekIndex += 1
    return
  }

  const nextMonthView = getScenarioMonthView(addMonths(parseDateKey(scenario.monthStartKey), 1))
  scenario.monthStartKey = nextMonthView.monthStartKey
  scenario.weekCount = nextMonthView.weekCount
  scenario.activeWeekIndex = 0
  scenario.visibleDays = nextMonthView.visibleDays
  scenario.windowResults = {}
}

function normalizeScenarioWeek(scenario) {
  let guard = 0

  while (!scenario.complete && getScenarioWeekStudyCount(scenario) === 0 && guard < 24) {
    advanceScenarioWeek(scenario)
    guard += 1
  }
}

function didCompleteRow(previousFilledCount, nextFilledCount) {
  if (nextFilledCount <= previousFilledCount) {
    return false
  }

  const nextBoundary = (Math.floor(previousFilledCount / COLUMNS) + 1) * COLUMNS
  return previousFilledCount < nextBoundary && nextFilledCount >= nextBoundary
}

function didCompleteScenarioJuz(previousJuz, nextJuz) {
  return previousJuz < COLUMNS && nextJuz >= COLUMNS
}

function getRemainingScenarioJuzToBoundary(currentJuz) {
  return Math.max(COLUMNS - currentJuz, 0)
}

function getMaxScenarioChoice(currentJuz) {
  const remainingToBoundary = getRemainingScenarioJuzToBoundary(currentJuz)
  if (remainingToBoundary <= 0) {
    return 0
  }

  return Math.min(WEEK_LENGTH, remainingToBoundary)
}

function getScenarioCompletionChoiceLimit(scenario) {
  const remainingMainCells = Math.max(TOTAL_CELLS - scenario.virtualCount, 0)

  if (remainingMainCells <= 0) {
    return 0
  }

  if (scenario.currentHam === 'repeat') {
    return remainingMainCells
  }

  return Math.max(1, Math.ceil(remainingMainCells / scenario.currentHam))
}

function getScenarioBoundaryHamLimit(scenario) {
  const remainingMainCells = Math.max(TOTAL_CELLS - scenario.virtualCount, 0)

  if (remainingMainCells <= 0) {
    return 0
  }

  return Math.min(HAM_OPTIONS[HAM_OPTIONS.length - 1], Math.floor(remainingMainCells / COLUMNS))
}

function getScenarioBoundarySelectableHamLimit(scenario) {
  const remainingPaceCapacity = Math.max(20 - scenario.virtualPace, 0)
  return Math.min(getScenarioBoundaryHamLimit(scenario), remainingPaceCapacity)
}

function hasRemainingStudyWeekInWindow(scenario) {
  for (let weekIndex = scenario.activeWeekIndex + 1; weekIndex < scenario.weekCount; weekIndex += 1) {
    if (getScenarioWeekStudyCount(scenario, weekIndex) > 0) {
      return true
    }
  }

  return false
}

function moveScenarioToNextStudyWeek(scenario) {
  advanceScenarioWeek(scenario)
  normalizeScenarioWeek(scenario)
}

function finishScenarioMonthTransition() {
  if (!state.scenario) {
    return
  }

  state.scenario.incoming = false
  state.scenario.locked = false
  render()
}

function startScenarioMonthTransition() {
  if (!state.scenario) {
    return
  }

  const monthWaveDuration = getScenarioWaveTotal(state.scenario.visibleDays.length)
  state.scenario.locked = true
  state.scenario.rolling = true
  state.scenario.incoming = false
  render()

  scenarioRollTimer = window.setTimeout(() => {
    if (!state.scenario) {
      return
    }

    moveScenarioToNextStudyWeek(state.scenario)
    state.scenario.rolling = false
    state.scenario.incoming = true
    render()

    scenarioIncomingTimer = window.setTimeout(finishScenarioMonthTransition, monthWaveDuration)
  }, monthWaveDuration)
}

function createScenarioState() {
  const remainingPages = Math.max(TOTAL_CELLS - state.filledCount, 0)
  const initialHam = shouldReuseScenarioHam() ? state.preferredScenarioHam : 1
  const today = startOfDay(new Date())
  const monthView = getScenarioMonthView(today)
  const activeWeekIndex = monthView.visibleDays.find((day) => day.dateKey === toDateKey(today))?.weekIndex ?? 0
  const startDateKey = toDateKey(today)
  const scenario = {
    initialRemaining: remainingPages,
    greensEarned: 0,
    redsAdded: 0,
    entries: [],
    complete: remainingPages === 0,
    currentEndDate: getProjectedEndDate(remainingPages, state.spentStudyDays),
    completedEndDate: null,
    previousEndDate: null,
    dateWidthReference: null,
    dateVersion: 0,
    currentHam: initialHam,
    virtualPace: state.pace,
    virtualCount: state.filledCount,
    virtualJuz: state.juz,
    shouldBlackenNextLesson: false,
    repeatGrayCount: 0,
    startDateKey,
    startMonthStartKey: monthView.monthStartKey,
    startWeekIndex: activeWeekIndex,
    monthStartKey: monthView.monthStartKey,
    weekCount: monthView.weekCount,
    activeWeekIndex,
    visibleDays: monthView.visibleDays,
    windowResults: {},
    animatedResultKeys: [],
    modalOpen: !shouldReuseScenarioHam(),
    modalContext: shouldReuseScenarioHam() ? null : 'initial',
    boundaryReached: false,
    locked: false,
    filling: false,
    rolling: false,
    incoming: false,
  }

  normalizeScenarioWeek(scenario)
  return scenario
}

function getScenarioFillTotal(dayCount) {
  return SCENARIO_FILL_DURATION + (SCENARIO_FILL_DELAY_STEP * Math.max(dayCount - 1, 0))
}

function getScenarioRevealDuration(dayCount) {
  return getScenarioFillTotal(dayCount) + SCENARIO_POST_FILL_HOLD
}

function getScenarioWaveTotal(dayCount) {
  return SCENARIO_WAVE_DURATION + (SCENARIO_WAVE_DELAY_STEP * Math.max(dayCount - 1, 0))
}

function shuffleArray(values) {
  const array = [...values]

  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[array[index], array[swapIndex]] = [array[swapIndex], array[index]]
  }

  return array
}

function setScenarioDateTransition(nextDate) {
  if (!state.scenario) {
    return
  }

  if (scenarioDateTimer) {
    window.clearTimeout(scenarioDateTimer)
    scenarioDateTimer = null
  }

  const scenario = state.scenario
  scenario.dateWidthReference = scenario.currentEndDate
  scenario.previousEndDate = scenario.currentEndDate
  scenario.currentEndDate = nextDate
  scenario.dateVersion += 1
  setForecastEndDate(nextDate)

  scenarioDateTimer = window.setTimeout(() => {
    if (!state.scenario) {
      return
    }

    state.scenario.previousEndDate = null

    if (state.scenario.filling || state.scenario.incoming) {
      return
    }

    render()
  }, 520)
}

function openScenarioView() {
  clearScenarioTimers()
  state.scenario = createScenarioState()
  state.view = 'scenario'
  render()
}

function applyScenarioChoice(selectedGreenCount) {
  const scenario = state.scenario

  if (!scenario || scenario.complete || scenario.locked) {
    return
  }

  const isRepeatMode = scenario.currentHam === 'repeat'
  const activeWeekDays = getActiveScenarioWeekDays(scenario)
  const visibleStudyDays = activeWeekDays.filter(
    (day) => day.isCurrentMonth
      && !day.isHoliday
      && !isScenarioPastStartDay(scenario, day)
      && !scenario.windowResults[day.dateKey],
  )
  const weekdayStudyDays = visibleStudyDays.filter((day) => !day.isSunday)
  const sundayStudyDays = visibleStudyDays.filter((day) => day.isSunday)
  const boundarySelectableChoice = getMaxScenarioChoice(scenario.virtualJuz)
  const maxSelectableChoice = getScenarioWeekMaxChoice(scenario)
  const remainingChoicesToCompletion = getScenarioCompletionChoiceLimit(scenario)
  const actualGreens = Math.min(selectedGreenCount, remainingChoicesToCompletion, maxSelectableChoice, visibleStudyDays.length)
  const boundaryLimitedWeek = boundarySelectableChoice < visibleStudyDays.length
    || remainingChoicesToCompletion < visibleStudyDays.length
  const prioritizedStudyDays = [
    ...(boundaryLimitedWeek && actualGreens === maxSelectableChoice
      ? weekdayStudyDays
      : shuffleArray(weekdayStudyDays)),
    ...sundayStudyDays,
  ]
  const selectedSuccessDateKeys = new Set(
    prioritizedStudyDays.slice(0, actualGreens).map((day) => day.dateKey),
  )
  const beforeFilledCount = projectScenarioOutcome().filledCount
  const beforeVirtualJuz = scenario.virtualJuz
  const displayedEndDateBeforeChoice = scenario.currentEndDate
    ?? estimateProjectedEndDate(Math.max(TOTAL_CELLS - beforeFilledCount, 0), state.spentStudyDays)
  const animatedResultKeys = []
  let boundaryReachedDuringWeek = false
  let studyIndex = 0

  activeWeekDays.forEach((day) => {
    if (boundaryReachedDuringWeek) {
      return
    }

    if (!day.isCurrentMonth) {
      return
    }

    if (isScenarioPastStartDay(scenario, day)) {
      return
    }

    if (scenario.windowResults[day.dateKey]) {
      return
    }

    if (day.isHoliday || (day.isSunday && !selectedSuccessDateKeys.has(day.dateKey))) {
      const closedEntry = createScenarioClosedEntry(day)
      scenario.entries.push(closedEntry)
      scenario.windowResults[day.dateKey] = closedEntry
      return
    }

    const entryType = selectedSuccessDateKeys.has(day.dateKey) ? 'success' : 'red'
    const gain = entryType === 'success'
      ? Math.min(
          isRepeatMode ? 1 : scenario.currentHam,
          Math.max(TOTAL_CELLS - scenario.virtualCount, 0),
        )
      : 0
    const scenarioEntry = {
      type: entryType,
      dateKey: day.dateKey,
      hamLevel: scenario.currentHam,
      gain,
      isSundayStudy: day.isSunday && entryType === 'success',
      blackFill: false,
    }

    if (entryType === 'success' && scenario.shouldBlackenNextLesson) {
      scenarioEntry.blackFill = true
      scenario.shouldBlackenNextLesson = false
    }

    scenario.entries.push(scenarioEntry)
    scenario.windowResults[day.dateKey] = scenarioEntry
    animatedResultKeys.push(day.dateKey)

    if (entryType === 'success' && gain > 0) {
      const previousVirtualJuz = scenario.virtualJuz
      if (!isRepeatMode) {
        scenario.virtualCount = Math.min(scenario.virtualCount + gain, TOTAL_CELLS)
      }
      scenario.virtualJuz = Math.min(scenario.virtualJuz + 1, COLUMNS)

      if (isRepeatMode) {
        scenario.repeatGrayCount += 1
      } else {
        scenario.greensEarned += gain
      }
      if (didCompleteScenarioJuz(previousVirtualJuz, scenario.virtualJuz) || scenario.virtualCount >= TOTAL_CELLS) {
        boundaryReachedDuringWeek = true
      }
    } else {
      if (!isRepeatMode) {
        scenario.redsAdded += 1
      }
    }

    studyIndex += 1
  })

  const virtualBoundaryReached = didCompleteScenarioJuz(beforeVirtualJuz, scenario.virtualJuz)

  if (isRepeatMode && virtualBoundaryReached && scenario.repeatGrayCount > 0) {
    scenario.entries.push({
      type: 'repeat-summary',
      count: scenario.repeatGrayCount,
    })
    scenario.repeatGrayCount = 0
  }

  const afterProjection = projectScenarioOutcome()
  scenario.complete = afterProjection.filledCount >= TOTAL_CELLS
  scenario.completedEndDate = scenario.complete ? displayedEndDateBeforeChoice : null
  if (scenario.complete) {
    setForecastEndDate(displayedEndDateBeforeChoice)
  }
  scenario.animatedResultKeys = animatedResultKeys
  scenario.locked = true
  scenario.filling = true
  scenario.boundaryReached = virtualBoundaryReached
  scenario.incoming = false

  const revealDuration = getScenarioRevealDuration(activeWeekDays.length)

  if (!scenario.complete) {
    const nextEndDate = estimateProjectedEndDate(
      Math.max(TOTAL_CELLS - afterProjection.filledCount, 0),
      afterProjection.spentStudyDays,
    )
    setScenarioDateTransition(nextEndDate)
  }
  render()

  scenarioRevealTimer = window.setTimeout(() => {
    if (!state.scenario) {
      return
    }

    state.scenario.filling = false
    state.scenario.animatedResultKeys = []
    if (state.scenario.complete) {
      commitScenarioToMain()
      return
    }

    if (state.scenario.boundaryReached) {
      state.preferredScenarioHam = null
      state.scenario.modalOpen = true
      state.scenario.modalContext = 'boundary'
      state.scenario.boundaryReached = false
      state.scenario.locked = false
      render()
      return
    }

    if (hasRemainingStudyWeekInWindow(state.scenario)) {
      moveScenarioToNextStudyWeek(state.scenario)
      state.scenario.locked = false
      render()
      return
    }

    startScenarioMonthTransition()
  }, revealDuration)
}

function commitScenarioToMain() {
  clearScenarioTimers()
  const previousFilledCount = state.filledCount
  const previousDisplayEndDate = getProjectedEndDate(TOTAL_CELLS - previousFilledCount, state.spentStudyDays)
  const projected = projectScenarioOutcome()
  const displayEndDate = state.scenario?.completedEndDate
    ?? state.scenario?.currentEndDate
    ?? previousDisplayEndDate

  state.filledCount = projected.filledCount
  state.pace = projected.pace
  state.juz = projected.juz
  state.committedMarks = projected.marks
    .filter((mark) => mark.progressIndex > state.baselineCount && mark.progressIndex <= projected.filledCount)
    .slice(-320)
  state.carryRedCount = projected.pendingRedCount
  state.spentStudyDays = projected.spentStudyDays
  state.scenario = null
  state.view = 'main'
  state.animate = false
  setForecastEndDate(displayEndDate)
  syncCompletionState(previousFilledCount, state.filledCount, displayEndDate)
  persistState()
  render()
}

function projectScenarioOutcome() {
  const scenario = state.scenario

  if (!scenario) {
    return {
      filledCount: state.filledCount,
      baselineCount: state.baselineCount,
      marks: state.committedMarks,
      pace: state.pace,
      juz: state.juz,
      pendingRedCount: state.carryRedCount,
      spentStudyDays: state.spentStudyDays,
    }
  }

  let nextFilledCount = state.filledCount
  let pendingRedCount = state.carryRedCount
  let spentStudyDays = state.spentStudyDays
  const nextMarks = [...state.committedMarks]
  scenario.entries.forEach((entry) => {
    if (entry.type === 'repeat-summary') {
      return
    }

    if (entry.type === 'red') {
      pendingRedCount += 1
      spentStudyDays += 1
      return
    }

    if (entry.type !== 'success') {
      return
    }

    spentStudyDays += 1

    if (entry.hamLevel === 'repeat') {
      return
    }

    const hamConfig = getHamConfig(entry.hamLevel)
    const fillClass = entry.blackFill
      ? 'cell-fill-black'
      : (pendingRedCount > 0 ? hamConfig.penaltyFillClass : hamConfig.mainFillClass)
    const labelValue = entry.blackFill ? null : (pendingRedCount > 0 ? pendingRedCount : null)
    const gain = entry.gain ?? (entry.hamLevel === 'repeat' ? 1 : entry.hamLevel)

    for (let repeat = 0; repeat < gain; repeat += 1) {
      nextFilledCount = Math.min(nextFilledCount + 1, TOTAL_CELLS)
      nextMarks.push({
        progressIndex: nextFilledCount,
        badgeValue: labelValue,
        fillClass,
      })
    }

    pendingRedCount = 0
  })

  const progress = filledCountToProgress(nextFilledCount)

  return {
    filledCount: nextFilledCount,
    baselineCount: state.baselineCount,
    marks: nextMarks.filter((mark) => mark.progressIndex <= nextFilledCount),
    pace: scenario.virtualPace,
    juz: scenario.virtualJuz,
    pendingRedCount,
    spentStudyDays,
  }
}

function clearScenarioTimers() {
  if (scenarioDateTimer) {
    window.clearTimeout(scenarioDateTimer)
    scenarioDateTimer = null
  }

  if (scenarioRevealTimer) {
    window.clearTimeout(scenarioRevealTimer)
    scenarioRevealTimer = null
  }

  if (scenarioRollTimer) {
    window.clearTimeout(scenarioRollTimer)
    scenarioRollTimer = null
  }

  if (scenarioIncomingTimer) {
    window.clearTimeout(scenarioIncomingTimer)
    scenarioIncomingTimer = null
  }
}

function applyHamSelection(nextHamLevel) {
  if (!state.scenario) {
    return
  }

  const hamLevel = nextHamLevel === 'repeat' ? 'repeat' : nextHamLevel
  const modalContext = state.scenario.modalContext
  const maxBoundaryHam = getScenarioBoundarySelectableHamLimit(state.scenario)

  if (modalContext === 'boundary' && hamLevel !== 'repeat' && hamLevel > maxBoundaryHam) {
    return
  }

  const wasRepeatMode = state.scenario.currentHam === 'repeat'
  state.scenario.currentHam = hamLevel
  if (modalContext === 'boundary' && hamLevel !== 'repeat') {
    state.scenario.virtualPace += hamLevel
  }
  if (modalContext === 'boundary' && wasRepeatMode && hamLevel !== 'repeat') {
    state.scenario.shouldBlackenNextLesson = true
  }
  state.scenario.modalOpen = false
  state.scenario.modalContext = null
  state.scenario.locked = true
  state.preferredScenarioHam = hamLevel

  if (modalContext === 'initial') {
    state.scenario.locked = false
    render()
    return
  }

  state.scenario.virtualJuz = 0

  if (getScenarioWeekRemainingStudyCount(state.scenario) > 0) {
    state.scenario.locked = false
    render()
    return
  }

  if (hasRemainingStudyWeekInWindow(state.scenario)) {
    moveScenarioToNextStudyWeek(state.scenario)
    state.scenario.locked = false
    render()
    return
  }

  startScenarioMonthTransition()
}

export function render() {
  if (state.view === 'scenario') {
    renderScenarioView()
    return
  }

  renderMainView()
}

export function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      pace: state.pace,
      juz: state.juz,
      inputPace: state.inputPace,
      inputJuz: state.inputJuz,
      inputHamCount: state.inputHamCount,
      filledCount: state.filledCount,
      baselineCount: state.baselineCount,
      committedMarks: state.committedMarks,
      carryRedCount: state.carryRedCount,
      spentStudyDays: state.spentStudyDays,
      forecastEndDateKey: state.forecastEndDateKey,
      completionDateKey: state.completionDateKey,
      preferredScenarioHam: state.preferredScenarioHam,
    }),
  )
}

export {
  ROWS,
  COLUMNS,
  TOTAL_CELLS,
  HAM_OPTIONS,
  WEEKDAY_LABELS,
  app,
  state,
  applyHamSelection,
  applyScenarioChoice,
  calculateFilledCount,
  clampNumber,
  closeCompletionModal,
  commitScenarioToMain,
  createScenarioClosedEntry,
  createScenarioState,
  estimateProjectedEndDate,
  estimateCompletion,
  formatDate,
  formatMonthYear,
  getCellState,
  getFillSequenceIndex,
  getHamSelectionLabel,
  getHamSelectionNumericValue,
  getMarkMap,
  getProjectedEndDate,
  getScenarioVisual,
  getScenarioWeekMaxChoice,
  getScenarioBoundaryHamLimit,
  getScenarioBoundarySelectableHamLimit,
  doesScenarioChoiceIncludeSunday,
  isScenarioPastStartDay,
  openScenarioView,
  parseDateKey,
  projectScenarioOutcome,
  renderCompletionModal,
  renderScenarioDate,
  shiftHamSelection,
  setForecastEndDate,
  syncCompletionState,
  triggerApplyButtonValidationError,
}

if (savedState.filledCount == null) {
  state.filledCount = calculateFilledCount(state.pace, state.juz, state.inputHamCount)
  state.baselineCount = state.filledCount
}

render()
