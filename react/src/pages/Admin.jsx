import { useState, useEffect } from "react";
import "./Admin.css";

const getRecentSunday = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sunday
    d.setDate(d.getDate() - day);

    // Format locally to prevent UTC shift (e.g. Sunday 8am KST becoming Saturday UTC)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dom = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dom}`;
};

function Admin() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [activeTab, setActiveTab] = useState("ko");
    const [successMsg, setSuccessMsg] = useState("");
    const [selectedSunday, setSelectedSunday] = useState(getRecentSunday(new Date()));

    const [newPassword, setNewPassword] = useState("");
    const [passwordMsg, setPasswordMsg] = useState("");
    const [verseData, setVerseData] = useState({});

    useEffect(() => {
        if (isLoggedIn) {
            loadData();
        }
    }, [isLoggedIn]);

    const loadData = async () => {
        try {
            const cached = localStorage.getItem("verseData");
            let dataToSet = {};
            if (cached) {
                dataToSet = JSON.parse(cached);
            } else {
                const response = await fetch("/data.json");
                if (response.ok) {
                    dataToSet = await response.json();
                }
            }

            // Migration from legacy data format to date-keyed format
            if (dataToSet && (dataToSet.ko || dataToSet.en)) {
                dataToSet = { [getRecentSunday(new Date())]: dataToSet };
            }
            setVerseData(dataToSet || {});
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg("");

        try {
            const response = await fetch("/api/verify-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });
            const result = await response.json();

            if (response.ok && result.success) {
                setIsLoggedIn(true);
            } else {
                setErrorMsg("❌ 비밀번호가 틀렸습니다.");
            }
        } catch (error) {
            setErrorMsg("❌ 서버에 연결할 수 없습니다.");
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setPassword("");
    };

    const handleChange = (lang, field, value) => {
        let finalValue = value;
        if (field === "title" && value.length > 0 && !value.includes("📖")) {
            finalValue = "📖" + value;
        }

        setVerseData((prev) => {
            const currentWk = prev[selectedSunday] || {
                ko: { title: "", part1: "", part2: "" },
                en: { title: "", part1: "", part2: "" }
            };
            return {
                ...prev,
                [selectedSunday]: {
                    ...currentWk,
                    [lang]: {
                        ...currentWk[lang],
                        [field]: finalValue,
                    }
                }
            };
        });
    };

    const handlePrevWeek = () => {
        const d = new Date(selectedSunday);
        d.setDate(d.getDate() - 7);
        setSelectedSunday(d.toISOString().split('T')[0]);
    };

    const handleNextWeek = () => {
        const d = new Date(selectedSunday);
        d.setDate(d.getDate() + 7);
        setSelectedSunday(d.toISOString().split('T')[0]);
    };

    const currentVerse = verseData[selectedSunday] || {
        ko: { title: "", part1: "", part2: "" },
        en: { title: "", part1: "", part2: "" }
    };

    const handleSave = async (lang) => {
        const updatedData = { ...verseData };

        // Clear local storage cache so it forces a fetch everywhere
        localStorage.removeItem("verseData");

        // Show success message
        setSuccessMsg("✓ 저장 중...");

        // Save to server
        try {
            const response = await fetch("/api/save-json", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": password
                },
                body: JSON.stringify({ filename: "data.json", data: updatedData }),
            });

            if (response.ok) {
                setSuccessMsg("✓ 서버에 저장되었습니다.");
                console.log("✓ 서버에 저장되었습니다.");
            } else {
                setSuccessMsg("⚠️ 저장 실패 (잘못된 비밀번호)");
                console.log("⚠️ 서버 저장 실패.");
            }
        } catch (error) {
            setSuccessMsg("⚠️ 서버 연결 불가.");
            console.log("⚠️ 서버 연결 불가.", error);
        }

        setTimeout(() => setSuccessMsg(""), 3000);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordMsg("변경 중...");

        try {
            const response = await fetch("/api/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: password, newPassword: newPassword })
            });
            const result = await response.json();

            if (response.ok && result.success) {
                setPasswordMsg("✅ 비밀번호가 성공적으로 변경되었습니다.");
                setPassword(newPassword); // Update active session password
                setNewPassword("");
            } else {
                setPasswordMsg(`❌ 변경 실패: ${result.error || "알 수 없는 오류"}`);
            }
        } catch (error) {
            setPasswordMsg("❌ 서버에 연결할 수 없습니다.");
        }

        setTimeout(() => setPasswordMsg(""), 4000);
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

                <div className="date-selector" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    <button onClick={handlePrevWeek} style={{ padding: '8px 15px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9' }}>&lt; 이전 주</button>
                    <input
                        type="date"
                        value={selectedSunday}
                        onChange={(e) => setSelectedSunday(getRecentSunday(e.target.value))}
                        style={{ padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <button onClick={handleNextWeek} style={{ padding: '8px 15px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9' }}>다음 주 &gt;</button>
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
                            value={currentVerse.ko.title}
                            onChange={(e) => handleChange("ko", "title", e.target.value)}
                            placeholder="📖요한복음 15:5-6"
                        />
                    </div>
                    <div className="form-group">
                        <h3>파트 1 (Part 1):</h3>
                        <textarea
                            value={currentVerse.ko.part1}
                            onChange={(e) => handleChange("ko", "part1", e.target.value)}
                            placeholder="<br/>로 줄바꿈을 표시하세요"
                        />
                    </div>
                    <div className="form-group">
                        <h3>파트 2 (Part 2):</h3>
                        <textarea
                            value={currentVerse.ko.part2}
                            onChange={(e) => handleChange("ko", "part2", e.target.value)}
                            placeholder="<br/>로 줄바꿈을 표시하세요"
                        />
                    </div>
                    <div className="button-group">
                        <button className="save-btn" onClick={() => handleSave()}>
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
                            value={currentVerse.en.title}
                            onChange={(e) => handleChange("en", "title", e.target.value)}
                            placeholder="📖John 15:5-6"
                        />
                    </div>
                    <div className="form-group">
                        <h3>Part 1:</h3>
                        <textarea
                            value={currentVerse.en.part1}
                            onChange={(e) => handleChange("en", "part1", e.target.value)}
                            placeholder="Use <br/> for line breaks"
                        />
                    </div>
                    <div className="form-group">
                        <h3>Part 2:</h3>
                        <textarea
                            value={currentVerse.en.part2}
                            onChange={(e) => handleChange("en", "part2", e.target.value)}
                            placeholder="Use <br/> for line breaks"
                        />
                    </div>
                    <div className="button-group">
                        <button className="save-btn" onClick={() => handleSave()}>
                            💾 Save
                        </button>
                        <button className="download-btn" onClick={handleDownloadJson}>
                            ⬇️ Download JSON
                        </button>
                    </div>
                </div>

                {/* Password Change Section */}
                <div style={{ marginTop: '40px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#334155', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔐</span> 관리자 비밀번호 변경
                    </h3>
                    <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="password"
                                placeholder="새 비밀번호 입력 (4자 이상)"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                            <button
                                type="submit"
                                disabled={newPassword.length < 4}
                                style={{ padding: '10px 20px', background: newPassword.length < 4 ? '#94a3b8' : '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: newPassword.length < 4 ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                            >
                                변경하기
                            </button>
                        </div>
                        {passwordMsg && <div style={{ fontSize: '14px', color: passwordMsg.includes('✅') ? '#059669' : '#dc2626', marginTop: '5px' }}>{passwordMsg}</div>}
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Admin;
