const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialPassword) {
    console.error("Set INITIAL_ADMIN_PASSWORD before running this script.");
    process.exitCode = 1;
    return;
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .upsert({ key: 'admin_password', value: initialPassword }, { onConflict: 'key' });
    console.log("Error:", error);
    console.log("Data:", data);
  } catch (err) {
    console.error("Catch Error:", err);
  }
}
test();
