import { getHolidaySet as getHolidaySetFromData } from './holiday-data.js'

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
const MAIN_MIRROR_FILL_DURATION = 520
const MAIN_MIRROR_HOLD = 90
const MAIN_MIRROR_BASE_DELAY_STEP = 10
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

localStorage.removeItem(STORAGE_KEY)
const savedState = {}
const savedHistory = savedState.history ?? {}
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

const defaultHistoryStartDateKey = typeof savedHistory.startDateKey === 'string' ? savedHistory.startDateKey : null
const defaultHistoryInputHamCount = getHistoryCurrentHamValue(savedHistory.inputHamCount ?? savedState.inputHamCount ?? 1)
const savedCompletedScenarioView = savedState.completedScenarioView && typeof savedState.completedScenarioView === 'object'
  ? {
      entries: Array.isArray(savedState.completedScenarioView.entries)
        ? savedState.completedScenarioView.entries.map((entry) => ({
            type: entry.type,
            dateKey: String(entry.dateKey ?? ''),
            hamLevel: entry.hamLevel === 'repeat' ? 'repeat' : clampNumber(entry.hamLevel ?? 1, 1, 5),
            gain: clampNumber(entry.gain ?? 0, 0, 5),
            isSundayStudy: entry.isSundayStudy === true,
            isHolidayStudy: entry.isHolidayStudy === true,
            blackFill: entry.blackFill === true,
          })).filter((entry) => entry.dateKey)
        : [],
      startDateKey: typeof savedState.completedScenarioView.startDateKey === 'string' ? savedState.completedScenarioView.startDateKey : null,
      startMonthStartKey: typeof savedState.completedScenarioView.startMonthStartKey === 'string' ? savedState.completedScenarioView.startMonthStartKey : null,
      finalMonthStartKey: typeof savedState.completedScenarioView.finalMonthStartKey === 'string' ? savedState.completedScenarioView.finalMonthStartKey : null,
      completedEndDateKey: typeof savedState.completedScenarioView.completedEndDateKey === 'string' ? savedState.completedScenarioView.completedEndDateKey : null,
      mode: savedState.completedScenarioView.mode === 'monthly'
        ? 'monthly'
        : (savedState.completedScenarioView.mode === 'annual' ? 'annual' : 'weekly'),
      selectedWeeklyLessonCount: savedState.completedScenarioView.selectedWeeklyLessonCount == null
        ? null
        : clampNumber(savedState.completedScenarioView.selectedWeeklyLessonCount, 0, 7),
      includeSundayStudy: savedState.completedScenarioView.includeSundayStudy === true,
      includeHolidayStudy: savedState.completedScenarioView.includeHolidayStudy === true,
    }
  : null

const state = {
  mainDataApplied: savedState.mainDataApplied === true,
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
  closedStudyDays: clampNumber(savedState.closedStudyDays ?? 0, 0, 9999),
  view: 'main',
  scenario: null,
  forecastEndDateKey: typeof savedState.forecastEndDateKey === 'string' ? savedState.forecastEndDateKey : null,
  completionDateKey: typeof savedState.completionDateKey === 'string' ? savedState.completionDateKey : null,
  completionModalOpen: false,
  preferredScenarioHam: savedState.preferredScenarioHam === 'repeat'
    ? 'repeat'
    : (savedState.preferredScenarioHam != null ? clampNumber(savedState.preferredScenarioHam, 1, 5) : null),
  preferredScenarioMode: savedState.preferredScenarioMode === 'monthly'
    ? 'monthly'
    : (savedState.preferredScenarioMode === 'weekly' ? 'weekly' : null),
  preferredScenarioLessonCount: savedState.preferredScenarioLessonCount == null
    ? null
    : clampNumber(savedState.preferredScenarioLessonCount, 0, 7),
  preferredScenarioSundayEnabled: savedState.preferredScenarioSundayEnabled === true,
  preferredScenarioHolidayEnabled: savedState.preferredScenarioHolidayEnabled === true,
  completedScenarioView: savedCompletedScenarioView,
  history: {
    inputPace: clampNumber(
      savedHistory.inputPace ?? savedState.inputPace ?? savedState.pace ?? 1,
      0,
      ROWS,
    ),
    inputJuz: clampNumber(
      savedHistory.inputJuz ?? savedState.inputJuz ?? savedState.juz ?? 0,
      0,
      COLUMNS,
    ),
    inputHamCount: defaultHistoryInputHamCount,
    startDateKey: defaultHistoryStartDateKey,
    startDateText: typeof savedHistory.startDateText === 'string'
      ? savedHistory.startDateText
      : formatDateInputText(defaultHistoryStartDateKey),
    phaseCounts: normalizeHistoryPhaseCounts(savedHistory.phaseCounts),
    activeYear: clampNumber(
      savedHistory.activeYear ?? (defaultHistoryStartDateKey ? parseDateKey(defaultHistoryStartDateKey).getFullYear() : new Date().getFullYear()),
      1900,
      3000,
    ),
    reportReady: savedHistory.reportReady === true,
    reportAttempted: savedHistory.reportAttempted === true,
    reportBasis: savedHistory.reportBasis && typeof savedHistory.reportBasis === 'object'
      ? {
          pace: clampNumber(savedHistory.reportBasis.pace ?? 1, 0, ROWS),
          juz: clampNumber(savedHistory.reportBasis.juz ?? 0, 0, COLUMNS),
          hamCount: normalizeHamSelection(savedHistory.reportBasis.hamCount ?? 1),
        }
      : null,
  },
}

const listeners = new Set()
let scenarioDateTimer = null
let scenarioRevealTimer = null
let scenarioRollTimer = null
let scenarioIncomingTimer = null
let scenarioAutoTimer = null

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

function normalizeHistoryPhaseCounts(value) {
  return {
    2: clampNumber(value?.[2] ?? value?.two ?? 0, 0, 20),
    3: clampNumber(value?.[3] ?? value?.three ?? 0, 0, 20),
    4: clampNumber(value?.[4] ?? value?.four ?? 0, 0, 20),
    5: clampNumber(value?.[5] ?? value?.five ?? 0, 0, 20),
  }
}

function getHistoryCurrentHamValue(value) {
  const normalized = normalizeHamSelection(value, 1)
  return normalized === 'repeat' ? 1 : normalized
}

function formatDateInputText(dateKey) {
  if (!dateKey) {
    return ''
  }

  const date = parseDateKey(dateKey)
  return `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}/${date.getFullYear()}`
}

function parseDateInputText(text) {
  const normalized = String(text ?? '').replace(/[^\d/]/g, '').trim()
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!match) {
    return null
  }

  const [, dayText, monthText, yearText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const candidate = new Date(year, month - 1, day)

  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    return null
  }

  return toDateKey(candidate)
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
  return {
    day: padNumber(date.getDate()),
    month: padNumber(date.getMonth() + 1),
    year: String(date.getFullYear()),
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
      ${renderStaticPart(current.day, [current.day])}
      <span class="scenario-date-separator">.</span>
      ${renderStaticPart(current.month, [current.month, widthReference?.month, '12'])}
      <span class="scenario-date-separator">.</span>
      ${renderStaticPart(current.year, [current.year])}
    `
  }

  const previous = getDateParts(previousDate)

  return ['day', 'month', 'year']
    .map((key, index) => {
      const separator = index < 2 ? '<span class="scenario-date-separator">.</span>' : ''
      const sizeValues = key === 'month'
        ? [current[key], previous[key], widthReference?.[key], '12']
        : [current[key], previous[key]]

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

function estimateProjectedEndDate(remainingPages, spentStudyDays, closedStudyDays = state.closedStudyDays) {
  return estimateCompletion(Math.max(remainingPages, 0), spentStudyDays, closedStudyDays).endDate
}

function setForecastEndDate(date) {
  state.forecastEndDateKey = date ? toDateKey(startOfDay(date)) : null
}

function getProjectedEndDate(
  remainingPages,
  spentStudyDays,
  closedStudyDays = state.closedStudyDays,
  forecastDateKey = state.forecastEndDateKey,
  completionDateKey = state.completionDateKey,
) {
  if (remainingPages <= 0 && completionDateKey) {
    return parseDateKey(completionDateKey)
  }

  if (forecastDateKey) {
    return parseDateKey(forecastDateKey)
  }

  return estimateProjectedEndDate(remainingPages, spentStudyDays, closedStudyDays)
}

function shouldReuseScenarioHam(filledCount = state.filledCount, preferredScenarioHam = state.preferredScenarioHam) {
  return filledCount < TOTAL_CELLS && preferredScenarioHam != null
}

function canOpenScenarioView() {
  return state.mainDataApplied || (
    state.filledCount === 0
    && state.baselineCount === 0
    && state.pace === 0
    && state.juz === 0
  )
}

function shouldReuseScenarioConfiguration() {
  if (!shouldReuseScenarioHam()) {
    return false
  }

  const preferredMode = state.preferredScenarioMode ?? 'weekly'

  if (preferredMode === 'weekly') {
    return true
  }

  return state.preferredScenarioLessonCount != null
}

function isScenarioStudyEligible(scenario, day) {
  if (!day.isCurrentMonth || isScenarioPastStartDay(scenario, day)) {
    return false
  }

  if (day.isSunday && !scenario.includeSundayStudy) {
    return false
  }

  if (day.isHoliday && !scenario.includeHolidayStudy) {
    return false
  }

  return true
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
    state.preferredScenarioMode = null
    state.preferredScenarioLessonCount = null
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

function getHolidaySet(year) {
  return getHolidaySetFromData(year)
}

function isNonStudyDay(date, holidaySet) {
  return date.getDay() === 0 || holidaySet.has(toDateKey(date))
}

function estimateCompletion(remainingPages, spentStudyDays = 0, closedStudyDays = 0) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const pastStudyDaysNeeded = Math.max(spentStudyDays, 0)
  const futureStudyDaysNeeded = Math.max(remainingPages, 0)
  const totalStudyDaysNeeded = pastStudyDaysNeeded + futureStudyDaysNeeded

  if (totalStudyDaysNeeded === 0) {
    return {
      endDate: start,
      extraDays: 0,
      sundays: 0,
      holidays: 0,
    }
  }

  let cursor = start
  let pastStudyDaysLeft = pastStudyDaysNeeded
  let futureStudyDaysLeft = futureStudyDaysNeeded
  let remainingClosedStudyDays = Math.min(Math.max(closedStudyDays, 0), pastStudyDaysNeeded)
  let sundays = 0
  let holidays = 0

  while (pastStudyDaysLeft > 0 || futureStudyDaysLeft > 0) {
    const holidaySet = getHolidaySet(cursor.getFullYear())
    const closedDay = isNonStudyDay(cursor, holidaySet)

    if (pastStudyDaysLeft > 0) {
      if (!closedDay) {
        pastStudyDaysLeft -= 1
      } else if (remainingClosedStudyDays > 0) {
        remainingClosedStudyDays -= 1
        pastStudyDaysLeft -= 1
      } else {
        if (cursor.getDay() === 0) {
          sundays += 1
        } else {
          holidays += 1
        }
      }
    } else {
      if (!closedDay) {
        futureStudyDaysLeft -= 1
      } else if (cursor.getDay() === 0) {
        sundays += 1
      } else {
        holidays += 1
      }
    }

    if (pastStudyDaysLeft > 0 || futureStudyDaysLeft > 0) {
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

function isScenarioOptionalStudyDay(scenario, day) {
  return (day.isSunday && scenario.includeSundayStudy) || (day.isHoliday && scenario.includeHolidayStudy)
}

function getScenarioOrderedStudyDays(scenario) {
  const remainingDays = getActiveScenarioWeekDays(scenario)
    .filter((day) => isScenarioStudyEligible(scenario, day) && !scenario.windowResults[day.dateKey])

  const regularDays = remainingDays.filter((day) => !isScenarioOptionalStudyDay(scenario, day))
  const optionalDays = remainingDays.filter((day) => isScenarioOptionalStudyDay(scenario, day))

  return {
    regularDays,
    optionalDays,
    orderedDays: [...regularDays, ...optionalDays],
  }
}

function isScenarioPastStartDay(scenario, day) {
  return day.isCurrentMonth
    && scenario.monthStartKey === scenario.startMonthStartKey
    && day.weekIndex === scenario.startWeekIndex
    && day.dateKey < scenario.startDateKey
}

function getScenarioWeekStudyCount(scenario, weekIndex = scenario.activeWeekIndex) {
  return scenario.visibleDays.filter(
    (day) => day.weekIndex === weekIndex && isScenarioStudyEligible(scenario, day),
  ).length
}

function getScenarioWeekRemainingStudyCount(scenario, weekIndex = scenario.activeWeekIndex) {
  return scenario.visibleDays.filter(
    (day) => (
      day.weekIndex === weekIndex
      && isScenarioStudyEligible(scenario, day)
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
  return getScenarioChoiceHint(scenario, choice) === 'Pazar'
}

function getScenarioChoiceHint(scenario, choice) {
  if (choice <= 0) {
    return ''
  }

  const selectedDay = getScenarioOrderedStudyDays(scenario).orderedDays[choice - 1]

  if (!selectedDay) {
    return ''
  }

  if (selectedDay.isSunday) {
    return 'Pazar'
  }

  if (selectedDay.isHoliday) {
    return 'Tatil'
  }

  return ''
}

function createScenarioClosedEntry(day) {
  if (day.isSunday) {
    return {
      type: 'sunday',
      dateKey: day.dateKey,
    }
  }

  return {
    type: 'holiday',
    dateKey: day.dateKey,
  }
}

function advanceScenarioWeek(scenario) {
  if (scenario.activeWeekIndex < scenario.weekCount - 1) {
    scenario.activeWeekIndex += 1
    return
  }

  const previousMonthStartKey = scenario.monthStartKey
  const nextMonthView = getScenarioMonthView(addMonths(parseDateKey(scenario.monthStartKey), 1))
  scenario.monthStartKey = nextMonthView.monthStartKey
  scenario.weekCount = nextMonthView.weekCount
  scenario.activeWeekIndex = 0
  scenario.visibleDays = nextMonthView.visibleDays
  scenario.windowResults = {}

  if (!scenario.viewMonthStartKey || scenario.viewMonthStartKey === previousMonthStartKey) {
    scenario.viewMonthStartKey = nextMonthView.monthStartKey
  }
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

function createAnnualPhaseId() {
  return `annual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getAnnualPlanLastPace(scenario) {
  const lastPhase = [...(scenario.annualPhasePlan ?? [])].reverse().find((phase) => phase.status !== 'removed')
  return lastPhase ? lastPhase.paceAfter : scenario.virtualPace
}

function getAnnualPhasePaceAfter(basePace, ham) {
  return ham === 'repeat'
    ? basePace
    : Math.min(ROWS, basePace + getHamSelectionNumericValue(ham))
}

function simulateAnnualPhasePlan(scenario) {
  const phases = scenario?.annualPhasePlan ?? []
  let virtualCount = scenario?.virtualCount ?? state.filledCount
  let virtualJuz = scenario?.virtualJuz ?? state.juz
  let runningPace = scenario?.virtualPace ?? state.pace
  let hasProgressPlan = false
  const startVirtualJuz = virtualJuz
  let isFirstPendingPhase = true

  const normalizedPhases = phases.map((phase) => {
    const ham = normalizeHamSelection(phase.ham)
    const weeklyLessonCount = clampNumber(phase.weeklyLessonCount ?? 0, 0, scenario?.includeSundayStudy ? 7 : 6)
    // For the first pending phase when juz > 0 (mid-boundary), don't increase pace
    const paceAfter = phase.status === 'consumed'
      ? phase.paceAfter
      : (isFirstPendingPhase && startVirtualJuz > 0 && startVirtualJuz < COLUMNS
        ? runningPace
        : getAnnualPhasePaceAfter(runningPace, ham))

    if (phase.status === 'pending' && weeklyLessonCount > 0) {
      hasProgressPlan = true
      isFirstPendingPhase = false

      const remainingLessonsToBoundary = Math.max(COLUMNS - virtualJuz, 0) || COLUMNS

      if (ham !== 'repeat') {
        const remainingMainCells = Math.max(TOTAL_CELLS - virtualCount, 0)
        const lessonsToCompletion = Math.ceil(remainingMainCells / getHamSelectionNumericValue(ham))
        const lessonsApplied = Math.min(remainingLessonsToBoundary, lessonsToCompletion)
        virtualCount = Math.min(virtualCount + (lessonsApplied * getHamSelectionNumericValue(ham)), TOTAL_CELLS)
        virtualJuz = virtualCount >= TOTAL_CELLS
          ? Math.min(virtualJuz + lessonsApplied, COLUMNS)
          : 0
      } else {
        virtualJuz = 0
      }

      runningPace = paceAfter
    } else if (phase.status === 'consumed') {
      runningPace = phase.paceAfter
      isFirstPendingPhase = true // reset for next pending phase after consumed
    }

    return {
      ...phase,
      ham,
      weeklyLessonCount,
      paceAfter,
      status: phase.status === 'consumed' ? 'consumed' : 'pending',
    }
  })

  return {
    phases: normalizedPhases,
    completesScenario: virtualCount >= TOTAL_CELLS,
    hasProgressPlan,
    finalVirtualCount: virtualCount,
    finalVirtualJuz: virtualJuz,
    finalVirtualPace: runningPace,
  }
}

function syncAnnualPhasePlan(scenario) {
  if (!scenario) {
    return
  }

  const simulation = simulateAnnualPhasePlan(scenario)
  scenario.annualPhasePlan = simulation.phases
}

function canAddAnnualPhase(scenario) {
  if (!scenario || scenario.mode !== 'annual') {
    return false
  }

  const ham = scenario.annualDraftHam
  const weeklyLessonCount = scenario.annualDraftWeeklyLessonCount

  if (ham == null || weeklyLessonCount == null) {
    return false
  }

  if (weeklyLessonCount <= 0) {
    return false
  }

  const basePace = getAnnualPlanLastPace(scenario)
  const isFirstPendingPhase = scenario.annualPhasePlan.filter(p => p.status !== 'removed').length === 0
  const isMidBoundary = (scenario.virtualJuz ?? state.juz) > 0 && (scenario.virtualJuz ?? state.juz) < COLUMNS

  if (ham !== 'repeat' && !(isFirstPendingPhase && isMidBoundary)) {
    const nextPace = getAnnualPhasePaceAfter(basePace, ham)
    if (nextPace > ROWS) {
      return false
    }
  }

  const annualSimulation = simulateAnnualPhasePlan(scenario)
  const remainingCount = Math.max(TOTAL_CELLS - annualSimulation.finalVirtualCount, 0)

  if (remainingCount <= 0) {
    return false
  }

  return ham === 'repeat' || ham <= getScenarioBoundarySelectableHamLimit({
    virtualCount: annualSimulation.finalVirtualCount,
    virtualPace: annualSimulation.finalVirtualPace,
  })
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

function getScenarioAnimationProfile(scenario) {
  if (scenario?.mode === 'monthly' && scenario?.monthlyAutoRunning) {
    const monthlyFullWeekCount = scenario.includeSundayStudy ? 7 : 6

    if (scenario.selectedWeeklyLessonCount === monthlyFullWeekCount) {
      return {
        fillDelayStep: 44,
        fillDuration: 340,
        postFillHold: 120,
        waveDelayStep: 10,
        waveDuration: 300,
        autoDelay: 110,
      }
    }

    return {
      fillDelayStep: 44,
      fillDuration: 340,
      postFillHold: 150,
      waveDelayStep: 10,
      waveDuration: 300,
      autoDelay: 140,
    }
  }

  if (scenario?.mode === 'annual' && scenario?.annualAutoRunning) {
    return {
      fillDelayStep: 44,
      fillDuration: 340,
      postFillHold: 150,
      waveDelayStep: 10,
      waveDuration: 300,
      autoDelay: 100,
    }
  }

  return {
    fillDelayStep: SCENARIO_FILL_DELAY_STEP,
    fillDuration: SCENARIO_FILL_DURATION,
    postFillHold: SCENARIO_POST_FILL_HOLD,
    waveDelayStep: SCENARIO_WAVE_DELAY_STEP,
    waveDuration: SCENARIO_WAVE_DURATION,
    autoDelay: 0,
  }
}

function openScenarioModal(step, boundary = false) {
  if (!state.scenario) {
    return
  }

  if (scenarioAutoTimer) {
    window.clearTimeout(scenarioAutoTimer)
    scenarioAutoTimer = null
  }

  state.scenario.modalOpen = true
  state.scenario.modalBoundary = boundary
  state.scenario.modalStep = boundary && state.scenario.mode === 'monthly' ? 'monthly-ham' : step

  if (boundary) {
    state.scenario.modalHamSelection = null
    state.scenario.modalLessonSelection = null
  } else {
    state.scenario.modalHamSelection = state.scenario.currentHam
    state.scenario.modalLessonSelection = state.scenario.mode === 'monthly'
      ? state.scenario.selectedWeeklyLessonCount
      : null
  }
  state.scenario.monthlyAutoRunning = false
  state.scenario.locked = false
}

function scheduleScenarioAutoRun() {
  const scenario = state.scenario

  if (
    !scenario
    || scenario.modalOpen
    || scenario.locked
    || scenario.complete
    || scenario.filling
    || scenario.rolling
    || scenario.incoming
  ) {
    return
  }

  const isMonthlyAuto = scenario.mode === 'monthly' && scenario.monthlyAutoRunning
  const isAnnualAuto = scenario.mode === 'annual' && scenario.annualAutoRunning

  if (!isMonthlyAuto && !isAnnualAuto) {
    return
  }

  if (isMonthlyAuto) {
    if (
      scenario.selectedWeeklyLessonCount == null
      || scenario.selectedWeeklyLessonCount <= 0
      || getScenarioWeekRemainingStudyCount(scenario) <= 0
    ) {
      return
    }
  }

  if (scenarioAutoTimer) {
    return
  }

  scenarioAutoTimer = window.setTimeout(() => {
    scenarioAutoTimer = null

    if (!state.scenario) return

    if (state.scenario.mode === 'monthly' && state.scenario.monthlyAutoRunning) {
      applyScenarioChoice(state.scenario.selectedWeeklyLessonCount)
    } else if (state.scenario.mode === 'annual' && state.scenario.annualAutoRunning) {
      stepAnnualScenarioMonth()
    }
  }, getScenarioAnimationProfile(scenario).autoDelay)
}

function finishScenarioMonthTransition() {
  if (!state.scenario) {
    return
  }

  state.scenario.incoming = false
  state.scenario.locked = false
  render()

  if (state.scenario.mode === 'monthly' || state.scenario.mode === 'annual') {
    scheduleScenarioAutoRun()
  }
}

function startScenarioMonthTransition() {
  if (!state.scenario) {
    return
  }

  const monthWaveDuration = getScenarioWaveTotal(state.scenario, state.scenario.visibleDays.length)
  state.scenario.locked = true
  state.scenario.rolling = true
  state.scenario.incoming = false
  render()

  scenarioRollTimer = window.setTimeout(() => {
    scenarioRollTimer = null

    if (!state.scenario) {
      return
    }

    moveScenarioToNextStudyWeek(state.scenario)
    state.scenario.rolling = false
    state.scenario.incoming = true
    render()

    scenarioIncomingTimer = window.setTimeout(() => {
      scenarioIncomingTimer = null
      finishScenarioMonthTransition()
    }, monthWaveDuration)
  }, monthWaveDuration)
}

function finishScenarioReveal() {
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
    state.scenario.boundaryReached = false
    openScenarioModal(state.scenario.mode === 'monthly' ? 'monthly-config' : 'weekly-ham', true)
    render()
    return
  }

  const annualPaused = state.scenario.mode === 'annual' && !state.scenario.annualAutoRunning

  if (hasRemainingStudyWeekInWindow(state.scenario) && !annualPaused) {
    moveScenarioToNextStudyWeek(state.scenario)
    state.scenario.locked = false
    render()

    if (state.scenario.mode === 'monthly' || (state.scenario.mode === 'annual' && state.scenario.annualAutoRunning)) {
      scheduleScenarioAutoRun()
    }
    return
  }

  if (annualPaused) {
    state.scenario.locked = false
    render()
    return
  }

  startScenarioMonthTransition()
}

function recoverScenarioProgressIfInterrupted() {
  const scenario = state.scenario

  if (!scenario) {
    return
  }

  if (scenario.filling && !scenarioRevealTimer) {
    finishScenarioReveal()
    return
  }

  if (scenario.rolling && !scenarioRollTimer) {
    moveScenarioToNextStudyWeek(scenario)
    scenario.rolling = false
    scenario.incoming = false
    scenario.locked = false
    render()

    if (scenario.mode === 'monthly') {
      scheduleScenarioAutoRun()
    }
    return
  }

  if (scenario.incoming && !scenarioIncomingTimer) {
    finishScenarioMonthTransition()
    return
  }

  if (scenario.previousEndDate && !scenarioDateTimer && !scenario.filling && !scenario.incoming) {
    scenario.previousEndDate = null
    render()
  }
}

function createScenarioState() {
  const remainingPages = Math.max(TOTAL_CELLS - state.filledCount, 0)
  const isComplete = remainingPages === 0
  const startsAtBoundary = !isComplete && state.juz >= COLUMNS
  const isZeroStart = state.pace === 0 && state.juz === 0 && state.filledCount === 0
  const shouldPrefillZeroStartHam = state.mainDataApplied && isZeroStart
  const initialHam = shouldPrefillZeroStartHam
    ? normalizeHamSelection(state.preferredScenarioHam ?? state.inputHamCount)
    : (state.inputJuz > 0 && state.inputJuz < COLUMNS ? state.inputHamCount : 1)
  const today = startOfDay(new Date())
  const monthView = getScenarioMonthView(today)
  const activeWeekIndex = monthView.visibleDays.find((day) => day.dateKey === toDateKey(today))?.weekIndex ?? 0
  const startDateKey = toDateKey(today)
  const initialMode = 'weekly'
  const initialLessonCount = null
  const scenario = {
    initialRemaining: remainingPages,
    greensEarned: 0,
    redsAdded: 0,
    entries: [],
    complete: isComplete,
    currentEndDate: getProjectedEndDate(remainingPages, state.spentStudyDays, state.closedStudyDays),
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
    viewMonthStartKey: monthView.monthStartKey,
    weekCount: monthView.weekCount,
    activeWeekIndex,
    visibleDays: monthView.visibleDays,
    windowResults: {},
    animatedResultKeys: [],
    hasStarted: isComplete,
    modalOpen: !isComplete,
    modalDismissed: false,
    boundaryReached: false,
    locked: false,
    filling: false,
    rolling: false,
    incoming: false,
    mode: initialMode,
    previousModeSelection: initialMode,
    modeSelected: false,
    selectedWeeklyLessonCount: initialLessonCount,
    monthlyAutoRunning: false,
    monthlyWeekPlan: null,
    annualPhasePlan: [],
    annualDraftHam: null,
    annualDraftWeeklyLessonCount: null,
    modalStep: !isComplete ? 'weekly-ham' : null,
    modalBoundary: startsAtBoundary,
    modalHamSelection: shouldPrefillZeroStartHam ? initialHam : null,
    modalLessonSelection: null,
    includeSundayStudy: state.preferredScenarioSundayEnabled === true,
    includeHolidayStudy: state.preferredScenarioHolidayEnabled === true,
  }

  normalizeScenarioWeek(scenario)
  return scenario
}

function createCompletedScenarioViewState() {
  const snapshot = state.completedScenarioView

  if (!snapshot?.startDateKey || !snapshot?.startMonthStartKey || !snapshot?.finalMonthStartKey) {
    return createScenarioState()
  }

  const finalMonthView = getScenarioMonthView(parseDateKey(snapshot.finalMonthStartKey))
  const completedEndDate = snapshot.completedEndDateKey
    ? parseDateKey(snapshot.completedEndDateKey)
    : getProjectedEndDate(0, state.spentStudyDays, state.closedStudyDays)

  return {
    initialRemaining: 0,
    greensEarned: 0,
    redsAdded: 0,
    entries: [],
    archivedEntries: snapshot.entries,
    complete: true,
    currentEndDate: completedEndDate,
    completedEndDate,
    previousEndDate: null,
    dateWidthReference: completedEndDate,
    dateVersion: 0,
    currentHam: state.preferredScenarioHam ?? 1,
    virtualPace: state.pace,
    virtualCount: state.filledCount,
    virtualJuz: state.juz,
    shouldBlackenNextLesson: false,
    repeatGrayCount: 0,
    startDateKey: snapshot.startDateKey,
    startMonthStartKey: snapshot.startMonthStartKey,
    startWeekIndex: 0,
    monthStartKey: snapshot.finalMonthStartKey,
    viewMonthStartKey: snapshot.finalMonthStartKey,
    weekCount: finalMonthView.weekCount,
    activeWeekIndex: 0,
    visibleDays: finalMonthView.visibleDays,
    windowResults: {},
    animatedResultKeys: [],
    hasStarted: true,
    modalOpen: false,
    boundaryReached: false,
    locked: false,
    filling: false,
    rolling: false,
    incoming: false,
    mode: snapshot.mode,
    previousModeSelection: snapshot.mode,
    selectedWeeklyLessonCount: snapshot.selectedWeeklyLessonCount,
    monthlyAutoRunning: false,
    monthlyWeekPlan: null,
    annualPhasePlan: [],
    annualDraftHam: null,
    annualDraftWeeklyLessonCount: null,
    modalStep: null,
    modalBoundary: false,
    modalHamSelection: null,
    modalLessonSelection: snapshot.selectedWeeklyLessonCount,
    includeSundayStudy: snapshot.includeSundayStudy,
    includeHolidayStudy: snapshot.includeHolidayStudy,
  }
}

function createCompletedScenarioSnapshot(scenario) {
  const completedEndDate = scenario.completedEndDate
    ?? scenario.currentEndDate
    ?? (state.completionDateKey ? parseDateKey(state.completionDateKey) : null)

  return {
    entries: scenario.entries
      .filter((entry) => entry.type !== 'repeat-summary' && entry.dateKey)
      .map((entry) => ({
        type: entry.type,
        dateKey: entry.dateKey,
        hamLevel: entry.hamLevel ?? 1,
        gain: entry.gain ?? 0,
        isSundayStudy: entry.isSundayStudy === true,
        isHolidayStudy: entry.isHolidayStudy === true,
        blackFill: entry.blackFill === true,
      })),
    startDateKey: scenario.startDateKey,
    startMonthStartKey: scenario.startMonthStartKey,
    finalMonthStartKey: scenario.monthStartKey,
    completedEndDateKey: completedEndDate ? toDateKey(startOfDay(completedEndDate)) : null,
    mode: scenario.mode ?? 'weekly',
    selectedWeeklyLessonCount: scenario.selectedWeeklyLessonCount,
    includeSundayStudy: scenario.includeSundayStudy === true,
    includeHolidayStudy: scenario.includeHolidayStudy === true,
  }
}

function getScenarioFillTotal(scenario, dayCount) {
  const profile = getScenarioAnimationProfile(scenario)
  return profile.fillDuration + (profile.fillDelayStep * Math.max(dayCount - 1, 0))
}

function getScenarioRevealDuration(scenario, dayCount) {
  return getScenarioFillTotal(scenario, dayCount) + getScenarioAnimationProfile(scenario).postFillHold
}

function getScenarioWaveTotal(scenario, dayCount) {
  const profile = getScenarioAnimationProfile(scenario)
  return profile.waveDuration + (profile.waveDelayStep * Math.max(dayCount - 1, 0))
}

function getScenarioMainMirrorAnimationConfig(scenario, cellCount = 1) {
  const safeCellCount = Math.max(cellCount, 1)
  const baseTotalDuration = MAIN_MIRROR_FILL_DURATION
    + (MAIN_MIRROR_BASE_DELAY_STEP * Math.max(safeCellCount - 1, 0))
    + MAIN_MIRROR_HOLD

  if (!scenario?.hasStarted) {
    return {
      delayStep: MAIN_MIRROR_BASE_DELAY_STEP,
      totalDuration: baseTotalDuration,
    }
  }

  const profile = getScenarioAnimationProfile(scenario)
  const revealDuration = getScenarioRevealDuration(scenario, 7)
  const requiresMonthTransitionBuffer = (
    (scenario.mode === 'monthly' || scenario.mode === 'annual')
    && scenario.filling
    && !scenario.complete
    && !scenario.boundaryReached
    && !hasRemainingStudyWeekInWindow(scenario)
  )
  const monthTransitionBuffer = requiresMonthTransitionBuffer
    ? getScenarioWaveTotal(scenario, scenario.visibleDays.length) * 2
    : 0
  const targetDuration = Math.min(
    Math.max(baseTotalDuration, revealDuration + profile.autoDelay + monthTransitionBuffer),
    2400,
  )
  const computedDelayStep = safeCellCount > 1
    ? Math.round((targetDuration - MAIN_MIRROR_FILL_DURATION - MAIN_MIRROR_HOLD) / (safeCellCount - 1))
    : MAIN_MIRROR_BASE_DELAY_STEP
  const delayStep = Math.max(MAIN_MIRROR_BASE_DELAY_STEP, Math.min(computedDelayStep, 260))

  return {
    delayStep,
    totalDuration: Math.min(
      MAIN_MIRROR_FILL_DURATION + (delayStep * Math.max(safeCellCount - 1, 0)) + MAIN_MIRROR_HOLD,
      2400,
    ),
  }
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
    scenarioDateTimer = null

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
  if (!canOpenScenarioView()) {
    state.view = 'main'
    render()
    return
  }

  if (!state.scenario) {
    state.scenario = state.filledCount >= TOTAL_CELLS && state.completedScenarioView
      ? createCompletedScenarioViewState()
      : createScenarioState()
  }
  state.view = 'scenario'
  render()
  recoverScenarioProgressIfInterrupted()

  if (state.scenario?.mode === 'monthly' && !state.scenario.modalOpen) {
    scheduleScenarioAutoRun()
  }
}

function openMainView() {
  state.view = 'main'
  render()
}

function openHistoryView() {
  if (!state.mainDataApplied) {
    state.view = 'main'
    render()
    return
  }

  state.view = 'history'
  render()
}

function processScenarioWeekChoice(scenario, selectedGreenCount, options = {}) {
  const { skipReds = false, preserveOrder = false } = options
  const isRepeatMode = scenario.currentHam === 'repeat'
  const activeWeekDays = getActiveScenarioWeekDays(scenario)
  const { regularDays, optionalDays, orderedDays: visibleStudyDays } = getScenarioOrderedStudyDays(scenario)
  const boundarySelectableChoice = getMaxScenarioChoice(scenario.virtualJuz)
  const maxSelectableChoice = getScenarioWeekMaxChoice(scenario)
  const remainingChoicesToCompletion = getScenarioCompletionChoiceLimit(scenario)
  const actualGreens = Math.min(selectedGreenCount, remainingChoicesToCompletion, maxSelectableChoice, visibleStudyDays.length)
  const boundaryLimitedWeek = boundarySelectableChoice < visibleStudyDays.length
    || remainingChoicesToCompletion < visibleStudyDays.length
  const prioritizedStudyDays = [
    ...((preserveOrder || (boundaryLimitedWeek && actualGreens === maxSelectableChoice))
      ? regularDays
      : shuffleArray(regularDays)),
    ...optionalDays,
  ]
  const selectedSuccessDateKeys = new Set(
    prioritizedStudyDays.slice(0, actualGreens).map((day) => day.dateKey),
  )
  const beforeVirtualJuz = scenario.virtualJuz
  const animatedResultKeys = []
  let boundaryReachedDuringWeek = false

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

    const isClosedNonStudyDay = (
      (day.isSunday && !scenario.includeSundayStudy)
      || (day.isHoliday && !scenario.includeHolidayStudy)
    )

    if (isClosedNonStudyDay) {
      const closedEntry = createScenarioClosedEntry(day)
      scenario.entries.push(closedEntry)
      scenario.windowResults[day.dateKey] = closedEntry
      return
    }

    if (isScenarioOptionalStudyDay(scenario, day) && !selectedSuccessDateKeys.has(day.dateKey)) {
      return
    }

    if (skipReds && !selectedSuccessDateKeys.has(day.dateKey)) {
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
      isHolidayStudy: day.isHoliday && entryType === 'success',
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
  })

  const virtualBoundaryReached = didCompleteScenarioJuz(beforeVirtualJuz, scenario.virtualJuz)

  if (isRepeatMode && virtualBoundaryReached && scenario.repeatGrayCount > 0) {
    scenario.entries.push({
      type: 'repeat-summary',
      count: scenario.repeatGrayCount,
    })
    scenario.repeatGrayCount = 0
  }

  return {
    animatedResultKeys,
    virtualBoundaryReached,
    activeWeekDayCount: activeWeekDays.length,
  }
}

function applyScenarioChoice(selectedGreenCount) {
  const scenario = state.scenario

  if (!scenario || scenario.complete || scenario.locked) {
    return
  }

  const weekResult = processScenarioWeekChoice(scenario, selectedGreenCount)
  const afterProjection = projectScenarioOutcome()
  const nextEndDate = estimateProjectedEndDate(
    Math.max(TOTAL_CELLS - afterProjection.filledCount, 0),
    afterProjection.spentStudyDays,
    afterProjection.closedStudyDays,
  )
  scenario.complete = afterProjection.filledCount >= TOTAL_CELLS
  scenario.completedEndDate = scenario.complete ? nextEndDate : null
  if (scenario.complete) {
    setForecastEndDate(nextEndDate)
  }
  scenario.animatedResultKeys = weekResult.animatedResultKeys
  scenario.locked = true
  scenario.filling = true
  scenario.boundaryReached = weekResult.virtualBoundaryReached
  scenario.incoming = false

  const revealDuration = getScenarioRevealDuration(scenario, weekResult.activeWeekDayCount)

  setScenarioDateTransition(nextEndDate)
  render()

  scenarioRevealTimer = window.setTimeout(() => {
    scenarioRevealTimer = null
    finishScenarioReveal()
  }, revealDuration)
}

function commitScenarioToMain(nextView = 'main') {
  clearScenarioTimers()
  const previousFilledCount = state.filledCount
  const previousBaselineCount = state.baselineCount
  const previousDisplayEndDate = getProjectedEndDate(TOTAL_CELLS - previousFilledCount, state.spentStudyDays, state.closedStudyDays)
  const projected = projectScenarioOutcome()
  const displayEndDate = state.scenario?.completedEndDate
    ?? state.scenario?.currentEndDate
    ?? previousDisplayEndDate

  if (state.scenario?.complete) {
    state.completedScenarioView = createCompletedScenarioSnapshot(state.scenario)
  }

  state.mainDataApplied = true
  state.filledCount = projected.filledCount
  state.pace = projected.pace
  state.juz = projected.juz
  state.inputPace = projected.pace
  state.inputJuz = projected.juz
  state.baselineCount = previousBaselineCount
  state.committedMarks = projected.marks
  state.carryRedCount = projected.pendingRedCount
  state.spentStudyDays = projected.spentStudyDays
  state.closedStudyDays = projected.closedStudyDays
  state.scenario = null
  state.view = nextView
  state.animate = false
  setForecastEndDate(displayEndDate)
  syncCompletionState(previousFilledCount, state.filledCount, displayEndDate)
  persistState()
  render()
}

function hasPendingScenarioTransfer() {
  if (!state.scenario) {
    return false
  }

  const projected = projectScenarioOutcome()

  return (
    projected.filledCount !== state.filledCount
    || projected.pace !== state.pace
    || projected.juz !== state.juz
    || projected.pendingRedCount !== state.carryRedCount
    || projected.spentStudyDays !== state.spentStudyDays
    || projected.closedStudyDays !== state.closedStudyDays
  )
}

function renderTabbedPanels(nextView) {
  if (!nextView || nextView === state.view) {
    return
  }

  if (state.view === 'scenario' && nextView === 'main') {
    openMainView()
    return
  }

  if (state.view === 'scenario' && nextView === 'history') {
    openHistoryView()
    return
  }

  if (nextView === 'scenario') {
    openScenarioView()
    return
  }

  if (nextView === 'history') {
    openHistoryView()
    return
  }

  openMainView()
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
      closedStudyDays: state.closedStudyDays,
    }
  }

  const zeroStartSelectedHam = (
    state.pace === 0
    && state.juz === 0
    && scenario.virtualCount === 0
    && scenario.virtualJuz === 0
  )
    ? (scenario.modalHamSelection ?? (scenario.hasStarted ? scenario.currentHam : null))
    : null

  let nextFilledCount = state.filledCount
  let pendingRedCount = state.carryRedCount
  let spentStudyDays = state.spentStudyDays
  let closedStudyDays = state.closedStudyDays
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

    if (entry.isSundayStudy || entry.isHolidayStudy) {
      closedStudyDays += 1
    }

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
    pace: zeroStartSelectedHam != null
      ? getHamSelectionNumericValue(zeroStartSelectedHam)
      : scenario.virtualPace,
    juz: scenario.virtualJuz,
    pendingRedCount,
    spentStudyDays,
    closedStudyDays,
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

  if (scenarioAutoTimer) {
    window.clearTimeout(scenarioAutoTimer)
    scenarioAutoTimer = null
  }
}

function addAnnualPhase() {
  if (!state.scenario || state.scenario.mode !== 'annual') {
    return
  }

  const ham = state.scenario.annualDraftHam
  const weeklyLessonCount = state.scenario.annualDraftWeeklyLessonCount

  if (ham == null || weeklyLessonCount == null) {
    return
  }

  const isFirstPhase = state.scenario.annualPhasePlan.filter((p) => p.status !== 'removed').length === 0
  const basePace = getAnnualPlanLastPace(state.scenario)
  // For the first phase, ham is locked to current pace — so paceAfter stays the same (cüz not finished)
  const paceAfter = isFirstPhase ? basePace : getAnnualPhasePaceAfter(basePace, ham)

  state.scenario.annualPhasePlan.push({
    id: createAnnualPhaseId(),
    ham,
    weeklyLessonCount,
    paceAfter,
    status: 'pending',
  })
  syncAnnualPhasePlan(state.scenario)
  render()
}

function removeAnnualPhase() {
  if (!state.scenario || state.scenario.mode !== 'annual') {
    return
  }

  const lastPendingIndex = [...state.scenario.annualPhasePlan]
    .map((phase, index) => ({ phase, index }))
    .reverse()
    .find(({ phase }) => phase.status === 'pending')
    ?.index

  if (lastPendingIndex == null) {
    return
  }

  state.scenario.annualPhasePlan.splice(lastPendingIndex, 1)
  syncAnnualPhasePlan(state.scenario)
  render()
}

function canStartAnnualScenario(scenario = state.scenario) {
  if (!scenario || scenario.mode !== 'annual') {
    return false
  }

  const annualSimulation = simulateAnnualPhasePlan(scenario)
  return annualSimulation.hasProgressPlan
}

function stepAnnualScenarioMonth() {
  const scenario = state.scenario

  if (!scenario || scenario.mode !== 'annual' || !scenario.annualAutoRunning || scenario.complete || scenario.locked) {
    return
  }

  const startingMonthStartKey = scenario.monthStartKey
  let monthAnimatedKeys = []
  let phaseVirtualBoundaryReached = false

  while (!scenario.complete && scenario.monthStartKey === startingMonthStartKey) {
    const nextPhase = scenario.annualPhasePlan.find((phase) => phase.status === 'pending')

    if (!nextPhase) {
      break
    }

    const previousPhase = [...scenario.annualPhasePlan].reverse().find((phase) => phase.status === 'consumed')
    const previousPhaseHam = previousPhase ? previousPhase.ham : null

    if (previousPhaseHam === 'repeat' && nextPhase.ham !== 'repeat' && !scenario.annualBlackenFlagApplied) {
      scenario.shouldBlackenNextLesson = true
      scenario.annualBlackenFlagApplied = true
    }

    scenario.currentHam = nextPhase.ham
    scenario.virtualPace = nextPhase.paceAfter
    state.preferredScenarioHam = nextPhase.ham

    if (getScenarioWeekRemainingStudyCount(scenario) <= 0) {
      if (hasRemainingStudyWeekInWindow(scenario)) {
        moveScenarioToNextStudyWeek(scenario)
      } else {
        break
      }
      continue
    }

    const weeklyChoice = Math.min(nextPhase.weeklyLessonCount, getScenarioWeekMaxChoice(scenario))

    if (weeklyChoice <= 0) {
      break
    }

    const weekResult = processScenarioWeekChoice(scenario, weeklyChoice)

    phaseVirtualBoundaryReached = weekResult.virtualBoundaryReached
    monthAnimatedKeys.push(...weekResult.animatedResultKeys)

    const afterProjection = projectScenarioOutcome()
    const nextEndDate = estimateProjectedEndDate(
      Math.max(TOTAL_CELLS - afterProjection.filledCount, 0),
      afterProjection.spentStudyDays,
      afterProjection.closedStudyDays,
    )

    scenario.complete = afterProjection.filledCount >= TOTAL_CELLS
    scenario.completedEndDate = scenario.complete ? nextEndDate : null
    scenario.currentEndDate = nextEndDate
    setForecastEndDate(nextEndDate)

    if (phaseVirtualBoundaryReached) {
      nextPhase.status = 'consumed'
      scenario.annualBlackenFlagApplied = false
      if (!scenario.complete) {
        scenario.virtualJuz = 0
      }
    } else if (!scenario.complete) {
      if (hasRemainingStudyWeekInWindow(scenario)) {
        moveScenarioToNextStudyWeek(scenario)
      } else {
        break
      }
    }
  }

  if (monthAnimatedKeys.length > 0) {
    scenario.animatedResultKeys = monthAnimatedKeys
    scenario.filling = true
    scenario.locked = true
    scenario.boundaryReached = false
    scenario.incoming = false

    // If no pending phases remain, pause annual mode before reveal finishes
    const hasMorePending = scenario.annualPhasePlan.some(p => p.status === 'pending')
    if (!hasMorePending) {
      scenario.annualAutoRunning = false
      scenario.annualDraftHam = null
      scenario.annualDraftWeeklyLessonCount = null
      state.preferredScenarioMode = 'annual'
      syncAnnualPhasePlan(scenario)
    }

    setScenarioDateTransition(scenario.currentEndDate)
    render()

    scenarioRevealTimer = window.setTimeout(() => {
      scenarioRevealTimer = null
      finishScenarioReveal()
    }, getScenarioRevealDuration(scenario, 7))
  } else if (!scenario.complete && scenario.annualPhasePlan.some(p => p.status === 'pending')) {
    if (!hasRemainingStudyWeekInWindow(scenario)) {
      startScenarioMonthTransition()
    } else {
      stepAnnualScenarioMonth()
    }
  } else {
    scenario.annualAutoRunning = false
    scenario.annualDraftHam = null
    scenario.annualDraftWeeklyLessonCount = null
    state.preferredScenarioMode = 'annual'
    syncAnnualPhasePlan(scenario)
    render()
  }
}

function startAnnualScenario() {
  const scenario = state.scenario

  if (!scenario || scenario.mode !== 'annual' || !canStartAnnualScenario(scenario)) {
    return
  }

  scenario.modalOpen = false
  scenario.modalBoundary = false
  scenario.modalStep = null
  scenario.hasStarted = true
  scenario.locked = false
  scenario.filling = false
  scenario.rolling = false
  scenario.incoming = false
  scenario.annualAutoRunning = true
  scenario.annualBlackenFlagApplied = false

  render()
  
  scheduleScenarioAutoRun()
}

function finalizeScenarioModalSelection() {
  if (!state.scenario) {
    return
  }

  const scenario = state.scenario
  const selectedMode = scenario.mode ?? 'weekly'
  const hamLocked = !scenario.modalBoundary && scenario.virtualJuz > 0
  const hamLevel = hamLocked ? scenario.currentHam : (scenario.modalHamSelection ?? scenario.currentHam)

  if (hamLevel == null) {
    return
  }

  const isBoundary = scenario.modalBoundary
  const maxBoundaryHam = getScenarioBoundarySelectableHamLimit(scenario)

  if (isBoundary && hamLevel !== 'repeat' && hamLevel > maxBoundaryHam) {
    return
  }

  if (selectedMode === 'monthly' && scenario.modalLessonSelection == null) {
    return
  }

  const wasRepeatMode = scenario.currentHam === 'repeat'
  scenario.currentHam = hamLevel
  scenario.previousModeSelection = selectedMode
  scenario.selectedWeeklyLessonCount = selectedMode === 'monthly' ? scenario.modalLessonSelection : null
  scenario.monthlyAutoRunning = selectedMode === 'monthly'
  scenario.monthlyWeekPlan = selectedMode === 'monthly'
    ? { lessonCount: scenario.modalLessonSelection }
    : null
  if (!isBoundary && state.pace === 0 && state.juz === 0 && scenario.virtualCount === 0 && scenario.virtualJuz === 0) {
    scenario.virtualPace = getHamSelectionNumericValue(hamLevel)
  }
  if (isBoundary && hamLevel !== 'repeat') {
    scenario.virtualPace += hamLevel
  }
  if (isBoundary && wasRepeatMode && hamLevel !== 'repeat') {
    scenario.shouldBlackenNextLesson = true
  }
  scenario.modalOpen = false
  scenario.modalBoundary = false
  scenario.modalStep = null
  scenario.modalHamSelection = null
  scenario.modalLessonSelection = null
  scenario.hasStarted = true
  scenario.locked = true
  state.preferredScenarioHam = hamLevel
  state.preferredScenarioMode = selectedMode
  state.preferredScenarioLessonCount = selectedMode === 'monthly' ? scenario.selectedWeeklyLessonCount : null

  if (!isBoundary) {
    scenario.locked = false
    render()

    if (scenario.mode === 'monthly') {
      scheduleScenarioAutoRun()
    }
    return
  }

  scenario.virtualJuz = 0

  if (getScenarioWeekRemainingStudyCount(scenario) > 0) {
    scenario.locked = false
    render()

    if (scenario.mode === 'monthly') {
      scheduleScenarioAutoRun()
    }
    return
  }

  if (hasRemainingStudyWeekInWindow(scenario)) {
    moveScenarioToNextStudyWeek(scenario)
    scenario.locked = false
    render()

    if (scenario.mode === 'monthly') {
      scheduleScenarioAutoRun()
    }
    return
  }

  startScenarioMonthTransition()
}

function selectScenarioMode(nextMode) {
  if (!state.scenario) {
    return
  }

  const isModeChanged = state.scenario.mode !== nextMode || !state.scenario.modeSelected
  const shouldResetMonthlyBoundarySelection = state.scenario.modalBoundary && nextMode === 'monthly'
  state.scenario.mode = nextMode
  state.scenario.previousModeSelection = nextMode
  state.scenario.modeSelected = true
  state.scenario.modalStep = nextMode === 'monthly'
    ? (shouldResetMonthlyBoundarySelection ? 'monthly-ham' : 'monthly-config')
    : (nextMode === 'annual' ? 'annual-config' : 'weekly-ham')

  if (isModeChanged && !state.scenario.hasStarted) {
    state.scenario.modalHamSelection = nextMode === 'monthly' ? state.scenario.currentHam : null
    state.scenario.modalLessonSelection = null
    state.scenario.annualDraftHam = null
    state.scenario.annualDraftWeeklyLessonCount = null
    // Auto-select the current ham for the first annual phase
    if (nextMode === 'annual' && state.inputHamCount > 0 && state.juz > 0) {
      state.scenario.annualDraftHam = state.inputHamCount
    }
  } else if (shouldResetMonthlyBoundarySelection) {
    state.scenario.modalHamSelection = null
    state.scenario.modalLessonSelection = null
  } else {
    const hamLocked = !state.scenario.modalBoundary && state.scenario.virtualJuz > 0
    state.scenario.modalHamSelection = nextMode === 'annual'
      ? null
      : (hamLocked
      ? state.scenario.currentHam
      : (state.scenario.modalHamSelection ?? state.scenario.currentHam))
    // If switching back to annual and plan is still empty, re-lock to current ham
    if (nextMode === 'annual' && state.scenario.annualPhasePlan.filter(p => p.status !== 'removed').length === 0 && state.inputHamCount > 0 && state.juz > 0) {
      state.scenario.annualDraftHam = state.inputHamCount
    }
    state.scenario.modalLessonSelection = nextMode === 'monthly' ? state.scenario.selectedWeeklyLessonCount : null
  }

  render()
}

function navigateScenarioMonth(offset) {
  if (!state.scenario || state.scenario.locked) {
    return
  }

  const scenario = state.scenario
  const currentViewDate = parseDateKey(scenario.viewMonthStartKey ?? scenario.monthStartKey)
  const nextView = startOfMonth(addMonths(currentViewDate, offset))
  const minViewDate = parseDateKey(scenario.startMonthStartKey)
  const maxViewDate = parseDateKey(scenario.monthStartKey)

  if (nextView < minViewDate || nextView > maxViewDate) {
    return
  }

  scenario.viewMonthStartKey = toDateKey(nextView)
  render()
}

function selectScenarioLessonCount(nextCount) {
  if (!state.scenario) {
    return
  }

  if (state.scenario.mode === 'annual') {
    state.scenario.annualDraftWeeklyLessonCount = nextCount
  } else {
    state.scenario.modalLessonSelection = nextCount
  }
  render()
}

function toggleScenarioAvailability(kind) {
  if (!state.scenario) {
    return
  }

  if (kind === 'sunday') {
    state.scenario.includeSundayStudy = !state.scenario.includeSundayStudy
    state.preferredScenarioSundayEnabled = state.scenario.includeSundayStudy

    if (!state.scenario.includeSundayStudy) {
      if (state.scenario.selectedWeeklyLessonCount != null) {
        state.scenario.selectedWeeklyLessonCount = Math.min(state.scenario.selectedWeeklyLessonCount, 6)
      }
      if (state.scenario.modalLessonSelection != null) {
        state.scenario.modalLessonSelection = Math.min(state.scenario.modalLessonSelection, 6)
      }
      if (state.scenario.annualDraftWeeklyLessonCount != null) {
        state.scenario.annualDraftWeeklyLessonCount = Math.min(state.scenario.annualDraftWeeklyLessonCount, 6)
      }
      if (state.scenario.annualPhasePlan.length > 0) {
        state.scenario.annualPhasePlan = state.scenario.annualPhasePlan.map((phase) => ({
          ...phase,
          weeklyLessonCount: Math.min(phase.weeklyLessonCount, 6),
        }))
        syncAnnualPhasePlan(state.scenario)
      }
      if (state.preferredScenarioLessonCount != null) {
        state.preferredScenarioLessonCount = Math.min(state.preferredScenarioLessonCount, 6)
      }
    }
  }

  if (kind === 'holiday') {
    state.scenario.includeHolidayStudy = !state.scenario.includeHolidayStudy
    state.preferredScenarioHolidayEnabled = state.scenario.includeHolidayStudy
  }

  persistState()
  render()
}

function applyHamSelection(nextHamLevel) {
  if (!state.scenario) {
    return
  }

  if (state.scenario.mode === 'annual') {
    state.scenario.annualDraftHam = nextHamLevel === 'repeat' ? 'repeat' : nextHamLevel
    render()
    return
  }

  state.scenario.modalHamSelection = nextHamLevel === 'repeat' ? 'repeat' : nextHamLevel

  if (state.scenario.mode === 'monthly') {
    state.scenario.modalStep = 'monthly-lessons'
    state.scenario.modalLessonSelection = null
  }

  render()
}

function startScenarioFromModal() {
  if (!state.scenario) {
    return
  }

  if (state.scenario.mode === 'annual') {
    startAnnualScenario()
    return
  }

  finalizeScenarioModalSelection()
}

function dismissScenarioModal() {
  if (!state.scenario) {
    return
  }
  state.scenario.modalOpen = false
  state.scenario.modalDismissed = true
  render()
}

function reopenScenarioModal() {
  if (!state.scenario || !state.scenario.modalDismissed) {
    return
  }
  state.scenario.modalDismissed = false
  state.scenario.modalOpen = true
  render()
}

export function render() {
  listeners.forEach((listener) => listener())
}

export function persistState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      pace: state.pace,
      juz: state.juz,
      mainDataApplied: state.mainDataApplied,
      inputPace: state.inputPace,
      inputJuz: state.inputJuz,
      inputHamCount: state.inputHamCount,
      filledCount: state.filledCount,
      baselineCount: state.baselineCount,
      committedMarks: state.committedMarks,
      carryRedCount: state.carryRedCount,
      spentStudyDays: state.spentStudyDays,
      closedStudyDays: state.closedStudyDays,
      forecastEndDateKey: state.forecastEndDateKey,
      completionDateKey: state.completionDateKey,
      preferredScenarioHam: state.preferredScenarioHam,
      preferredScenarioMode: state.preferredScenarioMode,
      preferredScenarioLessonCount: state.preferredScenarioLessonCount,
      preferredScenarioSundayEnabled: state.preferredScenarioSundayEnabled,
      preferredScenarioHolidayEnabled: state.preferredScenarioHolidayEnabled,
      completedScenarioView: state.completedScenarioView,
      history: state.history,
    }),
  )
}

export {
  ROWS,
  COLUMNS,
  TOTAL_CELLS,
  HAM_OPTIONS,
  WEEKDAY_LABELS,
  state,
  addAnnualPhase,
  applyHamSelection,
  applyScenarioChoice,
  canAddAnnualPhase,
  canStartAnnualScenario,
  calculateFilledCount,
  canOpenScenarioView,
  clampNumber,
  closeCompletionModal,
  commitScenarioToMain,
  createScenarioClosedEntry,
  createScenarioState,
  estimateProjectedEndDate,
  estimateCompletion,
  formatDate,
  formatDateInputText,
  formatMonthYear,
  getHolidaySet,
  getTodayDateKey,
  getCellState,
  getFillSequenceIndex,
  getHamSelectionLabel,
  getHamSelectionNumericValue,
  getHistoryCurrentHamValue,
  getMarkMap,
  hasPendingScenarioTransfer,
  getScenarioMonthView,
  getProjectedEndDate,
  getScenarioVisual,
  getScenarioWeekMaxChoice,
  getScenarioBoundaryHamLimit,
  getScenarioBoundarySelectableHamLimit,
  getScenarioChoiceHint,
  getScenarioMainMirrorAnimationConfig,
  doesScenarioChoiceIncludeSunday,
  isScenarioPastStartDay,
  isNonStudyDay,
  openMainView,
  openHistoryView,
  openScenarioView,
  dismissScenarioModal,
  endOfMonth,
  endOfWeekSunday,
  addDays,
  padNumber,
  parseDateKey,
  parseDateInputText,
  projectScenarioOutcome,
  renderTabbedPanels,
  renderCompletionModal,
  renderScenarioDate,
  removeAnnualPhase,
  reopenScenarioModal,
  navigateScenarioMonth,
  selectScenarioLessonCount,
  selectScenarioMode,
  simulateAnnualPhasePlan,
  startScenarioFromModal,
  startOfMonth,
  startOfWeekMonday,
  shiftHamSelection,
  setForecastEndDate,
  syncCompletionState,
  toggleScenarioAvailability,
  toDateKey,
  triggerApplyButtonValidationError,
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (savedState.filledCount == null) {
  state.filledCount = calculateFilledCount(state.pace, state.juz, state.inputHamCount)
  state.baselineCount = state.filledCount
}
