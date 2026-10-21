import { NavLink, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { ResultsPage } from './pages/ResultsPage';
import { VotePage } from './pages/VotePage';

export default function App() {
  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <nav className="top-nav">
        <NavLink to="/" end>
          Vote
        </NavLink>
        <NavLink to="/results">Results</NavLink>
        <NavLink to="/admin">Admin</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<VotePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}
