import {
  TOTAL_CELLS,
  WEEKDAY_LABELS,
  HAM_OPTIONS,
  state as appState,
  applyHamSelection,
  applyScenarioChoice,
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
  renderScenarioDate,
  selectScenarioLessonCount,
  selectScenarioMode,
  startScenarioFromModal,
  toggleScenarioAvailability,
  dismissScenarioModal,
  reopenScenarioModal,
} from './app-state.js'
import { SegmentedTabs } from './components/SegmentedTabs.jsx'

function getScenarioChoiceBackground(choice, maxSelectableChoice) {
  const safeMaxChoice = Math.max(maxSelectableChoice, 1)
  const ratio = Math.min(Math.max(choice / safeMaxChoice, 0), 1)
  const hue = 2 + (140 * ratio)
  const saturation = 66
  const lightness = 37 - (4 * ratio)

  return `hsl(${Math.round(hue)} ${saturation}% ${Math.round(lightness)}%)`
}

export function ScenarioView({ state }) {
  const scenario = state.scenario ?? createScenarioState()
  appState.scenario = scenario

  const preview = projectScenarioOutcome()
  const projectedEndDate = estimateProjectedEndDate(
    Math.max(TOTAL_CELLS - preview.filledCount, 0),
    preview.spentStudyDays,
    preview.closedStudyDays,
  )
  const previewMarkMap = getMarkMap(preview.marks)
  const maxSelectableChoice = getScenarioWeekMaxChoice(scenario)
  const boundaryHamLimit = getScenarioBoundarySelectableHamLimit(scenario)
  const availableHamOptions = HAM_OPTIONS.filter((option) => !scenario.modalBoundary || option <= boundaryHamLimit)
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
  const manualChoiceDisabled = scenario.complete || scenario.locked || scenario.mode === 'monthly' || !isViewingCurrentMonth
  const hamLocked = !scenario.modalBoundary && scenario.virtualJuz > 0
  const weeklyChoiceButtonMax = scenario.includeSundayStudy ? 7 : 6
  const monthlyLessonOptionMax = scenario.includeSundayStudy ? 7 : 6
  const shouldShowMonthlyLessonOptions = scenario.mode === 'monthly' && (hamLocked || scenario.modalHamSelection != null)
  const canStartScenario = scenario.mode === 'weekly'
    ? (hamLocked || scenario.modalHamSelection != null)
    : (scenario.modalLessonSelection != null && (hamLocked || scenario.modalHamSelection != null))

  return (
    <div className="view-container">
      <main
        className={`scenario-layout ${scenario.modalDismissed ? 'scenario-table-clickable' : ''}`}
        onClick={() => {
          if (scenario.modalDismissed) {
            reopenScenarioModal();
          }
        }}
      >
        <section className="scenario-main">
          <div className="view-topbar">
            <SegmentedTabs activeView="scenario" />
          </div>

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

        <div className="scenario-actions">
          {Array.from({ length: weeklyChoiceButtonMax + 1 }, (_, index) => {
            const value = index
              const choiceHint = getScenarioChoiceHint(scenario, value)
              const includesSunday = choiceHint === 'Pazar'

              return (
                <button
                  key={value}
                  className={`scenario-option scenario-choice-option ${includesSunday ? 'scenario-choice-option-sunday' : ''}`}
                  data-choice={value}
                  type="button"
                  style={{ '--scenario-choice-bg': getScenarioChoiceBackground(value, maxSelectableChoice) }}
                  disabled={manualChoiceDisabled || value > maxSelectableChoice}
                  onClick={() => applyScenarioChoice(value)}
                >
                  {choiceHint ? <span className="scenario-option-hint">{choiceHint}</span> : null}
                  <span className="scenario-option-value">{value}</span>
                </button>
            )
          })}
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
            <p className="eyebrow">Ana Tablo Ön İzleme</p>
            <div className="scenario-mini-grid" aria-label="Ana tablonun minyatür temsili">
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
        </aside>
      </main>

      {scenario.modalOpen ? (
        <div
          className="scenario-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismissScenarioModal();
          }}
        >
          <div className="scenario-modal-stack">
            <div className={`scenario-modal scenario-mode-modal ${scenario.modalStep !== 'mode' ? 'scenario-mode-modal-raised' : ''}`}>
              <p className="eyebrow">{scenario.modalBoundary ? 'Yeni Aşama' : 'Başlangıç'}</p>
              <h2>Hangi Mod?</h2>
              <div className="scenario-mode-actions">
                <button
                  className={`scenario-option scenario-mode-option ${scenario.mode === 'weekly' ? 'scenario-mode-option-active' : ''}`}
                  data-scenario-mode="weekly"
                  type="button"
                  onClick={() => selectScenarioMode('weekly')}
                >
                  Haftalık
                </button>
                <button
                  className={`scenario-option scenario-mode-option ${scenario.mode === 'monthly' ? 'scenario-mode-option-active' : ''}`}
                  data-scenario-mode="monthly"
                  type="button"
                  onClick={() => selectScenarioMode('monthly')}
                >
                  Aylık
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

            {scenario.modalStep !== 'mode' ? (
              <div className="scenario-modal scenario-detail-modal">
                {scenario.mode === 'weekly' ? (
                  <>
                    <p className="eyebrow">Haftalık Mod</p>
                    <h2>{scenario.modalBoundary ? 'Kaç Ham Alacaksın?' : 'Kaç Ham?'}</h2>
                    <div className="scenario-modal-ham-group">
                      <div className="scenario-monthly-lesson-strip" style={{ '--scenario-lesson-count': availableHamOptions.length }}>
                        {availableHamOptions.map((option) => (
                          <button
                            key={option}
                            className={`scenario-option scenario-modal-option scenario-monthly-lesson-option ${scenario.modalHamSelection === option ? 'scenario-modal-option-active' : ''}`}
                            data-modal-ham={option}
                            type="button"
                            disabled={hamLocked}
                            onClick={() => applyHamSelection(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      <button
                        className={`scenario-option scenario-modal-option scenario-modal-option-repeat ${scenario.modalHamSelection === 'repeat' ? 'scenario-modal-option-active' : ''}`}
                        data-modal-ham="repeat"
                        type="button"
                        disabled={hamLocked}
                        onClick={() => applyHamSelection('repeat')}
                      >
                        Tekrar
                      </button>
                    </div>
                    {hamLocked ? (
                      <p className="scenario-modal-note">Ara cüzde olduğunuz için ham sayısı döngü tamamlanana kadar sabit kalır.</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Aylık Mod</p>
                    <div className="scenario-detail-section">
                      <h2>{scenario.modalBoundary ? 'Kaç Ham Alacaksın?' : 'Kaç Ham?'}</h2>
                      <div className="scenario-modal-ham-group">
                        <div className="scenario-monthly-lesson-strip" style={{ '--scenario-lesson-count': availableHamOptions.length }}>
                          {availableHamOptions.map((option) => (
                            <button
                              key={option}
                              className={`scenario-option scenario-modal-option scenario-monthly-lesson-option ${scenario.modalHamSelection === option ? 'scenario-modal-option-active' : ''}`}
                              data-modal-ham={option}
                              type="button"
                              disabled={hamLocked}
                              onClick={() => applyHamSelection(option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <button
                          className={`scenario-option scenario-modal-option scenario-modal-option-repeat ${scenario.modalHamSelection === 'repeat' ? 'scenario-modal-option-active' : ''}`}
                          data-modal-ham="repeat"
                          type="button"
                          disabled={hamLocked}
                          onClick={() => applyHamSelection('repeat')}
                        >
                          Tekrar
                        </button>
                      </div>
                      {hamLocked ? (
                        <p className="scenario-modal-note">Ara cüzde olduğunuz için ham sayısı döngü tamamlanana kadar sabit kalır.</p>
                      ) : null}
                    </div>
                    {shouldShowMonthlyLessonOptions ? (
                      <div className="scenario-detail-section">
                        <h2>Haftalık Kaç Ders?</h2>
                        <div className="scenario-monthly-lesson-strip" style={{ '--scenario-lesson-count': monthlyLessonOptionMax + 1 }}>
                          {Array.from({ length: monthlyLessonOptionMax + 1 }, (_, index) => (
                            <button
                              key={index}
                              className={`scenario-option scenario-modal-option scenario-monthly-lesson-option ${scenario.modalLessonSelection === index ? 'scenario-modal-option-active' : ''}`}
                              data-modal-lesson={index}
                              type="button"
                              onClick={() => selectScenarioLessonCount(index)}
                            >
                              {index}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
                <button
                  className="scenario-button scenario-modal-start-button"
                  type="button"
                  disabled={!canStartScenario}
                  onClick={startScenarioFromModal}
                >
                  Senaryoya Başla
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
