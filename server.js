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

// Helper to fetch the admin password from Supabase app_config
async function getAdminPassword() {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'admin_password')
      .single();
    if (error || !data) return "apple9191"; // Default fallback
    return data.value;
  } catch (err) {
    return "apple9191";
  }
}

// 비밀번호 검증 API
app.post("/api/verify-password", async (req, res) => {
  try {
    const { password } = req.body;
    const currentPassword = await getAdminPassword();
    if (password === currentPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid password" });
    }
  } catch (error) {
    console.error("Error verifying password:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// 비밀번호 변경 API
app.post("/api/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const actualPassword = await getAdminPassword();

    if (currentPassword !== actualPassword) {
      return res.status(401).json({ success: false, error: "현재 비밀번호가 일치하지 않습니다." });
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, error: "새 비밀번호는 4자리 이상이어야 합니다." });
    }

    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'admin_password', value: newPassword }, { onConflict: 'key' });

    if (error) throw error;
    res.json({ success: true, message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ success: false, error: "서버 오류로 변경 실패: " + (error.message || JSON.stringify(error)) });
  }
});

// JSON 저장 API
app.post("/api/save-json", async (req, res) => {
  try {
    const providedPassword = req.headers['x-admin-password'];
    const actualPassword = await getAdminPassword();

    if (providedPassword !== actualPassword) {
      return res.status(401).json({ error: "Unauthorized: Invalid password" });
    }

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
