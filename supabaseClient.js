const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn('Supabase belum terkonfigurasi lengkap. Set SUPABASE_URL dan SUPABASE_ANON_KEY di environment.');
}

const supabase = supabaseUrl && supabaseAnonKey
	? createClient(supabaseUrl, supabaseAnonKey)
	: null;

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
	? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
	: null;

module.exports = { supabase, supabaseAdmin };
