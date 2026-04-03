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
  doesScenarioChoiceIncludeSunday,
  estimateProjectedEndDate,
  formatMonthYear,
  getCellState,
  getFillSequenceIndex,
  getMarkMap,
  getScenarioBoundarySelectableHamLimit,
  getScenarioVisual,
  getScenarioWeekMaxChoice,
  isScenarioPastStartDay,
  parseDateKey,
  projectScenarioOutcome,
  renderTabbedPanels,
  renderScenarioDate,
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
  const optionButtons = document.querySelectorAll('.scenario-option')
  const hamButtons = document.querySelectorAll('[data-ham]')
  const backButton = document.getElementById('back-to-main')
  const tabButtons = document.querySelectorAll('[data-view-tab]')

  optionButtons.forEach((button) => {
    if (button.dataset.ham) {
      return
    }

    button.addEventListener('click', () => {
      applyScenarioChoice(Number(button.dataset.choice))
    })
  })

  hamButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.ham === 'repeat' ? 'repeat' : Number(button.dataset.ham)
      applyHamSelection(value)
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
  )
  const previewMarkMap = getMarkMap(preview.marks)
  const maxSelectableChoice = getScenarioWeekMaxChoice(scenario)
  const boundaryHamLimit = getScenarioBoundarySelectableHamLimit(scenario)
  const animatedResultKeySet = new Set(scenario.animatedResultKeys)
  const animatedOrderMap = new Map(scenario.animatedResultKeys.map((dateKey, index) => [dateKey, index]))

  state.scenario = scenario

  app.innerHTML = `
    <main class="scenario-layout">
      <section class="scenario-main">
        <div class="folder-tabs folder-tabs-scenario" aria-label="Sayfa sekmeleri">
          <button class="folder-tab" data-view-tab="main" type="button">Ana Tablo</button>
          <button class="folder-tab folder-tab-active" data-view-tab="scenario" type="button">Hayali Senaryo</button>
          <button class="folder-tab" data-view-tab="history" type="button">Geçmişin Hesabı</button>
        </div>

        <header class="scenario-header">
          <div>
            <p class="eyebrow">Simülasyon</p>
            <h1 class="scenario-title">Hayali Senaryo</h1>
          </div>
          <div class="scenario-date-block">
            <span class="scenario-date-label">Tahmini bitiş tarihi</span>
            <div class="scenario-date-window">
              <div class="scenario-date-text">
                ${renderScenarioDate(
                  scenario.currentEndDate ?? projectedEndDate,
                  scenario.previousEndDate,
                  scenario.dateVersion,
                  scenario.dateWidthReference,
                )}
              </div>
            </div>
          </div>
        </header>

        <div class="scenario-strip-shell">
          <p class="scenario-month-label">${formatMonthYear(parseDateKey(scenario.monthStartKey))}</p>
          <div class="scenario-strip-viewport scenario-calendar-viewport">
            <div class="scenario-calendar-frame">
              <div class="scenario-calendar-corner"></div>
              <div class="scenario-calendar-head">
                ${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join('')}
              </div>
              <div class="scenario-week-rail">
                ${Array.from({ length: scenario.weekCount }, (_, weekIndex) => `
                  <span class="scenario-week-label ${weekIndex === scenario.activeWeekIndex ? 'scenario-week-label-active' : ''}">
                    ${weekIndex + 1}. Hafta
                  </span>
                `).join('')}
              </div>
              <div class="scenario-calendar-grid">
                ${scenario.visibleDays.map((day, index) => {
                  const result = scenario.windowResults[day.dateKey]
                  const staticEntry = day.isCurrentMonth && day.isClosed ? createScenarioClosedEntry(day) : null
                  const visual = getScenarioVisual(result ?? staticEntry)
                  const dayLabel = day.isCurrentMonth && day.isSunday ? 'Pazar' : visual.label
                  const isPastStartDay = isScenarioPastStartDay(scenario, day)
                  const isOutsideMonth = !day.isCurrentMonth
                  const isPastWeek = day.weekIndex < scenario.activeWeekIndex
                  const isActiveWeek = day.weekIndex === scenario.activeWeekIndex
                  const isFutureWeek = day.weekIndex > scenario.activeWeekIndex
                  const fillClass = scenario.filling
                    && isActiveWeek
                    && result
                    && result.type !== 'sunday'
                    && result.type !== 'holiday'
                    && day.isCurrentMonth
                    && animatedResultKeySet.has(day.dateKey)
                    ? 'scenario-tile-fill-in'
                    : ''
                  const waveClass = scenario.rolling
                    ? 'scenario-tile-wave-out'
                    : (scenario.incoming ? 'scenario-tile-wave-in' : '')
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
                      ${dayLabel ? `<span class="scenario-tile-mark ${day.isCurrentMonth && day.isSunday ? 'scenario-tile-mark-sunday' : ''}">${dayLabel}</span>` : ''}
                    </div>
                  `
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="scenario-actions">
          ${Array.from({ length: 8 }, (_, index) => {
            const value = index
            const includesSunday = doesScenarioChoiceIncludeSunday(scenario, value)
            return `
              <button
                class="scenario-option scenario-choice-option ${includesSunday ? 'scenario-choice-option-sunday' : ''}"
                data-choice="${value}"
                type="button"
                style="--scenario-choice-bg:${getScenarioChoiceBackground(value, maxSelectableChoice)}"
                ${scenario.complete || scenario.locked || value > maxSelectableChoice ? 'disabled' : ''}
              >
                ${includesSunday ? '<span class="scenario-option-hint">Pazar</span>' : ''}
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
        <div class="scenario-modal">
          <p class="eyebrow">${scenario.modalContext === 'initial' ? 'Başlangıç' : 'Yeni Aşama'}</p>
          <h2>${scenario.modalContext === 'initial' ? 'Kaç Hamla Gidiyorsun?' : 'Kaç Ham Alacaksın?'}</h2>
          <div class="scenario-modal-actions scenario-modal-actions-stacked">
            ${HAM_OPTIONS
              .filter((option) => scenario.modalContext === 'initial' || option <= boundaryHamLimit)
              .map((option) => `
              <button class="scenario-option scenario-modal-option" data-ham="${option}" type="button">${option}</button>
            `).join('')}
            <button class="scenario-option scenario-modal-option scenario-modal-option-repeat" data-ham="repeat" type="button">Tekrar</button>
          </div>
        </div>
      </div>
    ` : ''}
  `

  bindScenarioEvents()
}
