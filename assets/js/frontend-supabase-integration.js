(function(){
	function getJson(form) {
		const data = new FormData(form);
		const obj = {};
		for (const [k,v] of data.entries()) { obj[k] = v; }
		return obj;
	}
	function setAuth(token, user) {
		try {
			localStorage.setItem('auth_token', token);
			localStorage.setItem('auth_user', JSON.stringify(user || {}));
		} catch(e) {}
	}
	function notify(msg) {
		if (window.alert) alert(msg);
		else console.log(msg);
	}
	async function postJson(url, body) {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body || {})
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data && data.message ? data.message : 'Request gagal');
		return data;
	}
	function closeModalSafe(id) {
		try { if (typeof window.closeModal === 'function') window.closeModal(id); } catch(e) {}
	}
	function storagePublicUrl(path) {
		if (!window.supabaseBrowser) return null;
		const { data } = window.supabaseBrowser.storage.from(window.SUPABASE_BUCKET || 'bansos-uploads').getPublicUrl(path);
		return data && data.publicUrl ? data.publicUrl : null;
	}
	async function createSignedUpload(path, file) {
		const token = localStorage.getItem('auth_token');
		const res = await fetch('/api/storage/signed-url', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
			body: JSON.stringify({ path, contentType: file.type })
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || 'Gagal membuat signed URL');
		return data;
	}
	async function uploadWithSignedUrl(signedUrl, token, file) {
		const res = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'true', 'authorization': `Bearer ${token}` }, body: file });
		if (!res.ok) throw new Error('Upload gagal');
	}

	// Public helper: submit bantuan via signed upload
	window.submitBantuanViaSignedUpload = async function(formEl) {
		const fd = new FormData(formEl);
		const payload = Object.fromEntries(fd.entries());
		const requiredFiles = ['fotoKK','fotoRumahDepan','fotoRumahDalam','fotoSelfieKTP'];
		const uploadedPaths = {};
		for (const key of requiredFiles) {
			const file = fd.get(key);
			if (!file || !(file instanceof File)) throw new Error(`File ${key} wajib diupload`);
			const dest = `users/${(JSON.parse(localStorage.getItem('auth_user')||'{}').id)||'me'}/${Date.now()}-${file.name}`;
			const { signedUrl, token, path } = await createSignedUpload(dest, file);
			await uploadWithSignedUrl(signedUrl, token, file);
			uploadedPaths[key] = path;
		}
		const body = {
			jenis_bantuan: payload.jenis_bantuan,
			alasan_pengajuan: payload.alasan_pengajuan,
			gps_latitude: payload.gps_latitude || null,
			gps_longitude: payload.gps_longitude || null,
			foto_kk: uploadedPaths.fotoKK,
			foto_rumah_depan: uploadedPaths.fotoRumahDepan,
			foto_rumah_dalam: uploadedPaths.fotoRumahDalam,
			foto_selfie_ktp: uploadedPaths.fotoSelfieKTP
		};
		const token = localStorage.getItem('auth_token');
		const res = await fetch('/api/bantuan/json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: JSON.stringify(body) });
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || 'Gagal mengirim ajuan');
		return data;
	}

	// Public helper: submit sanggahan via signed upload
	window.submitSanggahanViaSignedUpload = async function(formEl) {
		const fd = new FormData(formEl);
		const jenis_sanggahan = fd.get('jenisSanggahan');
		const alasan_sanggahan = fd.get('alasanSanggahan');
		const nik_warga_lain = fd.get('nikWargaLain');
		const buktiFile = fd.get('buktiSanggahan');
		let bukti_path = null;
		if (buktiFile && buktiFile instanceof File && buktiFile.size > 0) {
			const dest = `sanggahan/${(JSON.parse(localStorage.getItem('auth_user')||'{}').id)||'me'}/${Date.now()}-${buktiFile.name}`;
			const { signedUrl, token, path } = await createSignedUpload(dest, buktiFile);
			await uploadWithSignedUrl(signedUrl, token, buktiFile);
			bukti_path = path;
		}
		const body = { jenis_sanggahan, alasan_sanggahan, bukti_file: bukti_path };
		if (jenis_sanggahan === 'warga_lain') body.nik_warga_lain = nik_warga_lain;
		const token = localStorage.getItem('auth_token');
		const res = await fetch('/api/sanggahan/json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: JSON.stringify(body) });
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || 'Gagal mengirim sanggahan');
		return data;
	}

	document.addEventListener('DOMContentLoaded', function(){
		const adminForm = document.getElementById('adminForm');
		if (adminForm) {
			adminForm.addEventListener('submit', async function(e){
				e.preventDefault();
				const payload = getJson(adminForm);
				try {
					const result = await postJson('/api/admin/login', payload);
					setAuth(result.token, result.user);
					notify('Login admin berhasil');
					closeModalSafe('loginModal');
				} catch(err) {
					notify(err.message || 'Login gagal');
				}
			});
		}
		const wargaForm = document.getElementById('wargaForm');
		if (wargaForm) {
			wargaForm.addEventListener('submit', async function(e){
				e.preventDefault();
				const payload = getJson(wargaForm);
				try {
					const result = await postJson('/api/warga/login', payload);
					setAuth(result.token, result.user);
					notify('Login warga berhasil');
					closeModalSafe('loginModal');
				} catch(err) {
					notify(err.message || 'Login gagal');
				}
			});
		}
		const registerForm = document.getElementById('registerForm');
		if (registerForm) {
			registerForm.addEventListener('submit', async function(e){
				e.preventDefault();
				const payload = getJson(registerForm);
				if (payload.password !== payload.confirmPassword) {
					return notify('Konfirmasi password tidak cocok');
				}
				try {
					const result = await postJson('/api/warga/register', payload);
					notify(result.message || 'Pendaftaran berhasil');
					closeModalSafe('registerModal');
				} catch(err) {
					notify(err.message || 'Pendaftaran gagal');
				}
			});
		}

		// Hijack submit for bantuan & sanggahan to use signed upload (Supabase mode)
		if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
			const bantuanForm = document.getElementById('bantuanForm');
			if (bantuanForm) {
				bantuanForm.addEventListener('submit', async function(e){
					e.preventDefault();
					e.stopImmediatePropagation();
					try {
						const res = await window.submitBantuanViaSignedUpload(bantuanForm);
						notify(res.message || 'Ajuan bantuan berhasil');
						// TODO: refresh daftar bantuan jika ada fungsi tersedia di script.js
					} catch(err) {
						notify(err.message || 'Gagal mengirim ajuan');
					}
				});
			}
			const sanggahanForm = document.getElementById('sanggahanForm');
			if (sanggahanForm) {
				sanggahanForm.addEventListener('submit', async function(e){
					e.preventDefault();
					e.stopImmediatePropagation();
					try {
						const res = await window.submitSanggahanViaSignedUpload(sanggahanForm);
						notify(res.message || 'Sanggahan berhasil dikirim');
						// TODO: refresh daftar sanggahan jika ada fungsi tersedia di script.js
					} catch(err) {
						notify(err.message || 'Gagal mengirim sanggahan');
					}
				});
			}
		}

		// Rewrite link dokumen dari /uploads/... ke public URL Supabase jika ada
		if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
			function rewriteDocLinks() {
				// elemen link dokumen
				const anchors = document.querySelectorAll('a[href^="/uploads/"]');
				anchors.forEach(a => {
					const relPath = a.getAttribute('href').replace(/^\/uploads\//, '');
					const pub = storagePublicUrl(relPath);
					if (pub) a.setAttribute('href', pub);
				});
				// gambar preview di modal bukti
				const imgs = document.querySelectorAll('img[src^="/uploads/"]');
				imgs.forEach(img => {
					const relPath = img.getAttribute('src').replace(/^\/uploads\//, '');
					const pub = storagePublicUrl(relPath);
					if (pub) img.setAttribute('src', pub);
				});
			}
			rewriteDocLinks();
			// observe perubahan DOM sederhana (single-page UI)
			const observer = new MutationObserver(() => rewriteDocLinks());
			observer.observe(document.body, { childList: true, subtree: true });
		}
	});
})();
