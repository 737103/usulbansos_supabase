(function(){
	if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
		console.warn('Supabase browser belum dikonfigurasi. Set window.SUPABASE_URL dan window.SUPABASE_ANON_KEY.');
		return;
	}
	window.supabaseBrowser = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();
