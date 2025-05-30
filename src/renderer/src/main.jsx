import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { HistoryProvider } from './contexts/HistoryContext'
import './styles/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HistoryProvider>
      <App />
    </HistoryProvider>
  </StrictMode>
)
