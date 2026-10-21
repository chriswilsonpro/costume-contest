import { Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { ResultsPage } from './pages/ResultsPage';
import { VotePage } from './pages/VotePage';

export default function App() {
  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <Routes>
        <Route path="/" element={<VotePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}
