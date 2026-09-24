import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import Pay from './pages/Pay';
import Scan from './pages/Scan';
import VoiceAssistant from './pages/VoiceAssistant';
import History from './pages/History';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Bills from './pages/Bills';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="pay" element={<Pay />} />
              <Route path="bills" element={<Bills />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="voice" element={<VoiceAssistant />} />
              <Route path="scan" element={<Scan />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AccessibilityProvider>
    </AuthProvider>
  );
}

export default App;
