import {
  ROWS,
  COLUMNS,
  TOTAL_CELLS,
  app,
  state,
  clampNumber,
  calculateFilledCount,
  closeCompletionModal,
  estimateProjectedEndDate,
  estimateCompletion,
  formatDate,
  getCellState,
  getFillSequenceIndex,
  getHamSelectionLabel,
  getHamSelectionNumericValue,
  getMarkMap,
  getProjectedEndDate,
  openScenarioView,
  persistState,
  render,
  renderTabbedPanels,
  renderCompletionModal,
  shiftHamSelection,
  setForecastEndDate,
  syncCompletionState,
  triggerApplyButtonValidationError,
} from './main.js'

function bindMainEvents() {
  const paceInput = document.getElementById('pace-input')
  const juzInput = document.getElementById('juz-input')
  const hamCountDecrement = document.getElementById('ham-count-decrement')
  const hamCountIncrement = document.getElementById('ham-count-increment')
  const hamCountValue = document.getElementById('ham-count-value')
  const applyButton = document.getElementById('apply-button')
  const scenarioButton = document.getElementById('scenario-button')
  const closeCompletionButton = document.getElementById('close-completion-modal')
  const resetButton = document.getElementById('reset-button')
  const tabButtons = document.querySelectorAll('[data-view-tab]')
  const syncHamCountValue = () => {
    hamCountValue.textContent = getHamSelectionLabel(state.inputHamCount)
  }
  const triggerStepperValidationError = (button) => {
    button.classList.remove('stepper-button-invalid')
    void button.offsetWidth
    button.classList.add('stepper-button-invalid')
    window.setTimeout(() => {
      button.classList.remove('stepper-button-invalid')
    }, 420)
  }

  paceInput.addEventListener('input', (event) => {
    state.inputPace = clampNumber(event.target.value, 0, ROWS)
    persistState()
  })

  juzInput.addEventListener('input', (event) => {
    state.inputJuz = clampNumber(event.target.value, 0, COLUMNS)
    persistState()
  })

  hamCountDecrement.addEventListener('click', () => {
    const nextHamCount = shiftHamSelection(state.inputHamCount, -1)

    if (nextHamCount === state.inputHamCount) {
      triggerStepperValidationError(hamCountDecrement)
      return
    }

    state.inputHamCount = nextHamCount
    persistState()
    syncHamCountValue()
  })

  hamCountIncrement.addEventListener('click', () => {
    const nextHamCount = shiftHamSelection(state.inputHamCount, 1)

    if (nextHamCount === state.inputHamCount) {
      triggerStepperValidationError(hamCountIncrement)
      return
    }

    state.inputHamCount = nextHamCount
    persistState()
    syncHamCountValue()
  })

  applyButton.addEventListener('click', () => {
    const rawPace = Number(paceInput.value)
    const rawJuz = Number(juzInput.value)
    const rawHamCount = state.inputHamCount
    const isZeroStart = rawPace === 0 && rawJuz === 0
    const isPaceStart = rawPace >= 1 && rawJuz >= 0
    const hasInvalidInput = (
      Number.isNaN(rawPace)
      || Number.isNaN(rawJuz)
      || rawPace < 0
      || rawJuz < 0
      || rawPace > ROWS
      || rawJuz > COLUMNS
      || (!isZeroStart && !isPaceStart)
    )

    if (hasInvalidInput) {
      triggerApplyButtonValidationError(applyButton)
      return
    }

    const previousFilledCount = state.filledCount
    state.pace = rawPace
    state.juz = rawJuz
    state.inputHamCount = rawHamCount
    state.filledCount = calculateFilledCount(state.pace, state.juz, rawHamCount)
    state.baselineCount = state.filledCount
    state.committedMarks = []
    state.carryRedCount = 0
    state.spentStudyDays = 0
    state.animate = false
    state.preferredScenarioHam = rawJuz !== 30 ? rawHamCount : null
    state.scenario = null
    const nextDisplayEndDate = estimateProjectedEndDate(TOTAL_CELLS - state.filledCount, state.spentStudyDays)
    setForecastEndDate(nextDisplayEndDate)
    syncCompletionState(previousFilledCount, state.filledCount, nextDisplayEndDate)

    render()

    requestAnimationFrame(() => {
      state.animate = true
      render()
      persistState()

      window.setTimeout(() => {
        state.animate = false
        render()
      }, Math.min(state.filledCount * 10 + 450, 8000))
    })
  })

  scenarioButton.addEventListener('click', openScenarioView)

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      renderTabbedPanels(button.dataset.viewTab)
    })
  })

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      state.pace = 0
      state.juz = 0
      state.inputPace = 1
      state.inputJuz = 0
      state.inputHamCount = 1
      state.filledCount = 0
      state.baselineCount = 0
      state.animate = false
      state.committedMarks = []
      state.carryRedCount = 0
      state.spentStudyDays = 0
      state.forecastEndDateKey = null
      state.completionDateKey = null
      state.completionModalOpen = false
      state.preferredScenarioHam = null
      state.scenario = null
      persistState()
      render()
    })
  }

  if (closeCompletionButton) {
    closeCompletionButton.addEventListener('click', closeCompletionModal)
  }
}

export function renderMainView() {
  const filledCount = state.filledCount
  const remainingPages = TOTAL_CELLS - filledCount
  const percent = ((filledCount / TOTAL_CELLS) * 100).toFixed(1)
  const estimate = estimateCompletion(remainingPages, state.spentStudyDays)
  const displayEndDate = getProjectedEndDate(remainingPages, state.spentStudyDays)
  const markMap = getMarkMap(state.committedMarks)

  app.innerHTML = `
    <main class="layout">
      <section class="board-panel">
        <div class="folder-tabs folder-tabs-main" aria-label="Sayfa sekmeleri">
          <button class="folder-tab folder-tab-active" data-view-tab="main" type="button">Ana Tablo</button>
          <button class="folder-tab" data-view-tab="scenario" type="button">Hayali Senaryo</button>
          <button class="folder-tab" data-view-tab="history" type="button">Geçmişin Hesabı</button>
        </div>

        <div class="board-heading">
          <div>
            <p class="eyebrow">Osmanlı Usulü Hafızlık</p>
            <h1>Hafızlık Ne Zaman Biter</h1>
          </div>
          <div class="board-note">
            <span class="board-note-label">Tahmini bitiş tarihi</span>
            <strong class="board-note-date">${formatDate(displayEndDate)}</strong>
          </div>
        </div>

        <div class="grid-shell">
          <div class="grid-labels grid-labels-top">
            ${Array.from({ length: COLUMNS }, (_, index) => `<span>${index + 1}</span>`).join('')}
          </div>
          <div class="grid-area">
            <div class="grid-labels grid-labels-side">
              ${Array.from({ length: ROWS }, (_, index) => `<span>${ROWS - index}</span>`).join('')}
            </div>
            <div class="progress-grid" aria-label="600 karelik hafızlık tablosu">
              ${Array.from({ length: TOTAL_CELLS }, (_, index) => {
                const order = getFillSequenceIndex(index)
                const progressIndex = order + 1
                const cellState = getCellState(progressIndex, state.baselineCount, markMap)
                const animationStyle =
                  state.animate && progressIndex <= state.baselineCount ? `style="--fill-delay:${order * 10}ms"` : ''

                return `
                  <div
                    class="cell"
                    ${animationStyle}
                    title="Satır ${ROWS - Math.floor(index / COLUMNS)}, Cüz ${(index % COLUMNS) + 1}"
                  >
                    <span class="cell-fill ${cellState.fillClass}${state.animate && progressIndex <= state.baselineCount ? ' cell-animated' : ''}"></span>
                    ${cellState.labelValue ? `<span class="cell-label ${cellState.labelClass}">${cellState.labelValue}</span>` : ''}
                  </div>
                `
              }).join('')}
            </div>
          </div>
        </div>
      </section>

      <aside class="control-panel">
        <div class="control-card">
          <p class="eyebrow">Veri Girişi</p>
          <h2>İlerlemeyi aktar</h2>

          <label class="field">
            <span>Kaçla gidiyor</span>
            <input id="pace-input" type="number" min="0" max="${ROWS}" value="${state.inputPace}" />
          </label>

          <label class="field">
            <span>Kaçıncı cüz</span>
            <input id="juz-input" type="number" min="0" max="${COLUMNS}" value="${state.inputJuz}" />
          </label>

          <label class="field">
            <span>Kaç ham aldı</span>
            <div class="stepper-field" aria-label="Kaç ham aldı">
              <button id="ham-count-decrement" class="stepper-button" type="button">-</button>
              <div id="ham-count-value" class="stepper-value">${getHamSelectionLabel(state.inputHamCount)}</div>
              <button id="ham-count-increment" class="stepper-button" type="button">+</button>
            </div>
          </label>

          <button id="apply-button" class="apply-button" type="button">Tabloya aktar</button>
        </div>

        <div class="control-card summary-card">
          <p class="eyebrow">Durum Özeti</p>
          <div class="summary-row">
            <span>Boyanan kare</span>
            <strong>${filledCount} / ${TOTAL_CELLS}</strong>
          </div>
          <div class="summary-row">
            <span>Kalan sayfa</span>
            <strong>${remainingPages}</strong>
          </div>
          <div class="summary-row">
            <span>Tatil ek gün</span>
            <strong>${estimate.extraDays}</strong>
          </div>
          <div class="summary-row">
            <span>İlerleme</span>
            <strong>%${percent}</strong>
          </div>
          <div class="summary-row">
            <span>Tahmini bitiş</span>
            <strong>${formatDate(displayEndDate)}</strong>
          </div>
          <p class="summary-note">
            Hesapta ${estimate.sundays} Pazar ve ${estimate.holidays} resmi tatil/ara tatil günü
            atlandı.
          </p>
          <button id="reset-button" class="reset-button" type="button">Ana Tabloyu Sıfırla</button>
        </div>

        <div class="control-card scenario-card">
          <button id="scenario-button" class="scenario-button" type="button">Hayali Senaryo</button>
        </div>
      </aside>
    </main>
    ${renderCompletionModal()}
  `

  bindMainEvents()
}
