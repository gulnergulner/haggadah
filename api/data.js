const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // CORS configure
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    // ... handling OPTIONS preflight etc...

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('weekly_verses')
            .select('date, content');

        if (error) throw error;

        const formattedData = {};
        if (data) {
            data.forEach(row => {
                formattedData[row.date] = row.content;
            });
        }

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.status(200).json(formattedData);
    } catch (error) {
        console.error("Error fetching from Supabase:", error);
        res.status(500).json({ error: "Failed to read data from database" });
    }
};
