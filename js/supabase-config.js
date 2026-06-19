// supabase-config.js
// Stores Supabase configuration credentials.
// If values are empty or default templates, database calls gracefully fallback to LocalStorage.

const supabaseConfig = {
  url: "https://ksarwkaseogpljtcjusq.supabase.co",
  anonKey: "sb_publishable_eFD7Vdl0yfidyDHWRvZyPg_FTh7XeCO"
};

// Check if Supabase is configured (i.e. user has replaced url/key)
const isSupabaseConfigured = () => {
  return (
    supabaseConfig.url &&
    supabaseConfig.url !== "YOUR_SUPABASE_URL" &&
    supabaseConfig.anonKey &&
    supabaseConfig.anonKey !== "YOUR_SUPABASE_ANON_KEY"
  );
};

// Export variables to window
window.supabaseConfig = supabaseConfig;
window.isSupabaseConfigured = isSupabaseConfigured;
