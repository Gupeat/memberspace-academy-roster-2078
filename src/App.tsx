import { Navigate, Route, Routes } from "react-router-dom";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { RosterPage } from "./pages/RosterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/academy/sessions/sess-2078/roster" replace />} />
      <Route path="/academy/sessions/:sid/roster" element={<RosterPage />} />
      <Route path="/academy/activities" element={<ActivitiesPage />} />
      <Route path="*" element={<Navigate to="/academy/sessions/sess-2078/roster" replace />} />
    </Routes>
  );
}
