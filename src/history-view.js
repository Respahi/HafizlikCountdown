import {
  app,
  renderTabbedPanels,
} from './main.js'

function bindHistoryEvents() {
  const tabButtons = document.querySelectorAll('[data-view-tab]')

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      renderTabbedPanels(button.dataset.viewTab)
    })
  })
}

export function renderHistoryView() {
  app.innerHTML = `
    <main class="history-layout">
      <section class="history-panel">
        <div class="folder-tabs folder-tabs-history" aria-label="Sayfa sekmeleri">
          <button class="folder-tab" data-view-tab="main" type="button">Ana Tablo</button>
          <button class="folder-tab" data-view-tab="scenario" type="button">Hayali Senaryo</button>
          <button class="folder-tab folder-tab-active" data-view-tab="history" type="button">Geçmişin Hesabı</button>
        </div>

        <header class="history-header">
          <div>
            <p class="eyebrow">Üçüncü İşlem</p>
            <h1>Geçmişin Hesabı</h1>
          </div>
          <p class="history-note">Bu alanı bir sonraki adımda dolduracağız.</p>
        </header>

        <div class="history-placeholder">
          <div class="history-placeholder-card">
            <strong>Sayfa hazır</strong>
            <p>Şu an sadece geçiş sistemi ve sayfa iskeleti kuruldu. İçeriği sonraki isteğinizde ekleyebiliriz.</p>
          </div>
        </div>
      </section>
    </main>
  `

  bindHistoryEvents()
}
