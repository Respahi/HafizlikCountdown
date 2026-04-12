import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './style.css'

const VERSION_QUERY_KEY = 'v'
const VERSION_REFRESH_KEY = 'hafizlik-countdown-build-refresh'

function renderApp() {
  ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

async function ensureLatestBuild() {
  if (!import.meta.env.PROD || typeof window === 'undefined') {
    return
  }

  const currentUrl = new URL(window.location.href)

  if (currentUrl.searchParams.has(VERSION_QUERY_KEY)) {
    currentUrl.searchParams.delete(VERSION_QUERY_KEY)
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
    sessionStorage.removeItem(VERSION_REFRESH_KEY)
    return
  }

  const currentEntryScript = document
    .querySelector('script[type="module"][src]')
    ?.getAttribute('src')

  if (!currentEntryScript) {
    return
  }

  try {
    const response = await fetch(currentUrl.pathname, { cache: 'no-store' })

    if (!response.ok) {
      return
    }

    const html = await response.text()
    const latestEntryScript = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i)?.[1]

    if (!latestEntryScript || latestEntryScript === currentEntryScript) {
      sessionStorage.removeItem(VERSION_REFRESH_KEY)
      return
    }

    if (sessionStorage.getItem(VERSION_REFRESH_KEY) === latestEntryScript) {
      return
    }

    sessionStorage.setItem(VERSION_REFRESH_KEY, latestEntryScript)
    currentUrl.searchParams.set(VERSION_QUERY_KEY, Date.now().toString())
    window.location.replace(`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
  } catch {
    sessionStorage.removeItem(VERSION_REFRESH_KEY)
  }
}

ensureLatestBuild().finally(renderApp)
