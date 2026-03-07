import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Main from "./pages/Main";
import Admin from "./pages/Admin";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Routes>
                    <Route path="/" element={<Main />} />
                    <Route path="/admin" element={<Admin />} />
                </Routes>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
