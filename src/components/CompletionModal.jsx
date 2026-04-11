const CONFETTI_COLORS = ['#4f9b59', '#dc8a2f', '#417fd1', '#d96ca4', '#d4aa2a', '#8f969d']

export function CompletionModal({ dateLabel, onClose }) {
  const confettiPieces = Array.from({ length: 28 }, (_, index) => {
    const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length]
    const left = (index * 13) % 100
    const delay = `${(index % 7) * 110}ms`
    const duration = `${2400 + ((index % 5) * 180)}ms`
    const rotate = `${((index * 37) % 60) - 30}deg`
    const drift = `${(index % 2 === 0 ? 1 : -1) * (12 + ((index % 4) * 6))}px`
    const size = `${8 + ((index % 3) * 3)}px`

    return (
      <span
        key={index}
        className="completion-confetti-piece"
        style={{
          '--confetti-left': `${left}%`,
          '--confetti-delay': delay,
          '--confetti-duration': duration,
          '--confetti-rotate': rotate,
          '--confetti-drift': drift,
          '--confetti-size': size,
          '--confetti-color': color,
        }}
      />
    )
  })

  return (
    <div className="completion-modal-backdrop">
      <div className="completion-modal">
        <div className="completion-confetti" aria-hidden="true">
          {confettiPieces}
        </div>
        <p className="eyebrow">Tebrikler</p>
        <h2>Hafızlığınız Bitti</h2>
        <p className="completion-date">Hafızlık Bitiş Tarihi: {dateLabel}</p>
        <button className="back-button completion-close-button" type="button" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  )
}
