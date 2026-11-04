import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'
import { ModelProvider } from './ModelContext'
import { TelemetryProvider } from './TelemetryContext'
import { Alerts } from '../pages/Alerts'
import { Analytics } from '../pages/Analytics'
import { DigitalTwin } from '../pages/DigitalTwin'
import { Overview } from '../pages/Overview'
import { Support } from '../pages/Support'

export default function App() {
  return (
    <BrowserRouter>
      <TelemetryProvider>
        <ModelProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Overview />} />
              <Route path="twin" element={<DigitalTwin />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="support" element={<Support />} />
              <Route path="*" element={<Overview />} />
            </Route>
          </Routes>
        </ModelProvider>
      </TelemetryProvider>
    </BrowserRouter>
  )
}
