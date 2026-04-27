import { useRef, useState, useLayoutEffect } from 'react'
import {
  ROWS,
  COLUMNS,
  state,
  addDays,
  calculateFilledCount,
  clampNumber,
  endOfMonth,
  endOfWeekSunday,
  formatDate,
  formatDateInputText,
  formatMonthYear,
  getHamSelectionLabel,
  getHistoryCurrentHamValue,
  getHolidaySet,
  getTodayDateKey,
  isNonStudyDay,
  parseDateInputText,
  parseDateKey,
  persistState,
  render,
  startOfMonth,
  startOfWeekMonday,
  toDateKey,
} from './app-state.js'

const HISTORY_WEEKDAY_MINI_LABELS = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P']

const HISTORY_STUDY_CLASS_BY_HAM = {
  1: 'history-day-study-green',
  2: 'history-day-study-orange',
  3: 'history-day-study-blue',
  4: 'history-day-study-pink',
  5: 'history-day-study-gold',
}

const HISTORY_MISS_CLASS_BY_HAM = {
  1: 'history-day-miss-red',
  2: 'history-day-miss-orange',
  3: 'history-day-miss-blue',
  4: 'history-day-miss-pink',
  5: 'history-day-miss-gold',
}

const DATE_MASK = '__/__/____'

function getHistoryMonthLabel(year, monthIndex) {
  return formatMonthYear(new Date(year, monthIndex, 1)).split(' ')[0]
}

function getHistoryWeightedHamTotal(phaseCounts) {
  return (2 * phaseCounts[2]) + (3 * phaseCounts[3]) + (4 * phaseCounts[4]) + (5 * phaseCounts[5])
}

function getDateSegments(text) {
  const normalized = String(text ?? '')
  const [rawDay = '', rawMonth = '', rawYear = ''] = normalized.split('/')

  return {
    day: rawDay.replace(/\D/g, '').slice(0, 2),
    month: rawMonth.replace(/\D/g, '').slice(0, 2),
    year: rawYear.replace(/\D/g, '').slice(0, 4),
  }
}

function buildMaskedDateText({ day, month, year }) {
  const safeDay = String(day ?? '').padEnd(2, '_').slice(0, 2)
  const safeMonth = String(month ?? '').padEnd(2, '_').slice(0, 2)
  const safeYear = String(year ?? '').padEnd(4, '_').slice(0, 4)
  return `${safeDay}/${safeMonth}/${safeYear}`
}

function normalizeDateSegments({ day, month, year }) {
  return {
    day: String(day ?? '').length === 1 ? `0${day}` : String(day ?? '').slice(0, 2),
    month: String(month ?? '').length === 1 ? `0${month}` : String(month ?? '').slice(0, 2),
    year: String(year ?? '').slice(0, 4),
  }
}

function buildDateKeyFromSegments({ day, month, year }) {
  const normalizedSegments = normalizeDateSegments({ day, month, year })

  if (normalizedSegments.day.length !== 2 || normalizedSegments.month.length !== 2 || normalizedSegments.year.length !== 4) {
    return null
  }

  return parseDateInputText(`${normalizedSegments.day}/${normalizedSegments.month}/${normalizedSegments.year}`)
}

function getHistoryCompletionPhaseSequence(completedPhaseSequence, currentHam, pace) {
  const remainingCapacity = Math.max(20 - pace, 0)
  const futurePhaseSequence = []
  let remaining = remainingCapacity

  while (remaining > 0) {
    const nextHam = Math.min(currentHam, remaining)
    futurePhaseSequence.push(nextHam)
    remaining -= nextHam
  }

  if (pace <= 0) {
    return futurePhaseSequence
  }

  return [...completedPhaseSequence, currentHam, ...futurePhaseSequence]
}

function getHistoryCompletionSnapshot(startDate, phaseSequence) {
  const totalStudyDaysNeeded = phaseSequence.length * 30

  if (totalStudyDaysNeeded <= 0) {
    return { dateKey: toDateKey(startDate), sundayDays: 0, holidayDays: 0 }
  }

  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  let studyDaysDone = 0
  let sundayDays = 0
  let holidayDays = 0

  while (studyDaysDone < totalStudyDaysNeeded) {
    const holidaySet = getHolidaySet(cursor.getFullYear())
    const blocked = isNonStudyDay(cursor, holidaySet)

    if (blocked) {
      if (cursor.getDay() === 0) {
        sundayDays += 1
      } else {
        holidayDays += 1
      }
    } else {
      studyDaysDone += 1
    }

    if (studyDaysDone < totalStudyDaysNeeded) {
      cursor = addDays(cursor, 1)
    }
  }

  return { dateKey: toDateKey(cursor), sundayDays, holidayDays }
}

function getHistoryProgressForStudyDays(studyDayCount, phaseSequence) {
  if (studyDayCount <= 0 || phaseSequence.length === 0) {
    return { pace: 0, juz: 0 }
  }

  const clampedStudyDays = Math.min(studyDayCount, phaseSequence.length * COLUMNS)
  let completedPace = 0

  for (let phaseIndex = 0; phaseIndex < phaseSequence.length; phaseIndex += 1) {
    const ham = phaseSequence[phaseIndex]
    const phaseStart = phaseIndex * COLUMNS
    const phaseEnd = phaseStart + COLUMNS

    if (clampedStudyDays <= phaseEnd) {
      return {
        pace: completedPace + ham,
        juz: Math.max(clampedStudyDays - phaseStart, 0),
      }
    }

    completedPace += ham
  }

  return {
    pace: completedPace,
    juz: COLUMNS,
  }
}

function addCalendarYearsSafe(date, years) {
  const year = date.getFullYear() + years
  const month = date.getMonth()
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(date.getDate(), lastDayOfMonth))
}

function addCalendarMonthsSafe(date, months) {
  const totalMonths = (date.getFullYear() * 12) + date.getMonth() + months
  const year = Math.floor(totalMonths / 12)
  const month = totalMonths % 12
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(date.getDate(), lastDayOfMonth))
}

function formatElapsedSpan(fromDate, toDate) {
  if (!fromDate || !toDate || fromDate > toDate) {
    return 'Henüz yok'
  }

  let cursor = new Date(fromDate)
  let years = 0
  let months = 0

  while (true) {
    const next = addCalendarYearsSafe(cursor, 1)
    if (next <= toDate) {
      years += 1
      cursor = next
      continue
    }
    break
  }

  while (true) {
    const next = addCalendarMonthsSafe(cursor, 1)
    if (next <= toDate) {
      months += 1
      cursor = next
      continue
    }
    break
  }

  const days = Math.max(Math.round((toDate - cursor) / (24 * 60 * 60 * 1000)), 0)
  const parts = []

  if (years > 0) parts.push(`${years} yıl`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0 || parts.length === 0) parts.push(`${days} gün`)

  return parts.join(' ')
}

function getHistoryTimeline(historyState) {
  const reportBasis = historyState.reportBasis ?? {
    pace: historyState.inputPace,
    juz: historyState.inputJuz,
    hamCount: historyState.inputHamCount,
  }
  const pace = clampNumber(reportBasis.pace, 0, ROWS)
  const juz = clampNumber(reportBasis.juz, 0, COLUMNS)
  const currentHam = getHistoryCurrentHamValue(reportBasis.hamCount)
  const phaseCounts = historyState.phaseCounts
  const weightedHamTotal = getHistoryWeightedHamTotal(phaseCounts)
  const pastWeightedCapacity = Math.max(pace - currentHam, 0)
  const startDateKey = historyState.startDateKey
  const endDateKey = getTodayDateKey()
  const endDate = parseDateKey(endDateKey)
  const invalidDateText = historyState.startDateText.trim() !== '' && !parseDateInputText(historyState.startDateText)

  let validationMessage = ''

  if (!startDateKey) {
    validationMessage = invalidDateText
      ? 'Hafızlığa başlama tarihini gg/aa/yyyy biçiminde girin.'
      : 'Takvimi hesaplamak için hafızlığa başlama tarihini girin.'
  } else if (parseDateKey(startDateKey) > endDate) {
    validationMessage = 'Başlama tarihi bugünden ileri olamaz.'
  } else if (pace === 0 && juz > 0) {
    validationMessage = 'Kaçla gidiyor 0 iken cüz sayısı da 0 olmalı.'
  } else if (pace > 0 && currentHam > pace) {
    validationMessage = 'Mevcut ham, kaçla gidiyor değerinden büyük olamaz.'
  } else if (weightedHamTotal > 20) {
    validationMessage = 'Ham sayıları toplamı 20 hamı geçemez.'
  } else if (weightedHamTotal > pastWeightedCapacity) {
    validationMessage = 'Geçmiş ham sayıları, mevcut ilerleme için fazla yüksek.'
  }

  const inferredOneHamCount = Math.max(pastWeightedCapacity - weightedHamTotal, 0)
  const completedPhaseSequence = validationMessage
    ? []
    : [
      ...Array.from({ length: inferredOneHamCount }, () => 1),
      ...Array.from({ length: phaseCounts[2] }, () => 2),
      ...Array.from({ length: phaseCounts[3] }, () => 3),
      ...Array.from({ length: phaseCounts[4] }, () => 4),
      ...Array.from({ length: phaseCounts[5] }, () => 5),
    ]

  const successHamSequence = validationMessage
    ? []
    : [
      ...completedPhaseSequence.flatMap((ham) => Array.from({ length: 30 }, () => ham)),
      ...Array.from({ length: juz }, () => currentHam),
    ]
  const completionPhaseSequence = validationMessage
    ? []
    : getHistoryCompletionPhaseSequence(completedPhaseSequence, currentHam, pace)

  const baselineCount = calculateFilledCount(pace, juz, currentHam)

  if (validationMessage || !startDateKey) {
    return {
      validationMessage,
      baselineCount,
      startDateKey,
      endDateKey,
      endDate,
      years: [],
      activeYear: endDate.getFullYear(),
      allocationMap: new Map(),
      totalElapsedDays: 0,
      studyDays: 0,
      missedDays: 0,
      sundayDays: 0,
      holidayDays: 0,
      blockedDays: 0,
      perfectFinishDateKey: null,
      ziyadeZamanLabel: 'Henüz yok',
      perfectCurrentProgress: { pace: 0, juz: 0 },
      currentHam,
      phaseCounts,
      inferredOneHamCount,
      weightedHamTotal,
    }
  }

  const startDate = parseDateKey(startDateKey)
  const rangeDays = []
  let cursor = startDate
  let sundayDays = 0
  let holidayDays = 0

  while (cursor <= endDate) {
    const dateKey = toDateKey(cursor)
    const holidaySet = getHolidaySet(cursor.getFullYear())
    const isSunday = cursor.getDay() === 0
    const isHoliday = holidaySet.has(dateKey)

    if (isSunday) {
      sundayDays += 1
    } else if (isHoliday) {
      holidayDays += 1
    }

    rangeDays.push({
      date: new Date(cursor),
      dateKey,
      isSunday,
      isHoliday,
      isStudyDay: !isNonStudyDay(cursor, holidaySet),
    })

    cursor = addDays(cursor, 1)
  }

  const eligibleDays = rangeDays.filter((day) => day.isStudyDay)
  const idealStudyDaysByNow = eligibleDays.length
  const studyDays = Math.min(successHamSequence.length, eligibleDays.length)
  const missedDays = Math.max(eligibleDays.length - studyDays, 0)
  const perfectCompletion = getHistoryCompletionSnapshot(startDate, completionPhaseSequence)
  const perfectFinishDateKey = perfectCompletion.dateKey
  const ziyadeZamanLabel = formatElapsedSpan(parseDateKey(perfectFinishDateKey), endDate)
  const perfectCurrentProgress = getHistoryProgressForStudyDays(idealStudyDaysByNow, completionPhaseSequence)
  const allocationMap = new Map()
  let studyAssigned = 0

  eligibleDays.forEach((day, index) => {
    const shouldStudy = Math.floor(((index + 1) * studyDays) / eligibleDays.length) > studyAssigned
    const mappedHam = successHamSequence[Math.min(studyAssigned, Math.max(studyDays - 1, 0))] ?? currentHam

    allocationMap.set(day.dateKey, {
      type: shouldStudy ? 'study' : 'missed',
      ham: shouldStudy ? successHamSequence[studyAssigned] ?? currentHam : mappedHam,
    })

    if (shouldStudy && studyAssigned < studyDays) {
      studyAssigned += 1
    }
  })

  rangeDays.forEach((day) => {
    if (!allocationMap.has(day.dateKey)) {
      allocationMap.set(day.dateKey, { type: day.isSunday ? 'sunday' : 'holiday', ham: null })
    }
  })

  const years = Array.from(
    { length: endDate.getFullYear() - startDate.getFullYear() + 1 },
    (_, index) => startDate.getFullYear() + index,
  )

  return {
    validationMessage: '',
    baselineCount,
    startDateKey,
    endDateKey,
    endDate,
    years,
    activeYear: years.includes(historyState.activeYear) ? historyState.activeYear : years[years.length - 1],
    allocationMap,
    totalElapsedDays: rangeDays.length,
    studyDays,
    missedDays,
    sundayDays,
    holidayDays,
    blockedDays: sundayDays + holidayDays,
    perfectFinishDateKey,
    ziyadeZamanLabel,
    perfectCurrentProgress,
    currentHam,
    phaseCounts,
    inferredOneHamCount,
    weightedHamTotal,
  }
}

function getHistoryYearMonths(year, timeline) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = startOfMonth(new Date(year, monthIndex, 1))
    const monthEnd = endOfMonth(monthStart)
    const gridStart = startOfWeekMonday(monthStart)
    const gridEnd = endOfWeekSunday(monthEnd)
    const days = []
    let cursor = gridStart

    while (cursor <= gridEnd) {
      const dateKey = toDateKey(cursor)
      const inRange = timeline.startDateKey && dateKey >= timeline.startDateKey && dateKey <= timeline.endDateKey
      const entry = inRange ? timeline.allocationMap?.get(dateKey) ?? timeline.allocationMap.get(dateKey) : null

      days.push({
        dateKey,
        dayNumber: cursor.getDate(),
        isCurrentMonth: cursor.getMonth() === monthIndex,
        isToday: dateKey === getTodayDateKey(),
        state: entry?.type ?? (inRange ? 'empty' : 'inactive'),
        ham: entry?.ham ?? null,
      })

      cursor = addDays(cursor, 1)
    }

    return { monthIndex, monthLabel: getHistoryMonthLabel(year, monthIndex), days }
  })
}

function HistoryDay({ day }) {
  const stateClassMap = {
    inactive: 'history-day-inactive',
    empty: 'history-day-empty',
    sunday: 'history-day-sunday',
    holiday: 'history-day-holiday',
  }

  const studyClass = day.state === 'study' ? HISTORY_STUDY_CLASS_BY_HAM[day.ham] : ''
  const missClass = day.state === 'missed' ? HISTORY_MISS_CLASS_BY_HAM[day.ham] : ''
  const baseClass = stateClassMap[day.state] ?? ''

  return (
    <div className={`history-day ${day.isCurrentMonth ? '' : 'history-day-adjacent'} ${day.isToday ? 'history-day-today' : ''} ${baseClass} ${studyClass} ${missClass}`}>
      <span>{day.dayNumber}</span>
    </div>
  )
}

export function HistoryView() {
  const [invalidStepper, setInvalidStepper] = useState(null)
  const [invalidReport, setInvalidReport] = useState(false)
  const startDatePickerRef = useRef(null)
  const dayInputRef = useRef(null)
  const monthInputRef = useRef(null)
  const yearInputRef = useRef(null)
  const invalidStepperTimerRef = useRef(null)
  const invalidReportTimerRef = useRef(null)

  const timeline = getHistoryTimeline(state.history)
  state.history.activeYear = timeline.activeYear
  const months = timeline.years.length > 0 ? getHistoryYearMonths(timeline.activeYear, timeline) : []
  const shouldShowReport = state.history.reportReady && !timeline.validationMessage
  const shouldShowValidation = state.history.reportAttempted && Boolean(timeline.validationMessage)

  const triggerStepperError = (key) => {
    if (invalidStepperTimerRef.current) {
      window.clearTimeout(invalidStepperTimerRef.current)
    }

    setInvalidStepper(null)
    requestAnimationFrame(() => {
      setInvalidStepper(key)
      invalidStepperTimerRef.current = window.setTimeout(() => setInvalidStepper(null), 420)
    })
  }

  const triggerReportError = () => {
    if (invalidReportTimerRef.current) {
      window.clearTimeout(invalidReportTimerRef.current)
    }

    setInvalidReport(false)
    requestAnimationFrame(() => {
      setInvalidReport(true)
      invalidReportTimerRef.current = window.setTimeout(() => setInvalidReport(false), 420)
    })
  }

  const resetHistoryReport = () => {
    state.history.reportReady = false
    state.history.reportAttempted = false
    state.history.reportBasis = null
  }

  const handlePhaseShift = (ham, direction) => {
    const nextCounts = {
      ...state.history.phaseCounts,
      [ham]: clampNumber(state.history.phaseCounts[ham] + direction, 0, 20),
    }

    if (nextCounts[ham] === state.history.phaseCounts[ham]) {
      triggerStepperError(`${ham}-${direction}`)
      return
    }

    const nextWeightedTotal = getHistoryWeightedHamTotal(nextCounts)
    const nextPastCapacity = Math.max(state.history.inputPace - getHistoryCurrentHamValue(state.history.inputHamCount), 0)

    if (direction > 0 && (nextWeightedTotal > 20 || nextWeightedTotal > nextPastCapacity)) {
      triggerStepperError(`${ham}-${direction}`)
      return
    }

    state.history.phaseCounts = nextCounts
    resetHistoryReport()
    persistState()
    render()
  }

  const syncDateSegments = (nextSegments) => {
    const parsedDateKey = buildDateKeyFromSegments(nextSegments)
    state.history.startDateText = buildMaskedDateText(nextSegments)
    state.history.startDateKey = parsedDateKey

    if (parsedDateKey) {
      state.history.activeYear = parseDateKey(parsedDateKey).getFullYear()
    }

    resetHistoryReport()
    persistState()
    render()
  }

  const handlePickerChange = (event) => {
    const nextDateKey = event.target.value || null
    state.history.startDateKey = nextDateKey
    state.history.startDateText = nextDateKey ? formatDateInputText(nextDateKey) : DATE_MASK

    if (nextDateKey) {
      state.history.activeYear = parseDateKey(nextDateKey).getFullYear()
    }

    resetHistoryReport()
    persistState()
    render()
  }

  const handleReport = () => {
    const parsedDateKey = buildDateKeyFromSegments(getDateSegments(state.history.startDateText || DATE_MASK))

    if (parsedDateKey) {
      state.history.startDateKey = parsedDateKey
      state.history.startDateText = formatDateInputText(parsedDateKey)
      state.history.activeYear = parseDateKey(parsedDateKey).getFullYear()
    }

    const nextTimeline = getHistoryTimeline(state.history)
    state.history.reportAttempted = true

    if (nextTimeline.validationMessage) {
      triggerReportError()
      persistState()
      render()
      return
    }

    state.history.reportReady = true
    state.history.reportBasis = {
      pace: state.history.inputPace,
      juz: state.history.inputJuz,
      hamCount: state.history.inputHamCount,
    }
    persistState()
    render()
  }

  const handleEdit = () => {
    resetHistoryReport()
    persistState()
    render()
  }

  const handlePrevYear = () => {
    state.history.activeYear = Math.max(state.history.activeYear - 1, timeline.years[0])
    persistState()
    render()
  }

  const handleNextYear = () => {
    state.history.activeYear = Math.min(state.history.activeYear + 1, timeline.years[timeline.years.length - 1])
    persistState()
    render()
  }

  const dateSegments = getDateSegments(state.history.startDateText || DATE_MASK)

  useLayoutEffect(() => {
    const rawDay = dateSegments.day ?? ''
    const rawMonth = dateSegments.month ?? ''
    const rawYear = dateSegments.year ?? ''

    if (dayInputRef.current && document.activeElement === dayInputRef.current) {
      dayInputRef.current.setSelectionRange(rawDay.length, rawDay.length)
    }
    if (monthInputRef.current && document.activeElement === monthInputRef.current) {
      monthInputRef.current.setSelectionRange(rawMonth.length, rawMonth.length)
    }
    if (yearInputRef.current && document.activeElement === yearInputRef.current) {
      yearInputRef.current.setSelectionRange(rawYear.length, rawYear.length)
    }
  }, [dateSegments.day, dateSegments.month, dateSegments.year])

  const handleSegmentChange = (segment, maxLength, nextRef = null) => (event) => {
    const input = event.target
    const cleanedValue = input.value.replace(/\D/g, '').slice(0, maxLength)
    const nextSegments = {
      ...dateSegments,
      [segment]: cleanedValue,
    }

    syncDateSegments(nextSegments)

    if (cleanedValue.length === maxLength && nextRef?.current) {
      window.requestAnimationFrame(() => {
        nextRef.current.focus()
        nextRef.current.select()
      })
    }
  }

  const handleSegmentKeyDown = (segment, previousRef = null) => (event) => {
    if (event.key !== 'Backspace') {
      return
    }

    const currentValue = dateSegments[segment]

    if (currentValue.length > 0) {
      return
    }

    if (!previousRef?.current) {
      return
    }

    event.preventDefault()
    window.requestAnimationFrame(() => {
      previousRef.current.focus()
      previousRef.current.select()
    })
  }

  const handleSegmentPointerDown = (segment, ref) => (event) => {
    event.preventDefault()
    if (dateSegments[segment]?.length > 0) {
      syncDateSegments({
        ...dateSegments,
        [segment]: '',
      })
    }

    window.requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.select()
    })
  }

  return (
    <main className="history-layout">
      <section className="history-main">
        <section className="history-board">
          <div className="history-board-toolbar">
            <div>
              <p className="eyebrow">Yıllık Takvim</p>
              <h2 className="history-year-title">{timeline.years.length > 0 ? timeline.activeYear : '----'}</h2>
            </div>
            <div className="history-year-nav">
              <button className="history-year-button" type="button" disabled={timeline.years.length <= 1 || timeline.activeYear === timeline.years[0]} onClick={handlePrevYear}>&lsaquo;</button>
              <button className="history-year-button" type="button" disabled={timeline.years.length <= 1 || timeline.activeYear === timeline.years[timeline.years.length - 1]} onClick={handleNextYear}>&rsaquo;</button>
            </div>
          </div>

          {shouldShowReport ? (
            <div className="history-year-grid">
              {months.map((month) => (
                <section key={month.monthIndex} className="history-month">
                  <h3 className="history-month-title">{month.monthLabel}</h3>
                  <div className="history-month-weekdays">
                    {HISTORY_WEEKDAY_MINI_LABELS.map((label) => <span key={label}>{label}</span>)}
                  </div>
                  <div className="history-month-days">
                    {month.days.map((day) => <HistoryDay key={day.dateKey} day={day} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="history-empty-state">
              <strong>{shouldShowValidation ? 'Rapor oluşturulamadı' : 'Durum raporu bekleniyor'}</strong>
              <p>{shouldShowValidation ? timeline.validationMessage : ''}</p>
            </div>
          )}
        </section>
      </section>

      <aside className="history-side">
        {shouldShowReport ? (
          <div className="control-card summary-card">
            <p className="eyebrow">Durum Özeti</p>
            <div className="history-progress-compare">
              <div className="history-progress-card history-progress-card-actual">
                <span className="history-progress-title">Şu Anda</span>
                <div className="history-progress-fraction">
                  <div className="history-progress-part">
                    <span className="history-progress-label">Kaçla gidiyor</span>
                    <strong>{state.history.reportBasis ? state.history.reportBasis.pace : state.history.inputPace}</strong>
                  </div>
                  <div className="history-progress-line"></div>
                  <div className="history-progress-part">
                    <span className="history-progress-label">Kaçıncı cüzde</span>
                    <strong>{state.history.reportBasis ? state.history.reportBasis.juz : state.history.inputJuz}</strong>
                  </div>
                </div>
              </div>

              <div className="history-progress-card history-progress-card-perfect">
                <span className="history-progress-title">Mükemmel Gitseydi</span>
                <div className="history-progress-fraction">
                  <div className="history-progress-part">
                    <span className="history-progress-label">Kaçla gidecekti</span>
                    <strong>{timeline.perfectCurrentProgress.pace}</strong>
                  </div>
                  <div className="history-progress-line"></div>
                  <div className="history-progress-part">
                    <span className="history-progress-label">Kaçıncı cüzde olacaktı</span>
                    <strong>{timeline.perfectCurrentProgress.juz}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="summary-row"><span>Kaç Ham Aldı</span><strong>{getHamSelectionLabel(state.history.reportBasis ? state.history.reportBasis.hamCount : state.history.inputHamCount)}</strong></div>
            <div className="summary-row"><span>Toplam Geçen Gün</span><strong>{timeline.totalElapsedDays}</strong></div>
            <div className="summary-row"><span>Ders Verilen Gün</span><strong>{timeline.studyDays}</strong></div>
            <div className="summary-row"><span>Ders Verilmeyen Gün</span><strong>{timeline.missedDays}</strong></div>
            <div className="summary-row"><span>Pazar + Tatil</span><strong>{timeline.blockedDays}</strong></div>
            <div className="summary-row"><span>Ezberlenen Sayfa Sayısı</span><strong>{timeline.baselineCount}</strong></div>
            <div className="summary-row">
              <span>İdeal Bitiş Tarihi</span>
              <strong>{timeline.perfectFinishDateKey ? formatDate(parseDateKey(timeline.perfectFinishDateKey)) : '--'}</strong>
            </div>
            <div className="summary-row"><span>Ziyade Zaman</span><strong>{timeline.ziyadeZamanLabel}</strong></div>
            <button className="apply-button apply-button-history" type="button" onClick={handleEdit}>Yeni Veri Girişi</button>
          </div>
        ) : (
          <>
            <div className="control-card">
              <p className="eyebrow">Veri Girişi</p>
              <h2>Başlangıç tarihi</h2>

              <div className="summary-row"><span>Kaçla gidiyor</span><strong>{state.history.inputPace}</strong></div>
              <div className="summary-row"><span>Kaçıncı cüz</span><strong>{state.history.inputJuz}</strong></div>
              <div className="summary-row"><span>Kaç ham aldı</span><strong>{getHamSelectionLabel(state.history.inputHamCount)}</strong></div>

              <label className="field">
                <span>Hafızlığa Başlama Tarihi</span>
                <div className="history-date-segmented">
                  <div className="history-date-segment-head">
                    <span>Gün</span>
                    <span></span>
                    <span>Ay</span>
                    <span></span>
                    <span>Yıl</span>
                  </div>
                  <input
                    ref={dayInputRef}
                    className="history-date-segment history-date-segment-day"
                    type="text"
                    inputMode="numeric"
                    value={(dateSegments.day || '').padEnd(2, '_')}
                    onChange={handleSegmentChange('day', 2, monthInputRef)}
                    onKeyDown={handleSegmentKeyDown('day')}
                    onMouseDown={handleSegmentPointerDown('day', dayInputRef)}
                  />
                  <span className="history-date-slash">/</span>
                  <input
                    ref={monthInputRef}
                    className="history-date-segment history-date-segment-month"
                    type="text"
                    inputMode="numeric"
                    value={(dateSegments.month || '').padEnd(2, '_')}
                    onChange={handleSegmentChange('month', 2, yearInputRef)}
                    onKeyDown={handleSegmentKeyDown('month', dayInputRef)}
                    onMouseDown={handleSegmentPointerDown('month', monthInputRef)}
                  />
                  <span className="history-date-slash">/</span>
                  <input
                    ref={yearInputRef}
                    className="history-date-segment history-date-segment-year"
                    type="text"
                    inputMode="numeric"
                    value={(dateSegments.year || '').padEnd(4, '_')}
                    onChange={handleSegmentChange('year', 4)}
                    onKeyDown={handleSegmentKeyDown('year', monthInputRef)}
                    onMouseDown={handleSegmentPointerDown('year', yearInputRef)}
                  />
                </div>
              </label>

              <input
                ref={startDatePickerRef}
                className="history-date-picker-hidden"
                type="date"
                value={state.history.startDateKey ?? ''}
                tabIndex="-1"
                aria-hidden="true"
                onChange={handlePickerChange}
              />

              <p className="summary-note">İlerleme verileri ana tablodan alınır. Burada yalnızca başlangıç tarihini girmeniz yeterlidir.</p>
            </div>

            <div className="control-card">
              <p className="eyebrow">Geçmişteki Ham Sayıları</p>
              <div className="history-phase-list">
                {[2, 3, 4, 5].map((ham) => (
                  <div key={ham} className="history-phase-row">
                    <span>{ham} Ham</span>
                    <div className="stepper-field history-phase-stepper">
                      <button
                        className={`stepper-button ${invalidStepper === `${ham}--1` ? 'stepper-button-invalid' : ''}`}
                        type="button"
                        onClick={() => handlePhaseShift(ham, -1)}
                      >
                        -
                      </button>
                      <div className="stepper-value">{state.history.phaseCounts[ham]}</div>
                      <button
                        className={`stepper-button ${invalidStepper === `${ham}-1` ? 'stepper-button-invalid' : ''}`}
                        type="button"
                        onClick={() => handlePhaseShift(ham, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="history-phase-note">Toplam ham yükü: <strong>{timeline.weightedHamTotal}</strong> / 20</p>
            </div>
            <button className={`apply-button apply-button-history ${invalidReport ? 'apply-button-invalid' : ''}`} type="button" onClick={handleReport}>Durum Raporu</button>
          </>
        )}
      </aside>
    </main>
  )
}
