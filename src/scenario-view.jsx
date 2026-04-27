import { useState, useRef, useEffect } from 'react'

import {
  TOTAL_CELLS,
  WEEKDAY_LABELS,
  HAM_OPTIONS,
  addAnnualPhase,
  state as appState,
  applyHamSelection,
  applyScenarioChoice,
  canAddAnnualPhase,
  canStartAnnualScenario,
  commitScenarioToMain,
  createScenarioClosedEntry,
  createScenarioState,
  estimateProjectedEndDate,
  formatMonthYear,
  getCellState,
  getFillSequenceIndex,
  hasPendingScenarioTransfer,
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
  renderScenarioDate,
  removeAnnualPhase,
  selectScenarioLessonCount,
  selectScenarioMode,
  simulateAnnualPhasePlan,
  startScenarioFromModal,
  toggleScenarioAvailability,
} from './app-state.js'

function getScenarioChoiceBackground(choice, maxSelectableChoice) {
  const safeMaxChoice = Math.max(maxSelectableChoice, 1)
  const ratio = Math.min(Math.max(choice / safeMaxChoice, 0), 1)
  const hue = 2 + (140 * ratio)
  const saturation = 66
  const lightness = 37 - (4 * ratio)

  return `hsl(${Math.round(hue)} ${saturation}% ${Math.round(lightness)}%)`
}

export function ScenarioView({ state }) {
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const annualPhaseListRef = useRef(null)
  const scenario = state.scenario ?? createScenarioState()
  appState.scenario = scenario

  const preview = projectScenarioOutcome()
  const projectedEndDate = estimateProjectedEndDate(
    Math.max(TOTAL_CELLS - preview.filledCount, 0),
    preview.spentStudyDays,
    preview.closedStudyDays,
  )
  const previewMarkMap = getMarkMap(preview.marks)
  const hasPendingMainTransfer = hasPendingScenarioTransfer()
  const annualPlanSimulation = simulateAnnualPhasePlan(scenario)
  const annualRemainingScenario = {
    virtualCount: annualPlanSimulation.finalVirtualCount,
    virtualPace: annualPlanSimulation.finalVirtualPace,
  }
  const maxSelectableChoice = getScenarioWeekMaxChoice(scenario)
  const boundaryHamLimit = getScenarioBoundarySelectableHamLimit(scenario)
  const annualBoundaryHamLimit = getScenarioBoundarySelectableHamLimit(annualRemainingScenario)
  const availableHamOptions = scenario.mode === 'annual'
    ? HAM_OPTIONS.filter((option) => annualPlanSimulation.finalVirtualCount < TOTAL_CELLS && option <= annualBoundaryHamLimit)
    : HAM_OPTIONS.filter((option) => !scenario.modalBoundary || option <= boundaryHamLimit)
  const animatedResultKeySet = new Set(scenario.animatedResultKeys)
  const animatedOrderMap = new Map(scenario.animatedResultKeys.map((dateKey, index) => [dateKey, index]))
  const scenarioEntryMap = new Map((scenario.archivedEntries ?? scenario.entries).map((entry) => [entry.dateKey, entry]))
  const displayMonthStartKey = scenario.viewMonthStartKey ?? scenario.monthStartKey
  const displayMonthDate = parseDateKey(displayMonthStartKey)
  const displayMonth = displayMonthStartKey === scenario.monthStartKey
    ? { monthStartKey: scenario.monthStartKey, weekCount: scenario.weekCount, visibleDays: scenario.visibleDays }
    : getScenarioMonthView(displayMonthDate)
  const isViewingCurrentMonth = displayMonthStartKey === scenario.monthStartKey
  const canGoToPreviousMonth = displayMonthStartKey > scenario.startMonthStartKey
  const canGoToNextMonth = displayMonthStartKey < scenario.monthStartKey
  const isWeeklyMode = scenario.mode === 'weekly'
  const isMonthlyMode = scenario.mode === 'monthly'
  const isAnnualMode = scenario.mode === 'annual'
  const isFirstAnnualPhase = isAnnualMode && scenario.annualPhasePlan.filter(p => p.status !== 'removed').length === 0
  const annualFixedHam = isFirstAnnualPhase && state.inputHamCount > 0 && state.juz > 0 ? state.inputHamCount : null
  const isInitialSetup = !scenario.hasStarted && !scenario.complete
  const isBoundarySetup = scenario.modalBoundary
  const isScenarioRunning = scenario.hasStarted && !scenario.modalBoundary && !scenario.complete
  const isMonthlyPausedForSetup = isMonthlyMode && isScenarioRunning && !scenario.monthlyAutoRunning
  const manualChoiceDisabled = scenario.complete || scenario.locked || isMonthlyMode || isAnnualMode || !isViewingCurrentMonth
  const hamLocked = !isAnnualMode && !scenario.modalBoundary && scenario.virtualJuz > 0
  const weeklyChoiceButtonMax = scenario.includeSundayStudy ? 7 : 6
  const monthlyLessonOptionMax = scenario.includeSundayStudy ? 7 : 6
  const shouldRequireExplicitHamSelection = (isWeeklyMode && isInitialSetup) || (isMonthlyMode && (isInitialSetup || isBoundarySetup))
  const selectedHamValue = isAnnualMode
    ? scenario.annualDraftHam
    : (hamLocked
    ? scenario.currentHam
    : (shouldRequireExplicitHamSelection ? scenario.modalHamSelection : (scenario.modalHamSelection ?? scenario.currentHam)))
  const selectedLessonCount = isMonthlyMode && isBoundarySetup
    ? scenario.modalLessonSelection
    : (scenario.modalLessonSelection ?? scenario.selectedWeeklyLessonCount)
  const annualDraftLessonCount = scenario.annualDraftWeeklyLessonCount
  const canStartScenario = isAnnualMode
    ? canStartAnnualScenario(scenario)
    : (isWeeklyMode
    ? selectedHamValue != null
    : (selectedLessonCount != null && selectedHamValue != null))
  const setupPanelDisabled = isScenarioRunning && isMonthlyMode && scenario.monthlyAutoRunning
  const shouldShowSetupPanel = true
  const spotlightModeCard = !scenario.modeSelected
  const card1Interactive = !setupPanelDisabled && !scenario.complete && (isInitialSetup || isBoundarySetup || isScenarioRunning)
  const card2Interactive = !setupPanelDisabled && !scenario.complete && scenario.modeSelected && (
    (isWeeklyMode && (isInitialSetup || isBoundarySetup))
    || (isMonthlyMode && (isInitialSetup || isBoundarySetup))
    || isAnnualMode
  )
  const spotlightHamCard = card2Interactive && (
    (isWeeklyMode && isInitialSetup && scenario.modalHamSelection == null)
    || (isMonthlyMode && (isInitialSetup || isBoundarySetup) && scenario.modalHamSelection == null)
    || (isAnnualMode && scenario.annualDraftHam == null)
  )
  const showCard3 = isAnnualMode || isWeeklyMode || (isMonthlyMode && (isInitialSetup || isMonthlyPausedForSetup || !isBoundarySetup || scenario.modalHamSelection != null))
  const card3Interactive = !setupPanelDisabled && !scenario.complete && (
    (isWeeklyMode && isScenarioRunning)
    || (isMonthlyMode && scenario.modeSelected && (isInitialSetup || isMonthlyPausedForSetup || (isBoundarySetup && scenario.modalHamSelection != null)))
    || (isAnnualMode && scenario.modeSelected)
  )
  const spotlightLessonCard = card3Interactive && (
    (isWeeklyMode && isScenarioRunning)
    || (isMonthlyMode && selectedLessonCount == null)
    || (isAnnualMode && annualDraftLessonCount == null)
  )
  const showStartAction = !scenario.complete && (
    isAnnualMode
      ? (scenario.modeSelected && scenario.annualPhasePlan.length > 0)
      : (isWeeklyMode
      ? (scenario.modeSelected && selectedHamValue != null && (isInitialSetup || isBoundarySetup))
      : (scenario.modeSelected && selectedLessonCount != null && (isInitialSetup || isBoundarySetup || isMonthlyPausedForSetup)))
  )
  const showWeeklyStartOverlay = isWeeklyMode && showStartAction
  const showMonthlyStartCard = isMonthlyMode && showStartAction
  const showAnnualStartCard = isAnnualMode && showStartAction
  const annualCanAddPhase = canAddAnnualPhase(scenario)
  const startButtonDisabled = (
    !canStartScenario
    || setupPanelDisabled
    || scenario.filling
    || scenario.rolling
    || scenario.incoming
    || scenario.monthlyAutoRunning
    || scenario.locked
  )
  const commitButtonDisabled = (
    !hasPendingMainTransfer
    || scenario.filling
    || scenario.rolling
    || scenario.incoming
  )
  const isWeeklyActive = scenario.modeSelected && isWeeklyMode
  const isMonthlyActive = scenario.modeSelected && isMonthlyMode
  const isAnnualActive = scenario.modeSelected && isAnnualMode
  const showSettingsModal = settingsModalOpen && !setupPanelDisabled && !scenario.complete

  const annualConsumedCount = isAnnualMode ? scenario.annualPhasePlan.filter(p => p.status === 'consumed').length : 0

  useEffect(() => {
    if (!isAnnualMode || !annualPhaseListRef.current) return

    const container = annualPhaseListRef.current
    const rows = container.querySelectorAll('.scenario-annual-phase-row')

    if (rows.length === 0) return

    if (scenario.annualAutoRunning) {
      const activeIndex = Math.min(annualConsumedCount, rows.length - 1)
      const targetRow = rows[activeIndex]
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      const targetRow = rows[rows.length - 1]
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [scenario.annualPhasePlan.length, scenario.annualAutoRunning, annualConsumedCount, isAnnualMode])

  const setupPanel = (
    <aside className="scenario-setup-column">
      <div className="control-card scenario-setup-card">
        <div className={`scenario-control-stack ${setupPanelDisabled ? 'scenario-control-stack-disabled' : ''}`}>
          <section className={`scenario-control-card ${card1Interactive ? 'scenario-control-card-active' : 'scenario-control-card-inactive'} ${spotlightModeCard ? 'scenario-control-card-spotlight' : ''}`}>
            <fieldset className="scenario-control-card-fieldset" disabled={!card1Interactive}>
              <div className="scenario-control-card-head">
                <div className="scenario-control-card-topline">
                  <h2 className="scenario-control-card-title">1. Mod</h2>
                  <button
                    className="scenario-settings-button"
                    type="button"
                    aria-label="Ayarlar"
                    onClick={() => setSettingsModalOpen(true)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.85a.5.5 0 0 0 .12.63l2.03 1.58a7.43 7.43 0 0 0-.05.94 7.43 7.43 0 0 0 .05.94l-2.03 1.58a.5.5 0 0 0-.12.63l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.63zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="scenario-mode-actions">
                <button
                  className={`scenario-option scenario-mode-option ${isWeeklyActive ? 'scenario-mode-option-active' : ''}`}
                  data-scenario-mode="weekly"
                  type="button"
                  onClick={() => selectScenarioMode('weekly')}
                >
                  Haftalık
                </button>
                <button
                  className={`scenario-option scenario-mode-option ${isMonthlyActive ? 'scenario-mode-option-active' : ''}`}
                  data-scenario-mode="monthly"
                  type="button"
                  onClick={() => selectScenarioMode('monthly')}
                >
                  Aylık
                </button>
                <button
                  className={`scenario-option scenario-mode-option ${isAnnualActive ? 'scenario-mode-option-active' : ''}`}
                  data-scenario-mode="annual"
                  type="button"
                  onClick={() => selectScenarioMode('annual')}
                >
                  Yıllık
                </button>
              </div>
            </fieldset>
          </section>

          <section className={`scenario-control-card ${card2Interactive ? 'scenario-control-card-active' : 'scenario-control-card-inactive'} ${spotlightHamCard ? 'scenario-control-card-spotlight' : ''}`}>
            <fieldset className="scenario-control-card-fieldset" disabled={!card2Interactive}>
              <div className="scenario-control-card-head">
                <h2 className="scenario-control-card-title">2. Kaç Ham Alacaksın?</h2>
              </div>
              <div className="scenario-modal-ham-group">
                <div className="scenario-monthly-lesson-strip" style={{ '--scenario-lesson-count': availableHamOptions.length }}>
                  {availableHamOptions.map((option) => (
                    <button
                      key={option}
                      className={`scenario-option scenario-modal-option scenario-monthly-lesson-option scenario-ham-choice-option ${selectedHamValue === option ? 'scenario-modal-option-active' : ''}`}
                      data-modal-ham={option}
                      type="button"
                      disabled={!card2Interactive || hamLocked || (annualFixedHam != null && option !== annualFixedHam)}
                      onClick={() => applyHamSelection(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {isAnnualMode || !scenario.modalBoundary ? (
                  <button
                    className={`scenario-option scenario-modal-option scenario-modal-option-repeat scenario-ham-choice-option ${selectedHamValue === 'repeat' ? 'scenario-modal-option-active' : ''}`}
                    data-modal-ham="repeat"
                    type="button"
                    disabled={!card2Interactive || hamLocked || annualFixedHam != null || (isAnnualMode && annualPlanSimulation.finalVirtualCount >= TOTAL_CELLS)}
                    onClick={() => applyHamSelection('repeat')}
                  >
                    Tekrar
                  </button>
                ) : null}
              </div>
            </fieldset>
          </section>

          {showCard3 || showWeeklyStartOverlay ? (
            <div className={`scenario-control-card-shell ${showCard3 && showWeeklyStartOverlay ? 'scenario-control-card-shell-overlay-active' : ''}`}>
              {showCard3 ? (
                <section className={`scenario-control-card ${card3Interactive ? 'scenario-control-card-active' : 'scenario-control-card-inactive'} ${spotlightLessonCard ? 'scenario-control-card-spotlight' : ''}`}>
                  <fieldset className="scenario-control-card-fieldset" disabled={!card3Interactive}>
                    <div className="scenario-control-card-head">
                      <h2 className="scenario-control-card-title">
                        {isWeeklyMode ? '3. Bu Hafta Kaç Ders Vereceksin' : '3. Haftalık Kaç Ders?'}
                      </h2>
                    </div>
                    {isWeeklyMode ? (
                      <div className="scenario-monthly-lesson-strip" style={{ '--scenario-lesson-count': weeklyChoiceButtonMax + 1 }}>
                        {Array.from({ length: weeklyChoiceButtonMax + 1 }, (_, index) => {
                          const value = index
                          const choiceHint = getScenarioChoiceHint(scenario, value)
                          const includesSunday = choiceHint === 'Pazar'
                          const isDisabled = !card3Interactive || manualChoiceDisabled || value > maxSelectableChoice

                          return (
                            <button
                              key={value}
                              className={`scenario-option scenario-modal-option scenario-monthly-lesson-option ${includesSunday ? 'scenario-monthly-lesson-option-sunday' : ''}`}
                              data-choice={value}
                              type="button"
                              style={isDisabled ? {} : { background: getScenarioChoiceBackground(value, maxSelectableChoice), color: '#fff', borderColor: 'transparent' }}
                              disabled={isDisabled}
                              onClick={() => applyScenarioChoice(value)}
                              title={choiceHint}
                            >
                              {value}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="scenario-monthly-lesson-strip" style={{ '--scenario-lesson-count': monthlyLessonOptionMax + 1 }}>
                        {Array.from({ length: monthlyLessonOptionMax + 1 }, (_, index) => (
                          <button
                            key={index}
                            className={`scenario-option scenario-modal-option scenario-monthly-lesson-option ${(isAnnualMode ? annualDraftLessonCount : selectedLessonCount) === index ? 'scenario-modal-option-active' : ''}`}
                            data-modal-lesson={index}
                            type="button"
                            disabled={!card3Interactive}
                            onClick={() => selectScenarioLessonCount(index)}
                          >
                            {index}
                          </button>
                        ))}
                      </div>
                    )}
                    {isAnnualMode ? (
                      <div className="scenario-annual-actions">
                        <button
                          className="scenario-button scenario-annual-add-button"
                          type="button"
                          disabled={!annualCanAddPhase}
                          onClick={addAnnualPhase}
                        >
                          Ham Ekle
                        </button>
                      </div>
                    ) : null}
                  </fieldset>
                </section>
              ) : null}

              {showWeeklyStartOverlay ? (
                <div className="scenario-control-action">
                  <button
                    className="scenario-button scenario-modal-start-button"
                    type="button"
                    disabled={startButtonDisabled}
                    onClick={startScenarioFromModal}
                  >
                    {scenario.hasStarted ? 'Senaryoya Devam' : 'Senaryoyu Başlat'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {showMonthlyStartCard ? (
            <section className="scenario-control-card scenario-control-card-active scenario-control-card-action-card">
              <button
                className="scenario-button scenario-modal-start-button"
                type="button"
                disabled={startButtonDisabled}
                onClick={startScenarioFromModal}
              >
                {scenario.hasStarted ? 'Senaryoya Devam' : 'Senaryoyu Başlat'}
              </button>
            </section>
          ) : null}
          {isAnnualMode ? (
            <section className={`scenario-control-card ${scenario.modeSelected ? 'scenario-control-card-active' : 'scenario-control-card-inactive'}`}>
              <div className="scenario-control-card-head">
                <h2 className="scenario-control-card-title">4. Yıllık Faz Planı</h2>
              </div>
              <div 
                ref={annualPhaseListRef} 
                className={`scenario-annual-phase-list ${scenario.annualAutoRunning ? 'scenario-annual-phase-list-running' : ''}`}
              >
                {scenario.annualPhasePlan.length === 0 ? (
                  <p className="scenario-annual-phase-empty">Ham ve haftalık ders seçip plan oluşturmaya başla.</p>
                ) : (
                  scenario.annualPhasePlan.map((phase, index) => (
                    <div
                      key={phase.id}
                      className={`scenario-annual-phase-row ${phase.status === 'consumed' ? 'scenario-annual-phase-row-consumed' : ''}`}
                    >
                      <div className="scenario-annual-phase-meta">
                        <span className="scenario-annual-phase-order">{index + 1}</span>
                        <span className="scenario-annual-phase-text">
                          {phase.ham === 'repeat' ? 'Tekrar' : `${phase.ham} Ham`} / {phase.weeklyLessonCount} Ders
                        </span>
                      </div>
                      <div className="scenario-annual-phase-actions">
                        <span className="scenario-annual-phase-pace">{phase.paceAfter}</span>
                        {phase.status === 'pending' && index === scenario.annualPhasePlan.length - 1 ? (
                          <button
                            className="scenario-annual-phase-remove"
                            type="button"
                            onClick={removeAnnualPhase}
                            aria-label="Son fazı sil"
                          >
                            ×
                          </button>
                        ) : (
                          <span className="scenario-annual-phase-remove-placeholder"></span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
          {showAnnualStartCard ? (
            <section className="scenario-control-card scenario-control-card-active scenario-control-card-action-card">
              <button
                className="scenario-button scenario-modal-start-button"
                type="button"
                disabled={startButtonDisabled}
                onClick={startScenarioFromModal}
              >
                {scenario.hasStarted ? 'Senaryoya Devam' : 'Senaryoyu Başlat'}
              </button>
            </section>
          ) : null}
        </div>

        {showSettingsModal ? (
          <div className="scenario-settings-backdrop" onClick={() => setSettingsModalOpen(false)}>
            <div className="scenario-modal scenario-settings-modal" onClick={(event) => event.stopPropagation()}>
              <div className="scenario-settings-modal-head">
                <h2>Ayarlar</h2>
                <button
                  className="scenario-settings-close"
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                >
                  Kapat
                </button>
              </div>
              <div className="scenario-availability-actions">
                <button
                  className={`scenario-availability-option ${scenario.includeSundayStudy ? 'scenario-availability-option-active' : ''}`}
                  data-availability-kind="sunday"
                  type="button"
                  onClick={() => toggleScenarioAvailability('sunday')}
                >
                  <span className="scenario-availability-check">{scenario.includeSundayStudy ? '✓' : ''}</span>
                  <span className="scenario-availability-label">Pazarlar</span>
                </button>
                <button
                  className={`scenario-availability-option ${scenario.includeHolidayStudy ? 'scenario-availability-option-active' : ''}`}
                  data-availability-kind="holiday"
                  type="button"
                  onClick={() => toggleScenarioAvailability('holiday')}
                >
                  <span className="scenario-availability-check">{scenario.includeHolidayStudy ? '✓' : ''}</span>
                  <span className="scenario-availability-label">Tatil-Bayramlar</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )

  return (
    <div className="view-container">
      <main className={`scenario-layout ${shouldShowSetupPanel ? 'scenario-layout-with-setup' : ''}`}>
        {setupPanel}

        <section className="scenario-main">
          <div className="scenario-strip-shell">
            <div className="scenario-month-bar">
              <button
                className="scenario-month-nav"
                data-scenario-nav="-1"
                type="button"
                disabled={!canGoToPreviousMonth}
                aria-label="Önceki ay"
                onClick={() => navigateScenarioMonth(-1)}
              >
                <span className="scenario-month-nav-arrow">&#8249;</span>
                <span className="scenario-month-nav-text">Önceki</span>
              </button>
              <p className="scenario-month-label">{formatMonthYear(displayMonthDate)}</p>
              <button
                className="scenario-month-nav"
                data-scenario-nav="1"
                type="button"
                disabled={!canGoToNextMonth}
                aria-label="Sonraki ay"
                onClick={() => navigateScenarioMonth(1)}
              >
                <span className="scenario-month-nav-text">Sonraki</span>
                <span className="scenario-month-nav-arrow">&#8250;</span>
              </button>
            </div>

            <div className="scenario-strip-viewport scenario-calendar-viewport">
              <div
                className="scenario-calendar-frame"
                style={{ '--scenario-week-count': displayMonth.weekCount }}
              >
                <div className="scenario-calendar-corner"></div>
                <div className="scenario-calendar-head">
                  {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
                </div>
                <div className="scenario-week-rail">
                  {Array.from({ length: displayMonth.weekCount }, (_, weekIndex) => (
                    <span
                      key={weekIndex}
                      className={`scenario-week-label ${isViewingCurrentMonth && weekIndex === scenario.activeWeekIndex ? 'scenario-week-label-active' : ''}`}
                    >
                      {weekIndex + 1}. Hafta
                    </span>
                  ))}
                </div>
                <div className="scenario-calendar-grid">
                  {displayMonth.visibleDays.map((day, index) => {
                    const isOutsideMonth = !day.isCurrentMonth
                    const isPastAdjacentDay = isOutsideMonth && day.dateKey < displayMonthStartKey
                    const result = scenario.windowResults[day.dateKey] ?? scenarioEntryMap.get(day.dateKey)
                    const staticEntry = (day.isCurrentMonth || isPastAdjacentDay) && day.isClosed
                      ? createScenarioClosedEntry(day)
                      : null
                    const visual = getScenarioVisual(result ?? staticEntry)
                    const dayLabel = day.isCurrentMonth && day.isSunday
                      ? 'Pazar'
                      : (day.isCurrentMonth && day.isHoliday ? 'Tatil' : visual.label)
                    const isPastStartDay = isScenarioPastStartDay(scenario, day)
                    const isPastWeek = isViewingCurrentMonth ? day.weekIndex < scenario.activeWeekIndex : displayMonthStartKey < scenario.monthStartKey
                    const isActiveWeek = isViewingCurrentMonth && day.weekIndex === scenario.activeWeekIndex
                    const isFutureWeek = isViewingCurrentMonth && day.weekIndex > scenario.activeWeekIndex
                    const isGridAutoAnimating = scenario.mode === 'monthly' || scenario.mode === 'annual'
                    const fillClass = scenario.filling
                      && (!isGridAutoAnimating ? isActiveWeek : true)
                      && result
                      && result.type !== 'sunday'
                      && result.type !== 'holiday'
                      && day.isCurrentMonth
                      && animatedResultKeySet.has(day.dateKey)
                      ? (isGridAutoAnimating ? 'scenario-tile-fill-in-monthly' : 'scenario-tile-fill-in')
                      : ''
                    const waveClass = scenario.rolling
                      ? (isGridAutoAnimating ? 'scenario-tile-wave-out-monthly' : 'scenario-tile-wave-out')
                      : (scenario.incoming ? (isGridAutoAnimating ? 'scenario-tile-wave-in-monthly' : 'scenario-tile-wave-in') : '')
                    const fillOrder = isGridAutoAnimating ? day.weekdayIndex : (animatedOrderMap.get(day.dateKey) ?? day.weekdayIndex)
                    const mutedFillClass = isOutsideMonth
                      ? (!visual.fillClass ? (isPastAdjacentDay ? 'scenario-tile-fill-muted' : 'scenario-tile-fill-adjacent') : '')
                      : (!visual.fillClass && (isPastWeek || isFutureWeek || isPastStartDay)
                          ? `scenario-tile-fill-${isFutureWeek ? 'locked' : 'muted'}`
                          : '')

                    return (
                      <div
                        key={day.dateKey}
                        className={`scenario-tile scenario-day ${visual.tileClass} ${isActiveWeek && !isOutsideMonth ? 'scenario-day-active' : ''} ${isFutureWeek || isPastStartDay ? 'scenario-day-locked' : ''} ${isOutsideMonth ? 'scenario-day-adjacent' : ''} ${waveClass}`}
                        style={{ '--wave-order': index, '--fill-order': fillOrder }}
                      >
                        <span className={`scenario-tile-fill ${visual.fillClass} ${mutedFillClass} ${fillClass}`}></span>
                        {day.isCurrentMonth && day.isSunday ? <span className="scenario-tile-sunday-overlay"></span> : null}
                        <div className="scenario-day-head">
                          <span className="scenario-day-number">{day.dayNumber}</span>
                        </div>
                        {dayLabel ? (
                          <span className={`scenario-tile-mark ${day.isCurrentMonth && (day.isSunday || day.isHoliday) ? 'scenario-tile-mark-sunday' : ''}`}>
                            {dayLabel}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="scenario-side">
          <div className="control-card scenario-fraction-card">
            <p className="eyebrow">İlerleme</p>
            <div className="scenario-fraction">
              <div className="scenario-fraction-part">
                <span className="scenario-fraction-label">Kaçla gidiyor</span>
                <strong>{preview.pace}</strong>
              </div>
              <div className="scenario-fraction-line"></div>
              <div className="scenario-fraction-part">
                <span className="scenario-fraction-label">Kaçıncı cüzde</span>
                <strong>{preview.juz}</strong>
              </div>
            </div>
          </div>

          <div className="control-card scenario-preview-date-card">
            <div className="board-note scenario-preview-note">
              <span className="board-note-label">Tahmini bitiş tarihi</span>
              <strong className="board-note-date">
                <span className="scenario-date-window">
                  <span
                    className="scenario-date-text"
                    dangerouslySetInnerHTML={{
                      __html: renderScenarioDate(
                        scenario.currentEndDate ?? projectedEndDate,
                        scenario.previousEndDate,
                        scenario.dateVersion,
                        scenario.dateWidthReference,
                      ),
                    }}
                  />
                </span>
              </strong>
            </div>
          </div>

          <div className="control-card scenario-mini-card">
            <p className="eyebrow">Hafızlık Tablosu Ön İzleme</p>
            <div className="scenario-mini-grid" aria-label="Hafızlık tablosunun minyatür temsili">
              {Array.from({ length: TOTAL_CELLS }, (_, index) => {
                const order = getFillSequenceIndex(index)
                const progressIndex = order + 1
                const cellState = getCellState(progressIndex, preview.baselineCount, previewMarkMap)

                return (
                  <div key={index} className="scenario-mini-cell">
                    <span className={`scenario-mini-fill ${cellState.fillClass ? `scenario-mini-${cellState.fillClass.replace('cell-', '')}` : ''}`}></span>
                    {cellState.labelValue ? <span className="scenario-mini-label">{cellState.labelValue}</span> : null}
                  </div>
                )
              })}
            </div>
          </div>

          {hasPendingMainTransfer ? (
            <div className="control-card scenario-commit-card">
              <button
                className="scenario-button scenario-commit-button"
                type="button"
                disabled={commitButtonDisabled}
                onClick={() => commitScenarioToMain()}
              >
                Ana Tabloya Aktar
              </button>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  )
}
