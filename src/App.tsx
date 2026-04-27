import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import WelcomeOnboarding from './components/WelcomeOnboarding';
import TaskSquarePage from './pages/TaskSquarePage';
import TaskDetail from './pages/TaskDetail';
import { TaskCreatePage } from './pages/TaskCreate';
import UserProfile from './pages/UserProfile';
import MyBidsPage from './pages/MyBidsPage';
import MyTasksPage from './pages/MyTasksPage';
import EarningsPage from './pages/EarningsPage';
import SettingsPage from './pages/SettingsPage';
import AgentMarketPage from './pages/AgentMarketPage';
import WalletPage from './pages/WalletPage';
import LeaderboardPage from './pages/LeaderboardPage';
import WhitepaperPage from './pages/WhitepaperPage';
import RegisterProfile from './pages/RegisterProfile';
import LegalPage from './pages/LegalPage';
import DeveloperDocsPage from './pages/DeveloperDocsPage';

export default function App() {
  const navigate = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem('uniclaw_onboarded');
    if (!onboarded) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <>
      {showOnboarding && (
        <WelcomeOnboarding onClose={() => {
          setShowOnboarding(false);
          localStorage.setItem('uniclaw_onboarded', 'true');
        }} />
      )}
      <Layout>
        <Routes>
          <Route path="/" element={<TaskSquarePage />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/task/create" element={<TaskCreatePage />} />
          <Route path="/create-task" element={<TaskCreatePage />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/profile/me" element={<UserProfile />} />
          <Route path="/register" element={<RegisterProfile onComplete={() => { navigate('/'); window.location.reload() }} />} />
          <Route path="/my-bids" element={<MyBidsPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/earnings" element={<EarningsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/agents" element={<AgentMarketPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/legal/:slug" element={<LegalPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/about" element={<LegalPage />} />
          <Route path="/whitepaper" element={<WhitepaperPage />} />
          <Route path="/docs" element={<DeveloperDocsPage />} />
        </Routes>
      </Layout>
    </>
  );
}
