import { Routes, Route } from 'react-router-dom';
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
import RegisterProfile from './pages/RegisterProfile';

export default function App() {
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
          <Route path="/users/me" element={<UserProfile />} />
          <Route path="/register" element={<RegisterProfile />} />
          <Route path="/my-bids" element={<MyBidsPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/earnings" element={<EarningsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/agents" element={<AgentMarketPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </Layout>
    </>
  );
}
