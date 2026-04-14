import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import TaskSquarePage from './pages/TaskSquarePage';
import TaskDetail from './pages/TaskDetail';
import { TaskCreatePage } from './pages/TaskCreate';
import UserProfile from './pages/UserProfile';
import MyBidsPage from './pages/MyBidsPage';
import WalletPage from './pages/WalletPage';
import LeaderboardPage from './pages/LeaderboardPage';

export default function App() {
  return (
      <Layout>
        <Routes>
          <Route path="/" element={<TaskSquarePage />} />
          <Route path="/task/:id" element={<TaskDetail />} />
          <Route path="/task/create" element={<TaskCreatePage />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/my-bids" element={<MyBidsPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </Layout>
  );
}
