const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // CORS 
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        let parsedBody = req.body;
        if (typeof req.body === 'string') {
            try {
                parsedBody = JSON.parse(req.body);
            } catch (e) {
                return res.status(400).json({ error: "Invalid JSON body format" });
            }
        }

        const { filename, data } = parsedBody || {};

        // 파일명 검증 (data.json만 허용)
        if (filename !== "data.json" || !data) {
            return res.status(400).json({ error: "Invalid filename or missing data" });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Convert the dictionary data object into an array of rows
        const rowsToUpsert = Object.keys(data).map(dateKey => ({
            date: dateKey,
            content: data[dateKey]
        }));

        // Upsert into Supabase
        const { error } = await supabase
            .from('weekly_verses')
            .upsert(rowsToUpsert, { onConflict: 'date' });

        if (error) throw error;

        res.status(200).json({ success: true, message: `Data saved to Supabase successfully` });
    } catch (error) {
        console.error("Error saving to Supabase:", error);
        res.status(500).json({ error: "Failed to save data to database" });
    }
};
