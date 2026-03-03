import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import WebAlertHost from './ui/WebAlertHost.jsx'
import GlobalBrand from './ui/GlobalBrand.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalBrand />
    <App />
    <WebAlertHost />
  </StrictMode>,
)
