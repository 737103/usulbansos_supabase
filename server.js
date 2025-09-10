require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase, supabaseAdmin } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3000;
const USE_SUPABASE = String(process.env.USE_SUPABASE || '').toLowerCase() === 'true';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'bansos-uploads';

// Helper: upload file ke Supabase Storage
async function uploadFileToSupabaseStorage(localFile, destPath) {
    if (!supabaseAdmin) throw new Error('Supabase belum dikonfigurasi');
    const fileBuffer = fs.readFileSync(localFile.path);
    const { data, error } = await supabaseAdmin
        .storage
        .from(SUPABASE_BUCKET)
        .upload(destPath, fileBuffer, {
            contentType: localFile.mimetype || 'application/octet-stream',
            upsert: true
        });
    if (error) throw error;
    // Hapus file lokal setelah upload
    try { fs.unlinkSync(localFile.path); } catch (_) {}
    return data?.path || destPath;
}

// Ensure default admin exists in Supabase when using Supabase mode
async function ensureSupabaseAdminUser() {
    if (!USE_SUPABASE || !supabaseAdmin) return;
    try {
        const { data: existing, error } = await supabaseAdmin
            .from('users')
            .select('id, username')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();
        if (error) {
            console.warn('[Boot] Gagal cek admin Supabase:', error.message);
            return;
        }
        if (!existing) {
            const hashed = bcrypt.hashSync('admin123', 10);
            const { error: insErr } = await supabaseAdmin
                .from('users')
                .insert([{ username: 'admin', nama: 'Admin Kelurahan', password: hashed, role: 'admin', verified: true }]);
            if (insErr) {
                console.warn('[Boot] Gagal membuat admin default di Supabase:', insErr.message);
            } else {
                console.log('[Boot] Admin default dibuat di Supabase: username=admin password=admin123');
            }
        }
    } catch (e) {
        console.warn('[Boot] ensureSupabaseAdminUser exception');
    }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
// Proxy Supabase Storage paths to public URL when using Supabase
app.get('/uploads/*', async (req, res, next) => {
    try {
        const relPath = req.params[0];
        // Prefer local file if it exists (so hero/banner/login images work immediately)
        if (relPath) {
            // Always keep these served locally (even if not found, fall through to static -> 404),
            // to prevent accidental proxying to Supabase which returns 400
            const allowLocalRegex = /^(public\/|hero|banner|landing|login)/i;
            if (allowLocalRegex.test(relPath)) {
                return next();
            }
            const localCandidate = path.join('uploads', relPath);
            try {
                if (fs.existsSync(localCandidate)) {
                    return next();
                }
            } catch (_) {}
        }
        // Otherwise, when Supabase mode is ON, proxy to Supabase public URL
        if (!relPath) return res.status(404).end();
        if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase belum dikonfigurasi' });
        const { data } = supabaseAdmin.storage.from(SUPABASE_BUCKET).getPublicUrl(relPath);
        if (data && data.publicUrl) {
            return res.redirect(302, data.publicUrl);
        }
        return res.status(404).end();
    } catch (_) {
        return next();
    }
});

// Handle browsers requesting /favicon.ico even when we use inline SVG icon
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

// Initialize SQLite database
const db = new sqlite3.Database('bansos.db');

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nik TEXT UNIQUE,
        kk TEXT,
        username TEXT UNIQUE,
        nama TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        rt TEXT,
        rw TEXT,
        alamat TEXT,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'warga',
        verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME
    )`);

    // Bantuan Sosial table
    db.run(`CREATE TABLE IF NOT EXISTS bantuan_sosial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        jenis_bantuan TEXT NOT NULL,
        alasan_pengajuan TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        foto_kk TEXT,
        foto_rumah_depan TEXT,
        foto_rumah_dalam TEXT,
        foto_selfie_ktp TEXT,
        foto_lokasi_rumah TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    
    // Add new columns if they don't exist (for existing databases)
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN alasan_pengajuan TEXT`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN foto_kk TEXT`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN foto_rumah_depan TEXT`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN foto_rumah_dalam TEXT`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN foto_selfie_ktp TEXT`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN foto_lokasi_rumah TEXT`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN gps_latitude REAL`, () => {});
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN gps_longitude REAL`, () => {});
    
    // Drop old deskripsi column if it exists (SQLite doesn't support DROP COLUMN directly)
    // We'll recreate the table with the correct structure
    db.run(`CREATE TABLE IF NOT EXISTS bantuan_sosial_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        jenis_bantuan TEXT NOT NULL,
        alasan_pengajuan TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        foto_kk TEXT,
        foto_rumah_depan TEXT,
        foto_rumah_dalam TEXT,
        foto_selfie_ktp TEXT,
        foto_lokasi_rumah TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, () => {
        // Copy data from old table to new table
        db.run(`INSERT INTO bantuan_sosial_new 
            SELECT id, user_id, jenis_bantuan, 
                   COALESCE(alasan_pengajuan, deskripsi) as alasan_pengajuan,
                   status, foto_kk, foto_rumah_depan, foto_rumah_dalam, 
                   foto_selfie_ktp, foto_lokasi_rumah, gps_latitude, gps_longitude,
                   rejection_reason, created_at, updated_at
            FROM bantuan_sosial`, () => {
            // Drop old table and rename new table
            db.run(`DROP TABLE bantuan_sosial`, () => {
                db.run(`ALTER TABLE bantuan_sosial_new RENAME TO bantuan_sosial`);
            });
        });
    });

    // Sanggahan table
    db.run(`CREATE TABLE IF NOT EXISTS sanggahan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pelapor_user_id INTEGER NOT NULL,
        target_user_id INTEGER,
        tipe TEXT NOT NULL, -- 'diri_sendiri' | 'warga_lain'
        alasan TEXT NOT NULL,
        bukti_file TEXT,
        status TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pelapor_user_id) REFERENCES users (id),
        FOREIGN KEY (target_user_id) REFERENCES users (id)
    )`);
    
    // Add bukti_file column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE sanggahan ADD COLUMN bukti_file TEXT`, () => {});
    
    // Add rejection_reason column to bantuan_sosial if it doesn't exist
    db.run(`ALTER TABLE bantuan_sosial ADD COLUMN rejection_reason TEXT`, () => {});

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, nama, password, role, verified) 
            VALUES ('admin', 'Admin Kelurahan', ?, 'admin', 1)`, [adminPassword]);

    // Ensure new columns exist for backward compatibility (when DB was created before)
    const ensureColumn = (table, column, definition) => {
        db.get(`PRAGMA table_info(${table})`, (err) => {
            if (err) { return; }
            db.all(`PRAGMA table_info(${table})`, (err2, rows) => {
                if (err2) { return; }
                const hasColumn = rows.some(r => r.name === column);
                if (!hasColumn) {
                    db.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
                }
            });
        });
    };

    ensureColumn('users', 'kk', 'kk TEXT');
    ensureColumn('users', 'rt', 'rt TEXT');
    ensureColumn('users', 'rw', 'rw TEXT');
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token tidak valid' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (USE_SUPABASE) {
        try {
            if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase belum dikonfigurasi' });
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('role', 'admin')
                .limit(1)
                .maybeSingle();
            if (error) {
                console.error('[AdminLogin][Supabase] Query error:', error);
                return res.status(500).json({ message: 'Server error' });
            }
            const user = data;
            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ message: 'Username atau password salah' });
            }
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            return res.json({
                message: 'Login berhasil',
                token,
                user: { id: user.id, username: user.username, nama: user.nama, role: user.role }
            });
        } catch (_) {
            return res.status(500).json({ message: 'Server error' });
        }
    } else {
        db.get('SELECT * FROM users WHERE username = ? AND role = "admin"', [username], (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ message: 'Username atau password salah' });
            }
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.json({
                message: 'Login berhasil',
                token,
                user: { id: user.id, username: user.username, nama: user.nama, role: user.role }
            });
        });
    }
});

// Warga registration
app.post('/api/warga/register', async (req, res) => {
    const { nik, kk, nama, email, phone, rt, rw, alamat, password } = req.body;

    // Validate required fields
    if (!nik || !kk || !nama || !email || !password) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    // Validate formats
    const isSixteenDigits = /^\d{16}$/;
    const isRtRwValid = /^00\d{1,2}$/; // starts with 00, total length 3-4

    if (!isSixteenDigits.test(nik)) {
        return res.status(400).json({ message: 'Format NIK harus 16 digit' });
    }
    if (!isSixteenDigits.test(kk)) {
        return res.status(400).json({ message: 'Format No. KK harus 16 digit' });
    }
    if (rt && !isRtRwValid.test(rt)) {
        return res.status(400).json({ message: 'Format RT harus diawali 00 (3-4 digit)' });
    }
    if (rw && !isRtRwValid.test(rw)) {
        return res.status(400).json({ message: 'Format RW harus diawali 00 (3-4 digit)' });
    }

    if (USE_SUPABASE) {
        try {
            if (!supabaseAdmin || !supabase) return res.status(500).json({ message: 'Supabase belum dikonfigurasi' });
            const { data: existingNik, error: errNik } = await supabaseAdmin
                .from('users')
                .select('id, verified')
                .eq('nik', nik)
                .limit(1)
                .maybeSingle();
            if (errNik) {
                console.error('[Register][Supabase] Cek NIK error:', errNik);
                return res.status(500).json({ message: 'Server error' });
            }
            if (existingNik) {
                if (existingNik.verified === 1 || existingNik.verified === true) {
                    return res.status(400).json({ message: 'NIK sudah terdaftar dan diverifikasi oleh admin kelurahan. Hubungi admin kelurahan untuk bantuan.', code: 'NIK_VERIFIED_EXISTS' });
                }
                return res.status(400).json({ message: 'NIK sudah terdaftar tetapi belum diverifikasi. Tunggu verifikasi admin atau hubungi admin kelurahan.', code: 'NIK_PENDING_VERIFICATION' });
            }
            const { data: existingEmail, error: errEmail } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', email)
                .limit(1)
                .maybeSingle();
            if (errEmail) {
                console.error('[Register][Supabase] Cek email error:', errEmail);
                return res.status(500).json({ message: 'Server error' });
            }
            if (existingEmail) return res.status(400).json({ message: 'Email sudah terdaftar' });

            const hashedPassword = bcrypt.hashSync(password, 10);
            const { data: inserted, error: insertErr } = await supabaseAdmin
                .from('users')
                .insert([{ nik, kk, nama, email, phone, rt, rw, alamat, password: hashedPassword, role: 'warga', verified: 0 }])
                .select('id')
                .maybeSingle();
            if (insertErr) {
                console.error('[Register][Supabase] Insert error:', insertErr);
                // Tangani duplikat unik (race condition) agar tidak 500
                const msg = (insertErr.message || '').toLowerCase();
                const details = (insertErr.details || '').toLowerCase();
                const isDuplicate = insertErr.code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint');
                if (isDuplicate) {
                    if (details.includes('users_nik_key') || msg.includes('nik')) {
                        return res.status(400).json({ message: 'NIK sudah terdaftar', code: 'NIK_EXISTS' });
                    }
                    if (details.includes('users_email_key') || msg.includes('email')) {
                        return res.status(400).json({ message: 'Email sudah terdaftar', code: 'EMAIL_EXISTS' });
                    }
                    // fallback untuk duplicate lain
                    return res.status(400).json({ message: 'Data sudah terdaftar', code: 'DUPLICATE' });
                }
                return res.status(500).json({ message: 'Gagal mendaftar' });
            }
            return res.json({ message: 'Pendaftaran berhasil. Akun Anda akan diverifikasi oleh admin.', userId: inserted?.id || null });
        } catch (_) {
            console.error('[Register][Supabase] Unknown error');
            return res.status(500).json({ message: 'Server error' });
        }
    } else {
        // Check if NIK already exists (prevent re-register)
        db.get('SELECT id, verified FROM users WHERE nik = ?', [nik], (err, existingUser) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            if (existingUser) {
                if (existingUser.verified === 1) {
                    return res.status(400).json({ 
                        message: 'NIK sudah terdaftar dan diverifikasi oleh admin kelurahan. Hubungi admin kelurahan untuk bantuan.',
                        code: 'NIK_VERIFIED_EXISTS'
                    });
                } else {
                    return res.status(400).json({ 
                        message: 'NIK sudah terdaftar tetapi belum diverifikasi. Tunggu verifikasi admin atau hubungi admin kelurahan.',
                        code: 'NIK_PENDING_VERIFICATION'
                    });
                }
            }
            // Check if email already exists
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, existingEmail) => {
                if (err) {
                    return res.status(500).json({ message: 'Server error' });
                }
                if (existingEmail) {
                    return res.status(400).json({ message: 'Email sudah terdaftar' });
                }
                const hashedPassword = bcrypt.hashSync(password, 10);
                db.run(
                    'INSERT INTO users (nik, kk, nama, email, phone, rt, rw, alamat, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [nik, kk, nama, email, phone, rt, rw, alamat, hashedPassword],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ message: 'Gagal mendaftar' });
                        }
                        res.json({ message: 'Pendaftaran berhasil. Akun Anda akan diverifikasi oleh admin.', userId: this.lastID });
                    }
                );
            });
        });
    }
});

// Check NIK availability
app.post('/api/warga/check-nik', async (req, res) => {
    const { nik } = req.body;

    if (!nik) {
        return res.status(400).json({ message: 'NIK wajib diisi' });
    }

    // Validate NIK format
    const isSixteenDigits = /^\d{16}$/;
    if (!isSixteenDigits.test(nik)) {
        return res.status(400).json({ 
            message: 'Format NIK harus 16 digit',
            code: 'INVALID_NIK_FORMAT'
        });
    }

    // 1) Cek di Supabase (service role) jika tersedia
    if (supabaseAdmin) {
        try {
            const { data: user, error } = await supabaseAdmin
                .from('users')
                .select('id, verified')
                .eq('nik', nik)
                .limit(1)
                .maybeSingle();
            if (error) {
                console.error('[check-nik][Supabase] error:', error);
            }

            if (user) {
                if (user.verified === 1 || user.verified === true) {
                    return res.status(400).json({ 
                        message: 'NIK telah terdaftar',
                        code: 'NIK_VERIFIED_EXISTS'
                    });
                } else {
                    return res.status(400).json({ 
                        message: 'NIK telah terdaftar',
                        code: 'NIK_PENDING_VERIFICATION'
                    });
                }
            }

            // Jangan return di sini; lanjut cek sumber lain untuk konsistensi
        } catch (e) {
            console.error('[check-nik] exception:', e);
        }
    }

    // 1b) Cek di Supabase (anon) bila service role tidak tersedia namun anon ada
    if (!supabaseAdmin && supabase) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('id, verified')
                .eq('nik', nik)
                .limit(1)
                .maybeSingle();
            if (!error && user) {
                return res.status(400).json({ 
                    message: 'NIK telah terdaftar',
                    code: user.verified ? 'NIK_VERIFIED_EXISTS' : 'NIK_PENDING_VERIFICATION'
                });
            }
        } catch (e) {
            console.error('[check-nik][anon] exception:', e);
        }
    }

    // 2) Cek di SQLite (selalu dicek karena mungkin data lokal)
    db.get('SELECT id, verified FROM users WHERE nik = ?', [nik], (err, existingUser) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }

        if (existingUser) {
            if (existingUser.verified === 1) {
                return res.status(400).json({ 
                    message: 'NIK telah terdaftar',
                    code: 'NIK_VERIFIED_EXISTS'
                });
            } else {
                return res.status(400).json({ 
                    message: 'NIK telah terdaftar',
                    code: 'NIK_PENDING_VERIFICATION'
                });
            }
        }

        // Jika tidak ditemukan di kedua sumber, NIK tersedia
        res.json({ 
            message: 'NIK tersedia untuk pendaftaran',
            code: 'NIK_AVAILABLE'
        });
    });
});

// Warga login
app.post('/api/warga/login', async (req, res) => {
    const { nik, password } = req.body;
    if (USE_SUPABASE) {
        try {
            if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase belum dikonfigurasi' });
            const { data: user, error } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('nik', nik)
                .eq('role', 'warga')
                .limit(1)
                .maybeSingle();
            if (error) return res.status(500).json({ message: 'Server error' });
            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ message: 'NIK atau password salah' });
            }
            if (!user.verified) {
                return res.status(401).json({ message: 'Akun Anda belum diverifikasi oleh admin' });
            }
            const token = jwt.sign(
                { id: user.id, nik: user.nik, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            return res.json({
                message: 'Login berhasil',
                token,
                user: {
                    id: user.id,
                    nik: user.nik,
                    kk: user.kk,
                    nama: user.nama,
                    email: user.email,
                    phone: user.phone,
                    rt: user.rt,
                    rw: user.rw,
                    alamat: user.alamat,
                    role: user.role
                }
            });
        } catch (_) {
            return res.status(500).json({ message: 'Server error' });
        }
    } else {
        db.get('SELECT * FROM users WHERE nik = ? AND role = "warga"', [nik], (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.status(401).json({ message: 'NIK atau password salah' });
            }
            if (!user.verified) {
                return res.status(401).json({ message: 'Akun Anda belum diverifikasi oleh admin' });
            }
            const token = jwt.sign(
                { id: user.id, nik: user.nik, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.json({
                message: 'Login berhasil',
                token,
                user: {
                    id: user.id,
                    nik: user.nik,
                    kk: user.kk,
                    nama: user.nama,
                    email: user.email,
                    phone: user.phone,
                    rt: user.rt,
                    rw: user.rw,
                    alamat: user.alamat,
                    role: user.role
                }
            });
        });
    }
});

// Get all users for admin verification
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    if (USE_SUPABASE) {
        (async () => {
            try {
                const { data, error } = await supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('role', 'warga')
                    .order('created_at', { ascending: false });
                if (error) {
                    console.error('[AdminUsers][Supabase] Query error:', error);
                    return res.status(500).json({ message: 'Server error' });
                }
                const safe = (data || []).map(u => {
                    const { password, ...rest } = u || {};
                    return rest;
                });
                return res.json(safe);
            } catch (e) {
                return res.status(500).json({ message: 'Server error' });
            }
        })();
    } else {
        db.all('SELECT * FROM users WHERE role = "warga" ORDER BY created_at DESC', (err, users) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            const safeUsers = users.map(user => {
                const { password, ...safeUser } = user;
                return safeUser;
            });
            res.json(safeUsers);
        });
    }
});

// Verify user
app.put('/api/admin/users/:id/verify', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const userId = req.params.id;
    if (USE_SUPABASE) {
        (async () => {
            try {
                const { data: existing, error: getErr } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('id', userId)
                    .eq('role', 'warga')
                    .maybeSingle();
                if (getErr) return res.status(500).json({ message: 'Server error' });
                if (!existing) return res.status(404).json({ message: 'User tidak ditemukan' });
                const { error: updErr } = await supabaseAdmin
                    .from('users')
                    .update({ verified: true, verified_at: new Date().toISOString() })
                    .eq('id', userId)
                    .eq('role', 'warga');
                if (updErr) return res.status(500).json({ message: 'Server error' });
                return res.json({ message: 'User berhasil diverifikasi' });
            } catch (_) {
                return res.status(500).json({ message: 'Server error' });
            }
        })();
    } else {
        db.run(
            'UPDATE users SET verified = 1, verified_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userId],
            function(err) {
                if (err) {
                    return res.status(500).json({ message: 'Server error' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ message: 'User tidak ditemukan' });
                }
                res.json({ message: 'User berhasil diverifikasi' });
            }
        );
    }
});

// Reject user
app.delete('/api/admin/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const userId = req.params.id;
    if (USE_SUPABASE) {
        (async () => {
            const { data: existing, error: getErr } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('id', userId)
                .eq('role', 'warga')
                .maybeSingle();
            if (getErr) return res.status(500).json({ message: 'Server error' });
            if (!existing) return res.status(404).json({ message: 'User tidak ditemukan' });
            const { error: delErr } = await supabaseAdmin
                .from('users')
                .delete()
                .eq('id', userId)
                .eq('role', 'warga');
            if (delErr) return res.status(500).json({ message: 'Server error' });
            return res.json({ message: 'User berhasil ditolak' });
        })();
    } else {
        db.run('DELETE FROM users WHERE id = ? AND role = "warga"', [userId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ message: 'User tidak ditemukan' });
            }
            res.json({ message: 'User berhasil ditolak' });
        });
    }
});

// Update admin credentials (username/password)
app.put('/api/admin/credentials', authenticateToken, (req, res) => {
    // Only admin can update their credentials
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const adminId = req.user.id;
    const { currentPassword, newUsername, newPassword } = req.body || {};

    if (!currentPassword || (!newUsername && !newPassword)) {
        return res.status(400).json({ message: 'Isian tidak lengkap' });
    }

    if (USE_SUPABASE) {
        (async () => {
            try {
                // Get current admin record
                const { data: user, error: getUserError } = await supabaseAdmin
                    .from('users')
                    .select('*')
                    .eq('id', adminId)
                    .eq('role', 'admin')
                    .maybeSingle();
                
                if (getUserError) {
                    console.error('Error getting admin user:', getUserError);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                if (!user) {
                    return res.status(404).json({ message: 'Admin tidak ditemukan' });
                }
                
                // Verify current password
                const isValid = bcrypt.compareSync(currentPassword, user.password);
                if (!isValid) {
                    return res.status(401).json({ message: 'Password saat ini salah' });
                }

                // Prepare updates
                const updateData = {};
                
                if (newUsername && newUsername !== user.username) {
                    updateData.username = newUsername;
                }
                if (newPassword) {
                    updateData.password = bcrypt.hashSync(newPassword, 10);
                }

                if (Object.keys(updateData).length === 0) {
                    return res.json({ message: 'Tidak ada perubahan' });
                }

                // Update admin credentials
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update(updateData)
                    .eq('id', adminId)
                    .eq('role', 'admin');
                
                if (updateError) {
                    console.error('Error updating admin credentials:', updateError);
                    if (updateError.code === '23505' || updateError.message.includes('unique')) {
                        return res.status(400).json({ message: 'Username sudah digunakan' });
                    }
                    return res.status(500).json({ message: 'Gagal memperbarui kredensial' });
                }
                
                console.log('Admin credentials updated successfully for user:', adminId);
                return res.json({ message: 'Kredensial admin berhasil diperbarui. Silakan login ulang.' });
            } catch (e) {
                console.error('Update admin credentials error:', e);
                return res.status(500).json({ message: 'Server error' });
            }
        })();
    } else {
        // SQLite version
        // Get current admin record
        db.get('SELECT * FROM users WHERE id = ? AND role = "admin"', [adminId], (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            if (!user) {
                return res.status(404).json({ message: 'Admin tidak ditemukan' });
            }
            // Verify current password
            const isValid = bcrypt.compareSync(currentPassword, user.password);
            if (!isValid) {
                return res.status(401).json({ message: 'Password saat ini salah' });
            }

            // Prepare updates
            const updates = [];
            const params = [];

            if (newUsername && newUsername !== user.username) {
                updates.push('username = ?');
                params.push(newUsername);
            }
            if (newPassword) {
                const hashed = bcrypt.hashSync(newPassword, 10);
                updates.push('password = ?');
                params.push(hashed);
            }

            if (updates.length === 0) {
                return res.json({ message: 'Tidak ada perubahan' });
            }

            params.push(adminId);

            // Try update; handle unique username constraint error
            db.run(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'admin'`, params, function(updateErr) {
                if (updateErr) {
                    if (updateErr && /UNIQUE constraint failed: users.username/i.test(updateErr.message)) {
                        return res.status(400).json({ message: 'Username sudah digunakan' });
                    }
                    return res.status(500).json({ message: 'Gagal memperbarui kredensial' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Admin tidak ditemukan' });
                }

                return res.json({ message: 'Kredensial admin berhasil diperbarui. Silakan login ulang.' });
            });
        });
    }
});

// Reset user password (admin)
app.put('/api/admin/users/:id/reset-password', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const userId = req.params.id;
    const defaultPassword = bcrypt.hashSync('123456', 10);

    if (USE_SUPABASE) {
        (async () => {
            try {
                // Check if user exists and is a warga
                const { data: existingUser, error: checkError } = await supabaseAdmin
                    .from('users')
                    .select('id, role')
                    .eq('id', userId)
                    .eq('role', 'warga')
                    .maybeSingle();
                
                if (checkError) {
                    console.error('Error checking user:', checkError);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                if (!existingUser) {
                    return res.status(404).json({ message: 'User tidak ditemukan' });
                }
                
                // Update password
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({ password: defaultPassword })
                    .eq('id', userId)
                    .eq('role', 'warga');
                
                if (updateError) {
                    console.error('Error updating password:', updateError);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                console.log('Password reset successfully for user:', userId);
                return res.json({ message: 'Password berhasil direset ke default' });
            } catch (e) {
                console.error('Reset password error:', e);
                return res.status(500).json({ message: 'Server error' });
            }
        })();
    } else {
        // SQLite version
        db.run('UPDATE users SET password = ? WHERE id = ? AND role = "warga"', [defaultPassword, userId], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: 'User tidak ditemukan' });
            }

            res.json({ message: 'Password berhasil direset ke default' });
        });
    }
});

// Submit bantuan sosial
app.post('/api/bantuan', authenticateToken, upload.fields([
    { name: 'fotoKK', maxCount: 1 },
    { name: 'fotoRumahDepan', maxCount: 1 },
    { name: 'fotoRumahDalam', maxCount: 1 },
    { name: 'fotoSelfieKTP', maxCount: 1 }
]), (req, res) => {
    const { 
        jenis_bantuan, 
        alasan_pengajuan, 
        gps_latitude, 
        gps_longitude 
    } = req.body;
    const userId = req.user.id;

    if (!jenis_bantuan || !alasan_pengajuan) {
        return res.status(400).json({ message: 'Jenis bantuan dan alasan pengajuan wajib diisi' });
    }

    // Validate required files (kecuali fotoLokasiRumah yang hanya menggunakan GPS)
    const requiredFiles = ['fotoKK', 'fotoRumahDepan', 'fotoRumahDalam', 'fotoSelfieKTP'];
    const fileNames = {};
    
    for (const fileField of requiredFiles) {
        if (!req.files[fileField] || req.files[fileField].length === 0) {
            return res.status(400).json({ message: `File ${fileField} wajib diupload` });
        }
        fileNames[fileField] = req.files[fileField][0].filename;
    }
    
    // Validate GPS coordinates for foto lokasi rumah
    if (!gps_latitude || !gps_longitude) {
        return res.status(400).json({ message: 'GPS lokasi rumah wajib diaktifkan' });
    }

    // Validate file sizes (500KB max)
    for (const fileField of requiredFiles) {
        const file = req.files[fileField][0];
        if (file.size > 500 * 1024) {
            return res.status(400).json({ message: `Ukuran file ${fileField} maksimal 500 KB` });
        }
    }

    if (USE_SUPABASE) {
        (async () => {
            try {
                // upload files ke Supabase Storage
                const uploaded = {};
                for (const key of Object.keys(fileNames)) {
                    const f = req.files[key][0];
                    const dest = `users/${userId}/${Date.now()}-${f.originalname}`;
                    uploaded[key] = await uploadFileToSupabaseStorage(f, dest);
                }
                const { data, error } = await supabaseAdmin
                    .from('bantuan_sosial')
                    .insert([
                        {
                            user_id: userId,
                            jenis_bantuan,
                            alasan_pengajuan,
                            foto_kk: uploaded.fotoKK,
                            foto_rumah_depan: uploaded.fotoRumahDepan,
                            foto_rumah_dalam: uploaded.fotoRumahDalam,
                            foto_selfie_ktp: uploaded.fotoSelfieKTP,
                            foto_lokasi_rumah: null,
                            gps_latitude: gps_latitude || null,
                            gps_longitude: gps_longitude || null
                        }
                    ])
                    .select('id')
                    .maybeSingle();
                if (error) {
                    console.error('Supabase error:', error);
                    return res.status(500).json({ message: 'Server error' });
                }
                return res.json({ message: 'Ajuan bantuan sosial berhasil dikirim', bantuanId: data?.id || null });
            } catch (e) {
                console.error('Upload/insert error:', e);
                return res.status(500).json({ message: 'Server error' });
            }
        })();
    } else {
        db.run(
            `INSERT INTO bantuan_sosial (
                user_id, jenis_bantuan, alasan_pengajuan, 
                foto_kk, foto_rumah_depan, foto_rumah_dalam, 
                foto_selfie_ktp, foto_lokasi_rumah, 
                gps_latitude, gps_longitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, jenis_bantuan, alasan_pengajuan,
                fileNames.fotoKK, fileNames.fotoRumahDepan, fileNames.fotoRumahDalam,
                fileNames.fotoSelfieKTP, null,
                gps_latitude || null, gps_longitude || null
            ],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Server error' });
                }
                res.json({ message: 'Ajuan bantuan sosial berhasil dikirim', bantuanId: this.lastID });
            }
        );
    }
});

// Create sanggahan (by warga)
app.post('/api/sanggahan', authenticateToken, upload.single('bukti_sanggahan'), (req, res) => {
    const { jenis_sanggahan, alasan_sanggahan, nik_warga_lain } = req.body;
    const pelaporId = req.user.id;

    if (!jenis_sanggahan || !alasan_sanggahan) {
        return res.status(400).json({ message: 'Jenis sanggahan dan alasan wajib diisi' });
    }
    if (!['diri_sendiri', 'warga_lain'].includes(jenis_sanggahan)) {
        return res.status(400).json({ message: 'Jenis sanggahan tidak valid' });
    }

    // Validate file if uploaded
    if (req.file) {
        // Validate file size (500KB max)
        if (req.file.size > 500 * 1024) {
            return res.status(400).json({ message: 'Ukuran file bukti maksimal 500 KB' });
        }
        
        // Validate file type (JPG/JPEG only)
        if (!req.file.mimetype.match(/^image\/(jpeg|jpg)$/)) {
            return res.status(400).json({ message: 'Format file bukti harus JPG atau JPEG' });
        }
    }

    const insert = async (targetUserId, buktiFile) => {
        if (USE_SUPABASE) {
            try {
                let storedPath = null;
                if (req.file) {
                    const f = req.file;
                    const dest = `sanggahan/${pelaporId}/${Date.now()}-${f.originalname}`;
                    storedPath = await uploadFileToSupabaseStorage(f, dest);
                }
                const { data, error } = await supabaseAdmin
                    .from('sanggahan')
                    .insert([{ pelapor_user_id: pelaporId, target_user_id: targetUserId || null, tipe: jenis_sanggahan, alasan: alasan_sanggahan, bukti_file: storedPath || buktiFile || null }])
                    .select('id')
                    .maybeSingle();
                if (error) return res.status(500).json({ message: 'Gagal membuat sanggahan' });
                return res.json({ message: 'Sanggahan berhasil dikirim', sanggahanId: data?.id || null });
            } catch (_) {
                return res.status(500).json({ message: 'Gagal membuat sanggahan' });
            }
        } else {
            db.run(
                'INSERT INTO sanggahan (pelapor_user_id, target_user_id, tipe, alasan, bukti_file) VALUES (?, ?, ?, ?, ?)',
                [pelaporId, targetUserId || null, jenis_sanggahan, alasan_sanggahan, buktiFile || null],
                function(err) {
                    if (err) return res.status(500).json({ message: 'Gagal membuat sanggahan' });
                    res.json({ message: 'Sanggahan berhasil dikirim', sanggahanId: this.lastID });
                }
            );
        }
    };

    if (jenis_sanggahan === 'warga_lain') {
        if (!nik_warga_lain) {
            return res.status(400).json({ message: 'NIK warga yang disanggah wajib diisi' });
        }
        if (USE_SUPABASE) {
            (async () => {
                const { data: target, error } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('nik', nik_warga_lain)
                    .eq('role', 'warga')
                    .limit(1)
                    .maybeSingle();
                if (error) return res.status(500).json({ message: 'Server error' });
                if (!target) return res.status(404).json({ message: 'Warga yang disanggah tidak ditemukan' });
                insert(target.id, req.file ? req.file.filename : null);
            })();
        } else {
            db.get('SELECT id FROM users WHERE nik = ? AND role = "warga"', [nik_warga_lain], (err, target) => {
                if (err) return res.status(500).json({ message: 'Server error' });
                if (!target) return res.status(404).json({ message: 'Warga yang disanggah tidak ditemukan' });
                insert(target.id, req.file ? req.file.filename : null);
            });
        }
    } else {
        insert(null, req.file ? req.file.filename : null);
    }
});

// Get user's sanggahan
app.get('/api/sanggahan', authenticateToken, (req, res) => {
    const userId = req.user.id;

    console.log('Getting sanggahan for user:', userId);

    if (USE_SUPABASE) {
        (async () => {
            const { data, error } = await supabaseAdmin
                .from('sanggahan')
                .select('*, pelapor:users!sanggahan_pelapor_user_id_fkey(nama, nik), target:users!sanggahan_target_user_id_fkey(nama, nik)')
                .eq('pelapor_user_id', userId)
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ message: 'Server error' });
            const mapped = (data || []).map(s => ({
                ...s,
                pelapor_nama: s.pelapor?.nama || null,
                pelapor_nik: s.pelapor?.nik || null,
                target_nama: s.target?.nama || null,
                target_nik: s.target?.nik || null
            }));
            return res.json(mapped);
        })();
    } else {
        db.all(`
            SELECT s.*, p.nama AS pelapor_nama, p.nik AS pelapor_nik,
                   t.nama AS target_nama, t.nik AS target_nik
            FROM sanggahan s
            LEFT JOIN users p ON s.pelapor_user_id = p.id
            LEFT JOIN users t ON s.target_user_id = t.id
            WHERE s.pelapor_user_id = ?
            ORDER BY s.created_at DESC
        `, [userId], (err, rows) => {
            if (err) {
                console.error('Error getting sanggahan:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            console.log('Sanggahan data for user:', rows);
            res.json(rows);
        });
    }
});

// Get all sanggahan (admin)
app.get('/api/admin/sanggahan', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }
    if (USE_SUPABASE) {
        (async () => {
            const { data, error } = await supabaseAdmin
                .from('sanggahan')
                .select('*, pelapor:users!sanggahan_pelapor_user_id_fkey(nama, nik), target:users!sanggahan_target_user_id_fkey(nama, nik)')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ message: 'Server error' });
            const mapped = (data || []).map(s => ({
                ...s,
                pelapor_nama: s.pelapor?.nama || null,
                pelapor_nik: s.pelapor?.nik || null,
                target_nama: s.target?.nama || null,
                target_nik: s.target?.nik || null
            }));
            return res.json(mapped);
        })();
    } else {
        db.all(`
            SELECT s.*, p.nama AS pelapor_nama, p.nik AS pelapor_nik,
                   t.nama AS target_nama, t.nik AS target_nik
            FROM sanggahan s
            LEFT JOIN users p ON s.pelapor_user_id = p.id
            LEFT JOIN users t ON s.target_user_id = t.id
            ORDER BY s.created_at DESC
        `, (err, rows) => {
            if (err) return res.status(500).json({ message: 'Server error' });
            res.json(rows);
        });
    }
});

// Update sanggahan status (admin)
app.put('/api/admin/sanggahan/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }
    
    const { status } = req.body;
    const id = req.params.id;
    
    console.log('Update sanggahan status request:', { id, status, userId: req.user.id });
    
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status tidak valid' });
    }
    
    if (USE_SUPABASE) {
        (async () => {
            const { data: sanggahan, error: errGet } = await supabaseAdmin
                .from('sanggahan')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (errGet) return res.status(500).json({ message: 'Server error' });
            if (!sanggahan) return res.status(404).json({ message: 'Sanggahan tidak ditemukan' });

            const { error: errUpdate } = await supabaseAdmin
                .from('sanggahan')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (errUpdate) return res.status(500).json({ message: 'Server error' });

            let targetUserId = null;
            if (status === 'accepted') {
                if (sanggahan.tipe === 'diri_sendiri') targetUserId = sanggahan.pelapor_user_id;
                else if (sanggahan.tipe === 'warga_lain' && sanggahan.target_user_id) targetUserId = sanggahan.target_user_id;
                if (targetUserId) {
                    await supabaseAdmin
                        .from('bantuan_sosial')
                        .update({ status: 'rejected', rejection_reason: 'Ditolak berdasarkan sanggahan', updated_at: new Date().toISOString() })
                        .eq('user_id', targetUserId)
                        .in('status', ['pending', 'approved']);
                }
            }
            // Jika sanggahan ditolak oleh admin, jangan ubah status bantuan sosial apapun
            return res.json({ message: 'Status sanggahan berhasil diperbarui' });
        })();
    } else {
        // original SQLite flow
        // First, get the sanggahan details
        db.get('SELECT * FROM sanggahan WHERE id = ?', [id], (err, sanggahan) => {
            if (err) {
                console.error('Error getting sanggahan:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!sanggahan) {
                return res.status(404).json({ message: 'Sanggahan tidak ditemukan' });
            }
            
            console.log('Sanggahan details:', sanggahan);
            
            // Update sanggahan status
            db.run('UPDATE sanggahan SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], function(err) {
                if (err) {
                    console.error('Error updating sanggahan status:', err);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Sanggahan tidak ditemukan' });
                }
                
                console.log('Sanggahan status updated successfully');
                
                // Jika sanggahan diterima, set bantuan target menjadi REJECTED
                if (status === 'accepted') {
                    console.log('Sanggahan accepted, updating bantuan status to rejected');
                    
                    let targetUserId = null;
                    
                    if (sanggahan.tipe === 'diri_sendiri') {
                        targetUserId = sanggahan.pelapor_user_id;
                        console.log('Self-sanggahan accepted, updating pelapor bantuan to rejected');
                    } else if (sanggahan.tipe === 'warga_lain' && sanggahan.target_user_id) {
                        targetUserId = sanggahan.target_user_id;
                        console.log('Other-warga sanggahan accepted, updating target user bantuan to rejected');
                    }
                    
                    if (targetUserId) {
                        db.run(`
                            UPDATE bantuan_sosial 
                            SET status = 'rejected', rejection_reason = 'Ditolak berdasarkan sanggahan', updated_at = CURRENT_TIMESTAMP 
                            WHERE user_id = ? AND (status = 'pending' OR status = 'approved')
                        `, [targetUserId], function(err) {
                            if (err) {
                                console.error('Error updating bantuan status:', err);
                            } else {
                                console.log('Bantuan status updated to rejected:', this.changes, 'records for user:', targetUserId);
                            }
                        });
                    }
                }

                // Jika sanggahan DITOLAK, tidak ada perubahan status bantuan
                
                res.json({ message: 'Status sanggahan berhasil diperbarui' });
            });
        });
    }
});

// Delete sanggahan (admin)
app.delete('/api/admin/sanggahan/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }
    
    const id = req.params.id;
    
    console.log('Delete sanggahan request:', { id, userId: req.user.id });
    
    if (USE_SUPABASE) {
        (async () => {
            try {
                // Check if sanggahan exists
                const { data: existingSanggahan, error: checkError } = await supabaseAdmin
                    .from('sanggahan')
                    .select('id')
                    .eq('id', id)
                    .maybeSingle();
                
                if (checkError) {
                    console.error('Error checking sanggahan:', checkError);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                if (!existingSanggahan) {
                    return res.status(404).json({ message: 'Sanggahan tidak ditemukan' });
                }
                
                // Delete the sanggahan
                const { error: deleteError } = await supabaseAdmin
                    .from('sanggahan')
                    .delete()
                    .eq('id', id);
                
                if (deleteError) {
                    console.error('Error deleting sanggahan:', deleteError);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                console.log('Sanggahan deleted successfully');
                return res.json({ message: 'Sanggahan berhasil dihapus' });
            } catch (e) {
                console.error('Delete sanggahan error:', e);
                return res.status(500).json({ message: 'Server error' });
            }
        })();
    } else {
        // SQLite version
        // First, get the sanggahan details to check if it exists
        db.get('SELECT * FROM sanggahan WHERE id = ?', [id], (err, sanggahan) => {
            if (err) {
                console.error('Error getting sanggahan:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!sanggahan) {
                return res.status(404).json({ message: 'Sanggahan tidak ditemukan' });
            }
            
            console.log('Sanggahan to delete:', sanggahan);
            
            // Delete the sanggahan
            db.run('DELETE FROM sanggahan WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('Error deleting sanggahan:', err);
                    return res.status(500).json({ message: 'Server error' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ message: 'Sanggahan tidak ditemukan' });
                }
                
                console.log('Sanggahan deleted successfully');
                res.json({ message: 'Sanggahan berhasil dihapus' });
            });
        });
    }
});

// Signed Upload URL endpoint (Supabase Storage)
app.post('/api/storage/signed-url', authenticateToken, async (req, res) => {
    try {
        if (!USE_SUPABASE) return res.status(400).json({ message: 'Signed upload hanya untuk mode Supabase' });
        if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase belum dikonfigurasi' });
        const { path: objectPath, contentType, bucket } = req.body || {};
        const finalBucket = bucket || SUPABASE_BUCKET;
        if (!objectPath) return res.status(400).json({ message: 'Path wajib diisi' });
        const { data, error } = await supabaseAdmin
            .storage
            .from(finalBucket)
            .createSignedUploadUrl(objectPath, { upsert: true, contentType: contentType || 'application/octet-stream', expiresIn: 600 });
        if (error) return res.status(500).json({ message: 'Gagal membuat signed URL' });
        return res.json({ bucket: finalBucket, path: data?.path || objectPath, signedUrl: data?.signedUrl, token: data?.token });
    } catch (e) {
        return res.status(500).json({ message: 'Server error' });
    }
});

// Update bantuan sosial (edit)
app.put('/api/bantuan/:id', authenticateToken, upload.fields([
    { name: 'fotoKK', maxCount: 1 },
    { name: 'fotoRumahDepan', maxCount: 1 },
    { name: 'fotoRumahDalam', maxCount: 1 },
    { name: 'fotoSelfieKTP', maxCount: 1 }
]), async (req, res) => {
    const bantuanId = req.params.id;
    const userId = req.user.id;
    const { 
        jenis_bantuan, 
        alasan_pengajuan, 
        gps_latitude, 
        gps_longitude 
    } = req.body;

    if (!jenis_bantuan || !alasan_pengajuan) {
        return res.status(400).json({ message: 'Jenis bantuan dan alasan pengajuan wajib diisi' });
    }

    // GPS coordinates are optional for edit (can keep existing ones)
    // Only validate if new GPS coordinates are provided

    // Validate file sizes (500KB max) if files are uploaded
    const requiredFiles = ['fotoKK', 'fotoRumahDepan', 'fotoRumahDalam', 'fotoSelfieKTP'];
    for (const fileField of requiredFiles) {
        if (req.files[fileField] && req.files[fileField].length > 0) {
            const file = req.files[fileField][0];
            if (file.size > 500 * 1024) {
                return res.status(400).json({ message: `Ukuran file ${fileField} maksimal 500 KB` });
            }
        }
    }

    if (USE_SUPABASE) {
        try {
            // Check if bantuan belongs to user
            const { data: existingBantuan, error: checkError } = await supabaseAdmin
                .from('bantuan_sosial')
                .select('id, user_id')
                .eq('id', bantuanId)
                .eq('user_id', userId)
                .maybeSingle();
            
            if (checkError) {
                console.error('Error checking bantuan ownership:', checkError);
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!existingBantuan) {
                return res.status(404).json({ message: 'Bantuan tidak ditemukan atau bukan milik Anda' });
            }

            // Prepare update data
            const updateData = {
                jenis_bantuan,
                alasan_pengajuan,
                gps_latitude: gps_latitude || null,
                gps_longitude: gps_longitude || null,
                updated_at: new Date().toISOString()
            };

            // Upload new files if provided
            const fileNames = {};
            for (const fileField of requiredFiles) {
                if (req.files[fileField] && req.files[fileField].length > 0) {
                    const f = req.files[fileField][0];
                    const dest = `users/${userId}/${Date.now()}-${f.originalname}`;
                    try {
                        const uploadedPath = await uploadFileToSupabaseStorage(f, dest);
                        fileNames[fileField] = uploadedPath;
                        // Map field names correctly for Supabase
                        const fieldMapping = {
                            'fotoKK': 'foto_kk',
                            'fotoRumahDepan': 'foto_rumah_depan',
                            'fotoRumahDalam': 'foto_rumah_dalam',
                            'fotoSelfieKTP': 'foto_selfie_ktp'
                        };
                        updateData[fieldMapping[fileField]] = uploadedPath;
                    } catch (uploadError) {
                        console.error(`Error uploading ${fileField}:`, uploadError);
                        return res.status(500).json({ message: `Gagal upload file ${fileField}` });
                    }
                }
            }

            // Update bantuan
            const { data, error } = await supabaseAdmin
                .from('bantuan_sosial')
                .update(updateData)
                .eq('id', bantuanId)
                .eq('user_id', userId)
                .select('id')
                .maybeSingle();

            if (error) {
                console.error('Supabase update error:', error);
                return res.status(500).json({ message: 'Server error' });
            }

            return res.json({ message: 'Data bantuan sosial berhasil diperbarui', bantuanId: data?.id || bantuanId });
        } catch (e) {
            console.error('Update error:', e);
            return res.status(500).json({ message: 'Server error: ' + e.message });
        }
    } else {
        // SQLite version
        // Check if bantuan belongs to user
        db.get('SELECT id FROM bantuan_sosial WHERE id = ? AND user_id = ?', [bantuanId, userId], (err, existingBantuan) => {
            if (err) {
                console.error('Error checking bantuan ownership:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            
            if (!existingBantuan) {
                return res.status(404).json({ message: 'Bantuan tidak ditemukan atau bukan milik Anda' });
            }

            // Prepare update data
            const updateFields = ['jenis_bantuan = ?', 'alasan_pengajuan = ?', 'gps_latitude = ?', 'gps_longitude = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const updateValues = [jenis_bantuan, alasan_pengajuan, gps_latitude || null, gps_longitude || null];

            // Handle file updates
            const fileNames = {};
            const fieldMapping = {
                'fotoKK': 'foto_kk',
                'fotoRumahDepan': 'foto_rumah_depan',
                'fotoRumahDalam': 'foto_rumah_dalam',
                'fotoSelfieKTP': 'foto_selfie_ktp'
            };
            for (const fileField of requiredFiles) {
                if (req.files[fileField] && req.files[fileField].length > 0) {
                    const file = req.files[fileField][0];
                    fileNames[fileField] = file.filename;
                    updateFields.push(`${fieldMapping[fileField]} = ?`);
                    updateValues.push(file.filename);
                }
            }

            updateValues.push(bantuanId);

            // Update bantuan
            db.run(
                `UPDATE bantuan_sosial SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
                [...updateValues, userId],
                function(err) {
                    if (err) {
                        console.error('Database update error:', err);
                        return res.status(500).json({ message: 'Server error' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ message: 'Bantuan tidak ditemukan atau bukan milik Anda' });
                    }
                    
                    res.json({ message: 'Data bantuan sosial berhasil diperbarui', bantuanId: bantuanId });
                }
            );
        });
    }
});

// Submit bantuan via JSON (tanpa multipart, file sudah diupload via signed URL)
app.post('/api/bantuan/json', authenticateToken, async (req, res) => {
    if (!USE_SUPABASE) return res.status(400).json({ message: 'Endpoint hanya untuk mode Supabase' });
    try {
        const userId = req.user.id;
        const { jenis_bantuan, alasan_pengajuan, gps_latitude, gps_longitude, foto_kk, foto_rumah_depan, foto_rumah_dalam, foto_selfie_ktp } = req.body || {};
        if (!jenis_bantuan || !alasan_pengajuan) return res.status(400).json({ message: 'Jenis bantuan dan alasan pengajuan wajib diisi' });
        if (!foto_kk || !foto_rumah_depan || !foto_rumah_dalam || !foto_selfie_ktp) return res.status(400).json({ message: 'Semua foto wajib diupload' });
        const { data, error } = await supabaseAdmin
            .from('bantuan_sosial')
            .insert([{ user_id: userId, jenis_bantuan, alasan_pengajuan, foto_kk, foto_rumah_depan, foto_rumah_dalam, foto_selfie_ktp, foto_lokasi_rumah: null, gps_latitude: gps_latitude || null, gps_longitude: gps_longitude || null }])
            .select('id')
            .maybeSingle();
        if (error) return res.status(500).json({ message: 'Server error' });
        return res.json({ message: 'Ajuan bantuan sosial berhasil dikirim', bantuanId: data?.id || null });
    } catch (e) {
        return res.status(500).json({ message: 'Server error' });
    }
});

// Submit sanggahan via JSON (file bukti sudah diupload via signed URL)
app.post('/api/sanggahan/json', authenticateToken, async (req, res) => {
    if (!USE_SUPABASE) return res.status(400).json({ message: 'Endpoint hanya untuk mode Supabase' });
    try {
        const pelaporId = req.user.id;
        const { jenis_sanggahan, alasan_sanggahan, nik_warga_lain, bukti_file } = req.body || {};
        if (!jenis_sanggahan || !alasan_sanggahan) return res.status(400).json({ message: 'Jenis sanggahan dan alasan wajib diisi' });
        if (!['diri_sendiri', 'warga_lain'].includes(jenis_sanggahan)) return res.status(400).json({ message: 'Jenis sanggahan tidak valid' });
        let targetUserId = null;
        if (jenis_sanggahan === 'warga_lain') {
            if (!nik_warga_lain) return res.status(400).json({ message: 'NIK warga yang disanggah wajib diisi' });
            const { data: target, error } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('nik', nik_warga_lain)
                .eq('role', 'warga')
                .limit(1)
                .maybeSingle();
            if (error) return res.status(500).json({ message: 'Server error' });
            if (!target) return res.status(404).json({ message: 'Warga yang disanggah tidak ditemukan' });
            targetUserId = target.id;
        }
        const { data, error: insertErr } = await supabaseAdmin
            .from('sanggahan')
            .insert([{ pelapor_user_id: pelaporId, target_user_id: targetUserId, tipe: jenis_sanggahan, alasan: alasan_sanggahan, bukti_file: bukti_file || null }])
            .select('id')
            .maybeSingle();
        if (insertErr) return res.status(500).json({ message: 'Gagal membuat sanggahan' });
        return res.json({ message: 'Sanggahan berhasil dikirim', sanggahanId: data?.id || null });
    } catch (e) {
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get user's bantuan sosial
app.get('/api/bantuan', authenticateToken, (req, res) => {
    const userId = req.user.id;

    console.log('Getting bantuan for user:', userId);

    if (USE_SUPABASE) {
        (async () => {
            const { data, error } = await supabaseAdmin
                .from('bantuan_sosial')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ message: 'Server error' });
            return res.json(data || []);
        })();
    } else {
        db.all(
            'SELECT * FROM bantuan_sosial WHERE user_id = ? ORDER BY created_at DESC',
            [userId],
            (err, bantuan) => {
                if (err) {
                    console.error('Error getting bantuan:', err);
                    return res.status(500).json({ message: 'Server error' });
                }
                console.log('Bantuan data for user:', bantuan);
                res.json(bantuan);
            }
        );
    }
});

// Get all bantuan sosial for admin
app.get('/api/admin/bantuan', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    if (USE_SUPABASE) {
        (async () => {
            const { data, error } = await supabaseAdmin
                .from('bantuan_sosial')
                .select('*, user:users!bantuan_sosial_user_id_fkey(nama, nik)')
                .order('created_at', { ascending: false });
            if (error) return res.status(500).json({ message: 'Server error' });
            const mapped = (data || []).map(b => ({ ...b, nama: b.user?.nama || null, nik: b.user?.nik || null }));
            return res.json(mapped);
        })();
    } else {
        db.all(`
            SELECT bs.*, u.nama, u.nik 
            FROM bantuan_sosial bs 
            JOIN users u ON bs.user_id = u.id 
            ORDER BY bs.created_at DESC
        `, (err, bantuan) => {
            if (err) {
                return res.status(500).json({ message: 'Server error' });
            }
            res.json(bantuan);
        });
    }
});

// Update bantuan status
app.put('/api/admin/bantuan/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const { status, reason } = req.body;
    const bantuanId = req.params.id;

    console.log('Update bantuan status request:', { bantuanId, status, reason, userId: req.user.id });

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        console.log('Invalid status:', status);
        return res.status(400).json({ message: 'Status tidak valid' });
    }

    // If status is rejected, reason is required
    if (status === 'rejected' && !reason) {
        console.log('Rejection reason required but not provided');
        return res.status(400).json({ message: 'Alasan penolakan wajib diisi' });
    }

    console.log('Executing SQL update for bantuan:', bantuanId);
    if (USE_SUPABASE) {
        (async () => {
            const { error } = await supabaseAdmin
                .from('bantuan_sosial')
                .update({ status, rejection_reason: reason || null, updated_at: new Date().toISOString() })
                .eq('id', bantuanId);
            if (error) return res.status(500).json({ message: 'Server error: ' + error.message });
            return res.json({ message: 'Status bantuan berhasil diupdate' });
        })();
    } else {
        db.run(
            'UPDATE bantuan_sosial SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, reason || null, bantuanId],
            function(err) {
                if (err) {
                    console.error('Database error updating bantuan status:', err);
                    return res.status(500).json({ message: 'Server error: ' + err.message });
                }
                console.log('Update result:', { changes: this.changes, lastID: this.lastID });
                if (this.changes === 0) {
                    console.log('No bantuan found with id:', bantuanId);
                    return res.status(404).json({ message: 'Bantuan tidak ditemukan' });
                }
                console.log('Bantuan status updated successfully');
                res.json({ message: 'Status bantuan berhasil diupdate' });
            }
        );
    }
});

// Get statistics
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }
    if (USE_SUPABASE) {
        (async () => {
            try {
                const countExact = { count: 'exact', head: true };
                const [
                    uTotal, uVerified,
                    bTotal, bPKH, bBNPT, bNon,
                    bApproved, bRejected, bPending,
                    sTotal, sDiri, sWarga
                ] = await Promise.all([
                    supabaseAdmin.from('users').select('*', countExact).eq('role', 'warga'),
                    supabaseAdmin.from('users').select('*', countExact).eq('role', 'warga').eq('verified', true),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact).eq('jenis_bantuan', 'PKH'),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact).eq('jenis_bantuan', 'BNPT'),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact).not('jenis_bantuan', 'in', '(PKH,BNPT)'),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact).eq('status', 'approved'),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact).eq('status', 'rejected'),
                    supabaseAdmin.from('bantuan_sosial').select('*', countExact).eq('status', 'pending'),
                    supabaseAdmin.from('sanggahan').select('*', countExact),
                    supabaseAdmin.from('sanggahan').select('*', countExact).eq('tipe', 'diri_sendiri'),
                    supabaseAdmin.from('sanggahan').select('*', countExact).eq('tipe', 'warga_lain')
                ]);
                const stats = {
                    totalUsers: uTotal?.count || 0,
                    verifiedUsers: uVerified?.count || 0,
                    pendingUsers: (uTotal?.count || 0) - (uVerified?.count || 0),
                    totalBantuan: bTotal?.count || 0,
                    pkh: bPKH?.count || 0,
                    bnpt: bBNPT?.count || 0,
                    nonBansos: bNon?.count || 0,
                    approvedBantuan: bApproved?.count || 0,
                    rejectedBantuan: bRejected?.count || 0,
                    pendingBantuan: bPending?.count || 0,
                    totalSanggahan: sTotal?.count || 0,
                    sanggahanDiriSendiri: sDiri?.count || 0,
                    sanggahanWargaLain: sWarga?.count || 0
                };
                return res.json(stats);
            } catch (e) {
                console.error('[Stats][Supabase] error:', e);
                return res.status(500).json({ message: 'Server error' });
            }
        })();
        return;
    }

    const stats = {};
    let completedQueries = 0;
    const totalQueries = 10;
    const checkComplete = () => {
        completedQueries++;
        if (completedQueries === totalQueries) {
            res.json(stats);
        }
    };

    db.get('SELECT COUNT(*) as total FROM users WHERE role = "warga"', (err, result) => {
        if (err) {
            console.error('Error getting total users:', err);
            stats.totalUsers = 0;
        } else {
            stats.totalUsers = result.total;
        }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as verified FROM users WHERE role = "warga" AND verified = 1', (err, result) => {
        if (err) {
            console.error('Error getting verified users:', err);
            stats.verifiedUsers = 0;
        } else {
            stats.verifiedUsers = result.verified;
        }
        stats.pendingUsers = stats.totalUsers - stats.verifiedUsers;
        checkComplete();
    });
    db.get('SELECT COUNT(*) as total FROM bantuan_sosial', (err, result) => {
        if (err) {
            console.error('Error getting total bantuan:', err);
            stats.totalBantuan = 0;
        } else {
            stats.totalBantuan = result.total;
        }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM bantuan_sosial WHERE jenis_bantuan = "PKH"', (err, result) => {
        if (err) { console.error('Error getting PKH count:', err); stats.pkh = 0; } else { stats.pkh = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM bantuan_sosial WHERE jenis_bantuan = "BNPT"', (err, result) => {
        if (err) { console.error('Error getting BNPT count:', err); stats.bnpt = 0; } else { stats.bnpt = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM bantuan_sosial WHERE jenis_bantuan NOT IN ("PKH", "BNPT")', (err, result) => {
        if (err) { console.error('Error getting non-bansos count:', err); stats.nonBansos = 0; } else { stats.nonBansos = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM bantuan_sosial WHERE status = "approved"', (err, result) => {
        if (err) { console.error('Error getting approved bantuan:', err); stats.approvedBantuan = 0; } else { stats.approvedBantuan = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM bantuan_sosial WHERE status = "rejected"', (err, result) => {
        if (err) { console.error('Error getting rejected bantuan:', err); stats.rejectedBantuan = 0; } else { stats.rejectedBantuan = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM bantuan_sosial WHERE status = "pending"', (err, result) => {
        if (err) { console.error('Error getting pending bantuan:', err); stats.pendingBantuan = 0; } else { stats.pendingBantuan = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM sanggahan', (err, result) => {
        if (err) { console.error('Error getting total sanggahan:', err); stats.totalSanggahan = 0; } else { stats.totalSanggahan = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM sanggahan WHERE tipe = "diri_sendiri"', (err, result) => {
        if (err) { console.error('Error getting diri sendiri sanggahan:', err); stats.sanggahanDiriSendiri = 0; } else { stats.sanggahanDiriSendiri = result ? result.count : 0; }
        checkComplete();
    });
    db.get('SELECT COUNT(*) as count FROM sanggahan WHERE tipe = "warga_lain"', (err, result) => {
        if (err) { console.error('Error getting warga lain sanggahan:', err); stats.sanggahanWargaLain = 0; } else { stats.sanggahanWargaLain = result ? result.count : 0; }
        checkComplete();
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`Akses dari mobile: http://[IP-ADDRESS]:${PORT}`);
    console.log(`Contoh: http://192.168.1.100:${PORT}`);
    console.log('[Boot] USE_SUPABASE =', USE_SUPABASE);
    console.log('[Boot] SUPABASE_URL terisi =', !!process.env.SUPABASE_URL);
    console.log('[Boot] SUPABASE_ANON_KEY terisi =', !!process.env.SUPABASE_ANON_KEY);
    console.log('[Boot] SUPABASE_SERVICE_ROLE_KEY terisi =', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    ensureSupabaseAdminUser();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nMenutup server...');
    db.close((err) => {
        if (err) {
            console.error('Error menutup database:', err.message);
        } else {
            console.log('Database ditutup.');
        }
        process.exit(0);
    });
});
