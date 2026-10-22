import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import MapPage from './pages/MapPage'
import AlertsPage from './pages/AlertsPage'
import DeptPage from './pages/DeptPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<MapPage />} />
        <Route path="/app/alerts" element={<AlertsPage />} />
        <Route path="/app/dep/:code" element={<DeptPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
