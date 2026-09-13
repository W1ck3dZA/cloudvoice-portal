import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useSession } from './lib/session';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Numbers from './pages/Numbers';
import SipUsers from './pages/SipUsers';
import Gateways from './pages/Gateways';
import Calls from './pages/Calls';
import Recordings from './pages/Recordings';
import AudioFiles from './pages/AudioFiles';
import Applications from './pages/Applications';
import FlowBuilder from './pages/FlowBuilder';
import CallCenter from './pages/CallCenter';
import QueueDetail from './pages/QueueDetail';
import Messaging from './pages/Messaging';
import Webhooks from './pages/Webhooks';
import EventTester from './pages/EventTester';
import ApiKeys from './pages/ApiKeys';
import Organisation from './pages/Organisation';
import Settings from './pages/Settings';
function Protected() {
  const { session } = useSession();
  return session && localStorage.getItem('cv_token') ? (
    <Layout />
  ) : (
    <Navigate to="/login" replace />
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/numbers" element={<Numbers />} />
        <Route path="/sip-users" element={<SipUsers />} />
        <Route path="/gateways" element={<Gateways />} />
        <Route path="/calls" element={<Calls />} />
        <Route path="/recordings" element={<Recordings />} />
        <Route path="/audio-files" element={<AudioFiles />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id/builder" element={<FlowBuilder />} />
        <Route path="/call-center" element={<CallCenter />} />
        <Route path="/call-center/queues/:id" element={<QueueDetail />} />
        <Route path="/messaging" element={<Messaging />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/events" element={<EventTester />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/organisation" element={<Organisation />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
