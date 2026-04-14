import { renderTabbedPanels } from '../app-state.js'

export function SegmentedTabs({ activeView, canOpenScenario, canOpenHistory }) {
  const handleSelect = (nextView) => {
    if (nextView === 'scenario' && !canOpenScenario) {
      return
    }

    if (nextView === 'history' && !canOpenHistory) {
      return
    }

    if (nextView === activeView) {
      return
    }

    renderTabbedPanels(nextView)
  }

  return (
    <div className={`folder-tabs folder-tabs-${activeView}`} aria-label="Sayfa sekmeleri">
      <span className="folder-tab-slider" aria-hidden="true"></span>
      <button
        className={`folder-tab ${activeView === 'main' ? 'folder-tab-active' : ''}`}
        data-view-tab="main"
        type="button"
        onClick={() => handleSelect('main')}
      >
        Hafızlık Tablosu
      </button>
      <button
        className={`folder-tab ${activeView === 'scenario' ? 'folder-tab-active' : ''} ${!canOpenScenario ? 'folder-tab-disabled' : ''}`}
        data-view-tab="scenario"
        type="button"
        disabled={!canOpenScenario}
        onClick={() => handleSelect('scenario')}
      >
        Hayali Senaryo
      </button>
      <button
        className={`folder-tab ${activeView === 'history' ? 'folder-tab-active' : ''} ${!canOpenHistory ? 'folder-tab-disabled' : ''}`}
        data-view-tab="history"
        type="button"
        disabled={!canOpenHistory}
        onClick={() => handleSelect('history')}
      >
        Geçmişin Hesabı
      </button>
    </div>
  )
}
