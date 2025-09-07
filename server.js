const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
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
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

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
            user: {
                id: user.id,
                username: user.username,
                nama: user.nama,
                role: user.role
            }
        });
    });
});

// Warga registration
app.post('/api/warga/register', (req, res) => {
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

            // Hash password and insert user
            const hashedPassword = bcrypt.hashSync(password, 10);
            
            db.run(
                'INSERT INTO users (nik, kk, nama, email, phone, rt, rw, alamat, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [nik, kk, nama, email, phone, rt, rw, alamat, hashedPassword],
                function(err) {
                    if (err) {
                        return res.status(500).json({ message: 'Gagal mendaftar' });
                    }

                    res.json({
                        message: 'Pendaftaran berhasil. Akun Anda akan diverifikasi oleh admin.',
                        userId: this.lastID
                    });
                }
            );
        });
    });
});

// Check NIK availability
app.post('/api/warga/check-nik', (req, res) => {
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

    // Check if NIK already exists
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

        // NIK is available
        res.json({ 
            message: 'NIK tersedia untuk pendaftaran',
            code: 'NIK_AVAILABLE'
        });
    });
});

// Warga login
app.post('/api/warga/login', (req, res) => {
    const { nik, password } = req.body;

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
});

// Get all users for admin verification
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    db.all('SELECT * FROM users WHERE role = "warga" ORDER BY created_at DESC', (err, users) => {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }

        // Remove password from response
        const safeUsers = users.map(user => {
            const { password, ...safeUser } = user;
            return safeUser;
        });

        res.json(safeUsers);
    });
});

// Verify user
app.put('/api/admin/users/:id/verify', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const userId = req.params.id;

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
});

// Reject user
app.delete('/api/admin/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const userId = req.params.id;

    db.run('DELETE FROM users WHERE id = ? AND role = "warga"', [userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        res.json({ message: 'User berhasil ditolak' });
    });
});

// Reset user password (admin)
app.put('/api/admin/users/:id/reset-password', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

    const userId = req.params.id;
    const defaultPassword = bcrypt.hashSync('123456', 10);

    db.run('UPDATE users SET password = ? WHERE id = ? AND role = "warga"', [defaultPassword, userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Server error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        res.json({ message: 'Password berhasil direset ke default' });
    });
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
            fileNames.fotoSelfieKTP, null, // foto_lokasi_rumah tidak digunakan, hanya GPS
            gps_latitude || null, gps_longitude || null
        ],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }

            res.json({
                message: 'Ajuan bantuan sosial berhasil dikirim',
                bantuanId: this.lastID
            });
        }
    );
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

    const insert = (targetUserId, buktiFile) => {
        db.run(
            'INSERT INTO sanggahan (pelapor_user_id, target_user_id, tipe, alasan, bukti_file) VALUES (?, ?, ?, ?, ?)',
            [pelaporId, targetUserId || null, jenis_sanggahan, alasan_sanggahan, buktiFile || null],
            function(err) {
                if (err) return res.status(500).json({ message: 'Gagal membuat sanggahan' });
                res.json({ message: 'Sanggahan berhasil dikirim', sanggahanId: this.lastID });
            }
        );
    };

    if (jenis_sanggahan === 'warga_lain') {
        if (!nik_warga_lain) {
            return res.status(400).json({ message: 'NIK warga yang disanggah wajib diisi' });
        }
        db.get('SELECT id FROM users WHERE nik = ? AND role = "warga"', [nik_warga_lain], (err, target) => {
            if (err) return res.status(500).json({ message: 'Server error' });
            if (!target) return res.status(404).json({ message: 'Warga yang disanggah tidak ditemukan' });
            insert(target.id, req.file ? req.file.filename : null);
        });
    } else {
        insert(null, req.file ? req.file.filename : null);
    }
});

// Get user's sanggahan
app.get('/api/sanggahan', authenticateToken, (req, res) => {
    const userId = req.user.id;

    console.log('Getting sanggahan for user:', userId);

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
});

// Get all sanggahan (admin)
app.get('/api/admin/sanggahan', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }
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
            
            // If sanggahan is accepted, update the target user's bantuan status to approved
            if (status === 'accepted' && sanggahan.target_user_id) {
                console.log('Sanggahan accepted, updating target user bantuan status');
                
                // Update all pending bantuan for the target user to approved
                db.run(`
                    UPDATE bantuan_sosial 
                    SET status = 'approved', updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = ? AND status = 'pending'
                `, [sanggahan.target_user_id], function(err) {
                    if (err) {
                        console.error('Error updating target user bantuan status:', err);
                    } else {
                        console.log('Target user bantuan status updated:', this.changes, 'records');
                    }
                });
            }
            
            res.json({ message: 'Status sanggahan berhasil diperbarui' });
        });
    });
});

// Delete sanggahan (admin)
app.delete('/api/admin/sanggahan/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }
    
    const id = req.params.id;
    
    console.log('Delete sanggahan request:', { id, userId: req.user.id });
    
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
});

// Get user's bantuan sosial
app.get('/api/bantuan', authenticateToken, (req, res) => {
    const userId = req.user.id;

    console.log('Getting bantuan for user:', userId);

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
});

// Get all bantuan sosial for admin
app.get('/api/admin/bantuan', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
    }

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
});

// Get statistics
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak' });
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

    // Get user statistics
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

            // Get bantuan statistics
            db.get('SELECT COUNT(*) as total FROM bantuan_sosial', (err, result) => {
                if (err) {
            console.error('Error getting total bantuan:', err);
            stats.totalBantuan = 0;
        } else {
                stats.totalBantuan = result.total;
        }
        checkComplete();
    });

    // Get bantuan by jenis - using get() for COUNT queries with proper syntax
    db.get('SELECT COUNT(*) as pkh FROM bantuan_sosial WHERE jenis_bantuan = "PKH"', (err, result) => {
                    if (err) {
            console.error('Error getting PKH count:', err);
            stats.pkh = 0;
        } else {
            stats.pkh = result ? result.pkh : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as bnpt FROM bantuan_sosial WHERE jenis_bantuan = "BNPT"', (err, result) => {
        if (err) {
            console.error('Error getting BNPT count:', err);
            stats.bnpt = 0;
        } else {
            stats.bnpt = result ? result.bnpt : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as non_bansos FROM bantuan_sosial WHERE jenis_bantuan NOT IN ("PKH", "BNPT")', (err, result) => {
        if (err) {
            console.error('Error getting non-bansos count:', err);
            stats.nonBansos = 0;
        } else {
            stats.nonBansos = result ? result.non_bansos : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as approved FROM bantuan_sosial WHERE status = "approved"', (err, result) => {
        if (err) {
            console.error('Error getting approved bantuan:', err);
            stats.approvedBantuan = 0;
        } else {
            stats.approvedBantuan = result ? result.approved : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as rejected FROM bantuan_sosial WHERE status = "rejected"', (err, result) => {
        if (err) {
            console.error('Error getting rejected bantuan:', err);
            stats.rejectedBantuan = 0;
        } else {
            stats.rejectedBantuan = result ? result.rejected : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as pending FROM bantuan_sosial WHERE status = "pending"', (err, result) => {
        if (err) {
            console.error('Error getting pending bantuan:', err);
            stats.pendingBantuan = 0;
        } else {
            stats.pendingBantuan = result ? result.pending : 0;
        }
        checkComplete();
    });

    // Get sanggahan statistics
    db.get('SELECT COUNT(*) as total FROM sanggahan', (err, result) => {
        if (err) {
            console.error('Error getting total sanggahan:', err);
            stats.totalSanggahan = 0;
        } else {
            stats.totalSanggahan = result ? result.total : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as diri_sendiri FROM sanggahan WHERE tipe = "diri_sendiri"', (err, result) => {
        if (err) {
            console.error('Error getting diri sendiri sanggahan:', err);
            stats.sanggahanDiriSendiri = 0;
        } else {
            stats.sanggahanDiriSendiri = result ? result.diri_sendiri : 0;
        }
        checkComplete();
    });

    db.get('SELECT COUNT(*) as warga_lain FROM sanggahan WHERE tipe = "warga_lain"', (err, result) => {
        if (err) {
            console.error('Error getting warga lain sanggahan:', err);
            stats.sanggahanWargaLain = 0;
        } else {
            stats.sanggahanWargaLain = result ? result.warga_lain : 0;
        }
        checkComplete();
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log(`Akses dari mobile: http://[IP-ADDRESS]:${PORT}`);
    console.log(`Contoh: http://192.168.1.100:${PORT}`);
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
