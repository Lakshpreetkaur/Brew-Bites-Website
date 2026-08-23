/**
 * Brew & Bite - Supabase Client Initialization (supabase.js)
 * Connects the frontend to Supabase using the official Supabase JavaScript browser client.
 *
 * IMPORTANT SECURITY NOTE:
 * - Only use your Supabase Project URL and the Publishable (anon) API key in frontend code.
 * - NEVER include or expose your Supabase service_role / secret key here.
 */

// Supabase Configuration
const SUPABASE_URL = 'https://lwfnvcgupyyolkektqgt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_azNDn-pgKpTEC8CsLsQ1Gw_MZ3D_FJH';

// Capture early URL recovery parameters before client initialization cleans the hash
const _earlyHash = window.location.hash || '';
const _earlySearch = window.location.search || '';
if (
  _earlyHash.includes('type=recovery') ||
  _earlySearch.includes('type=recovery') ||
  (_earlyHash.includes('access_token=') && _earlyHash.includes('type=recovery'))
) {
  window.__bb_recovery_detected = true;
  console.log("[Auth Recovery Stage 2: URL/Token] Recovery tokens captured at early bootstrap before client init:", _earlyHash.substring(0, 50) + "...");
}

// Global Supabase Client instance
let supabaseClient = null;

// Initialize Supabase Client if the official CDN library is loaded
if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase Client initialized successfully with Brew & Bite project.");
  } catch (error) {
    console.warn("Could not initialize Supabase Client:", error);
  }
} else {
  console.warn("Supabase library not detected. Ensure the Supabase CDN script is loaded before js/supabase.js.");
}
