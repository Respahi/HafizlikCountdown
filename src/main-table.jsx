import { useEffect, useRef, useState } from 'react'
import {
  ROWS,
  COLUMNS,
  TOTAL_CELLS,
  calculateFilledCount,
  clampNumber,
  estimateProjectedEndDate,
  estimateCompletion,
  formatDate,
  getCellState,
  getFillSequenceIndex,
  getHamSelectionLabel,
  getHamSelectionNumericValue,
  getMarkMap,
  getProjectedEndDate,
  persistState,
  render,
  setForecastEndDate,
  shiftHamSelection,
  syncCompletionState,
  state as appState,
} from './app-state.js'

function shouldShowEmptyMainInputs(state) {
  return (
    state.filledCount === 0
    && state.baselineCount === 0
    && state.pace === 0
    && state.juz === 0
    && state.inputPace === 1
    && state.inputJuz === 0
  )
}

export function MainView({ state }) {
  const [invalidApply, setInvalidApply] = useState(false)
  const [invalidStepper, setInvalidStepper] = useState(null)
  const [paceText, setPaceText] = useState(shouldShowEmptyMainInputs(state) ? '' : String(state.inputPace ?? ''))
  const [juzText, setJuzText] = useState(shouldShowEmptyMainInputs(state) ? '' : String(state.inputJuz ?? ''))
  const applyTimerRef = useRef(null)
  const stepperTimerRef = useRef(null)

  useEffect(() => {
    setPaceText(shouldShowEmptyMainInputs(state) ? '' : String(state.inputPace ?? ''))
  }, [state.inputPace, state.filledCount, state.baselineCount, state.pace, state.juz, state.inputJuz])

  useEffect(() => {
    setJuzText(shouldShowEmptyMainInputs(state) ? '' : String(state.inputJuz ?? ''))
  }, [state.inputJuz, state.filledCount, state.baselineCount, state.pace, state.juz, state.inputPace])

  const triggerApplyError = () => {
    if (applyTimerRef.current) {
      window.clearTimeout(applyTimerRef.current)
    }

    setInvalidApply(false)
    requestAnimationFrame(() => {
      setInvalidApply(true)
      applyTimerRef.current = window.setTimeout(() => {
        setInvalidApply(false)
      }, 420)
    })
  }

  const triggerStepperError = (kind) => {
    if (stepperTimerRef.current) {
      window.clearTimeout(stepperTimerRef.current)
    }

    setInvalidStepper(null)
    requestAnimationFrame(() => {
      setInvalidStepper(kind)
      stepperTimerRef.current = window.setTimeout(() => {
        setInvalidStepper(null)
      }, 420)
    })
  }

  const filledCount = state.filledCount
  const remainingPages = TOTAL_CELLS - filledCount
  const percent = ((filledCount / TOTAL_CELLS) * 100).toFixed(1)
  const estimate = estimateCompletion(remainingPages, state.spentStudyDays, state.closedStudyDays)
  const displayEndDate = getProjectedEndDate(remainingPages, state.spentStudyDays, state.closedStudyDays)
  const markMap = getMarkMap(state.committedMarks)

  const handlePaceChange = (event) => {
    setPaceText(event.target.value.replace(/\D/g, '').slice(0, 2))
  }

  const handleJuzChange = (event) => {
    setJuzText(event.target.value.replace(/\D/g, '').slice(0, 2))
  }

  const handleShiftHam = (direction, kind) => {
    const nextHamCount = shiftHamSelection(appState.inputHamCount, direction)

    if (nextHamCount === appState.inputHamCount) {
      triggerStepperError(kind)
      return
    }

    appState.inputHamCount = nextHamCount
    persistState()
    render()
  }

  const handleApply = () => {
    const rawPace = Number(paceText)
    const rawJuz = Number(juzText)
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
      triggerApplyError()
      return
    }

    const previousFilledCount = state.filledCount
    appState.pace = rawPace
    appState.juz = rawJuz
    appState.inputPace = rawPace
    appState.inputJuz = rawJuz
    appState.inputHamCount = rawHamCount
    appState.filledCount = calculateFilledCount(appState.pace, appState.juz, rawHamCount)
    appState.baselineCount = appState.filledCount
    appState.committedMarks = []
    appState.carryRedCount = 0
    appState.spentStudyDays = 0
    appState.closedStudyDays = 0
    appState.animate = false
    appState.preferredScenarioHam = rawJuz !== 30 ? rawHamCount : null
    appState.preferredScenarioMode = null
    appState.preferredScenarioLessonCount = null
    appState.preferredScenarioSundayEnabled = false
    appState.preferredScenarioHolidayEnabled = false
    appState.completedScenarioView = null
    appState.scenario = null
    appState.history.inputPace = rawPace
    appState.history.inputJuz = rawJuz
    appState.history.inputHamCount = rawHamCount === 'repeat' ? 1 : getHamSelectionNumericValue(rawHamCount)
    appState.history.reportReady = false
    appState.history.reportAttempted = false
    appState.history.reportBasis = null

    const nextDisplayEndDate = estimateProjectedEndDate(
      TOTAL_CELLS - appState.filledCount,
      appState.spentStudyDays,
      appState.closedStudyDays,
    )

    setForecastEndDate(nextDisplayEndDate)
    syncCompletionState(previousFilledCount, appState.filledCount, nextDisplayEndDate)
    render()

    requestAnimationFrame(() => {
      appState.animate = true
      render()
      persistState()

      window.setTimeout(() => {
        appState.animate = false
        render()
      }, Math.min(appState.filledCount * 10 + 450, 8000))
    })
  }

  const handleReset = () => {
    appState.pace = 0
    appState.juz = 0
    appState.inputPace = 1
    appState.inputJuz = 0
    appState.inputHamCount = 1
    appState.filledCount = 0
    appState.baselineCount = 0
    appState.animate = false
    appState.committedMarks = []
    appState.carryRedCount = 0
    appState.spentStudyDays = 0
    appState.closedStudyDays = 0
    appState.forecastEndDateKey = null
    appState.completionDateKey = null
    appState.completionModalOpen = false
    appState.preferredScenarioHam = null
    appState.preferredScenarioMode = null
    appState.preferredScenarioLessonCount = null
    appState.preferredScenarioSundayEnabled = false
    appState.preferredScenarioHolidayEnabled = false
    appState.completedScenarioView = null
    appState.scenario = null
    appState.history = {
      inputPace: 1,
      inputJuz: 0,
      inputHamCount: 1,
      startDateKey: null,
      startDateText: '',
      phaseCounts: { 2: 0, 3: 0, 4: 0, 5: 0 },
      activeYear: new Date().getFullYear(),
      reportReady: false,
      reportAttempted: false,
      reportBasis: null,
    }
    persistState()
    render()
  }

  return (
    <main className="layout">
      <section className="board-panel">
        <div className="view-topbar">
          <div className="board-topline">
            <span className="board-topline-label">Hafızlık Ne Zaman Bitecek?</span>
          </div>
          <div className="board-note board-note-topbar">
            <span className="board-note-label">Tahmini bitiş tarihi</span>
            <strong className="board-note-date">{formatDate(displayEndDate)}</strong>
          </div>
        </div>

        <div className="grid-shell">
          <div className="grid-labels grid-labels-top">
            {Array.from({ length: COLUMNS }, (_, index) => <span key={index}>{index + 1}</span>)}
          </div>
          <div className="grid-area">
            <div className="grid-labels grid-labels-side">
              {Array.from({ length: ROWS }, (_, index) => <span key={index}>{ROWS - index}</span>)}
            </div>
            <div className="progress-grid" aria-label="600 karelik hafızlık tablosu">
              {Array.from({ length: TOTAL_CELLS }, (_, index) => {
                const order = getFillSequenceIndex(index)
                const progressIndex = order + 1
                const cellState = getCellState(progressIndex, state.baselineCount, markMap)
                const animated = state.animate && progressIndex <= state.baselineCount

                return (
                  <div
                    key={index}
                    className="cell"
                    style={animated ? { '--fill-delay': `${order * 10}ms` } : undefined}
                    title={`Satır ${ROWS - Math.floor(index / COLUMNS)}, Cüz ${(index % COLUMNS) + 1}`}
                  >
                    <span className={`cell-fill ${cellState.fillClass}${animated ? ' cell-animated' : ''}`}></span>
                    {cellState.labelValue ? (
                      <span className={`cell-label ${cellState.labelClass}`}>{cellState.labelValue}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <aside className="control-panel">
        <div className="control-card">
          <p className="eyebrow">Veri Girişi</p>
          <h2>İlerlemeyi aktar</h2>

          <div className="main-input-fraction">
            <div className="main-input-fraction-part">
              <span className="scenario-fraction-label">Kaçla gidiyor</span>
              <input
                className="main-input-fraction-value"
                type="text"
                inputMode="numeric"
                placeholder="--"
                value={paceText}
                onChange={handlePaceChange}
              />
            </div>
            <div className="scenario-fraction-line"></div>
            <div className="main-input-fraction-part">
              <span className="scenario-fraction-label">Kaçıncı cüz</span>
              <input
                className="main-input-fraction-value"
                type="text"
                inputMode="numeric"
                placeholder="--"
                value={juzText}
                onChange={handleJuzChange}
              />
            </div>
          </div>

          <label className="field">
            <span className="field-label-center">Kaç Ham Aldı</span>
            <div className="stepper-field" aria-label="Kaç ham aldı">
              <button
                className={`stepper-button ${invalidStepper === 'decrement' ? 'stepper-button-invalid' : ''}`}
                type="button"
                onClick={() => handleShiftHam(-1, 'decrement')}
              >
                -
              </button>
              <div className="stepper-value">{getHamSelectionLabel(state.inputHamCount)}</div>
              <button
                className={`stepper-button ${invalidStepper === 'increment' ? 'stepper-button-invalid' : ''}`}
                type="button"
                onClick={() => handleShiftHam(1, 'increment')}
              >
                +
              </button>
            </div>
          </label>

          <button
            className={`apply-button ${invalidApply ? 'apply-button-invalid' : ''}`}
            type="button"
            onClick={handleApply}
          >
            Tabloya aktar
          </button>
        </div>

        <div className="control-card summary-card">
          <p className="eyebrow">Durum Özeti</p>
          <div className="summary-row">
            <span>Boyanan kare</span>
            <strong>{filledCount} / {TOTAL_CELLS}</strong>
          </div>
          <div className="summary-row">
            <span>Kalan sayfa</span>
            <strong>{remainingPages}</strong>
          </div>
          <div className="summary-row">
            <span>Tatil ek gün</span>
            <strong>{estimate.extraDays}</strong>
          </div>
          <div className="summary-row">
            <span>İlerleme</span>
            <strong>%{percent}</strong>
          </div>
          <div className="summary-row">
            <span>Tahmini bitiş</span>
            <strong>{formatDate(displayEndDate)}</strong>
          </div>
          <p className="summary-note">
            Hesapta {estimate.sundays} Pazar ve {estimate.holidays} resmi tatil/ara tatil günü atlandı.
          </p>
          <button className="reset-button" type="button" onClick={handleReset}>Ana Tabloyu Sıfırla</button>
        </div>
      </aside>
    </main>
  )
}
