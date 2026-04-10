import {
  ROWS,
  COLUMNS,
  app,
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
  renderTabbedPanels,
  startOfMonth,
  startOfWeekMonday,
  toDateKey,
} from './main.js'

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

function getHistoryMonthLabel(year, monthIndex) {
  return formatMonthYear(new Date(year, monthIndex, 1)).split(' ')[0]
}

function getHistoryWeightedHamTotal(phaseCounts) {
  return (2 * phaseCounts[2]) + (3 * phaseCounts[3]) + (4 * phaseCounts[4]) + (5 * phaseCounts[5])
}

function formatTypingDateValue(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
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
    return {
      dateKey: toDateKey(startDate),
      sundayDays: 0,
      holidayDays: 0,
    }
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

  return {
    dateKey: toDateKey(cursor),
    sundayDays,
    holidayDays,
  }
}

function getHistoryProgressForStudyDays(studyDayCount, phaseSequence) {
  if (studyDayCount <= 0 || phaseSequence.length === 0) {
    return {
      pace: 0,
      juz: 0,
    }
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

  if (years > 0) {
    parts.push(`${years} yıl`)
  }

  if (months > 0) {
    parts.push(`${months} ay`)
  }

  if (days > 0 || parts.length === 0) {
    parts.push(`${days} gün`)
  }

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
  const endDateKey = state.completionDateKey ?? getTodayDateKey()
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
      perfectCurrentProgress: {
        pace: 0,
        juz: 0,
      },
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
      allocationMap.set(day.dateKey, {
        type: day.isSunday ? 'sunday' : 'holiday',
        ham: null,
      })
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

    return {
      monthIndex,
      monthLabel: getHistoryMonthLabel(year, monthIndex),
      days,
    }
  })
}

function renderHistoryDay(day) {
  const stateClassMap = {
    inactive: 'history-day-inactive',
    empty: 'history-day-empty',
    sunday: 'history-day-sunday',
    holiday: 'history-day-holiday',
  }

  const studyClass = day.state === 'study' ? HISTORY_STUDY_CLASS_BY_HAM[day.ham] : ''
  const missClass = day.state === 'missed' ? HISTORY_MISS_CLASS_BY_HAM[day.ham] : ''
  const baseClass = stateClassMap[day.state] ?? ''

  return `
    <div class="history-day ${day.isCurrentMonth ? '' : 'history-day-adjacent'} ${day.isToday ? 'history-day-today' : ''} ${baseClass} ${studyClass} ${missClass}">
      <span>${day.dayNumber}</span>
    </div>
  `
}

function triggerHistoryStepperValidationError(button) {
  button.classList.remove('stepper-button-invalid')
  void button.offsetWidth
  button.classList.add('stepper-button-invalid')
  window.setTimeout(() => {
    button.classList.remove('stepper-button-invalid')
  }, 420)
}

function bindHistoryEvents(timeline) {
  const tabButtons = document.querySelectorAll('[data-view-tab]')
  const reportButton = document.getElementById('history-report-button')
  const editButton = document.getElementById('history-edit-button')
  const startDateTextInput = document.getElementById('history-start-date-text')
  const startDatePicker = document.getElementById('history-start-date-picker')
  const yearPrevButton = document.getElementById('history-year-prev')
  const yearNextButton = document.getElementById('history-year-next')

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      renderTabbedPanels(button.dataset.viewTab)
    })
  })

  document.querySelectorAll('[data-phase-ham]').forEach((button) => {
    button.addEventListener('click', () => {
      const ham = Number(button.dataset.phaseHam)
      const direction = Number(button.dataset.phaseDirection)
      const nextCounts = {
        ...state.history.phaseCounts,
        [ham]: clampNumber(state.history.phaseCounts[ham] + direction, 0, 20),
      }

      if (nextCounts[ham] === state.history.phaseCounts[ham]) {
        triggerHistoryStepperValidationError(button)
        return
      }

      const nextWeightedTotal = getHistoryWeightedHamTotal(nextCounts)
      const nextPastCapacity = Math.max(state.history.inputPace - getHistoryCurrentHamValue(state.history.inputHamCount), 0)

      if (direction > 0 && (nextWeightedTotal > 20 || nextWeightedTotal > nextPastCapacity)) {
        triggerHistoryStepperValidationError(button)
        return
      }

      state.history.phaseCounts = nextCounts
      state.history.reportReady = false
      state.history.reportAttempted = false
      state.history.reportBasis = null
      persistState()
      renderHistoryView()
    })
  })

  if (startDateTextInput && startDatePicker) {
    startDateTextInput.addEventListener('input', (event) => {
      const formattedValue = formatTypingDateValue(event.target.value)
      event.target.value = formattedValue
      state.history.startDateText = formattedValue
      state.history.reportReady = false
      state.history.reportAttempted = false
      state.history.reportBasis = null
      persistState()
    })

    startDateTextInput.addEventListener('click', () => {
      if (typeof startDatePicker.showPicker === 'function') {
        try {
          startDatePicker.showPicker()
        } catch {}
      }
    })

    startDateTextInput.addEventListener('change', (event) => {
      const parsedDateKey = parseDateInputText(event.target.value)

      state.history.startDateKey = parsedDateKey
      state.history.startDateText = parsedDateKey ? formatDateInputText(parsedDateKey) : event.target.value

      if (parsedDateKey) {
        state.history.activeYear = parseDateKey(parsedDateKey).getFullYear()
      }

      state.history.reportReady = false
      state.history.reportAttempted = false
      state.history.reportBasis = null
      persistState()
      renderHistoryView()
    })

    startDatePicker.addEventListener('change', (event) => {
      const nextDateKey = event.target.value || null
      state.history.startDateKey = nextDateKey
      state.history.startDateText = nextDateKey ? formatDateInputText(nextDateKey) : ''

      if (nextDateKey) {
        state.history.activeYear = parseDateKey(nextDateKey).getFullYear()
      }

      state.history.reportReady = false
      state.history.reportAttempted = false
      state.history.reportBasis = null
      persistState()
      renderHistoryView()
    })
  }

  if (reportButton) {
    reportButton.addEventListener('click', () => {
      state.history.reportAttempted = true

      if (timeline.validationMessage) {
        reportButton.classList.remove('apply-button-invalid')
        void reportButton.offsetWidth
        reportButton.classList.add('apply-button-invalid')
        window.setTimeout(() => {
          reportButton.classList.remove('apply-button-invalid')
        }, 420)
        persistState()
        renderHistoryView()
        return
      }

      state.history.reportReady = true
      state.history.reportBasis = {
        pace: state.history.inputPace,
        juz: state.history.inputJuz,
        hamCount: state.history.inputHamCount,
      }
      persistState()
      renderHistoryView()
    })
  }

  if (editButton) {
    editButton.addEventListener('click', () => {
      state.history.reportReady = false
      state.history.reportAttempted = false
      state.history.reportBasis = null
      persistState()
      renderHistoryView()
    })
  }

  if (yearPrevButton) {
    yearPrevButton.addEventListener('click', () => {
      state.history.activeYear = Math.max(state.history.activeYear - 1, timeline.years[0])
      persistState()
      renderHistoryView()
    })
  }

  if (yearNextButton) {
    yearNextButton.addEventListener('click', () => {
      state.history.activeYear = Math.min(state.history.activeYear + 1, timeline.years[timeline.years.length - 1])
      persistState()
      renderHistoryView()
    })
  }
}

export function renderHistoryView() {
  const timeline = getHistoryTimeline(state.history)
  state.history.activeYear = timeline.activeYear
  const months = timeline.years.length > 0 ? getHistoryYearMonths(timeline.activeYear, timeline) : []
  const periodEndDate = timeline.endDateKey ? parseDateKey(timeline.endDateKey) : null
  const shouldShowReport = state.history.reportReady && !timeline.validationMessage
  const shouldShowValidation = state.history.reportAttempted && Boolean(timeline.validationMessage)
  const historyNote = shouldShowReport
    ? `Başlangıçtan ${periodEndDate ? formatDate(periodEndDate) : 'bugüne'} kadar olan tahmini ders düzeni.`
    : (shouldShowValidation ? timeline.validationMessage : '')

  app.innerHTML = `
    <main class="history-layout">
      <section class="history-main">
        <div class="folder-tabs folder-tabs-history" aria-label="Sayfa sekmeleri">
          <button class="folder-tab" data-view-tab="main" type="button">Ana Tablo</button>
          <button class="folder-tab" data-view-tab="scenario" type="button">Hayali Senaryo</button>
          <button class="folder-tab folder-tab-active" data-view-tab="history" type="button">Geçmişin Hesabı</button>
        </div>

        <header class="history-header history-header-compact">
          <div></div>
          <p class="history-note">${historyNote}</p>
        </header>

        <section class="history-board">
          <div class="history-board-toolbar">
            <div>
              <p class="eyebrow">Yıllık Takvim</p>
              <h2 class="history-year-title">${timeline.years.length > 0 ? timeline.activeYear : '----'}</h2>
            </div>
            <div class="history-year-nav">
              <button id="history-year-prev" class="history-year-button" type="button" ${timeline.years.length <= 1 || timeline.activeYear === timeline.years[0] ? 'disabled' : ''}>&lsaquo;</button>
              <button id="history-year-next" class="history-year-button" type="button" ${timeline.years.length <= 1 || timeline.activeYear === timeline.years[timeline.years.length - 1] ? 'disabled' : ''}>&rsaquo;</button>
            </div>
          </div>

          ${shouldShowReport ? `
            <div class="history-year-grid">
              ${months.map((month) => `
                <section class="history-month">
                  <h3 class="history-month-title">${month.monthLabel}</h3>
                  <div class="history-month-weekdays">
                    ${HISTORY_WEEKDAY_MINI_LABELS.map((label) => `<span>${label}</span>`).join('')}
                  </div>
                  <div class="history-month-days">
                    ${month.days.map(renderHistoryDay).join('')}
                  </div>
                </section>
              `).join('')}
            </div>
          ` : `
            <div class="history-empty-state">
              <strong>${shouldShowValidation ? 'Rapor oluşturulamadı' : 'Durum raporu bekleniyor'}</strong>
              <p>${shouldShowValidation ? timeline.validationMessage : ''}</p>
            </div>
          `}
        </section>
      </section>

      <aside class="history-side">
        ${shouldShowReport ? `
        <div class="control-card summary-card">
          <p class="eyebrow">Durum Özeti</p>
          <div class="history-progress-compare">
            <div class="history-progress-card history-progress-card-actual">
              <span class="history-progress-title">Şu Anda</span>
              <div class="history-progress-fraction">
                <div class="history-progress-part">
                  <span class="history-progress-label">Kaçla gidiyor</span>
                  <strong>${state.history.reportBasis ? state.history.reportBasis.pace : state.history.inputPace}</strong>
                </div>
                <div class="history-progress-line"></div>
                <div class="history-progress-part">
                  <span class="history-progress-label">Kaçıncı cüzde</span>
                  <strong>${state.history.reportBasis ? state.history.reportBasis.juz : state.history.inputJuz}</strong>
                </div>
              </div>
            </div>

            <div class="history-progress-card history-progress-card-perfect">
              <span class="history-progress-title">Mükemmel Gitseydi</span>
              <div class="history-progress-fraction">
                <div class="history-progress-part">
                  <span class="history-progress-label">Kaçla gidecekti</span>
                  <strong>${timeline.perfectCurrentProgress.pace}</strong>
                </div>
                <div class="history-progress-line"></div>
                <div class="history-progress-part">
                  <span class="history-progress-label">Kaçıncı cüzde olacaktı</span>
                  <strong>${timeline.perfectCurrentProgress.juz}</strong>
                </div>
              </div>
            </div>
          </div>
          <div class="summary-row">
            <span>Kaç ham aldı</span>
            <strong>${getHamSelectionLabel(state.history.reportBasis ? state.history.reportBasis.hamCount : state.history.inputHamCount)}</strong>
          </div>
          <div class="summary-row">
            <span>Toplam geçen gün</span>
            <strong>${timeline.totalElapsedDays}</strong>
          </div>
          <div class="summary-row">
            <span>Ders verilen gün</span>
            <strong>${timeline.studyDays}</strong>
          </div>
          <div class="summary-row">
            <span>Ders verilmeyen gün</span>
            <strong>${timeline.missedDays}</strong>
          </div>
          <div class="summary-row">
            <span>Pazar + Tatil</span>
            <strong>${timeline.blockedDays}</strong>
          </div>
          <div class="summary-row">
            <span>Gri kare hesabı</span>
            <strong>${timeline.baselineCount}</strong>
          </div>
          <div class="summary-row">
            <span>Mükemmel Bitiriş Tarihi</span>
            <strong>${timeline.perfectFinishDateKey ? formatDate(parseDateKey(timeline.perfectFinishDateKey)) : '--'}</strong>
          </div>
          <div class="summary-row">
            <span>Ziyade Zaman</span>
            <strong>${timeline.ziyadeZamanLabel}</strong>
          </div>
          <p class="summary-note">
            1 ham geçmişi otomatik kabul edilir. 2-5 ham girişleri yalnızca geçmişte tamamlanmış 30 cüz bloklarını renklendirmek için kullanılır.
          </p>
          <button id="history-edit-button" class="apply-button" type="button">Yeni Veri Girişi</button>
        </div>
        ` : `
        <div class="control-card">
          <p class="eyebrow">Veri Girişi</p>
          <h2>Başlangıç tarihi</h2>

          <div class="summary-row">
            <span>Kaçla gidiyor</span>
            <strong>${state.history.inputPace}</strong>
          </div>
          <div class="summary-row">
            <span>Kaçıncı cüz</span>
            <strong>${state.history.inputJuz}</strong>
          </div>
          <div class="summary-row">
            <span>Kaç ham aldı</span>
            <strong>${getHamSelectionLabel(state.history.inputHamCount)}</strong>
          </div>

          <label class="field">
            <span>Hafızlığa başlama tarihi</span>
            <input
              id="history-start-date-text"
              type="text"
              inputmode="numeric"
              placeholder="gg/aa/yyyy"
              value="${state.history.startDateText}"
            />
          </label>

          <input id="history-start-date-picker" class="history-date-picker-hidden" type="date" value="${state.history.startDateKey ?? ''}" tabindex="-1" aria-hidden="true" />

          <p class="summary-note">
            İlerleme verileri ana tablodan alınır. Burada yalnızca başlangıç tarihini girmeniz yeterlidir.
          </p>
        </div>

        <div class="control-card">
          <p class="eyebrow">Ham Sayıları</p>
          <div class="history-phase-list">
            ${[2, 3, 4, 5].map((ham) => `
              <div class="history-phase-row">
                <span>${ham} Ham</span>
                <div class="stepper-field history-phase-stepper">
                  <button class="stepper-button" data-phase-ham="${ham}" data-phase-direction="-1" type="button">-</button>
                  <div class="stepper-value">${state.history.phaseCounts[ham]}</div>
                  <button class="stepper-button" data-phase-ham="${ham}" data-phase-direction="1" type="button">+</button>
                </div>
              </div>
            `).join('')}
          </div>
          <p class="history-phase-note">
            Toplam ham yükü: <strong>${timeline.weightedHamTotal}</strong> / 20
          </p>
        </div>
        <button id="history-report-button" class="apply-button" type="button">Durum Raporu</button>
        `}
      </aside>
    </main>
  `

  bindHistoryEvents(timeline)
}
