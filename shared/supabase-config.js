// Public connection details for the J&E Supabase project ("je-apps").
// These keys are MEANT to be public: they only allow what the database rules
// (row level security) allow — reading reports and adding new ones.
window.SUPABASE = {
  url: "https://ugageqklogrispkncrnp.supabase.co",
  // Legacy anon key (a JWT) — needed to call Edge Functions.
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnYWdlcWtsb2dyaXNwa25jcm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjI3NTUsImV4cCI6MjEwOTM5ODc1NX0.P8Ugo4CkbvW0Esl12drRmoZjzvrZGMS-edL57LgTs4Y",
};
