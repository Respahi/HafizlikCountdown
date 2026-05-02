import { useEffect, useReducer, useState } from 'react'
import { closeCompletionModal, formatDate, parseDateKey, state, subscribe } from './app-state.js'
import { MainView } from './main-table.jsx'
import { ScenarioView } from './scenario-view.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { HistoryView } from './history-view.jsx'
import { SistemView } from './sistem-view.jsx'
import { CompletionModal } from './components/CompletionModal.jsx'
import { SegmentedTabs } from './components/SegmentedTabs.jsx'

function useAppStore() {
  const [, forceRender] = useReducer((value) => value + 1, 0)

  useEffect(() => subscribe(() => forceRender()), [])

  return state
}

export default function App() {
  const appState = useAppStore()
  const shouldKeepScenarioMounted = appState.view === 'scenario' || appState.scenario

  return (
    <>
      <div className="app-topbar">
        <div className="app-topbar-group">
          <SegmentedTabs
            activeView={appState.view}
            canOpenScenario
            canOpenHistory={appState.mainDataApplied}
          />
        </div>
      </div>
      <div className={appState.view === 'main' ? 'app-view-panel' : 'app-view-panel app-view-panel-hidden'}>
        <MainView state={appState} />
      </div>
      {shouldKeepScenarioMounted ? (
        <div className={appState.view === 'scenario' ? 'app-view-panel' : 'app-view-panel app-view-panel-hidden'}>
          <ErrorBoundary><ScenarioView state={appState} /></ErrorBoundary>
        </div>
      ) : null}
      {appState.view === 'history' ? (
        <div className="app-view-panel">
          <HistoryView state={appState} />
        </div>
      ) : null}
      {appState.view === 'sistem' ? (
        <div className="app-view-panel">
          <SistemView />
        </div>
      ) : null}
      {appState.completionModalOpen && appState.filledCount >= 600 && appState.completionDateKey ? (
        <CompletionModal
          dateLabel={formatDate(parseDateKey(appState.completionDateKey))}
          onClose={closeCompletionModal}
        />
      ) : null}
    </>
  )
}
