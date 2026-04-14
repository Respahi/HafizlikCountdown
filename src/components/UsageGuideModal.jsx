import { useEffect } from 'react'

const FLOW_ITEMS = [
  {
    key: 'main',
    label: 'Ana Tablo',
    summary: 'Bugünkü gerçek durum buradan girilir.',
  },
  {
    key: 'scenario',
    label: 'Hayali Senaryo',
    summary: 'Bugünden sonrası burada planlanır.',
  },
  {
    key: 'history',
    label: 'Geçmişin Hesabı',
    summary: 'Bugüne nasıl gelindiği burada okunur.',
  },
]

const GUIDE_CONTENT = {
  main: {
    title: 'Ana Tablo Kılavuzu',
    subtitle: 'Sistemin başlangıç noktasıdır. Buradaki bilgiler hem senaryo ekranını hem de geçmiş analizini besler.',
    purpose:
      'Öğrenci bugün kaçla gittiğini, kaçıncı cüzde olduğunu ve aktif ham düzenini buraya işler. Öğretici de aynı ekran üzerinden güncel durumu standart biçimde doğrular.',
    studentSteps: [
      'Kaçla gidiyor alanına mevcut hızını yaz.',
      'Kaçıncı cüzde alanına bugün bulunduğun cüzü gir.',
      'Kaç ham aldı seçicisiyle o temponun hangi ham düzeninden oluştuğunu seç.',
      'Uygula düğmesine basınca 600 kare tablo ve tahmini bitiş tarihi güncellenir.',
    ],
    teacherSteps: [
      'Öğrenciyle hız, cüz ve ham bilgisini aynı anda netleştir.',
      'Yeni tempo belirlendiyse önce bu ekranı düzelt, sonra diğer sekmelere geç.',
      'Tahmini bitiş tarihini hedef takvimle karşılaştırıp planı buna göre kur.',
    ],
    areas: [
      {
        title: '600 Karelik Tablo',
        description: 'Toplam ilerlemeyi tek bakışta gösterir. Gri alan işlenmiş kısmı, işaretli kareler senaryo etkilerini taşır.',
      },
      {
        title: 'Veri Girişi Kartı',
        description: 'Güncel tempo ve ham yapısı burada değiştirilir. Sistem yeniden bu verilerden hesap yapar.',
      },
      {
        title: 'Tahmini Bitiş',
        description: 'Mevcut duruma göre sistemin hesapladığı öngörülen bitiş tarihidir.',
      },
    ],
    tips: [
      'Yanlış başlangıç verisi girilirse diğer iki sekme de yanlış yorum üretir.',
      'Tempo değişikliği yaşandığında ilk güncellenecek yer her zaman bu ekrandır.',
    ],
  },
  scenario: {
    title: 'Hayali Senaryo Kılavuzu',
    subtitle: 'Önünüzdeki haftaları veya ayları denemek, farklı çalışma düzenlerinin sonucu nasıl değiştirdiğini görmek için kullanılır.',
    purpose:
      'Öğrenci kendi çalışma ritmini prova eder; öğretici ise hangi planın daha gerçekçi olduğunu görüp yön verir.',
    studentSteps: [
      'Önce Haftalık ya da Aylık modu seç.',
      'Kaç ham alacağını belirle.',
      'Aylık moddaysan haftalık kaç ders vereceğini seç.',
      'Senaryoyu Başlat veya Senaryoya Devam ile takvim üstünde sonucu izle.',
    ],
    teacherSteps: [
      'Haftalık modu kısa dönem disiplin testi için kullan.',
      'Aylık modu düzenli tempo ve ders dağılımı kurmak için kullan.',
      'Pazar ve tatil ayarlarını açıp kapatarak gerçek hayata en yakın planı kıyasla.',
    ],
    areas: [
      {
        title: '1. Mod Kartı',
        description: 'Haftalık ve aylık çalışma mantığı burada belirlenir. Aylık mod daha düzenli tekrar eden plan kurar.',
      },
      {
        title: '2. Ham Kartı',
        description: 'Bu dönem kaç ham alınacağını seçersin. Bu seçim senaryonun zorluk seviyesini belirler.',
      },
      {
        title: '3. Ders Kartı',
        description: 'Aylık modda haftalık ders sayısını ayarlarsın; haftalık modda ise o haftaki ders sayısını doğrudan seçersin.',
      },
      {
        title: 'Takvim ve Ön İzleme',
        description: 'Takvim günlük akışı, sağ taraftaki mini tablo ise ana tablonun senaryo sonrası nasıl görüneceğini gösterir.',
      },
    ],
    tips: [
      'Aylık modda ders sayısını tekrar açıp güncelleyebilirsin; ardından devam kartından yeni planı çalıştırabilirsin.',
      'Bu ekran tahmin aracıdır; gerçek veriyi kalıcı hale getirmek için ana tabloyu temel almaya devam et.',
    ],
  },
  history: {
    title: 'Geçmişin Hesabı Kılavuzu',
    subtitle: 'Bugüne kadar geçen zamanı, eski ham dönemlerini ve gecikme kaynaklarını okumak için kullanılır.',
    purpose:
      'Öğrenci nerede tempo kaybettiğini görür; öğretici de hangi dönemlerin yük bindirdiğini ve telafi ihtiyacını sayısal olarak okur.',
    studentSteps: [
      'Hafızlığa başlama tarihini gir.',
      'Geçmişteki 2, 3, 4 ve 5 ham dönemlerini sayıyla işle.',
      'Durum Raporu düğmesine bas.',
      'Takvim ve özet kartlarından bugüne geliş ritmini incele.',
    ],
    teacherSteps: [
      'Gerçek ilerlemeyi mükemmel gidişle karşılaştır.',
      'Ders verilen gün, verilmeyen gün ve pazar-tatil yükünü birlikte oku.',
      'Hangi dönemde tempo kırıldığını tespit edip telafi planını buna göre kur.',
    ],
    areas: [
      {
        title: 'Başlangıç Tarihi',
        description: 'Tüm geçmiş hesabının referans tarihidir; eksik veya yanlışsa rapor bozulur.',
      },
      {
        title: 'Geçmişteki Ham Sayıları',
        description: 'Önceki dönemlerin zorluk seviyesini sisteme tanımlar; rapor bu bilgiyle geçmiş temposunu çözer.',
      },
      {
        title: 'Yıllık Takvim',
        description: 'Çalışılan, kaçırılan ve kapalı günleri yıl bazında görselleştirir.',
      },
      {
        title: 'Durum Özeti',
        description: 'Gerçek ilerleme ile ideal ilerleme arasındaki farkı bir arada gösterir.',
      },
    ],
    tips: [
      'Bu ekran tahminden çok teşhis ekranıdır; problemi bulmak ve öğreticiyle konuşmak için kullan.',
      'Başlangıç tarihi ile geçmiş ham sayıları birlikte düşünülmelidir; biri tek başına yeterli değildir.',
    ],
  },
}

function GuideSystemFlow({ activeView }) {
  return (
    <section className="guide-system-flow">
      {FLOW_ITEMS.map((item, index) => (
        <div
          key={item.key}
          className={`guide-flow-card ${activeView === item.key ? 'guide-flow-card-active' : ''}`}
        >
          <span className="guide-flow-step">{index + 1}</span>
          <strong>{item.label}</strong>
          <p>{item.summary}</p>
        </div>
      ))}
    </section>
  )
}

function MainGuideVisual() {
  return (
    <div className="guide-visual guide-visual-main" aria-hidden="true">
      <div className="guide-main-topline">
        <span className="guide-main-title-block"></span>
        <span className="guide-main-date-block"></span>
      </div>
      <div className="guide-main-body">
        <div className="guide-main-grid">
          {Array.from({ length: 60 }, (_, index) => (
            <span
              key={index}
              className={`guide-main-cell ${index < 28 ? 'guide-main-cell-filled' : ''} ${index === 35 ? 'guide-main-cell-marked' : ''}`}
            />
          ))}
        </div>
        <div className="guide-main-sidebar">
          <span className="guide-main-sidebar-line guide-main-sidebar-line-lg"></span>
          <span className="guide-main-sidebar-line"></span>
          <span className="guide-main-sidebar-stepper"></span>
          <span className="guide-main-sidebar-button"></span>
        </div>
      </div>
    </div>
  )
}

function ScenarioGuideVisual() {
  return (
    <div className="guide-visual guide-visual-scenario" aria-hidden="true">
      <div className="guide-scenario-cards">
        <span className="guide-scenario-card guide-scenario-card-active">1</span>
        <span className="guide-scenario-card">2</span>
        <span className="guide-scenario-card">3</span>
      </div>
      <div className="guide-scenario-calendar">
        {Array.from({ length: 14 }, (_, index) => (
          <span
            key={index}
            className={`guide-scenario-day ${
              index === 2 || index === 3 || index === 8 ? 'guide-scenario-day-success' : ''
            } ${index === 4 ? 'guide-scenario-day-holiday' : ''}`}
          />
        ))}
      </div>
      <div className="guide-scenario-preview">
        <span className="guide-scenario-preview-line"></span>
        <span className="guide-scenario-preview-line guide-scenario-preview-line-wide"></span>
      </div>
    </div>
  )
}

function HistoryGuideVisual() {
  return (
    <div className="guide-visual guide-visual-history" aria-hidden="true">
      <div className="guide-history-calendar">
        {Array.from({ length: 35 }, (_, index) => (
          <span
            key={index}
            className={`guide-history-day ${
              index === 8 || index === 9 || index === 15 ? 'guide-history-day-study' : ''
            } ${index === 18 || index === 19 ? 'guide-history-day-missed' : ''}`}
          />
        ))}
      </div>
      <div className="guide-history-summary">
        <span className="guide-history-summary-line guide-history-summary-line-wide"></span>
        <span className="guide-history-summary-line"></span>
        <span className="guide-history-summary-line"></span>
      </div>
    </div>
  )
}

function GuideVisual({ view }) {
  if (view === 'scenario') {
    return <ScenarioGuideVisual />
  }

  if (view === 'history') {
    return <HistoryGuideVisual />
  }

  return <MainGuideVisual />
}

function GuideFeatureCards({ items }) {
  return (
    <div className="guide-feature-grid">
      {items.map((item) => (
        <article key={item.title} className="guide-feature-card">
          <h4>{item.title}</h4>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  )
}

function GuideRoleList({ title, items, ordered = false }) {
  const ListTag = ordered ? 'ol' : 'ul'

  return (
    <article className="guide-role-card">
      <h3>{title}</h3>
      <ListTag className={`guide-role-list ${ordered ? 'guide-role-list-ordered' : ''}`}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ListTag>
    </article>
  )
}

export function UsageGuideModal({ view, onClose }) {
  const content = GUIDE_CONTENT[view] ?? GUIDE_CONTENT.main

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="guide-modal-backdrop" onClick={onClose}>
      <div
        className={`guide-modal guide-modal-${view}`}
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-modal-head">
          <div className="guide-modal-heading">
            <p className="eyebrow">Kullanım Kılavuzu</p>
            <h2>{content.title}</h2>
            <p className="guide-modal-subtitle">{content.subtitle}</p>
          </div>
          <button className="guide-modal-close" type="button" onClick={onClose}>
            Kapat
          </button>
        </div>

        <GuideSystemFlow activeView={view} />

        <section className="guide-hero">
          <GuideVisual view={view} />
          <div className="guide-hero-copy">
            <h3>Bu ekran ne işe yarar?</h3>
            <p>{content.purpose}</p>
            <div className="guide-inline-pills">
              <span className="guide-inline-pill">Öğrenci için günlük kullanım</span>
              <span className="guide-inline-pill">Öğretici için takip ve yorum</span>
              <span className="guide-inline-pill">Mevcut sekmeye özel içerik</span>
            </div>
          </div>
        </section>

        <section className="guide-role-grid">
          <GuideRoleList title="Öğrenci Nasıl Kullanır?" items={content.studentSteps} ordered />
          <GuideRoleList title="Öğretici Nasıl Kullanır?" items={content.teacherSteps} />
        </section>

        <section className="guide-panel">
          <div className="guide-panel-head">
            <h3>Ekrandaki Bölümler</h3>
            <p>Bu sekmede gördüğünüz ana parçalar ve ne işe yaradıkları.</p>
          </div>
          <GuideFeatureCards items={content.areas} />
        </section>

        <section className="guide-panel">
          <div className="guide-panel-head">
            <h3>Pratik Notlar</h3>
            <p>Bu sekmeyi verimli kullanmak için kısa ama kritik hatırlatmalar.</p>
          </div>
          <ul className="guide-note-list">
            {content.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}
