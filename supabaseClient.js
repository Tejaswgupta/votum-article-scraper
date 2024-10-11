const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and Key
const supabaseUrl = 'https://supabase.thevotum.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE3OTU3ODAwLAogICJleHAiOiAxODc1NzI0MjAwCn0.XrCbkNQDLY0fvtqJ7ZHdimDSihI7sRfbqtIjqOXgrNg';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
