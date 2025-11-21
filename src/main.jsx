import React from 'react'
import ReactDOM from 'react-dom/client'
// Ensure this import matches the file name exactly
import PaintballFinanceTracker from './PaintballTracker'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PaintballFinanceTracker />
  </React.StrictMode>,
)
