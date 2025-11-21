import React from 'react'
import ReactDOM from 'react-dom/client'
import PaintballTracker from './PaintballTracker'

// This finds the <div id="root"> in your index.html and puts the app inside it
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PaintballTracker />
  </React.StrictMode>,
)
