# Aplikasi Usul Bansos Kelurahan Bara Baraya Selatan

Aplikasi web dan mobile modern untuk mengajukan bantuan sosial di Kelurahan Bara Baraya Selatan. Aplikasi ini memungkinkan warga untuk mendaftar, login, dan mengajukan bantuan sosial, sementara admin kelurahan dapat memverifikasi akun warga dan mengelola ajuan bantuan sosial.

## 🚀 Fitur Utama

### Untuk Warga:
- **Registrasi Akun**: Daftar menggunakan NIK dan informasi pribadi
- **Login Aman**: Login menggunakan NIK dan password
- **Ajukan Bantuan Sosial**: Ajukan berbagai jenis bantuan sosial
- **Riwayat Ajuan**: Lihat status dan riwayat ajuan bantuan
- **Profil Pribadi**: Kelola informasi profil

### Untuk Admin Kelurahan:
- **Login Admin**: Login menggunakan username dan password
- **Verifikasi Warga**: Verifikasi akun warga yang mendaftar
- **Kelola Ajuan**: Kelola dan update status ajuan bantuan sosial
- **Statistik**: Lihat statistik pendaftaran dan ajuan
- **Dashboard Lengkap**: Interface admin yang user-friendly

## 🛠️ Teknologi yang Digunakan

### Frontend:
- **HTML5**: Struktur halaman web
- **CSS3**: Styling modern dengan Flexbox dan Grid
- **JavaScript (ES6+)**: Interaktivitas dan logika aplikasi
- **Font Awesome**: Icons yang menarik
- **Google Fonts**: Typography yang modern (Poppins)

### Backend:
- **Node.js**: Runtime JavaScript
- **Express.js**: Framework web
- **SQLite**: Database lokal
- **JWT**: Autentikasi dan otorisasi
- **bcryptjs**: Enkripsi password
- **Multer**: Upload file

## 📱 Responsive Design

Aplikasi ini dirancang untuk berfungsi optimal di:
- **Desktop** (1200px+)
- **Tablet** (768px - 1199px)
- **Mobile** (320px - 767px)

## 🚀 Cara Menjalankan Aplikasi

### Prerequisites:
- Node.js (versi 14 atau lebih baru)
- npm atau yarn

### Langkah-langkah:

1. **Clone atau download aplikasi**
   ```bash
   git clone [repository-url]
   cd aplikasi-usul-bansos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Jalankan server**
   ```bash
   npm start
   ```
   atau untuk development:
   ```bash
   npm run dev
   ```

4. **Buka aplikasi**
   - Buka browser dan kunjungi: `http://localhost:3000`

## 🔐 Kredensial Default

### Admin Kelurahan:
- **Username**: `admin`
- **Password**: `admin123`

### Warga:
- Daftar akun baru melalui halaman registrasi
- Akun akan diverifikasi oleh admin sebelum bisa login

## 📁 Struktur Proyek

```
aplikasi-usul-bansos/
├── assets/
│   ├── css/
│   │   └── style.css          # Stylesheet utama
│   └── js/
│       └── script.js          # JavaScript utama
├── uploads/                   # Folder untuk file upload
├── index.html                 # Halaman utama
├── server.js                  # Backend server
├── package.json               # Dependencies
├── bansos.db                  # Database SQLite (auto-generated)
└── README.md                  # Dokumentasi
```

## 🎨 Fitur UI/UX

- **Design Modern**: Menggunakan gradient dan glassmorphism
- **Responsive**: Optimal di semua ukuran layar
- **User-Friendly**: Interface yang intuitif dan mudah digunakan
- **Loading States**: Indikator loading untuk feedback user
- **Modal System**: Popup yang elegan untuk form
- **Tab Navigation**: Navigasi yang terorganisir
- **Color Scheme**: Palet warna yang profesional

## 🔒 Keamanan

- **Password Hashing**: Password dienkripsi menggunakan bcrypt
- **JWT Authentication**: Token-based authentication
- **Input Validation**: Validasi input di frontend dan backend
- **SQL Injection Protection**: Menggunakan prepared statements
- **File Upload Security**: Validasi tipe file yang diupload

## 📊 Database Schema

### Tabel `users`:
- `id`: Primary key
- `nik`: NIK warga (unique)
- `username`: Username admin (unique)
- `nama`: Nama lengkap
- `email`: Email (unique)
- `phone`: Nomor telepon
- `alamat`: Alamat lengkap
- `password`: Password terenkripsi
- `role`: 'admin' atau 'warga'
- `verified`: Status verifikasi (0/1)
- `created_at`: Tanggal dibuat
- `verified_at`: Tanggal diverifikasi

### Tabel `bantuan_sosial`:
- `id`: Primary key
- `user_id`: Foreign key ke users
- `jenis_bantuan`: Jenis bantuan (pangan, perumahan, dll)
- `deskripsi`: Deskripsi kebutuhan
- `status`: 'pending', 'approved', 'rejected'
- `dokumen`: Nama file dokumen pendukung
- `created_at`: Tanggal dibuat
- `updated_at`: Tanggal diupdate

## 🚀 Deployment

### Untuk Production:

1. **Setup Environment Variables**:
   ```bash
   export JWT_SECRET="your-super-secret-jwt-key"
   export PORT=3000
   ```

2. **Install PM2** (untuk process management):
   ```bash
   npm install -g pm2
   pm2 start server.js --name "bansos-app"
   ```

3. **Setup Reverse Proxy** (Nginx):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🤝 Kontribusi

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📝 Changelog

### v1.0.0
- Initial release
- Fitur registrasi dan login warga
- Fitur login admin
- Dashboard admin untuk verifikasi
- Dashboard warga untuk ajuan bantuan
- Responsive design
- Database SQLite
- API endpoints lengkap

## 📞 Kontak

**Kelurahan Bara Baraya Selatan**
- Alamat: Jl. Bara Baraya Selatan No. 123, Makassar
- Telepon: +62 411 1234567
- Email: info@barabarayaselatan.go.id

## 📄 Lisensi

Aplikasi ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

**Dibuat dengan ❤️ untuk Kelurahan Bara Baraya Selatan**
