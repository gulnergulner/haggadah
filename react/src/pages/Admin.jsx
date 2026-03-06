import { useState, useEffect } from "react";
import "./Admin.css";

const ADMIN_PASSWORD = "1234";

function Admin() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [activeTab, setActiveTab] = useState("ko");
    const [successMsg, setSuccessMsg] = useState("");

    const [verseData, setVerseData] = useState({
        ko: { title: "", part1: "", part2: "" },
        en: { title: "", part1: "", part2: "" },
    });

    useEffect(() => {
        if (isLoggedIn) {
            loadData();
        }
    }, [isLoggedIn]);

    const loadData = async () => {
        try {
            const cached = localStorage.getItem("verseData");
            if (cached) {
                setVerseData(JSON.parse(cached));
            } else {
                const response = await fetch("/data.json");
                if (response.ok) {
                    const data = await response.json();
                    setVerseData(data);
                }
            }
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsLoggedIn(true);
            setErrorMsg("");
        } else {
            setErrorMsg("❌ 비밀번호가 틀렸습니다.");
            setPassword("");
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setPassword("");
    };

    const handleChange = (lang, field, value) => {
        setVerseData((prev) => ({
            ...prev,
            [lang]: {
                ...prev[lang],
                [field]: value,
            },
        }));
    };

    const handleSave = async (lang) => {
        const updatedData = { ...verseData };

        // Clear local storage cache so it forces a fetch everywhere
        localStorage.removeItem("verseData");

        // Show success message
        setSuccessMsg("✓ 저장되었습니다.");
        setTimeout(() => setSuccessMsg(""), 3000);

        // Save to server
        try {
            const response = await fetch("/api/save-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: "data.json", data: updatedData }),
            });
            if (response.ok) {
                console.log("✓ 서버에 저장되었습니다.");
            } else {
                console.log("⚠️ 서버 저장 실패.");
            }
        } catch (error) {
            console.log("⚠️ 서버 연결 불가.", error);
        }
    };

    const handleDownloadJson = () => {
        const jsonString = JSON.stringify(verseData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "data.json";
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!isLoggedIn) {
        return (
            <div className="admin-body">
                <div className="login-container">
                    <h1>🔐 관리자 로그인</h1>
                    <form onSubmit={handleLogin} className="form-group">
                        <label htmlFor="password">비밀번호:</label>
                        <input
                            type="password"
                            id="password"
                            placeholder="비밀번호를 입력하세요"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button type="submit" className="login-btn">
                            로그인
                        </button>
                        {errorMsg && <div className="error-message">{errorMsg}</div>}
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-body">
            <div className="admin-container">
                <div className="admin-header">
                    <h1>하가다 관리자 패널</h1>
                    <button className="logout-btn" onClick={handleLogout}>
                        로그아웃
                    </button>
                </div>

                <div className="tab-buttons">
                    <button
                        className={`tab-btn ${activeTab === "ko" ? "active" : ""}`}
                        onClick={() => setActiveTab("ko")}
                    >
                        한글 (Korean)
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "en" ? "active" : ""}`}
                        onClick={() => setActiveTab("en")}
                    >
                        영문 (English)
                    </button>
                </div>

                {/* KO Tab */}
                <div className={`tab-content ${activeTab === "ko" ? "active" : ""}`}>
                    {successMsg && activeTab === "ko" && (
                        <div className="success-message">{successMsg}</div>
                    )}
                    <div className="form-group">
                        <label>제목 (Title):</label>
                        <input
                            type="text"
                            value={verseData.ko.title}
                            onChange={(e) => handleChange("ko", "title", e.target.value)}
                            placeholder="📖요한복음 15:5-6"
                        />
                    </div>
                    <div className="form-group">
                        <h3>파트 1 (Part 1):</h3>
                        <textarea
                            value={verseData.ko.part1}
                            onChange={(e) => handleChange("ko", "part1", e.target.value)}
                            placeholder="<br/>로 줄바꿈을 표시하세요"
                        />
                    </div>
                    <div className="form-group">
                        <h3>파트 2 (Part 2):</h3>
                        <textarea
                            value={verseData.ko.part2}
                            onChange={(e) => handleChange("ko", "part2", e.target.value)}
                            placeholder="<br/>로 줄바꿈을 표시하세요"
                        />
                    </div>
                    <div className="button-group">
                        <button className="save-btn" onClick={() => handleSave("ko")}>
                            💾 저장
                        </button>
                        <button className="download-btn" onClick={handleDownloadJson}>
                            ⬇️ JSON 다운로드
                        </button>
                    </div>
                </div>

                {/* EN Tab */}
                <div className={`tab-content ${activeTab === "en" ? "active" : ""}`}>
                    {successMsg && activeTab === "en" && (
                        <div className="success-message">{successMsg}</div>
                    )}
                    <div className="form-group">
                        <label>Title:</label>
                        <input
                            type="text"
                            value={verseData.en.title}
                            onChange={(e) => handleChange("en", "title", e.target.value)}
                            placeholder="📖John 15:5-6"
                        />
                    </div>
                    <div className="form-group">
                        <h3>Part 1:</h3>
                        <textarea
                            value={verseData.en.part1}
                            onChange={(e) => handleChange("en", "part1", e.target.value)}
                            placeholder="Use <br/> for line breaks"
                        />
                    </div>
                    <div className="form-group">
                        <h3>Part 2:</h3>
                        <textarea
                            value={verseData.en.part2}
                            onChange={(e) => handleChange("en", "part2", e.target.value)}
                            placeholder="Use <br/> for line breaks"
                        />
                    </div>
                    <div className="button-group">
                        <button className="save-btn" onClick={() => handleSave("en")}>
                            💾 Save
                        </button>
                        <button className="download-btn" onClick={handleDownloadJson}>
                            ⬇️ Download JSON
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Admin;
