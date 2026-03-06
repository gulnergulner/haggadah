const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

// CORS 설정
app.use(cors());

// JSON 파싱 미들웨어
app.use(express.json());

// 정적 파일 서빙 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'react/dist')));

// Serve data.json dynamic without cache
app.get("/data.json", (req, res) => {
  const filepath = path.join(__dirname, "data.json");
  try {
    const data = fs.readFileSync(filepath, "utf-8");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: "Failed to read data.json" });
  }
});

// For any other static files in root
app.use(express.static(__dirname));
// JSON 저장 API
app.post("/api/save-json", (req, res) => {
  try {
    const { filename, data } = req.body;

    // 파일명 검증 (data.json만 허용)
    if (filename !== "data.json") {
      return res.status(400).json({ error: "Invalid filename" });
    }

    // JSON 파일 저장
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");

    res.json({ success: true, message: `${filename} saved successfully` });
  } catch (error) {
    console.error("Error saving JSON:", error);
    res.status(500).json({ error: "Failed to save JSON" });
  }
});

// React Router wildcard 캡처
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'react/dist/index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📖 메인 페이지: http://localhost:${PORT}/`);
  console.log(`📋 관리자 페이지: http://localhost:${PORT}/admin`);
});
