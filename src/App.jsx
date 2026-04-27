import { useEffect, useReducer, useState } from 'react'
import { closeCompletionModal, formatDate, parseDateKey, state, subscribe } from './app-state.js'
import { MainView } from './main-table.jsx'
import { ScenarioView } from './scenario-view.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { HistoryView } from './history-view.jsx'
import { CompletionModal } from './components/CompletionModal.jsx'
import { SegmentedTabs } from './components/SegmentedTabs.jsx'

function useAppStore() {
  const [, forceRender] = useReducer((value) => value + 1, 0)

  useEffect(() => subscribe(() => forceRender()), [])

  return state
}

export default function App() {
  const appState = useAppStore()

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
      {appState.view === 'scenario' ? <ErrorBoundary><ScenarioView state={appState} /></ErrorBoundary> : null}
      {appState.view === 'history' ? <HistoryView state={appState} /> : null}
      {appState.view === 'main' ? <MainView state={appState} /> : null}
      {appState.completionModalOpen && appState.filledCount >= 600 && appState.completionDateKey ? (
        <CompletionModal
          dateLabel={formatDate(parseDateKey(appState.completionDateKey))}
          onClose={closeCompletionModal}
        />
      ) : null}
    </>
  )
}
