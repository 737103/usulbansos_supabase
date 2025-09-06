# Demo Aplikasi Usul Bansos Kelurahan Bara Baraya Selatan

## 🚀 Cara Menjalankan Aplikasi

### 1. Persiapan
- Pastikan Node.js sudah terinstall (versi 14 atau lebih baru)
- Download atau clone aplikasi ini
- Buka terminal/command prompt di folder aplikasi

### 2. Install Dependencies
```bash
npm install
```

### 3. Jalankan Server
```bash
npm start
```

### 4. Akses Aplikasi
- Buka browser dan kunjungi: `http://localhost:3000`

## 👥 Kredensial Login

### Admin Kelurahan:
- **Username**: `admin`
- **Password**: `admin123`

### Warga:
- Daftar akun baru melalui tombol "Daftar Sekarang"
- Gunakan NIK dan password yang sudah didaftarkan
- Akun harus diverifikasi admin sebelum bisa login

## 📱 Fitur Aplikasi

### Halaman Utama
- **Hero Section**: Tampilan menarik dengan call-to-action
- **Tentang Aplikasi**: Penjelasan fitur dan keunggulan
- **Layanan**: Jenis-jenis bantuan sosial yang tersedia
- **Kontak**: Informasi kontak kelurahan

### Login & Registrasi
- **Modal Login**: Tab terpisah untuk Admin dan Warga
- **Modal Registrasi**: Form lengkap untuk pendaftaran warga
- **Validasi**: Validasi input dan password confirmation

### Dashboard Admin
- **Verifikasi Warga**: Tabel daftar warga yang perlu diverifikasi
- **Statistik**: Grafik statistik pendaftaran dan ajuan
- **Kelola Ajuan**: Manage ajuan bantuan sosial
- **Pengaturan**: Konfigurasi aplikasi

### Dashboard Warga
- **Ajukan Bantuan**: Form untuk mengajukan bantuan sosial
- **Riwayat Ajuan**: Daftar ajuan yang sudah dibuat
- **Profil**: Informasi profil pribadi

## 🎨 Desain & UI/UX

### Responsive Design
- **Desktop**: Layout grid dengan sidebar
- **Tablet**: Layout adaptif dengan menu hamburger
- **Mobile**: Layout stack dengan navigasi mobile

### Color Scheme
- **Primary**: Gradient biru-ungu (#667eea → #764ba2)
- **Accent**: Emas (#ffd700)
- **Success**: Hijau (#28a745)
- **Warning**: Kuning (#ffc107)
- **Danger**: Merah (#dc3545)

### Typography
- **Font**: Poppins (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700

## 🔧 Teknologi

### Frontend
- HTML5, CSS3, JavaScript ES6+
- Font Awesome Icons
- Google Fonts
- Responsive Grid & Flexbox

### Backend
- Node.js & Express.js
- SQLite Database
- JWT Authentication
- bcryptjs Password Hashing
- Multer File Upload

## 📊 Database Schema

### Tabel `users`
- Menyimpan data admin dan warga
- Password dienkripsi dengan bcrypt
- Status verifikasi untuk warga

### Tabel `bantuan_sosial`
- Menyimpan ajuan bantuan sosial
- Status: pending, approved, rejected
- Support file upload

## 🔐 Keamanan

- **Password Hashing**: Menggunakan bcryptjs
- **JWT Tokens**: Autentikasi berbasis token
- **Input Validation**: Validasi di frontend dan backend
- **SQL Injection Protection**: Prepared statements
- **File Upload Security**: Validasi tipe file

## 📱 Testing

### Test Admin Login
1. Klik tombol "Masuk"
2. Pilih tab "Admin Kelurahan"
3. Masukkan username: `admin`, password: `admin123`
4. Klik "Masuk"

### Test Warga Registration
1. Klik tombol "Daftar Sekarang"
2. Isi form dengan data valid
3. Klik "Daftar"
4. Akun akan muncul di dashboard admin untuk diverifikasi

### Test Warga Login
1. Setelah akun diverifikasi admin
2. Klik tombol "Masuk"
3. Pilih tab "Warga"
4. Masukkan NIK dan password
5. Klik "Masuk"

## 🚀 Deployment

### Local Development
```bash
npm run dev  # dengan nodemon untuk auto-restart
```

### Production
```bash
npm start
```

### Environment Variables
```bash
JWT_SECRET=your-secret-key
PORT=3000
```

## 📈 Monitoring

### Logs
- Server logs di console
- Error handling dengan try-catch
- Database query logging

### Performance
- Static file serving
- Database indexing
- Image optimization

## 🔄 Updates

### Version 1.0.0
- Initial release
- Basic CRUD operations
- Authentication system
- File upload support
- Responsive design

### Future Updates
- Email notifications
- SMS integration
- Advanced reporting
- Mobile app (React Native)
- Real-time notifications

## 🆘 Troubleshooting

### Common Issues

1. **Port already in use**
   - Ganti port di server.js
   - Atau kill process yang menggunakan port 3000

2. **Database error**
   - Hapus file bansos.db
   - Restart server untuk membuat database baru

3. **File upload error**
   - Pastikan folder uploads/ ada
   - Check permissions folder

4. **CORS error**
   - Pastikan API_BASE_URL di script.js benar
   - Check server running di port yang benar

### Support
- Email: info@barabarayaselatan.go.id
- Phone: +62 411 1234567

---

**Selamat menggunakan Aplikasi Usul Bansos Kelurahan Bara Baraya Selatan!** 🎉
