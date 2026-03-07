const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .upsert({ key: 'admin_password', value: 'apple9191' }, { onConflict: 'key' });
    console.log("Error:", error);
    console.log("Data:", data);
  } catch (err) {
    console.error("Catch Error:", err);
  }
}
test();
