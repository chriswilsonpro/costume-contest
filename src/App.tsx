import { Route, Routes } from 'react-router-dom';
import { ThemeScope } from './components/ThemeScope';
import { AdminPage } from './pages/AdminPage';
import { ResultsPage } from './pages/ResultsPage';
import { VotePage } from './pages/VotePage';

export default function App() {
  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <Routes>
        <Route
          path="/"
          element={
            <ThemeScope>
              <VotePage />
            </ThemeScope>
          }
        />
        <Route
          path="/results"
          element={
            <ThemeScope>
              <ResultsPage />
            </ThemeScope>
          }
        />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}
