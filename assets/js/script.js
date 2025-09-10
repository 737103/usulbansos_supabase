// Global Variables
let currentUser = null;
let isAdmin = false;
const API_BASE_URL = 'http://localhost:3000/api';

// Table pagination variables
let currentPage = 1;
let itemsPerPage = 5;
let allUsers = [];
let filteredPendingUsers = [];
let filteredVerifiedUsers = [];
let currentTableType = 'pending'; // 'pending' or 'verified'

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
    setupMobileOptimizations();
});

// Initialize Application
function initializeApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    const savedAdmin = localStorage.getItem('isAdmin');
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isAdmin = savedAdmin === 'true';
        
        if (isAdmin) {
            showAdminDashboard();
        } else {
            showWargaDashboard();
        }
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Mobile menu toggle
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            navMenu.classList.toggle('active');
            
            // Add animation class
            if (navMenu.classList.contains('active')) {
                hamburger.classList.add('active');
            } else {
                hamburger.classList.remove('active');
            }
        });
        
        // Close menu when clicking on nav links
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // Form submissions
    const adminForm = document.getElementById('adminForm');
    const wargaForm = document.getElementById('wargaForm');
    const registerForm = document.getElementById('registerForm');

    if (adminForm) {
        adminForm.addEventListener('submit', handleAdminLogin);
    }

    if (wargaForm) {
        wargaForm.addEventListener('submit', handleWargaLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        
        // Add real-time NIK validation
        const nikInput = document.getElementById('regNik');
        if (nikInput) {
            nikInput.addEventListener('blur', validateNIK);
        }
    }

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Check Authentication Status
function checkAuthStatus() {
    if (currentUser) {
        updateNavbarForLoggedInUser();
    }
}

// Update Navbar for Logged In User
function updateNavbarForLoggedInUser() {
    const navMenu = document.getElementById('nav-menu');
    if (navMenu) {
        navMenu.innerHTML = `
            <a href="#home" class="nav-link">Beranda</a>
            <a href="#about" class="nav-link">Tentang</a>
            <a href="#services" class="nav-link">Layanan</a>
            <a href="#contact" class="nav-link">Kontak</a>
            <div class="user-menu">
                <span class="user-name">${currentUser.nama || currentUser.username}</span>
                <button class="btn-logout" onclick="logout()">Keluar</button>
            </div>
        `;
    }
}

// Show Login Modal
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Show Register Modal
function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

// Close Modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Switch Tab in Login Modal
function switchTab(tab) {
    const adminLogin = document.getElementById('adminLogin');
    const wargaLogin = document.getElementById('wargaLogin');
    const tabBtns = document.querySelectorAll('.tab-btn');

    // Remove active class from all tabs
    tabBtns.forEach(btn => btn.classList.remove('active'));
    adminLogin.classList.remove('active');
    wargaLogin.classList.remove('active');

    // Add active class to selected tab
    if (tab === 'admin') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        adminLogin.classList.add('active');
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        wargaLogin.classList.add('active');
    }
}

// Handle Admin Login
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Memproses...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            isAdmin = true;
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('token', data.token);
            
            showMessage('Login berhasil!', 'success');
            closeModal('loginModal');
            showAdminDashboard();
        } else {
            showMessage(data.message || 'Login gagal!', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Terjadi kesalahan saat login', 'error');
    } finally {
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Handle Warga Login
async function handleWargaLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const nik = formData.get('nik');
    const password = formData.get('password');

    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Memproses...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/warga/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nik, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            isAdmin = false;
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('isAdmin', 'false');
            localStorage.setItem('token', data.token);
            
            showMessage('Login berhasil!', 'success');
            closeModal('loginModal');
            showWargaDashboard();
        } else {
            showMessage(data.message || 'Login gagal!', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Terjadi kesalahan saat login', 'error');
    } finally {
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Validate NIK in real-time
async function validateNIK(e) {
    const nik = e.target.value.trim();
    
    // Clear previous validation messages
    const existingMessage = e.target.parentNode.querySelector('.nik-validation-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Only validate if NIK is 16 digits
    if (nik.length === 16 && /^\d{16}$/.test(nik)) {
        try {
            const response = await fetch(`${API_BASE_URL}/warga/check-nik`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nik })
            });
            
            const data = await response.json();
            
            // Create validation message element
            const messageDiv = document.createElement('div');
            messageDiv.className = 'nik-validation-message';
            
            if (response.ok) {
                // NIK is available
                messageDiv.style.color = '#28a745';
                messageDiv.innerHTML = '<i class="fas fa-check"></i> NIK tersedia untuk pendaftaran';
                e.target.style.borderColor = '#28a745';
            } else {
                // NIK already exists
                if (data.code === 'NIK_VERIFIED_EXISTS') {
                    messageDiv.style.color = '#dc3545';
                    messageDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> NIK sudah terdaftar dan diverifikasi. Hubungi admin kelurahan.';
                    e.target.style.borderColor = '#dc3545';
                } else if (data.code === 'NIK_PENDING_VERIFICATION') {
                    messageDiv.style.color = '#ffc107';
                    messageDiv.innerHTML = '<i class="fas fa-clock"></i> NIK sudah terdaftar, menunggu verifikasi admin.';
                    e.target.style.borderColor = '#ffc107';
                } else {
                    messageDiv.style.color = '#dc3545';
                    messageDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + (data.message || 'NIK tidak tersedia');
                    e.target.style.borderColor = '#dc3545';
                }
            }
            
            e.target.parentNode.appendChild(messageDiv);
            
        } catch (error) {
            console.error('NIK validation error:', error);
        }
    } else if (nik.length > 0) {
        // Invalid NIK format
        const messageDiv = document.createElement('div');
        messageDiv.className = 'nik-validation-message';
        messageDiv.style.color = '#dc3545';
        messageDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Format NIK harus 16 digit angka';
        e.target.style.borderColor = '#dc3545';
        e.target.parentNode.appendChild(messageDiv);
    } else {
        // Clear validation styling
        e.target.style.borderColor = '';
    }
}

// Handle Register
async function handleRegister(e) {
    e.preventDefault();
    console.log('Register form submitted');
    
    const formData = new FormData(e.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    // Validate password match
    if (password !== confirmPassword) {
        showMessage('Password dan konfirmasi password tidak sama!', 'error');
        return;
    }
    
    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading"></span> Memproses...';
    submitBtn.disabled = true;

    try {
        const userData = {
            nik: formData.get('nik'),
            kk: formData.get('kk'),
            nama: formData.get('nama'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            rt: formData.get('rt'),
            rw: formData.get('rw'),
            alamat: formData.get('alamat'),
            password: password
        };
        
        console.log('Sending user data:', userData);

        // Client-side validation fallback
        const sixteen = /^\d{16}$/;
        const rtRwRule = /^00\d{1,2}$/;
        if (!sixteen.test(userData.nik)) {
            showMessage('Format NIK harus 16 digit.', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }
        if (!sixteen.test(userData.kk)) {
            showMessage('Format No. KK harus 16 digit.', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }
        if (!rtRwRule.test(userData.rt)) {
            showMessage('Format RT harus diawali 00 (3-4 digit).', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }
        if (!rtRwRule.test(userData.rw)) {
            showMessage('Format RW harus diawali 00 (3-4 digit).', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        const response = await fetch(`${API_BASE_URL}/warga/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        console.log('Register response:', response.status, data);

        if (response.ok) {
            console.log('Registration successful, showing message and closing modal');
            showMessage('Pendaftaran berhasil! Akun Anda akan diverifikasi oleh admin.', 'success');
            closeModal('registerModal');
            e.target.reset();
        } else {
            console.log('Registration failed:', data.message);
            
            // Handle specific error codes for NIK validation
            if (data.code === 'NIK_VERIFIED_EXISTS') {
                showMessage('NIK sudah terdaftar dan diverifikasi oleh admin kelurahan. Hubungi admin kelurahan untuk bantuan.', 'error');
            } else if (data.code === 'NIK_PENDING_VERIFICATION') {
                showMessage('NIK sudah terdaftar tetapi belum diverifikasi. Tunggu verifikasi admin atau hubungi admin kelurahan.', 'warning');
            } else {
                showMessage(data.message || 'Pendaftaran gagal!', 'error');
            }
        }
    } catch (error) {
        console.error('Register error:', error);
        showMessage('Terjadi kesalahan saat pendaftaran', 'error');
    } finally {
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Show Admin Dashboard
function showAdminDashboard() {
    const mainContent = document.querySelector('main') || document.body;
    mainContent.innerHTML = `
        <div class="dashboard">
            <div class="dashboard-header">
                <div class="container">
                    <h1>Dashboard Admin</h1>
                    <p>Kelola aplikasi bantuan sosial Kelurahan Bara Baraya Selatan</p>
                </div>
                <button class="admin-logout-btn" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Keluar</button>
            </div>
            
            <div class="dashboard-content">
                <div id="admin-content">
                    <!-- Dynamic content will be loaded here -->
                </div>
                
                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3><i class="fas fa-chart-bar"></i> Statistik</h3>
                        <p>Lihat statistik pendaftaran dan verifikasi</p>
                        <button class="btn-primary" onclick="showStatistics()">
                            <i class="fas fa-chart-line"></i> Lihat Statistik
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-users"></i> Verifikasi Warga</h3>
                        <p>Kelola dan verifikasi akun warga yang mendaftar</p>
                        <button class="btn-primary" onclick="showVerificationTable()">
                            <i class="fas fa-eye"></i> Lihat Daftar
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-hand-holding-heart"></i> Kelola Usulan Bansos</h3>
                        <p>Daftar ajuan bansos dari warga dan validasi kelayakan</p>
                        <button class="btn-primary" onclick="showKelolaBantuan()">
                            <i class="fas fa-list-check"></i> Kelola Usulan
                        </button>
                    </div>

                    <div class="dashboard-card">
                        <h3><i class="fas fa-comments"></i> Kelola Sanggahan</h3>
                        <p>Verifikasi dan validasi sanggahan warga</p>
                        <button class="btn-primary" onclick="showKelolaSanggahan()">
                            <i class="fas fa-comments"></i> Kelola Sanggahan
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-cog"></i> Pengaturan</h3>
                        <p>Kelola pengaturan aplikasi</p>
                        <button class="btn-primary" onclick="showSettings()">
                            <i class="fas fa-cog"></i> Pengaturan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    updateNavbarForLoggedInUser();
    showStatistics(); // Show statistics as default view
}
// Admin: Kelola Sanggahan
async function showKelolaSanggahan() {
    // Auto-refresh halaman sanggahan tiap 30 detik
    try { clearInterval(window.__adminAutoRefresh); } catch(_) {}
    window.__adminAutoRefresh = setInterval(() => { try { showKelolaSanggahan(); } catch(_) {} }, 30000);
    const content = document.getElementById('admin-content');
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/sanggahan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Gagal memuat sanggahan');
        const list = await res.json();
        content.innerHTML = `
            <div class="table-container">
                <h3>Daftar Sanggahan Warga</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Tipe Sanggahan</th>
                            <th>Pelapor</th>
                            <th>Terhadap</th>
                            <th>Alasan Sanggahan</th>
                            <th>Status</th>
                            <th>Tanggal</th>
                            <th>Bukti Pendukung</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? `<tr><td colspan="8">Belum ada sanggahan.</td></tr>` : list.map(s => `
                            <tr>
                                <td>
                                    <span class="sanggahan-type ${s.tipe === 'diri_sendiri' ? 'self' : 'other'}">
                                        ${s.tipe === 'diri_sendiri' ? 'Sanggah Diri Sendiri' : 'Sanggah Warga Lain'}
                                    </span>
                                </td>
                                <td>
                                    <div class="user-info">
                                        <strong>${s.pelapor_nama || '-'}</strong><br>
                                        <small>NIK: ${s.pelapor_nik || '-'}</small>
                                    </div>
                                </td>
                                <td>
                                    <div class="user-info">
                                        ${s.tipe === 'diri_sendiri' ? 
                                            '<strong>Diri Sendiri</strong>' : 
                                            `<strong>${s.target_nama || '-'}</strong><br><small>NIK: ${s.target_nik || '-'}</small>`
                                        }
                                    </div>
                                </td>
                                <td>
                                    <div class="alasan-full-text">
                                        ${s.alasan}
                                    </div>
                                </td>
                                <td>
                                    <span class="status ${getSanggahanStatusClass(s.status)}">
                                        ${getSanggahanStatusLabel(s.status)}
                                    </span>
                                </td>
                                <td>${new Date(s.created_at).toLocaleDateString('id-ID')}</td>
                                <td>
                                    ${s.bukti_file ? 
                                        `<div class="evidence-container">
                                            <div class="evidence-preview">
                                                <i class="fas fa-file-image evidence-icon"></i>
                                                <span class="evidence-name">${s.bukti_file.split('-').slice(1).join('-')}</span>
                                            </div>
                                            <a href="/uploads/${s.bukti_file}" target="_blank" class="evidence-btn">
                                                <i class="fas fa-eye"></i> Lihat
                                            </a>
                                            <a href="/uploads/${s.bukti_file}" download class="evidence-btn download">
                                                <i class="fas fa-download"></i> Download
                                            </a>
                                        </div>` : 
                                        '<div class="no-evidence"><i class="fas fa-ban"></i> Tidak ada bukti</div>'
                                    }
                                </td>
                                <td>
                                    <div class="action-container">
                                        ${s.status === 'pending' ? `
                                            <div class="action-group">
                                                <button class="action-btn accept-btn" onclick="updateSanggahanStatus(${s.id}, 'accepted')" title="Terima sanggahan dan setujui bantuan warga">
                                                    <i class="fas fa-check-circle"></i>
                                                    <span>Terima</span>
                                                </button>
                                                <button class="action-btn reject-btn" onclick="updateSanggahanStatus(${s.id}, 'rejected')" title="Tolak sanggahan">
                                                    <i class="fas fa-times-circle"></i>
                                                    <span>Tolak</span>
                                                </button>
                                            </div>
                                        ` : `
                                            <div class="action-group">
                                                <button class="action-btn process-btn" onclick="updateSanggahanStatus(${s.id}, 'pending')" title="Set status proses">
                                                    <i class="fas fa-clock"></i>
                                                    <span>Proses</span>
                                                </button>
                                                <div class="status-info">
                                                    <small>Status: ${getSanggahanStatusLabel(s.status)}</small>
                                                </div>
                                            </div>
                                        `}
                                        <div class="delete-section">
                                            <button class="action-btn delete-btn" onclick="deleteSanggahan(${s.id})" title="Hapus sanggahan">
                                                <i class="fas fa-trash"></i>
                                                <span>Hapus</span>
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error(e);
        content.innerHTML = `<div class="dashboard-card"><h3>Error</h3><p>Gagal memuat sanggahan.</p></div>`;
    }
}

async function updateSanggahanStatus(id, status) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/sanggahan/${id}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gagal update');
        showMessage('Status sanggahan berhasil diperbarui', 'success');
        // Refresh kedua tabel agar sinkron (sanggahan dan daftar usulan bantuan)
        showKelolaSanggahan();
        if (typeof showKelolaBantuan === 'function') {
            try { showKelolaBantuan(); } catch(_) {}
        }
    } catch (e) {
        console.error(e);
        showMessage('Gagal memperbarui status', 'error');
    }
}

// Delete sanggahan
async function deleteSanggahan(id) {
    // Show confirmation dialog
    const confirmed = confirm('Apakah Anda yakin ingin menghapus sanggahan ini?\n\nTindakan ini tidak dapat dibatalkan.');
    
    if (!confirmed) {
        return;
    }
    
    const token = localStorage.getItem('token');
    try {
        console.log('Deleting sanggahan:', id);
        
        const response = await fetch(`${API_BASE_URL}/admin/sanggahan/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Delete response status:', response.status);
        const data = await response.json();
        console.log('Delete response data:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Gagal menghapus sanggahan');
        }
        
        showMessage('Sanggahan berhasil dihapus', 'success');
        showKelolaSanggahan();
    } catch (e) {
        console.error('Error deleting sanggahan:', e);
        showMessage(`Gagal menghapus sanggahan: ${e.message}`, 'error');
    }
}


// Show Warga Dashboard
function showWargaDashboard() {
    // Auto-check perubahan status ajuan untuk warga
    try { clearInterval(window.__wargaAutoRefresh); } catch(_) {}
    window.__wargaAutoRefresh = setInterval(() => { try { checkWargaBantuanUpdates(); } catch(_) {} }, 30000);
    const mainContent = document.querySelector('main') || document.body;
    mainContent.innerHTML = `
        <div class="dashboard">
            <div class="dashboard-header">
                <div class="container">
                    <div class="header-content">
                        <div class="header-text">
                            <h1>Selamat Datang, ${currentUser.nama}!</h1>
                            <p>Kelola bantuan sosial Anda di Kelurahan Bara Baraya Selatan</p>
                        </div>
                        <div class="header-actions">
                            <button class="btn-logout" onclick="logout()">
                                <i class="fas fa-sign-out-alt"></i> Keluar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-content">
                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3><i class="fas fa-plus"></i> Ajukan Bantuan</h3>
                        <p>Ajukan bantuan sosial baru</p>
                        <button class="btn-primary" onclick="showBantuanForm()">
                            <i class="fas fa-plus"></i> Ajukan Sekarang
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-list"></i> Riwayat Ajuan</h3>
                        <p>Lihat status ajuan bantuan sosial Anda</p>
                        <button class="btn-primary" onclick="showRiwayatAjuan()">
                            <i class="fas fa-list"></i> Lihat Riwayat
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-exclamation-triangle"></i> Ajukan Sanggahan</h3>
                        <p>Sanggah diri sendiri atau warga lain yang tidak layak</p>
                        <button class="btn-primary" onclick="showSanggahanForm()">
                            <i class="fas fa-exclamation-triangle"></i> Ajukan Sanggahan
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-list-alt"></i> Riwayat Sanggahan</h3>
                        <p>Lihat status sanggahan yang telah Anda ajukan</p>
                        <button class="btn-primary" onclick="showRiwayatSanggahan()">
                            <i class="fas fa-list-alt"></i> Lihat Riwayat
                        </button>
                    </div>
                    
                    <div class="dashboard-card">
                        <h3><i class="fas fa-user"></i> Profil Saya</h3>
                        <p>Kelola informasi profil Anda</p>
                        <button class="btn-primary" onclick="showProfil()">
                            <i class="fas fa-user"></i> Lihat Profil
                        </button>
                    </div>
                </div>
                
                <div id="warga-content">
                    <!-- Dynamic content will be loaded here -->
                </div>
            </div>
        </div>
    `;
    
    updateNavbarForLoggedInUser();
    
    // Check for notifications after dashboard is loaded
    checkAndShowNotifications();
}

// Check and show notifications for verified bansos and sanggahan
async function checkAndShowNotifications() {
    try {
        const token = localStorage.getItem('token');
        
        // Get user's bansos data
        const bansosResponse = await fetch(`${API_BASE_URL}/bantuan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Get user's sanggahan data
        const sanggahanResponse = await fetch(`${API_BASE_URL}/sanggahan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (bansosResponse.ok && sanggahanResponse.ok) {
            const bansosData = await bansosResponse.json();
            const sanggahanData = await sanggahanResponse.json();
            
            // Check for approved bansos
            const approvedBansos = bansosData.filter(b => b.status === 'approved');
            const rejectedBansos = bansosData.filter(b => b.status === 'rejected');
            
            // Check for accepted sanggahan
            const acceptedSanggahan = sanggahanData.filter(s => s.status === 'accepted');
            const rejectedSanggahan = sanggahanData.filter(s => s.status === 'rejected');
            
            // Show notifications if there are any updates
            if (approvedBansos.length > 0 || rejectedBansos.length > 0 || 
                acceptedSanggahan.length > 0 || rejectedSanggahan.length > 0) {
                showNotificationPanel({
                    approvedBansos,
                    rejectedBansos,
                    acceptedSanggahan,
                    rejectedSanggahan
                });
            }
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// Show notification panel with updates
function showNotificationPanel(notifications) {
    const { approvedBansos, rejectedBansos, acceptedSanggahan, rejectedSanggahan } = notifications;
    
    // Create notification panel HTML
    const notificationHTML = `
        <div id="notificationPanel" class="notification-panel">
            <div class="notification-header">
                <h3><i class="fas fa-bell"></i> Pemberitahuan Terbaru</h3>
                <button class="notification-close" onclick="closeNotificationPanel()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-content">
                ${approvedBansos.length > 0 ? `
                    <div class="notification-item success">
                        <div class="notification-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="notification-text">
                            <h4>Ajuan Bantuan Sosial Disetujui!</h4>
                            <p>Selamat! ${approvedBansos.length} ajuan bantuan sosial Anda telah disetujui oleh admin kelurahan.</p>
                            <div class="notification-details">
                                ${approvedBansos.map(b => `
                                    <div class="detail-item">
                                        <strong>${b.jenis_bantuan}</strong> - ${new Date(b.updated_at).toLocaleDateString('id-ID')}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${rejectedBansos.length > 0 ? `
                    <div class="notification-item error">
                        <div class="notification-icon">
                            <i class="fas fa-times-circle"></i>
                        </div>
                        <div class="notification-text">
                            <h4>Ajuan Bantuan Sosial Ditolak</h4>
                            <p>Maaf, ${rejectedBansos.length} ajuan bantuan sosial Anda ditolak oleh admin kelurahan.</p>
                            <div class="notification-details">
                                ${rejectedBansos.map(b => `
                                    <div class="detail-item">
                                        <strong>${b.jenis_bantuan}</strong> - ${new Date(b.updated_at).toLocaleDateString('id-ID')}
                                        ${b.rejection_reason ? `<br><small>Alasan: ${b.rejection_reason}</small>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${acceptedSanggahan.length > 0 ? `
                    <div class="notification-item success">
                        <div class="notification-icon">
                            <i class="fas fa-gavel"></i>
                        </div>
                        <div class="notification-text">
                            <h4>Sanggahan Diterima!</h4>
                            <p>${acceptedSanggahan.length} sanggahan yang Anda ajukan telah diterima oleh admin kelurahan.</p>
                            <div class="notification-details">
                                ${acceptedSanggahan.map(s => `
                                    <div class="detail-item">
                                        <strong>${s.tipe === 'diri_sendiri' ? 'Sanggah Diri Sendiri' : 'Sanggah Warga Lain'}</strong> - ${new Date(s.updated_at).toLocaleDateString('id-ID')}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${rejectedSanggahan.length > 0 ? `
                    <div class="notification-item warning">
                        <div class="notification-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="notification-text">
                            <h4>Sanggahan Ditolak</h4>
                            <p>${rejectedSanggahan.length} sanggahan yang Anda ajukan ditolak oleh admin kelurahan.</p>
                            <div class="notification-details">
                                ${rejectedSanggahan.map(s => `
                                    <div class="detail-item">
                                        <strong>${s.tipe === 'diri_sendiri' ? 'Sanggah Diri Sendiri' : 'Sanggah Warga Lain'}</strong> - ${new Date(s.updated_at).toLocaleDateString('id-ID')}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="notification-footer">
                <button class="btn-primary" onclick="closeNotificationPanel()">
                    <i class="fas fa-check"></i> Mengerti
                </button>
            </div>
        </div>
    `;
    
    // Add notification panel to body
    document.body.insertAdjacentHTML('beforeend', notificationHTML);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.add('fade-out');
            setTimeout(() => {
                panel.remove();
            }, 300);
        }
    }, 10000);
}

// Close notification panel
function closeNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.classList.add('fade-out');
        setTimeout(() => {
            panel.remove();
        }, 300);
    }
}

// Show Verification Table
async function showVerificationTable() {
    const content = document.getElementById('admin-content');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil data users');
        }

        allUsers = await response.json();
        const pendingUsers = allUsers.filter(u => !u.verified);
        const verifiedUsers = allUsers.filter(u => u.verified);
        
        // Initialize filtered users
        filteredPendingUsers = pendingUsers;
        filteredVerifiedUsers = verifiedUsers;
        
        content.innerHTML = `
            <div class="table-container">
                <div class="table-header">
                    <h3>Daftar Warga yang Perlu Diverifikasi</h3>
                    <div class="table-controls">
                        <div class="search-box">
                            <input type="text" id="searchPending" placeholder="Cari warga..." onkeyup="searchUsers('pending', this.value)">
                            <i class="fas fa-search"></i>
                        </div>
                        <button class="btn-copy" onclick="copyTableData('pending')" title="Copy Data">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div id="pendingTableContent">
                    ${renderTable('pending', pendingUsers)}
                </div>
                <div id="pendingPagination" class="pagination">
                    ${renderPagination('pending', pendingUsers)}
                </div>
            </div>
            
            <div class="table-container" style="margin-top: 2rem;">
                <div class="table-header">
                    <h3>Daftar Warga yang Sudah Diverifikasi</h3>
                    <div class="table-controls">
                        <div class="search-box">
                            <input type="text" id="searchVerified" placeholder="Cari warga..." onkeyup="searchUsers('verified', this.value)">
                            <i class="fas fa-search"></i>
                        </div>
                        <button class="btn-copy" onclick="copyTableData('verified')" title="Copy Data">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                <div id="verifiedTableContent">
                    ${renderTable('verified', verifiedUsers)}
                </div>
                <div id="verifiedPagination" class="pagination">
                    ${renderPagination('verified', verifiedUsers)}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading users:', error);
        content.innerHTML = `
            <div class="dashboard-card">
                <h3>Error</h3>
                <p>Gagal memuat data users. Silakan coba lagi.</p>
            </div>
        `;
    }
}

// Render table with pagination
function renderTable(type, users) {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    return `
        <table class="table">
            <thead>
                <tr>
                    <th>NIK</th>
                    <th>No. KK</th>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>No. Telepon</th>
                    <th>RT/RW</th>
                    <th>Status</th>
                    <th>Tanggal Daftar</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${paginatedUsers.length === 0 ? `
                    <tr>
                        <td colspan="9">${type === 'pending' ? 'Belum ada warga yang menunggu verifikasi.' : 'Belum ada warga yang terverifikasi.'}</td>
                    </tr>
                ` : paginatedUsers.map(user => `
                    <tr>
                        <td>${user.nik}</td>
                        <td>${user.kk || '-'}</td>
                        <td>${user.nama}</td>
                        <td>${user.email}</td>
                        <td>${user.phone}</td>
                        <td>${(user.rt || '-')} / ${(user.rw || '-')}</td>
                        <td>
                            <span class="status ${user.verified ? 'verified' : 'pending'}">
                                ${user.verified ? 'Terverifikasi' : 'Menunggu'}
                            </span>
                        </td>
                        <td>${new Date(user.created_at).toLocaleDateString('id-ID')}</td>
                        <td>
                            <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                                ${!user.verified ? `
                                    <button class="btn-sm btn-success" onclick="verifyUser(${user.id})">
                                        <i class="fas fa-check"></i> Verifikasi
                                    </button>
                                ` : ''}
                                <button class="btn-sm btn-warning" onclick="resetUserPassword(${user.id})">
                                    <i class="fas fa-key"></i> Reset Password
                                </button>
                                <button class="btn-sm btn-danger" onclick="rejectUser(${user.id})">
                                    <i class="fas fa-trash"></i> Hapus
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Render pagination
function renderPagination(type, users) {
    const totalPages = Math.ceil(users.length / itemsPerPage);
    if (totalPages <= 1) return '';
    
    let paginationHTML = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button class="btn-pagination" onclick="changePage('${type}', ${currentPage - 1})">
            <i class="fas fa-chevron-left"></i> Sebelumnya
        </button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="btn-pagination active">${i}</button>`;
        } else {
            paginationHTML += `<button class="btn-pagination" onclick="changePage('${type}', ${i})">${i}</button>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button class="btn-pagination" onclick="changePage('${type}', ${currentPage + 1})">
            Selanjutnya <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    paginationHTML += '</div>';
    paginationHTML += `<div class="pagination-info">Halaman ${currentPage} dari ${totalPages} (${users.length} data)</div>`;
    
    return paginationHTML;
}

// Search users
function searchUsers(type, searchTerm) {
    const users = type === 'pending' ? allUsers.filter(u => !u.verified) : allUsers.filter(u => u.verified);
    
    if (!searchTerm || searchTerm.trim() === '') {
        // If search is empty, show all users
        if (type === 'pending') {
            filteredPendingUsers = users;
        } else {
            filteredVerifiedUsers = users;
        }
    } else {
        // Filter users based on search term
        const filtered = users.filter(user => 
            user.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone.includes(searchTerm) ||
            (user.kk && user.kk.includes(searchTerm)) ||
            (user.rt && user.rt.includes(searchTerm)) ||
            (user.rw && user.rw.includes(searchTerm))
        );
        
        if (type === 'pending') {
            filteredPendingUsers = filtered;
        } else {
            filteredVerifiedUsers = filtered;
        }
    }
    
    currentPage = 1; // Reset to first page
    const tableContent = document.getElementById(`${type}TableContent`);
    const pagination = document.getElementById(`${type}Pagination`);
    
    if (tableContent && pagination) {
        const currentFilteredUsers = type === 'pending' ? filteredPendingUsers : filteredVerifiedUsers;
        tableContent.innerHTML = renderTable(type, currentFilteredUsers);
        pagination.innerHTML = renderPagination(type, currentFilteredUsers);
    }
}

// Change page
function changePage(type, page) {
    currentPage = page;
    const tableContent = document.getElementById(`${type}TableContent`);
    const pagination = document.getElementById(`${type}Pagination`);
    
    if (tableContent && pagination) {
        const currentFilteredUsers = type === 'pending' ? filteredPendingUsers : filteredVerifiedUsers;
        tableContent.innerHTML = renderTable(type, currentFilteredUsers);
        pagination.innerHTML = renderPagination(type, currentFilteredUsers);
    }
}

// Copy table data
function copyTableData(type) {
    const currentFilteredUsers = type === 'pending' ? filteredPendingUsers : filteredVerifiedUsers;
    
    if (currentFilteredUsers.length === 0) {
        showMessage('Tidak ada data untuk di-copy', 'warning');
        return;
    }
    
    // Create CSV format
    let csvContent = 'NIK,No. KK,Nama,Email,No. Telepon,RT,RW,Status,Tanggal Daftar\n';
    
    currentFilteredUsers.forEach(user => {
        csvContent += `"${user.nik}","${user.kk || '-'}","${user.nama}","${user.email}","${user.phone}","${user.rt || '-'}","${user.rw || '-'}","${user.verified ? 'Terverifikasi' : 'Menunggu'}","${new Date(user.created_at).toLocaleDateString('id-ID')}"\n`;
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(csvContent).then(() => {
        showMessage(`Data ${type === 'pending' ? 'warga yang perlu diverifikasi' : 'warga yang sudah diverifikasi'} berhasil di-copy! (${currentFilteredUsers.length} data)`, 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showMessage('Gagal menyalin data', 'error');
    });
}

// Verify User
async function verifyUser(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            showMessage('User berhasil diverifikasi!', 'success');
            showVerificationTable();
        } else {
            const data = await response.json();
            showMessage(data.message || 'Gagal memverifikasi user', 'error');
        }
    } catch (error) {
        console.error('Error verifying user:', error);
        showMessage('Terjadi kesalahan saat memverifikasi user', 'error');
    }
}

// Reject User
async function rejectUser(userId) {
    if (confirm('Apakah Anda yakin ingin menolak user ini?')) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                showMessage('User berhasil ditolak!', 'success');
                showVerificationTable();
            } else {
                const data = await response.json();
                showMessage(data.message || 'Gagal menolak user', 'error');
            }
        } catch (error) {
            console.error('Error rejecting user:', error);
            showMessage('Terjadi kesalahan saat menolak user', 'error');
        }
    }
}

// Reset user password (default 123456)
async function resetUserPassword(userId) {
    if (confirm('Reset password user ke default 123456?')) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Gagal reset password');
            showMessage('Password berhasil direset (123456)', 'success');
        } catch (e) {
            console.error(e);
            showMessage('Gagal reset password', 'error');
        }
    }
}

// Show Statistics
async function showStatistics() {
    const content = document.getElementById('admin-content');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil statistik');
        }

        const stats = await response.json();
        
        content.innerHTML = `
            <div class="statistics-container">
                <h2><i class="fas fa-chart-bar"></i> Statistik Dashboard</h2>
                
                <div class="statistics-grid">
                    <!-- Warga Statistics -->
                    <div class="stat-section">
                        <h3><i class="fas fa-users"></i> Data Warga</h3>
                        <div class="stat-cards">
                            <div class="stat-card">
                                <div class="stat-icon users-icon">
                                    <i class="fas fa-user-plus"></i>
                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.totalUsers || 0}</div>
                                    <div class="stat-label">Jumlah Warga Mendaftar</div>
                </div>
                </div>
                            <div class="stat-card">
                                <div class="stat-icon verified-icon">
                                    <i class="fas fa-user-check"></i>
                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.verifiedUsers || 0}</div>
                                    <div class="stat-label">Jumlah Akun Warga Terverifikasi</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bantuan Sosial Statistics -->
                    <div class="stat-section">
                        <h3><i class="fas fa-hand-holding-heart"></i> Usulan Bantuan Sosial</h3>
                        <div class="stat-cards">
                            <div class="stat-card">
                                <div class="stat-icon total-icon">
                                    <i class="fas fa-list"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.totalBantuan || 0}</div>
                                    <div class="stat-label">Jumlah Usulan Bansos</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon pkh-icon">
                                    <i class="fas fa-utensils"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.pkh || 0}</div>
                                    <div class="stat-label">PKH (Bantuan Pangan)</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon bnpt-icon">
                                    <i class="fas fa-home"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.bnpt || 0}</div>
                                    <div class="stat-label">BNPT (Bantuan Perumahan)</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon non-bansos-icon">
                                    <i class="fas fa-gift"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.nonBansos || 0}</div>
                                    <div class="stat-label">Non Bansos (Lainnya)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Status Bantuan Statistics -->
                    <div class="stat-section">
                        <h3><i class="fas fa-tasks"></i> Status Usulan Bantuan</h3>
                        <div class="stat-cards">
                            <div class="stat-card">
                                <div class="stat-icon approved-icon">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.approvedBantuan || 0}</div>
                                    <div class="stat-label">Jumlah Usulan Bansos Diterima</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon rejected-icon">
                                    <i class="fas fa-times-circle"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.rejectedBantuan || 0}</div>
                                    <div class="stat-label">Jumlah Usulan Bansos Ditolak</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon pending-icon">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.pendingBantuan || 0}</div>
                                    <div class="stat-label">Jumlah Usulan Proses</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sanggahan Statistics -->
                    <div class="stat-section">
                        <h3><i class="fas fa-comments"></i> Sanggahan</h3>
                        <div class="stat-cards">
                            <div class="stat-card">
                                <div class="stat-icon total-sanggahan-icon">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.totalSanggahan || 0}</div>
                                    <div class="stat-label">Jumlah Sanggahan</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon diri-sendiri-icon">
                                    <i class="fas fa-user-times"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.sanggahanDiriSendiri || 0}</div>
                                    <div class="stat-label">Sanggahan Diri Sendiri</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon warga-lain-icon">
                                    <i class="fas fa-users-slash"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-number">${stats.sanggahanWargaLain || 0}</div>
                                    <div class="stat-label">Sanggahan Terhadap Warga</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading statistics:', error);
        content.innerHTML = `
            <div class="dashboard-card">
                <h3>Error</h3>
                <p>Gagal memuat statistik. Silakan coba lagi.</p>
            </div>
        `;
    }
}

// Show Settings
function showSettings() {
    const content = document.getElementById('admin-content');
    content.innerHTML = `
        <div class="dashboard-card">
            <h3><i class="fas fa-cog"></i> Pengaturan Aplikasi</h3>
            <p>Ubah kredensial admin kelurahan. Setelah perubahan berhasil, Anda akan diminta login ulang.</p>
            <form id="adminSettingsForm" class="settings-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="currentPassword">Password Saat Ini</label>
                        <input type="password" id="currentPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newUsername">Username Baru (opsional)</label>
                        <input type="text" id="newUsername" placeholder="Biarkan kosong jika tidak ingin ganti">
                    </div>
                    <div class="form-group">
                        <label for="newPassword">Password Baru (opsional)</label>
                        <input type="password" id="newPassword" placeholder="Biarkan kosong jika tidak ingin ganti">
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">Konfirmasi Password Baru</label>
                        <input type="password" id="confirmPassword" placeholder="Ulangi password baru">
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Simpan Perubahan</button>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById('adminSettingsForm');
    form.addEventListener('submit', handleAdminSettingsSubmit);
}

async function handleAdminSettingsSubmit(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newUsername = document.getElementById('newUsername').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    if (!currentPassword) {
        showMessage('Password saat ini wajib diisi', 'error');
        return;
    }
    if (newPassword && newPassword.length < 6) {
        showMessage('Password baru minimal 6 karakter', 'error');
        return;
    }
    if (newPassword && newPassword !== confirmPassword) {
        showMessage('Konfirmasi password baru tidak cocok', 'error');
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/credentials`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newUsername: newUsername || undefined, newPassword: newPassword || undefined })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gagal memperbarui kredensial');

        showMessage(data.message || 'Berhasil memperbarui kredensial', 'success');

        // Auto logout setelah 1.5 detik
        setTimeout(() => {
            logout();
        }, 1500);
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

// Admin: Kelola Usulan Bansos
async function showKelolaBantuan() {
    // Auto-refresh halaman usulan bantuan tiap 30 detik
    try { clearInterval(window.__adminAutoRefresh); } catch(_) {}
    window.__adminAutoRefresh = setInterval(() => { try { showKelolaBantuan(); } catch(_) {} }, 30000);
    const content = document.getElementById('admin-content');
    const token = localStorage.getItem('token');

    try {
        // Fetch both users and bantuan data with cache busting
        const timestamp = new Date().getTime();
        const [usersResponse, bantuanResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/users?t=${timestamp}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_BASE_URL}/admin/bantuan?t=${timestamp}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!usersResponse.ok) throw new Error('Gagal memuat data users');
        if (!bantuanResponse.ok) throw new Error('Gagal memuat data bantuan');

        const users = await usersResponse.json();
        const list = await bantuanResponse.json();
        const verifiedUsers = users.filter(u => u.verified);

        content.innerHTML = `
            <div class="table-container">
                <h3>Daftar Warga yang Sudah Diverifikasi</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>NIK</th>
                            <th>No. KK</th>
                            <th>Nama</th>
                            <th>Email</th>
                            <th>No. Telepon</th>
                            <th>RT/RW</th>
                            <th>Status</th>
                            <th>Tanggal Daftar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${verifiedUsers.length === 0 ? `
                            <tr>
                                <td colspan="8">Belum ada warga yang terverifikasi.</td>
                            </tr>
                        ` : verifiedUsers.map(user => `
                            <tr>
                                <td>${user.nik}</td>
                                <td>${user.kk || '-'}</td>
                                <td>${user.nama}</td>
                                <td>${user.email}</td>
                                <td>${user.phone}</td>
                                <td>${(user.rt || '-')} / ${(user.rw || '-')}</td>
                                <td>
                                    <span class="status verified">Terverifikasi</span>
                                </td>
                                <td>${new Date(user.created_at).toLocaleDateString('id-ID')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="table-container" style="margin-top: 2rem;">
                <h3>Daftar Usulan Bantuan Sosial Warga</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>NIK</th>
                            <th>Nama</th>
                            <th>Jenis Bantuan</th>
                            <th>Alasan Pengajuan</th>
                            <th>Dokumen</th>
                            <th>Status</th>
                            <th>Tanggal</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.length === 0 ? `
                            <tr><td colspan="8">Belum ada usulan bantuan.</td></tr>
                        ` : list.map(b => `
                            <tr>
                                <td>${b.nik}</td>
                                <td>${b.nama}</td>
                                <td>${getJenisBantuanLabel(b.jenis_bantuan)}</td>
                                <td>${b.alasan_pengajuan || 'Tidak ada alasan'}</td>
                                <td>
                                    <div class="document-buttons">
                                        ${b.foto_kk ? `<a href="/uploads/${b.foto_kk}" target="_blank" class="doc-btn doc-kk"><i class="fas fa-file-image"></i> Foto KK</a>` : ''}
                                        ${b.foto_rumah_depan ? `<a href="/uploads/${b.foto_rumah_depan}" target="_blank" class="doc-btn doc-rumah"><i class="fas fa-home"></i> Rumah Depan</a>` : ''}
                                        ${b.foto_rumah_dalam ? `<a href="/uploads/${b.foto_rumah_dalam}" target="_blank" class="doc-btn doc-rumah"><i class="fas fa-door-open"></i> Rumah Dalam</a>` : ''}
                                        ${b.foto_selfie_ktp ? `<a href="/uploads/${b.foto_selfie_ktp}" target="_blank" class="doc-btn doc-selfie"><i class="fas fa-user"></i> Selfie KTP</a>` : ''}
                                        ${b.gps_latitude && b.gps_longitude ? `<a href="https://www.google.com/maps?q=${b.gps_latitude},${b.gps_longitude}" target="_blank" class="doc-btn doc-gps"><i class="fas fa-map-marker-alt"></i> Lokasi GPS</a>` : ''}
                                        ${!b.foto_kk && !b.foto_rumah_depan && !b.foto_rumah_dalam && !b.foto_selfie_ktp && !b.gps_latitude ? '<span class="no-docs">Tidak ada dokumen</span>' : ''}
                                    </div>
                                </td>
                                <td><span class="status ${getStatusClass(b.status)}">${getStatusLabel(b.status)}</span></td>
                                <td>${new Date(b.created_at).toLocaleDateString('id-ID')}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="action-btn action-approve" onclick="updateBantuanStatus(${b.id}, 'approved')" title="Setujui usulan">
                                            <i class="fas fa-check"></i> Layak
                                        </button>
                                        <button class="action-btn action-reject" onclick="showRejectModal(${b.id})" title="Tolak usulan">
                                            <i class="fas fa-times"></i> Tidak Layak
                                        </button>
                                        <button class="action-btn action-process" onclick="updateBantuanStatus(${b.id}, 'pending')" title="Set status proses">
                                            <i class="fas fa-clock"></i> Proses
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error(err);
        content.innerHTML = `
            <div class="dashboard-card"><h3>Error</h3><p>Gagal memuat usulan bantuan.</p></div>
        `;
    }
}

// Show reject modal
function showRejectModal(bantuanId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Alasan Penolakan</h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <form id="rejectForm">
                    <div class="form-group">
                        <label for="rejectReason">Alasan Penolakan *</label>
                        <textarea id="rejectReason" name="rejectReason" rows="4" required 
                            placeholder="Jelaskan alasan mengapa usulan bantuan ditolak"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Batal
                        </button>
                        <button type="submit" class="btn-danger">
                            Tolak Usulan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add form submit handler
    modal.querySelector('#rejectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = document.getElementById('rejectReason').value;
        if (!reason.trim()) {
            showMessage('Alasan penolakan wajib diisi!', 'error');
            return;
        }
        
        try {
            await updateBantuanStatusWithReason(bantuanId, 'rejected', reason);
            modal.remove();
        } catch (error) {
            console.error('Error rejecting bantuan:', error);
        }
    });
}

// Update bantuan status with reason
async function updateBantuanStatusWithReason(id, status, reason = null) {
    try {
        const token = localStorage.getItem('token');
        console.log('Updating bantuan status with reason:', { id, status, reason });
        
        const response = await fetch(`${API_BASE_URL}/admin/bantuan/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status, reason })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Gagal update status');
        }
        
        showMessage('Status usulan berhasil diperbarui', 'success');
        showKelolaBantuan();
    } catch (e) {
        console.error('Error updating bantuan status with reason:', e);
        showMessage(`Gagal memperbarui status: ${e.message}`, 'error');
    }
}

async function updateBantuanStatus(bantuanId, status) {
    const token = localStorage.getItem('token');
    try {
        console.log('Updating bantuan status:', { bantuanId, status });
        
        const response = await fetch(`${API_BASE_URL}/admin/bantuan/${bantuanId}/status`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.message || 'Gagal update status');
        }
        
        showMessage('Status usulan berhasil diperbarui', 'success');
        showKelolaBantuan();
    } catch (e) {
        console.error('Error updating bantuan status:', e);
        showMessage(`Gagal memperbarui status: ${e.message}`, 'error');
    }
}

// Show Sanggahan Form
function showSanggahanForm() {
    const content = document.getElementById('warga-content');
    content.innerHTML = `
        <div class="dashboard-card">
            <h3>Ajukan Sanggahan</h3>
            <form id="sanggahanForm">
                <div class="form-group">
                    <label for="jenisSanggahan">Jenis Sanggahan</label>
                    <select id="jenisSanggahan" name="jenisSanggahan" required>
                        <option value="">Pilih Jenis Sanggahan</option>
                        <option value="diri_sendiri">Sanggah Diri Sendiri</option>
                        <option value="warga_lain">Sanggah Warga Lain</option>
                    </select>
                </div>
                
                <div class="form-group" id="wargaLainGroup" style="display: none;">
                    <label for="nikWargaLain">NIK Warga yang Disanggah</label>
                    <input type="text" id="nikWargaLain" name="nikWargaLain" 
                           placeholder="Masukkan NIK warga yang disanggah" maxlength="16">
                    <small class="form-text">Masukkan NIK 16 digit warga yang menurut Anda tidak layak menerima bantuan</small>
                </div>
                
                <div class="form-group">
                    <label for="alasanSanggahan">Alasan Sanggahan</label>
                    <textarea id="alasanSanggahan" name="alasanSanggahan" rows="4" required 
                        placeholder="Jelaskan alasan sanggahan Anda secara detail dan faktual"></textarea>
                </div>
                
                <div class="form-group">
                    <label for="buktiSanggahan">Bukti Pendukung (Opsional)</label>
                    <input type="file" id="buktiSanggahan" name="buktiSanggahan" accept=".jpg,.jpeg">
                    <small class="upload-info">Format: JPG, JPEG | Maksimal: 500 KB</small>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="showWargaDashboard()">
                        <i class="fas fa-arrow-left"></i> Kembali
                    </button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-paper-plane"></i> Kirim Sanggahan
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Add event listeners
    document.getElementById('sanggahanForm').addEventListener('submit', handleSanggahanSubmit);
    
    // Show/hide NIK field based on sanggahan type
    document.getElementById('jenisSanggahan').addEventListener('change', function() {
        const wargaLainGroup = document.getElementById('wargaLainGroup');
        const nikWargaLain = document.getElementById('nikWargaLain');
        
        if (this.value === 'warga_lain') {
            wargaLainGroup.style.display = 'block';
            nikWargaLain.required = true;
        } else {
            wargaLainGroup.style.display = 'none';
            nikWargaLain.required = false;
            nikWargaLain.value = '';
        }
    });
}

// Handle Sanggahan Submit
async function handleSanggahanSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const jenisSanggahan = formData.get('jenisSanggahan');
    const nikWargaLain = formData.get('nikWargaLain');
    const alasanSanggahan = formData.get('alasanSanggahan');
    const buktiSanggahan = formData.get('buktiSanggahan');
    
    // Validate required fields
    if (!jenisSanggahan || !alasanSanggahan) {
        showMessage('Jenis sanggahan dan alasan sanggahan wajib diisi!', 'error');
        return;
    }
    
    // Validate NIK if sanggah warga lain
    if (jenisSanggahan === 'warga_lain' && !nikWargaLain) {
        showMessage('NIK warga yang disanggah wajib diisi!', 'error');
        return;
    }
    
    // Validate NIK format if provided
    if (nikWargaLain && !/^\d{16}$/.test(nikWargaLain)) {
        showMessage('NIK harus berupa 16 digit angka!', 'error');
        return;
    }
    
    // Validate file size if uploaded
    if (buktiSanggahan && buktiSanggahan.size > 500 * 1024) {
        showMessage('Ukuran file bukti maksimal 500 KB!', 'error');
        return;
    }
    
    // Validate file type if uploaded
    if (buktiSanggahan && !buktiSanggahan.type.match(/^image\/(jpeg|jpg)$/)) {
        showMessage('Format file bukti harus JPG atau JPEG!', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const data = new FormData();
        data.append('jenis_sanggahan', jenisSanggahan);
        data.append('alasan_sanggahan', alasanSanggahan);
        
        if (jenisSanggahan === 'warga_lain') {
            data.append('nik_warga_lain', nikWargaLain);
        }
        
        if (buktiSanggahan && buktiSanggahan.size > 0) {
            data.append('bukti_sanggahan', buktiSanggahan);
        }
        
        const response = await fetch(`${API_BASE_URL}/sanggahan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: data
        });

        if (response.ok) {
            showMessage('Sanggahan berhasil dikirim!', 'success');
            e.target.reset();
            
            // Close form and redirect to dashboard
            setTimeout(() => {
                showWargaDashboard();
            }, 1500);
        } else {
            const errorData = await response.json();
            showMessage(errorData.message || 'Gagal mengirim sanggahan', 'error');
        }
    } catch (error) {
        console.error('Error submitting sanggahan:', error);
        showMessage('Terjadi kesalahan saat mengirim sanggahan', 'error');
    }
}

// Show Bantuan Form
function showBantuanForm() {
    const content = document.getElementById('warga-content');
        content.innerHTML = `
        <div class="dashboard-card">
            <h3>Ajukan Bantuan Sosial</h3>
            <form id="bantuanForm">
                <div class="form-group">
                    <label for="jenisBantuan">Jenis Bantuan</label>
                    <select id="jenisBantuan" name="jenisBantuan" required>
                        <option value="">Pilih Jenis Bantuan</option>
                        <option value="PKH">PKH (Program Keluarga Harapan)</option>
                        <option value="BNPT">BNPT (Bantuan Non Tunai Pangan)</option>
                        <option value="Non Bansos">Non Bansos</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="alasanPengajuan">Alasan Pengajuan</label>
                    <textarea id="alasanPengajuan" name="alasanPengajuan" rows="4" required 
                        placeholder="Jelaskan alasan pengajuan bantuan sosial Anda secara detail"></textarea>
                </div>
                
                <div class="form-group">
                    <label>Upload Dokumen Pendukung</label>
                    
                    <div class="upload-section">
                        <div class="upload-item">
                            <label for="fotoKK">1. Upload Foto KK</label>
                            <input type="file" id="fotoKK" name="fotoKK" accept=".jpg,.jpeg" required>
                            <div id="fotoKKPreview" class="photo-preview" style="display: none;">
                                <img id="fotoKKImg" src="" alt="Foto KK" class="preview-image">
                                <div class="photo-info">
                                    <span class="photo-name">Foto KK</span>
                                    <button type="button" class="btn-remove-photo" onclick="removePhoto('fotoKK')">Hapus</button>
                                </div>
                            </div>
                            <small class="upload-info">Format: JPG, JPEG | Maksimal: 500 KB</small>
                        </div>
                        
                        <div class="upload-item">
                            <label for="fotoRumahDepan">2. Upload Foto Rumah Tampak Depan</label>
                            <input type="file" id="fotoRumahDepan" name="fotoRumahDepan" accept=".jpg,.jpeg" required>
                            <div id="fotoRumahDepanPreview" class="photo-preview" style="display: none;">
                                <img id="fotoRumahDepanImg" src="" alt="Foto Rumah Depan" class="preview-image">
                                <div class="photo-info">
                                    <span class="photo-name">Foto Rumah Depan</span>
                                    <button type="button" class="btn-remove-photo" onclick="removePhoto('fotoRumahDepan')">Hapus</button>
                                </div>
                            </div>
                            <small class="upload-info">Format: JPG, JPEG | Maksimal: 500 KB</small>
                        </div>
                        
                        <div class="upload-item">
                            <label for="fotoRumahDalam">3. Upload Foto Rumah Tampak Dalam</label>
                            <input type="file" id="fotoRumahDalam" name="fotoRumahDalam" accept=".jpg,.jpeg" required>
                            <div id="fotoRumahDalamPreview" class="photo-preview" style="display: none;">
                                <img id="fotoRumahDalamImg" src="" alt="Foto Rumah Dalam" class="preview-image">
                                <div class="photo-info">
                                    <span class="photo-name">Foto Rumah Dalam</span>
                                    <button type="button" class="btn-remove-photo" onclick="removePhoto('fotoRumahDalam')">Hapus</button>
                                </div>
                            </div>
                            <small class="upload-info">Format: JPG, JPEG | Maksimal: 500 KB</small>
                        </div>
                        
                        <div class="upload-item">
                            <label for="fotoSelfieKTP">4. Upload Foto Selfie dengan KTP</label>
                            <input type="file" id="fotoSelfieKTP" name="fotoSelfieKTP" accept=".jpg,.jpeg" required>
                            <div id="fotoSelfieKTPPreview" class="photo-preview" style="display: none;">
                                <img id="fotoSelfieKTPImg" src="" alt="Foto Selfie KTP" class="preview-image">
                                <div class="photo-info">
                                    <span class="photo-name">Foto Selfie KTP</span>
                                    <button type="button" class="btn-remove-photo" onclick="removePhoto('fotoSelfieKTP')">Hapus</button>
                                </div>
                            </div>
                            <small class="upload-info">Format: JPG, JPEG | Maksimal: 500 KB</small>
                        </div>
                        
                        <div class="upload-item">
                            <label for="fotoLokasiRumah">5. Foto Lokasi Rumah (GPS)</label>
                            <div class="gps-upload">
                                <button type="button" id="btnGPS" class="btn-gps">Aktifkan GPS</button>
                                <input type="hidden" id="fotoLokasiRumah" name="fotoLokasiRumah">
                                <input type="hidden" id="gpsLatitude" name="gpsLatitude" required>
                                <input type="hidden" id="gpsLongitude" name="gpsLongitude" required>
                                <div id="gpsInfo" class="gps-info" style="display: none;">
                                    <div class="gps-coordinates">
                                        <strong>📍 Lokasi GPS:</strong>
                                        <span id="gpsDisplay">-</span>
                                    </div>
                                    <div class="gps-map-link">
                                        <a id="gpsMapLink" href="#" target="_blank" class="btn-map">Lihat di Peta</a>
                                    </div>
                                </div>
                                <div id="gpsPhotoPreview" class="photo-preview" style="display: none;">
                                    <img id="gpsPhotoImg" src="" alt="Foto GPS" class="preview-image">
                                    <div class="photo-info">
                                        <span class="photo-name">Foto Lokasi Rumah</span>
                                        <button type="button" class="btn-remove-photo" onclick="removeGPSPhoto()">Hapus</button>
                                    </div>
                                </div>
                                <small class="upload-info">GPS akan aktif secara otomatis dan tidak bisa diedit</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <button type="submit" class="btn-primary">Ajukan Bantuan</button>
            </form>
        </div>
    `;
    
    // Add form submit handler
    document.getElementById('bantuanForm').addEventListener('submit', handleBantuanSubmit);
    
    // Add GPS button handler
    document.getElementById('btnGPS').addEventListener('click', handleGPSPhoto);
    
    // Add file validation handlers
    addFileValidationHandlers();
}

// Handle Bantuan Submit
async function handleBantuanSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const jenisBantuan = formData.get('jenisBantuan');
    const alasanPengajuan = formData.get('alasanPengajuan');
    
    // Validate required fields
    if (!jenisBantuan || !alasanPengajuan) {
        showMessage('Jenis bantuan dan alasan pengajuan wajib diisi!', 'error');
        return;
    }
    
    // Validate file uploads (kecuali fotoLokasiRumah yang hanya menggunakan GPS)
    const requiredFiles = ['fotoKK', 'fotoRumahDepan', 'fotoRumahDalam', 'fotoSelfieKTP'];
    for (const fileId of requiredFiles) {
        const fileInput = document.getElementById(fileId);
        if (!fileInput || !fileInput.value) {
            showMessage(`File ${fileId} wajib diupload!`, 'error');
            return;
        }
    }
    
    // Validate GPS coordinates for foto lokasi rumah
    const gpsLat = document.getElementById('gpsLatitude').value;
    const gpsLng = document.getElementById('gpsLongitude').value;
    if (!gpsLat || !gpsLng) {
        showMessage('GPS lokasi rumah wajib diaktifkan!', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const data = new FormData();
        data.append('jenis_bantuan', jenisBantuan);
        data.append('alasan_pengajuan', alasanPengajuan);
        
        // Append all file uploads (kecuali fotoLokasiRumah yang hanya menggunakan GPS)
        const fileInputs = ['fotoKK', 'fotoRumahDepan', 'fotoRumahDalam', 'fotoSelfieKTP'];
        fileInputs.forEach(fileId => {
            const fileInput = document.getElementById(fileId);
            if (fileInput && fileInput.files && fileInput.files[0]) {
                data.append(fileId, fileInput.files[0]);
            }
        });
        
        // Append GPS coordinates
        const gpsLat = document.getElementById('gpsLatitude').value;
        const gpsLng = document.getElementById('gpsLongitude').value;
        if (gpsLat && gpsLng) {
            data.append('gps_latitude', gpsLat);
            data.append('gps_longitude', gpsLng);
        }
        
        const response = await fetch(`${API_BASE_URL}/bantuan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: data
        });

        if (response.ok) {
            showMessage('Ajuan bantuan sosial berhasil dikirim!', 'success');
            e.target.reset();
            
            // Close form and redirect to riwayat ajuan
            setTimeout(() => {
                showRiwayatAjuan();
            }, 1500); // Wait 1.5 seconds to show success message
        } else {
            const errorData = await response.json();
            showMessage(errorData.message || 'Gagal mengirim ajuan', 'error');
        }
    } catch (error) {
        console.error('Error submitting bantuan:', error);
        showMessage('Terjadi kesalahan saat mengirim ajuan', 'error');
    }
}

// Handle GPS Photo
async function handleGPSPhoto() {
    const btnGPS = document.getElementById('btnGPS');
    const originalText = btnGPS.innerHTML;
    
    try {
        btnGPS.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengaktifkan GPS...';
        btnGPS.disabled = true;
        
        // Get current position
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;
        
        // Update hidden inputs
        document.getElementById('gpsLatitude').value = latitude;
        document.getElementById('gpsLongitude').value = longitude;
        
        // Display GPS coordinates
        const gpsInfo = document.getElementById('gpsInfo');
        const gpsDisplay = document.getElementById('gpsDisplay');
        const gpsMapLink = document.getElementById('gpsMapLink');
        
        gpsDisplay.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        gpsMapLink.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
        gpsInfo.style.display = 'block';
        
        // Update button to show success (no file upload needed)
        btnGPS.innerHTML = '<i class="fas fa-check"></i> GPS Berhasil Diaktifkan';
        btnGPS.style.background = '#28a745';
        btnGPS.disabled = false;
        showMessage('GPS lokasi rumah berhasil diaktifkan!', 'success');
        
    } catch (error) {
        console.error('GPS Error:', error);
        showMessage('Gagal mengaktifkan GPS. Pastikan izin lokasi diizinkan.', 'error');
        btnGPS.innerHTML = originalText;
        btnGPS.disabled = false;
    }
}

// Get Current Position with Promise
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation tidak didukung oleh browser ini'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Preview image function
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100px; max-height: 100px; border-radius: 4px; margin-top: 5px;">`;
        };
        
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.innerHTML = '';
    }
}

// Get current location for GPS (supports edit mode)
function getCurrentLocation(mode = '') {
    const prefix = mode === 'edit' ? 'edit' : '';
    const locationInfo = document.getElementById(`${prefix}LocationInfo`);
    const latitudeInput = document.getElementById(`${prefix}GpsLatitude`);
    const longitudeInput = document.getElementById(`${prefix}GpsLongitude`);
    
    if (!locationInfo || !latitudeInput || !longitudeInput) {
        showMessage('Elemen GPS tidak ditemukan', 'error');
        return;
    }
    
    locationInfo.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Mengambil lokasi GPS...</p>';
    
    getCurrentPosition()
        .then(position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            
            latitudeInput.value = latitude;
            longitudeInput.value = longitude;
            
            locationInfo.innerHTML = `
                <p><i class="fas fa-check-circle text-success"></i> Lokasi berhasil diambil!</p>
                <p><strong>Koordinat:</strong> ${latitude}, ${longitude}</p>
                <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank" class="btn-link">
                    <i class="fas fa-external-link-alt"></i> Lihat di Google Maps
                </a>
            `;
            
            showMessage('Lokasi GPS berhasil diambil', 'success');
        })
        .catch(error => {
            console.error('Error getting location:', error);
            let errorMessage = 'Gagal mengambil lokasi GPS';
            
            if (error.code === 1) {
                errorMessage = 'Akses lokasi ditolak. Silakan izinkan akses lokasi di browser Anda.';
            } else if (error.code === 2) {
                errorMessage = 'Lokasi tidak dapat ditentukan. Pastikan GPS aktif.';
            } else if (error.code === 3) {
                errorMessage = 'Timeout mengambil lokasi. Silakan coba lagi.';
            }
            
            locationInfo.innerHTML = `<p class="text-error"><i class="fas fa-exclamation-triangle"></i> ${errorMessage}</p>`;
            showMessage(errorMessage, 'error');
        });
}

// Add File Validation Handlers
function addFileValidationHandlers() {
    const fileInputs = ['fotoKK', 'fotoRumahDepan', 'fotoRumahDalam', 'fotoSelfieKTP'];
    
    fileInputs.forEach(fileId => {
        const input = document.getElementById(fileId);
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Validate file size (500KB max)
                    if (file.size > 500 * 1024) {
                        showMessage(`Ukuran file ${fileId} maksimal 500 KB!`, 'error');
                        e.target.value = '';
                        return;
                    }
                    
                    // Validate file type
                    if (!file.type.match(/^image\/(jpeg|jpg)$/)) {
                        showMessage(`Format file ${fileId} harus JPG atau JPEG!`, 'error');
                        e.target.value = '';
                        return;
                    }
                    
                    // Show photo preview
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const preview = document.getElementById(`${fileId}Preview`);
                        const img = document.getElementById(`${fileId}Img`);
                        img.src = e.target.result;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                    
                    showMessage(`File ${fileId} berhasil diupload!`, 'success');
                }
            });
        }
    });
}

// Remove Photo Function
function removePhoto(fileId) {
    const input = document.getElementById(fileId);
    const preview = document.getElementById(`${fileId}Preview`);
    
    if (input) input.value = '';
    if (preview) preview.style.display = 'none';
    
    showMessage(`Foto ${fileId} berhasil dihapus`, 'info');
}

// Remove GPS Photo Function
function removeGPSPhoto() {
    const hiddenInput = document.getElementById('fotoLokasiRumah');
    const preview = document.getElementById('gpsPhotoPreview');
    const gpsInfo = document.getElementById('gpsInfo');
    const btnGPS = document.getElementById('btnGPS');
    
    if (hiddenInput) hiddenInput.value = '';
    if (preview) preview.style.display = 'none';
    if (gpsInfo) gpsInfo.style.display = 'none';
    
    // Reset GPS button
    btnGPS.innerHTML = 'Aktifkan GPS & Ambil Foto';
    btnGPS.style.background = '#17a2b8';
    btnGPS.disabled = false;
    
    // Clear GPS coordinates
    document.getElementById('gpsLatitude').value = '';
    document.getElementById('gpsLongitude').value = '';
    
    showMessage('Foto GPS berhasil dihapus', 'info');
}

// Show Riwayat Ajuan
async function showRiwayatAjuan() {
    // Jalankan cek awal agar UI menampilkan status terbaru
    try { checkWargaBantuanUpdates(); } catch(_) {}
    const content = document.getElementById('warga-content');
    
    try {
        const token = localStorage.getItem('token');
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_BASE_URL}/bantuan?t=${timestamp}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil riwayat ajuan');
        }

        const bantuanList = await response.json();
        
        if (bantuanList.length === 0) {
            content.innerHTML = `
                <div class="dashboard-card">
                    <h3>Riwayat Ajuan Bantuan Sosial</h3>
                    <p>Belum ada ajuan bantuan sosial.</p>
                </div>
            `;
            return;
        }
        
        content.innerHTML = `
            <div class="table-container">
                <h3>Riwayat Ajuan Bantuan Sosial</h3>
                <table class="table riwayat-ajuan-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Jenis Bantuan</th>
                            <th>Alasan Pengajuan</th>
                            <th>Status</th>
                            <th>Tanggal Ajuan</th>
                            <th>Alasan Penolakan</th>
                            <th>Dokumen</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bantuanList.map(bantuan => `
                            <tr>
                                <td>${getJenisBantuanLabel(bantuan.jenis_bantuan)}</td>
                                <td>${bantuan.alasan_pengajuan || 'Tidak ada alasan'}</td>
                                <td>
                                    <span class="status ${getStatusClass(bantuan.status)}">
                                        ${getStatusLabel(bantuan.status)}
                                    </span>
                                </td>
                                <td>${new Date(bantuan.created_at).toLocaleDateString('id-ID')}</td>
                                <td>
                                    ${bantuan.status === 'rejected' && bantuan.rejection_reason ? 
                                        `<span class="rejection-reason" title="${bantuan.rejection_reason}">
                                            <i class="fas fa-exclamation-triangle"></i> ${bantuan.rejection_reason}
                                        </span>` : 
                                        '-'
                                    }
                                </td>
                                <td>
                                    <div class="document-buttons">
                                        ${bantuan.foto_kk ? `<a href="/uploads/${bantuan.foto_kk}" target="_blank" class="doc-btn doc-kk"><i class="fas fa-file-image"></i> KK</a>` : ''}
                                        ${bantuan.foto_rumah_depan ? `<a href="/uploads/${bantuan.foto_rumah_depan}" target="_blank" class="doc-btn doc-rumah"><i class="fas fa-home"></i> Depan</a>` : ''}
                                        ${bantuan.foto_rumah_dalam ? `<a href="/uploads/${bantuan.foto_rumah_dalam}" target="_blank" class="doc-btn doc-rumah"><i class="fas fa-door-open"></i> Dalam</a>` : ''}
                                        ${bantuan.foto_selfie_ktp ? `<a href="/uploads/${bantuan.foto_selfie_ktp}" target="_blank" class="doc-btn doc-selfie"><i class="fas fa-user"></i> Selfie</a>` : ''}
                                        ${bantuan.gps_latitude && bantuan.gps_longitude ? `<a href="https://www.google.com/maps?q=${bantuan.gps_latitude},${bantuan.gps_longitude}" target="_blank" class="doc-btn doc-gps"><i class="fas fa-map-marker-alt"></i> GPS</a>` : ''}
                                        ${!bantuan.foto_kk && !bantuan.foto_rumah_depan && !bantuan.foto_rumah_dalam && !bantuan.foto_selfie_ktp && !bantuan.gps_latitude ? '<span class="no-docs">Tidak ada</span>' : ''}
                                    </div>
                                </td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="action-btn action-edit" onclick="showEditBantuanForm(${bantuan.id})" title="Edit data bantuan">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading riwayat:', error);
        content.innerHTML = `
            <div class="dashboard-card">
                <h3>Error</h3>
                <p>Gagal memuat riwayat ajuan. Silakan coba lagi.</p>
            </div>
        `;
    }
}

// Helper functions for status and jenis bantuan
function getJenisBantuanLabel(jenis) {
    const labels = {
        'pangan': 'Bantuan Pangan',
        'perumahan': 'Bantuan Perumahan',
        'pendidikan': 'Bantuan Pendidikan',
        'kesehatan': 'Bantuan Kesehatan'
    };
    return labels[jenis] || jenis;
}

function getStatusLabel(status) {
    const labels = {
        'pending': 'Menunggu',
        'approved': 'Disetujui',
        'rejected': 'Ditolak'
    };
    return labels[status] || status;
}

function getStatusClass(status) {
    const classes = {
        'pending': 'pending',
        'approved': 'verified',
        'rejected': 'rejected'
    };
    return classes[status] || 'pending';
}

// Polling helper untuk warga: deteksi perubahan status bantuan
async function checkWargaBantuanUpdates() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const timestamp = new Date().getTime();
        const res = await fetch(`${API_BASE_URL}/bantuan?t=${timestamp}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const list = await res.json();
        // Deteksi perubahan status dan tampilkan notifikasi toast
        try {
            const storageKey = 'warga_bantuan_status_map';
            const prevJson = localStorage.getItem(storageKey) || '{}';
            const prevMap = JSON.parse(prevJson);
            const nextMap = {};
            (list || []).forEach(b => {
                const key = String(b.id);
                nextMap[key] = { status: b.status, reason: b.rejection_reason || null };
                const prev = prevMap[key];
                if (prev && prev.status !== b.status) {
                    const label = getStatusLabel(b.status);
                    if (b.status === 'rejected' && b.rejection_reason) {
                        showMessage(`Status ajuan Anda berubah menjadi "${label}". Alasan: ${b.rejection_reason}`, 'warning');
                    } else if (b.status === 'approved') {
                        showMessage(`Selamat! Ajuan Anda telah "${label}".`, 'success');
                    } else {
                        showMessage(`Status ajuan Anda sekarang "${label}".`, 'info');
                    }
                }
            });
            // Simpan state terbaru untuk perbandingan berikutnya
            localStorage.setItem(storageKey, JSON.stringify(nextMap));
        } catch (_) {}
        // Jika sedang berada di halaman riwayat, render ulang agar sinkron
        const wargaContent = document.getElementById('warga-content');
        if (wargaContent && wargaContent.querySelector('.riwayat-ajuan-table')) {
            try { showRiwayatAjuan(); } catch(_) {}
        }
    } catch(_) {}
}

// Show Edit Bantuan Form
async function showEditBantuanForm(bantuanId) {
    const content = document.getElementById('warga-content');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/bantuan`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil data bantuan');
        }

        const bantuanList = await response.json();
        const bantuan = bantuanList.find(b => b.id == bantuanId);
        
        if (!bantuan) {
            showMessage('Data bantuan tidak ditemukan', 'error');
            return;
        }

        content.innerHTML = `
            <div class="form-container">
                <h3>Edit Data Bantuan Sosial</h3>
                <form id="editBantuanForm" enctype="multipart/form-data">
                    <input type="hidden" id="bantuanId" value="${bantuan.id}">
                    
                    <div class="form-group">
                        <label for="editJenisBantuan">Jenis Bantuan *</label>
                        <select id="editJenisBantuan" name="jenis_bantuan" required>
                            <option value="">Pilih Jenis Bantuan</option>
                            <option value="PKH" ${bantuan.jenis_bantuan === 'PKH' ? 'selected' : ''}>PKH (Program Keluarga Harapan)</option>
                            <option value="BNPT" ${bantuan.jenis_bantuan === 'BNPT' ? 'selected' : ''}>BNPT (Bantuan Non Tunai Pangan)</option>
                            <option value="pangan" ${bantuan.jenis_bantuan === 'pangan' ? 'selected' : ''}>Bantuan Pangan</option>
                            <option value="sembako" ${bantuan.jenis_bantuan === 'sembako' ? 'selected' : ''}>Bantuan Sembako</option>
                            <option value="tunai" ${bantuan.jenis_bantuan === 'tunai' ? 'selected' : ''}>Bantuan Tunai</option>
                            <option value="lainnya" ${bantuan.jenis_bantuan === 'lainnya' ? 'selected' : ''}>Lainnya</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="editAlasanPengajuan">Alasan Pengajuan *</label>
                        <textarea id="editAlasanPengajuan" name="alasan_pengajuan" rows="4" required placeholder="Jelaskan alasan mengapa Anda membutuhkan bantuan sosial ini...">${bantuan.alasan_pengajuan || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Dokumen Pendukung</label>
                        <div class="file-upload-grid">
                            <div class="file-upload-item">
                                <label for="editFotoKK">Foto Kartu Keluarga</label>
                                <input type="file" id="editFotoKK" name="fotoKK" accept="image/*" onchange="previewImage(this, 'editPreviewKK')">
                                <div id="editPreviewKK" class="image-preview">
                                    ${bantuan.foto_kk ? `<img src="/uploads/${bantuan.foto_kk}" alt="Foto KK" style="max-width: 100px; max-height: 100px;">` : ''}
                                </div>
                            </div>
                            
                            <div class="file-upload-item">
                                <label for="editFotoRumahDepan">Foto Rumah Depan</label>
                                <input type="file" id="editFotoRumahDepan" name="fotoRumahDepan" accept="image/*" onchange="previewImage(this, 'editPreviewRumahDepan')">
                                <div id="editPreviewRumahDepan" class="image-preview">
                                    ${bantuan.foto_rumah_depan ? `<img src="/uploads/${bantuan.foto_rumah_depan}" alt="Foto Rumah Depan" style="max-width: 100px; max-height: 100px;">` : ''}
                                </div>
                            </div>
                            
                            <div class="file-upload-item">
                                <label for="editFotoRumahDalam">Foto Rumah Dalam</label>
                                <input type="file" id="editFotoRumahDalam" name="fotoRumahDalam" accept="image/*" onchange="previewImage(this, 'editPreviewRumahDalam')">
                                <div id="editPreviewRumahDalam" class="image-preview">
                                    ${bantuan.foto_rumah_dalam ? `<img src="/uploads/${bantuan.foto_rumah_dalam}" alt="Foto Rumah Dalam" style="max-width: 100px; max-height: 100px;">` : ''}
                                </div>
                            </div>
                            
                            <div class="file-upload-item">
                                <label for="editFotoSelfieKTP">Foto Selfie dengan KTP</label>
                                <input type="file" id="editFotoSelfieKTP" name="fotoSelfieKTP" accept="image/*" onchange="previewImage(this, 'editPreviewSelfieKTP')">
                                <div id="editPreviewSelfieKTP" class="image-preview">
                                    ${bantuan.foto_selfie_ktp ? `<img src="/uploads/${bantuan.foto_selfie_ktp}" alt="Foto Selfie KTP" style="max-width: 100px; max-height: 100px;">` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Lokasi GPS Rumah</label>
                        <div class="gps-section">
                            <button type="button" id="editGetLocationBtn" onclick="getCurrentLocation('edit')" class="btn-secondary">
                                <i class="fas fa-map-marker-alt"></i> Ambil Lokasi GPS
                            </button>
                            <div id="editLocationInfo" class="location-info">
                                ${bantuan.gps_latitude && bantuan.gps_longitude ? 
                                    `<p>Lokasi: ${bantuan.gps_latitude}, ${bantuan.gps_longitude}</p>
                                     <a href="https://www.google.com/maps?q=${bantuan.gps_latitude},${bantuan.gps_longitude}" target="_blank" class="btn-link">Lihat di Google Maps</a>` : 
                                    '<p>Belum ada lokasi GPS</p>'
                                }
                            </div>
                            <input type="hidden" id="editGpsLatitude" name="gps_latitude" value="${bantuan.gps_latitude || ''}">
                            <input type="hidden" id="editGpsLongitude" name="gps_longitude" value="${bantuan.gps_longitude || ''}">
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" onclick="showRiwayatAjuan()" class="btn-secondary">
                            <i class="fas fa-arrow-left"></i> Kembali
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Simpan Perubahan
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Add form submit event listener
        document.getElementById('editBantuanForm').addEventListener('submit', handleEditBantuanSubmit);
        
    } catch (error) {
        console.error('Error loading edit form:', error);
        showMessage('Gagal memuat form edit', 'error');
    }
}

// Handle Edit Bantuan Form Submit
async function handleEditBantuanSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const bantuanId = document.getElementById('bantuanId').value;
    
    // Add form fields
    formData.append('jenis_bantuan', document.getElementById('editJenisBantuan').value);
    formData.append('alasan_pengajuan', document.getElementById('editAlasanPengajuan').value);
    formData.append('gps_latitude', document.getElementById('editGpsLatitude').value);
    formData.append('gps_longitude', document.getElementById('editGpsLongitude').value);
    
    // Add files if selected
    const fileInputs = [
        { id: 'editFotoKK', name: 'fotoKK' },
        { id: 'editFotoRumahDepan', name: 'fotoRumahDepan' },
        { id: 'editFotoRumahDalam', name: 'fotoRumahDalam' },
        { id: 'editFotoSelfieKTP', name: 'fotoSelfieKTP' }
    ];
    fileInputs.forEach(input => {
        const fileInput = document.getElementById(input.id);
        if (fileInput.files[0]) {
            formData.append(input.name, fileInput.files[0]);
        }
    });
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/bantuan/${bantuanId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Gagal memperbarui data bantuan');
        }
        
        showMessage('Data bantuan sosial berhasil diperbarui', 'success');
        showRiwayatAjuan(); // Refresh the list
        
    } catch (error) {
        console.error('Error updating bantuan:', error);
        showMessage(`Gagal memperbarui data: ${error.message}`, 'error');
    }
}

// Show Riwayat Sanggahan
async function showRiwayatSanggahan() {
    const content = document.getElementById('warga-content');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/sanggahan`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal mengambil riwayat sanggahan');
        }

        const sanggahanList = await response.json();
        
        if (sanggahanList.length === 0) {
            content.innerHTML = `
                <div class="dashboard-card">
                    <h3>Riwayat Sanggahan</h3>
                    <p>Belum ada sanggahan yang diajukan.</p>
                </div>
            `;
            return;
        }
        
        content.innerHTML = `
            <div class="table-container">
                <h3>Riwayat Sanggahan</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Jenis Sanggahan</th>
                            <th>Terhadap</th>
                            <th>Alasan Sanggahan</th>
                            <th>Status</th>
                            <th>Tanggal Ajuan</th>
                            <th>Bukti Pendukung</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sanggahanList.map(sanggahan => `
                            <tr>
                                <td>
                                    <span class="sanggahan-type ${sanggahan.tipe === 'diri_sendiri' ? 'self' : 'other'}">
                                        ${sanggahan.tipe === 'diri_sendiri' ? 'Sanggah Diri Sendiri' : 'Sanggah Warga Lain'}
                                    </span>
                                </td>
                                <td>
                                    ${sanggahan.tipe === 'diri_sendiri' ? 
                                        'Diri Sendiri' : 
                                        (sanggahan.target_nama ? `${sanggahan.target_nama} (${sanggahan.target_nik})` : 'Warga Lain')
                                    }
                                </td>
                                <td>${sanggahan.alasan}</td>
                                <td>
                                    <span class="status ${getSanggahanStatusClass(sanggahan.status)}">
                                        ${getSanggahanStatusLabel(sanggahan.status)}
                                    </span>
                                </td>
                                <td>${new Date(sanggahan.created_at).toLocaleDateString('id-ID')}</td>
                                <td>
                                    ${sanggahan.bukti_file ? 
                                        `<div class=\"bukti-container\">
                                            <a href=\"/uploads/${sanggahan.bukti_file}\" target=\"_blank\" class=\"btn-sm btn-primary bukti-link\" title=\"Unduh bukti\">
                                                <i class=\"fas fa-download\"></i> Lihat
                                            </a>
                                            <button type=\"button\" class=\"bukti-preview\" onclick=\"showBuktiPreview('${sanggahan.bukti_file}')\" title=\"Pratinjau bukti\">
                                                <i class=\"fas fa-eye\"></i> Preview
                                            </button>
                                        </div>` : 
                                        '<span class=\"no-bukti\">Tidak ada</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading riwayat sanggahan:', error);
        content.innerHTML = `
            <div class="dashboard-card">
                <h3>Error</h3>
                <p>Gagal memuat riwayat sanggahan. Silakan coba lagi.</p>
            </div>
        `;
    }
}

// Helper functions for sanggahan status
function getSanggahanStatusLabel(status) {
    const labels = {
        'pending': 'Menunggu',
        'accepted': 'Diterima',
        'rejected': 'Ditolak'
    };
    return labels[status] || status;
}

function getSanggahanStatusClass(status) {
    const classes = {
        'pending': 'pending',
        'accepted': 'verified',
        'rejected': 'rejected'
    };
    return classes[status] || 'pending';
}

// Show bukti preview modal
function showBuktiPreview(filename) {
    const modalHTML = `
        <div id="buktiModal" class="modal bukti-modal">
            <div class="modal-content bukti-modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-image"></i> Preview Bukti Pendukung</h3>
                    <span class="close" onclick="closeBuktiModal()">&times;</span>
                </div>
                <div class="modal-body bukti-modal-body">
                    <div class="bukti-image-container">
                        <img src="/uploads/${filename}" alt="Bukti Pendukung" class="bukti-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="bukti-error" style="display: none;">
                            <i class="fas fa-file-alt"></i>
                            <p>File tidak dapat ditampilkan sebagai gambar</p>
                            <a href="/uploads/${filename}" target="_blank" class="btn-primary">
                                <i class="fas fa-download"></i> Download File
                            </a>
                        </div>
                    </div>
                    <div class="bukti-actions">
                        <a href="/uploads/${filename}" target="_blank" class="btn-primary">
                            <i class="fas fa-download"></i> Download
                        </a>
                        <button class="btn-secondary" onclick="closeBuktiModal()">
                            <i class="fas fa-times"></i> Tutup
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // tampilkan modal
    const modalEl = document.getElementById('buktiModal');
    if (modalEl) {
        modalEl.style.display = 'block';
    }

    // tutup saat klik area luar
    modalEl.addEventListener('click', function(e) {
        if (e.target === this) {
            closeBuktiModal();
        }
    });

    // tutup dengan tombol ESC
    const escHandler = (ev) => {
        if (ev.key === 'Escape') {
            closeBuktiModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Close bukti modal
function closeBuktiModal() {
    const modal = document.getElementById('buktiModal');
    if (modal) {
        modal.remove();
    }
}

// Show Profil
function showProfil() {
    const content = document.getElementById('warga-content');
    content.innerHTML = `
        <div class="dashboard-card">
            <h3>Profil Saya</h3>
            <div class="profile-info">
                <p><strong>NIK:</strong> ${currentUser.nik}</p>
                <p><strong>No. KK:</strong> ${currentUser.kk || '-'}</p>
                <p><strong>Nama:</strong> ${currentUser.nama}</p>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                <p><strong>No. Telepon:</strong> ${currentUser.phone}</p>
                <p><strong>RT/RW:</strong> ${(currentUser.rt || '-')} / ${(currentUser.rw || '-')}</p>
                <p><strong>Alamat:</strong> ${currentUser.alamat}</p>
                <p><strong>Status:</strong> <span class="text-success">Terverifikasi</span></p>
            </div>
        </div>
    `;
}

// Show Message
function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at top of body
    document.body.insertBefore(messageDiv, document.body.firstChild);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Logout
function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAdmin');
        currentUser = null;
        isAdmin = false;
        
        // Reload page to show login form
        location.reload();
    }
}

// Mobile Optimizations
function setupMobileOptimizations() {
    // Prevent zoom on input focus (iOS)
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            if (window.innerWidth <= 768) {
                const viewport = document.querySelector('meta[name="viewport"]');
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            }
        });
        
        input.addEventListener('blur', function() {
            if (window.innerWidth <= 768) {
                const viewport = document.querySelector('meta[name="viewport"]');
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            }
        });
    });

    // Touch feedback for buttons
    const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary, .btn-login');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        const navMenu = document.getElementById('nav-menu');
        const hamburger = document.getElementById('hamburger');
        
        if (navMenu && navMenu.classList.contains('active')) {
            if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
                navMenu.classList.remove('active');
            }
        }
    });

    // Handle orientation change
    window.addEventListener('orientationchange', function() {
        setTimeout(function() {
            // Recalculate viewport height for mobile browsers
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        }, 100);
    });

    // Set initial viewport height
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    // Add swipe gesture for mobile menu
    let startX = 0;
    let startY = 0;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', function(e) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Swipe right to open menu
        if (Math.abs(diffX) > Math.abs(diffY) && diffX < -50 && startX < 50) {
            const navMenu = document.getElementById('nav-menu');
            if (navMenu && !navMenu.classList.contains('active')) {
                navMenu.classList.add('active');
            }
        }
        
        // Swipe left to close menu
        if (Math.abs(diffX) > Math.abs(diffY) && diffX > 50) {
            const navMenu = document.getElementById('nav-menu');
            if (navMenu && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
        }
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Close mobile menu after navigation
            const navMenu = document.getElementById('nav-menu');
            if (navMenu && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
            }
        }
    });
});

// Add CSS for status indicators
const style = document.createElement('style');
style.textContent = `
    .status {
        padding: 0.25rem 0.5rem;
        border-radius: 15px;
        font-size: 0.8rem;
        font-weight: 500;
    }
    .status.verified {
        background: #d4edda;
        color: #155724;
    }
    .status.pending {
        background: #fff3cd;
        color: #856404;
    }
    .stat-number {
        font-size: 3rem;
        font-weight: 700;
        color: #667eea;
        margin: 1rem 0;
    }
    .text-success {
        color: #28a745;
        font-weight: 500;
    }
    .user-menu {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .user-name {
        color: white;
        font-weight: 500;
    }
    .btn-logout {
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid white;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    .btn-logout:hover {
        background: white;
        color: #667eea;
    }
    .nik-validation-message {
        font-size: 0.875rem;
        margin-top: 0.5rem;
        padding: 0.5rem;
        border-radius: 4px;
        background: rgba(0,0,0,0.05);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .nik-validation-message i {
        font-size: 0.875rem;
    }
    .rejection-reason {
        color: #dc3545;
        font-size: 0.875rem;
        padding: 0.25rem 0.5rem;
        background: #f8d7da;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .rejection-reason i {
        color: #dc3545;
    }
    .document-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
    }
    .doc-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        border-radius: 4px;
        text-decoration: none;
        color: white;
        transition: all 0.3s ease;
    }
    .doc-btn.doc-kk { background: #007bff; }
    .doc-btn.doc-rumah { background: #28a745; }
    .doc-btn.doc-selfie { background: #ffc107; color: #212529; }
    .doc-btn.doc-gps { background: #17a2b8; }
    .doc-btn:hover {
        opacity: 0.8;
        transform: translateY(-1px);
    }
    .no-docs {
        color: #6c757d;
        font-style: italic;
        font-size: 0.875rem;
    }
    .status.rejected {
        background: #f8d7da;
        color: #721c24;
    }
    .sanggahan-type {
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 500;
    }
    .sanggahan-type.self {
        background: #e3f2fd;
        color: #1976d2;
    }
    .sanggahan-type.other {
        background: #fff3e0;
        color: #f57c00;
    }
    .user-info {
        line-height: 1.4;
    }
    .user-info strong {
        display: block;
        margin-bottom: 0.25rem;
    }
    .user-info small {
        color: #6c757d;
        font-size: 0.75rem;
    }
    .alasan-text {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: help;
    }
    .action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
    }
    .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        transition: all 0.3s ease;
    }
    .btn-sm.btn-success {
        background: #28a745;
        color: white;
    }
    .btn-sm.btn-danger {
        background: #dc3545;
        color: white;
    }
    .btn-sm.btn-warning {
        background: #ffc107;
        color: #212529;
    }
    .btn-sm.btn-primary {
        background: #007bff;
        color: white;
    }
    .btn-sm:hover {
        opacity: 0.8;
        transform: translateY(-1px);
    }
    .alasan-full-text {
        max-width: 300px;
        padding: 0.5rem;
        background: #f8f9fa;
        border-radius: 6px;
        border-left: 4px solid #007bff;
        line-height: 1.4;
        word-wrap: break-word;
        white-space: pre-wrap;
    }
    .evidence-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 150px;
    }
    .evidence-preview {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background: #e3f2fd;
        border-radius: 6px;
        border: 1px solid #bbdefb;
    }
    .evidence-icon {
        color: #1976d2;
        font-size: 1.2rem;
    }
    .evidence-name {
        font-size: 0.8rem;
        color: #1976d2;
        font-weight: 500;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .evidence-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        border-radius: 4px;
        text-decoration: none;
        color: white;
        background: #007bff;
        transition: all 0.3s ease;
        border: none;
        cursor: pointer;
    }
    .evidence-btn.download {
        background: #28a745;
    }
    .evidence-btn:hover {
        opacity: 0.8;
        transform: translateY(-1px);
    }
    .no-evidence {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        color: #6c757d;
        font-style: italic;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px dashed #dee2e6;
    }
    .action-container {
        min-width: 120px;
    }
    .action-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .action-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border: none;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: left;
        width: 100%;
    }
    .action-btn i {
        font-size: 1rem;
    }
    .accept-btn {
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
    }
    .accept-btn:hover {
        background: linear-gradient(135deg, #218838, #1ea085);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
    }
    .reject-btn {
        background: linear-gradient(135deg, #dc3545, #e74c3c);
        color: white;
        box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
    }
    .reject-btn:hover {
        background: linear-gradient(135deg, #c82333, #c0392b);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(220, 53, 69, 0.4);
    }
    .process-btn {
        background: linear-gradient(135deg, #ffc107, #ffb300);
        color: #212529;
        box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
    }
    .process-btn:hover {
        background: linear-gradient(135deg, #e0a800, #e6a200);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(255, 193, 7, 0.4);
    }
    .delete-btn {
        background: linear-gradient(135deg, #dc3545, #c82333);
        color: white;
        box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
    }
    .delete-btn:hover {
        background: linear-gradient(135deg, #c82333, #bd2130);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(220, 53, 69, 0.4);
    }
    .delete-section {
        margin-top: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid #dee2e6;
    }
    .status-info {
        text-align: center;
        padding: 0.25rem;
        background: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #dee2e6;
    }
    .status-info small {
        color: #6c757d;
        font-size: 0.7rem;
    }
    .table {
        table-layout: auto;
    }
    .table th,
    .table td {
        vertical-align: top;
        padding: 1rem 0.75rem;
    }
    .table th:nth-child(4),
    .table td:nth-child(4) {
        min-width: 200px;
    }
    .table th:nth-child(7),
    .table td:nth-child(7) {
        min-width: 150px;
    }
    .table th:nth-child(8),
    .table td:nth-child(8) {
        min-width: 120px;
    }
`;
document.head.appendChild(style);
