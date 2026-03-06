const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS 설정
app.use(cors());

// JSON 파싱 미들웨어
app.use(express.json());

// 정적 파일 서빙 (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'react/dist')));

// Serve data.json dynamic without cache from Supabase
app.get("/data.json", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('weekly_verses')
      .select('date, content');

    if (error) throw error;

    // Reconstruct the JSON object the frontend expects
    const formattedData = {};
    if (data) {
      data.forEach(row => {
        formattedData[row.date] = row.content;
      });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(formattedData);
  } catch (error) {
    console.error("Error fetching from Supabase:", error);
    res.status(500).json({ error: "Failed to read data from database" });
  }
});

// For any other static files in root
app.use(express.static(__dirname));

// JSON 저장 API
app.post("/api/save-json", async (req, res) => {
  try {
    const { filename, data } = req.body;

    // 파일명 검증 (data.json만 허용)
    if (filename !== "data.json") {
      return res.status(400).json({ error: "Invalid filename" });
    }

    // Convert the dictionary data object into an array of rows
    const rowsToUpsert = Object.keys(data).map(dateKey => ({
      date: dateKey,
      content: data[dateKey]
    }));

    // Upsert into Supabase (insert or update)
    const { error } = await supabase
      .from('weekly_verses')
      .upsert(rowsToUpsert, { onConflict: 'date' });

    if (error) throw error;

    res.json({ success: true, message: `Data saved to Supabase successfully` });
  } catch (error) {
    console.error("Error saving to Supabase:", error);
    res.status(500).json({ error: "Failed to save data to database" });
  }
});

// React Router wildcard 캡처
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'react/dist/index.html'));
});

// 로컬 (내 PC) 환경에서만 직접 서버를 실행합니다.
// Vercel 환경(서버리스)에서는 Vercel이 알아서 app을 실행해주기 때문에 listen을 직접 호출하면 안 됩니다.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📖 메인 페이지: http://localhost:${PORT}/`);
    console.log(`📋 관리자 페이지: http://localhost:${PORT}/admin`);
  });
}

// Vercel Serverless Function으로 동작하기 위해 app을 내보냅니다(export)
module.exports = app;
