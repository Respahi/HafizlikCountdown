import {
  TOTAL_CELLS,
  WEEKDAY_LABELS,
  HAM_OPTIONS,
  app,
  state,
  applyHamSelection,
  applyScenarioChoice,
  commitScenarioToMain,
  createScenarioClosedEntry,
  createScenarioState,
  estimateProjectedEndDate,
  formatMonthYear,
  getCellState,
  getFillSequenceIndex,
  getMarkMap,
  getScenarioBoundarySelectableHamLimit,
  getScenarioChoiceHint,
  getScenarioMonthView,
  getScenarioVisual,
  getScenarioWeekMaxChoice,
  isScenarioPastStartDay,
  navigateScenarioMonth,
  parseDateKey,
  projectScenarioOutcome,
  renderTabbedPanels,
  renderScenarioDate,
  selectScenarioLessonCount,
  selectScenarioMode,
  startScenarioFromModal,
  toggleScenarioAvailability,
} from './main.js'

function getScenarioChoiceBackground(choice, maxSelectableChoice) {
  const safeMaxChoice = Math.max(maxSelectableChoice, 1)
  const ratio = Math.min(Math.max(choice / safeMaxChoice, 0), 1)
  const hue = 2 + (140 * ratio)
  const saturation = 66
  const lightness = 37 - (4 * ratio)

  return `hsl(${Math.round(hue)} ${saturation}% ${Math.round(lightness)}%)`
}

function bindScenarioEvents() {
  const optionButtons = document.querySelectorAll('[data-choice]')
  const modeButtons = document.querySelectorAll('[data-scenario-mode]')
  const hamButtons = document.querySelectorAll('[data-modal-ham]')
  const lessonButtons = document.querySelectorAll('[data-modal-lesson]')
  const availabilityButtons = document.querySelectorAll('[data-availability-kind]')
  const startButton = document.getElementById('scenario-start-button')
  const monthNavButtons = document.querySelectorAll('[data-scenario-nav]')
  const backButton = document.getElementById('back-to-main')
  const tabButtons = document.querySelectorAll('[data-view-tab]')

  optionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyScenarioChoice(Number(button.dataset.choice))
    })
  })

  hamButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.modalHam === 'repeat' ? 'repeat' : Number(button.dataset.modalHam)
      applyHamSelection(value)
    })
  })

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectScenarioMode(button.dataset.scenarioMode)
    })
  })

  lessonButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectScenarioLessonCount(Number(button.dataset.modalLesson))
    })
  })

  availabilityButtons.forEach((button) => {
    button.addEventListener('click', () => {
      toggleScenarioAvailability(button.dataset.availabilityKind)
    })
  })

  if (startButton) {
    startButton.addEventListener('click', () => {
      startScenarioFromModal()
    })
  }

  monthNavButtons.forEach((button) => {
    button.addEventListener('click', () => {
      navigateScenarioMonth(Number(button.dataset.scenarioNav))
    })
  })

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      renderTabbedPanels(button.dataset.viewTab)
    })
  })

  backButton.addEventListener('click', commitScenarioToMain)
}

export function renderScenarioView() {
  const scenario = state.scenario ?? createScenarioState()
  const preview = projectScenarioOutcome()
  const projectedEndDate = estimateProjectedEndDate(
    Math.max(TOTAL_CELLS - preview.filledCount, 0),
    preview.spentStudyDays,
    preview.closedStudyDays,
  )
  const previewMarkMap = getMarkMap(preview.marks)
  const maxSelectableChoice = getScenarioWeekMaxChoice(scenario)
  const boundaryHamLimit = getScenarioBoundarySelectableHamLimit(scenario)
  const animatedResultKeySet = new Set(scenario.animatedResultKeys)
  const animatedOrderMap = new Map(scenario.animatedResultKeys.map((dateKey, index) => [dateKey, index]))
  const scenarioEntryMap = new Map((scenario.archivedEntries ?? scenario.entries).map((entry) => [entry.dateKey, entry]))
  const displayMonthStartKey = scenario.viewMonthStartKey ?? scenario.monthStartKey
  const displayMonthDate = parseDateKey(displayMonthStartKey)
  const displayMonth = displayMonthStartKey === scenario.monthStartKey
    ? {
        monthStartKey: scenario.monthStartKey,
        weekCount: scenario.weekCount,
        visibleDays: scenario.visibleDays,
      }
    : getScenarioMonthView(displayMonthDate)
  const isViewingCurrentMonth = displayMonthStartKey === scenario.monthStartKey
  const canGoToPreviousMonth = displayMonthStartKey > scenario.startMonthStartKey
  const canGoToNextMonth = displayMonthStartKey < scenario.monthStartKey
  const manualChoiceDisabled = scenario.complete || scenario.locked || scenario.mode === 'monthly' || !isViewingCurrentMonth
  const monthlyHamLocked = !scenario.modalBoundary && scenario.mode === 'monthly' && scenario.virtualJuz > 0
  const weeklyChoiceButtonMax = scenario.includeSundayStudy ? 7 : 6
  const monthlyLessonOptionMax = scenario.includeSundayStudy ? 7 : 6
  const shouldShowMonthlyLessonOptions = scenario.mode === 'monthly' && (monthlyHamLocked || scenario.modalHamSelection != null)
  const canStartScenario = scenario.mode === 'weekly'
    ? scenario.modalHamSelection != null
    : (scenario.modalLessonSelection != null && (monthlyHamLocked || scenario.modalHamSelection != null))

  state.scenario = scenario

  app.innerHTML = `
    <main class="scenario-layout">
      <section class="scenario-main">
        <div class="view-topbar">
          <div class="folder-tabs folder-tabs-scenario" aria-label="Sayfa sekmeleri">
            <button class="folder-tab" data-view-tab="main" type="button">Ana Tablo</button>
            <button class="folder-tab folder-tab-active" data-view-tab="scenario" type="button">Hayali Senaryo</button>
            <button class="folder-tab" data-view-tab="history" type="button">Geçmişin Hesabı</button>
          </div>
        </div>

        <div class="scenario-strip-shell">
          <div class="scenario-month-bar">
            <button class="scenario-month-nav" data-scenario-nav="-1" type="button" ${canGoToPreviousMonth ? '' : 'disabled'} aria-label="Önceki ay">
              <span class="scenario-month-nav-arrow">&#8249;</span>
              <span class="scenario-month-nav-text">Önceki</span>
            </button>
            <p class="scenario-month-label">${formatMonthYear(displayMonthDate)}</p>
            <button class="scenario-month-nav" data-scenario-nav="1" type="button" ${canGoToNextMonth ? '' : 'disabled'} aria-label="Sonraki ay">
              <span class="scenario-month-nav-text">Sonraki</span>
              <span class="scenario-month-nav-arrow">&#8250;</span>
            </button>
          </div>
          <div class="scenario-strip-viewport scenario-calendar-viewport">
            <div class="scenario-calendar-frame">
              <div class="scenario-calendar-corner"></div>
              <div class="scenario-calendar-head">
                ${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join('')}
              </div>
              <div class="scenario-week-rail">
                ${Array.from({ length: displayMonth.weekCount }, (_, weekIndex) => `
                  <span class="scenario-week-label ${isViewingCurrentMonth && weekIndex === scenario.activeWeekIndex ? 'scenario-week-label-active' : ''}">
                    ${weekIndex + 1}. Hafta
                  </span>
                `).join('')}
              </div>
              <div class="scenario-calendar-grid">
                ${displayMonth.visibleDays.map((day, index) => {
                  const result = scenario.windowResults[day.dateKey] ?? scenarioEntryMap.get(day.dateKey)
                  const staticEntry = day.isCurrentMonth && day.isClosed ? createScenarioClosedEntry(day) : null
                  const visual = getScenarioVisual(result ?? staticEntry)
                  const dayLabel = day.isCurrentMonth && day.isSunday
                    ? 'Pazar'
                    : (day.isCurrentMonth && day.isHoliday ? 'Tatil' : visual.label)
                  const isPastStartDay = isScenarioPastStartDay(scenario, day)
                  const isOutsideMonth = !day.isCurrentMonth
                  const isPastWeek = isViewingCurrentMonth ? day.weekIndex < scenario.activeWeekIndex : displayMonthStartKey < scenario.monthStartKey
                  const isActiveWeek = isViewingCurrentMonth && day.weekIndex === scenario.activeWeekIndex
                  const isFutureWeek = isViewingCurrentMonth && day.weekIndex > scenario.activeWeekIndex
                  const isMonthlyMode = scenario.mode === 'monthly'
                  const fillClass = scenario.filling
                    && isActiveWeek
                    && result
                    && result.type !== 'sunday'
                    && result.type !== 'holiday'
                    && day.isCurrentMonth
                    && animatedResultKeySet.has(day.dateKey)
                    ? (isMonthlyMode ? 'scenario-tile-fill-in-monthly' : 'scenario-tile-fill-in')
                    : ''
                  const waveClass = scenario.rolling
                    ? (isMonthlyMode ? 'scenario-tile-wave-out-monthly' : 'scenario-tile-wave-out')
                    : (scenario.incoming ? (isMonthlyMode ? 'scenario-tile-wave-in-monthly' : 'scenario-tile-wave-in') : '')
                  const fillOrder = animatedOrderMap.get(day.dateKey) ?? day.weekdayIndex
                  const mutedFillClass = isOutsideMonth
                    ? 'scenario-tile-fill-adjacent'
                    : (!visual.fillClass && (isPastWeek || isFutureWeek || isPastStartDay)
                        ? `scenario-tile-fill-${isFutureWeek ? 'locked' : 'muted'}`
                        : '')

                  return `
                    <div
                      class="scenario-tile scenario-day ${visual.tileClass} ${isActiveWeek && !isOutsideMonth ? 'scenario-day-active' : ''} ${isFutureWeek || isPastStartDay ? 'scenario-day-locked' : ''} ${isOutsideMonth ? 'scenario-day-adjacent' : ''} ${waveClass}"
                      style="--wave-order:${index}; --fill-order:${fillOrder}"
                    >
                      <span class="scenario-tile-fill ${visual.fillClass} ${mutedFillClass} ${fillClass}"></span>
                      ${day.isCurrentMonth && day.isSunday ? '<span class="scenario-tile-sunday-overlay"></span>' : ''}
                      <div class="scenario-day-head">
                        <span class="scenario-day-number">${day.dayNumber}</span>
                      </div>
                      ${dayLabel ? `<span class="scenario-tile-mark ${day.isCurrentMonth && (day.isSunday || day.isHoliday) ? 'scenario-tile-mark-sunday' : ''}">${dayLabel}</span>` : ''}
                    </div>
                  `
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="scenario-actions">
          ${Array.from({ length: weeklyChoiceButtonMax + 1 }, (_, index) => {
            const value = index
            const choiceHint = getScenarioChoiceHint(scenario, value)
            const includesSunday = choiceHint === 'Pazar'
            return `
              <button
                class="scenario-option scenario-choice-option ${includesSunday ? 'scenario-choice-option-sunday' : ''}"
                data-choice="${value}"
                type="button"
                style="--scenario-choice-bg:${getScenarioChoiceBackground(value, maxSelectableChoice)}"
                ${manualChoiceDisabled || value > maxSelectableChoice ? 'disabled' : ''}
              >
                ${choiceHint ? `<span class="scenario-option-hint">${choiceHint}</span>` : ''}
                <span class="scenario-option-value">${value}</span>
              </button>
            `
          }).join('')}
        </div>

        <button id="back-to-main" class="back-button" type="button">Ana Tablo'ya Dön</button>
      </section>

      <aside class="scenario-side">
        <div class="control-card scenario-fraction-card">
          <p class="eyebrow">İlerleme</p>
          <div class="scenario-fraction">
            <div class="scenario-fraction-part">
              <span class="scenario-fraction-label">Kaçla gidiyor</span>
              <strong>${preview.pace}</strong>
            </div>
            <div class="scenario-fraction-line"></div>
            <div class="scenario-fraction-part">
              <span class="scenario-fraction-label">Kaçıncı cüzde</span>
              <strong>${preview.juz}</strong>
            </div>
          </div>
        </div>

        <div class="control-card scenario-preview-date-card">
          <div class="board-note scenario-preview-note">
            <span class="board-note-label">Tahmini bitiş tarihi</span>
            <strong class="board-note-date">
              <span class="scenario-date-window">
                <span class="scenario-date-text">
                  ${renderScenarioDate(
                    scenario.currentEndDate ?? projectedEndDate,
                    scenario.previousEndDate,
                    scenario.dateVersion,
                    scenario.dateWidthReference,
                  )}
                </span>
              </span>
            </strong>
          </div>
        </div>

        <div class="control-card scenario-mini-card">
          <p class="eyebrow">Ana Tablo Ön İzleme</p>
          <div class="scenario-mini-grid" aria-label="Ana tablonun minyatür temsili">
            ${Array.from({ length: TOTAL_CELLS }, (_, index) => {
              const order = getFillSequenceIndex(index)
              const progressIndex = order + 1
              const cellState = getCellState(progressIndex, preview.baselineCount, previewMarkMap)

              return `
                <div class="scenario-mini-cell">
                  <span class="scenario-mini-fill ${cellState.fillClass ? `scenario-mini-${cellState.fillClass.replace('cell-', '')}` : ''}"></span>
                  ${cellState.labelValue ? `<span class="scenario-mini-label">${cellState.labelValue}</span>` : ''}
                </div>
              `
            }).join('')}
          </div>
        </div>
      </aside>
    </main>
    ${scenario.modalOpen ? `
      <div class="scenario-modal-backdrop">
        <div class="scenario-modal-stack">
          <div class="scenario-modal scenario-mode-modal ${scenario.modalStep !== 'mode' ? 'scenario-mode-modal-raised' : ''}">
            <p class="eyebrow">${scenario.modalBoundary ? 'Yeni Aşama' : 'Başlangıç'}</p>
            <h2>Hangi Mod?</h2>
            <div class="scenario-mode-actions">
              <button class="scenario-option scenario-mode-option ${scenario.mode === 'weekly' ? 'scenario-mode-option-active' : ''}" data-scenario-mode="weekly" type="button">Haftalık</button>
              <button class="scenario-option scenario-mode-option ${scenario.mode === 'monthly' ? 'scenario-mode-option-active' : ''}" data-scenario-mode="monthly" type="button">Aylık</button>
            </div>
            <div class="scenario-availability-actions">
              <button class="scenario-availability-option ${scenario.includeSundayStudy ? 'scenario-availability-option-active' : ''}" data-availability-kind="sunday" type="button">
                <span class="scenario-availability-check">${scenario.includeSundayStudy ? '✓' : ''}</span>
                <span class="scenario-availability-label">Pazarlar</span>
              </button>
              <button class="scenario-availability-option ${scenario.includeHolidayStudy ? 'scenario-availability-option-active' : ''}" data-availability-kind="holiday" type="button">
                <span class="scenario-availability-check">${scenario.includeHolidayStudy ? '✓' : ''}</span>
                <span class="scenario-availability-label">Tatil-Bayramlar</span>
              </button>
            </div>
          </div>

          ${scenario.modalStep !== 'mode' ? `
            <div class="scenario-modal scenario-detail-modal">
              ${scenario.mode === 'weekly' ? `
                <p class="eyebrow">Haftalık Mod</p>
                <h2>${scenario.modalBoundary ? 'Kaç Ham Alacaksın?' : 'Kaç Ham?'}</h2>
                  <div class="scenario-modal-actions scenario-modal-actions-stacked">
                    ${HAM_OPTIONS
                      .filter((option) => !scenario.modalBoundary || option <= boundaryHamLimit)
                      .map((option) => `
                      <button class="scenario-option scenario-modal-option ${scenario.modalHamSelection === option ? 'scenario-modal-option-active' : ''}" data-modal-ham="${option}" type="button">${option}</button>
                    `).join('')}
                    <button class="scenario-option scenario-modal-option scenario-modal-option-repeat ${scenario.modalHamSelection === 'repeat' ? 'scenario-modal-option-active' : ''}" data-modal-ham="repeat" type="button">Tekrar</button>
                  </div>
              ` : `
                <p class="eyebrow">Aylık Mod</p>
                <div class="scenario-detail-section">
                  <h2>${scenario.modalBoundary ? 'Kaç Ham Alacaksın?' : 'Kaç Ham?'}</h2>
                  <div class="scenario-modal-actions scenario-modal-actions-stacked">
                    ${HAM_OPTIONS
                      .filter((option) => !scenario.modalBoundary || option <= boundaryHamLimit)
                      .map((option) => `
                        <button class="scenario-option scenario-modal-option ${scenario.modalHamSelection === option ? 'scenario-modal-option-active' : ''}" data-modal-ham="${option}" type="button" ${monthlyHamLocked ? 'disabled' : ''}>${option}</button>
                      `).join('')}
                    <button class="scenario-option scenario-modal-option scenario-modal-option-repeat ${scenario.modalHamSelection === 'repeat' ? 'scenario-modal-option-active' : ''}" data-modal-ham="repeat" type="button" ${monthlyHamLocked ? 'disabled' : ''}>Tekrar</button>
                  </div>
                  ${monthlyHamLocked ? '<p class="scenario-modal-note">Ara cüzde aylık moda geçerken ham ana tablodaki mevcut değerle sabit kalır. Yeni ham seçimi 30. cüzde açılır.</p>' : ''}
                </div>
                ${shouldShowMonthlyLessonOptions ? `
                  <div class="scenario-detail-section">
                    <h2>Haftalık Kaç Ders?</h2>
                    <div class="scenario-monthly-lesson-strip" style="--scenario-lesson-count:${monthlyLessonOptionMax + 1}">
                      ${Array.from({ length: monthlyLessonOptionMax + 1 }, (_, index) => `
                        <button class="scenario-option scenario-modal-option scenario-monthly-lesson-option ${scenario.modalLessonSelection === index ? 'scenario-modal-option-active' : ''}" data-modal-lesson="${index}" type="button">${index}</button>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              `}
              <button id="scenario-start-button" class="scenario-button scenario-modal-start-button" type="button" ${canStartScenario ? '' : 'disabled'}>
                Senaryoya Başla
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}
  `

  bindScenarioEvents()
}
