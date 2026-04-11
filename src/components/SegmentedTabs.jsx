import { renderTabbedPanels } from '../app-state.js'

export function SegmentedTabs({ activeView }) {
  const handleSelect = (nextView) => {
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
        Ana Tablo
      </button>
      <button
        className={`folder-tab ${activeView === 'scenario' ? 'folder-tab-active' : ''}`}
        data-view-tab="scenario"
        type="button"
        onClick={() => handleSelect('scenario')}
      >
        Hayali Senaryo
      </button>
      <button
        className={`folder-tab ${activeView === 'history' ? 'folder-tab-active' : ''}`}
        data-view-tab="history"
        type="button"
        onClick={() => handleSelect('history')}
      >
        Geçmişin Hesabı
      </button>
    </div>
  )
}
