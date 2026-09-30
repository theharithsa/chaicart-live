import { Suspense, lazy } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Join from './pages/Join'
import Play from './pages/Play'
import Certificate from './pages/Certificate'

const Console = lazy(() => import('./console/Console'))
const Screen = lazy(() => import('./console/Screen'))

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<div className="empty">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<Join />} />
          <Route path="/play" element={<Play />} />
          <Route path="/certificate" element={<Certificate />} />
          <Route path="/console" element={<Console />} />
          <Route path="/screen" element={<Screen />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
