# Panduan Lengkap Self-Hosting di Laptop Kubuntu (Domain: theoverse.my.id)

Panduan ini dirancang khusus untuk menjalankan server portofolio di laptop Kubuntu (Ubuntu KDE) Anda agar bisa diakses oleh publik secara online menggunakan domain **theoverse.my.id**.

---

## ⚡ Langkah 1: Persiapan Environment di Laptop Kubuntu

Buka terminal (Konsole) di Kubuntu dan jalankan perintah berikut:

```bash
# 1. Update sistem paket
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v20+ LTS) dan Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Cek versi Node.js & npm
node -v
npm -v
```

---

## ⚡ Langkah 2: Copy Project & Build Production

Letakkan project di direktori home user Anda (misal: `/home/username/Portofolio`):

```bash
cd ~/Portofolio

# Install dependency produksi
npm install

# Build static bundle (mengkompilasi JSX dan Tailwind)
node build.js

# Buat file konfigurasi .env
cp deploy/.env.production.example .env
nano .env
```
*(Pastikan `ADMIN_PASSCODE` sudah sesuai dengan passcode rahasia Anda).*

---

## ⚡ Langkah 3: Setup Systemd Service (Auto-Start & Background)

Agar aplikasi otomatis berjalan di background dan otomatis nyala kembali jika laptop restart atau crash:

1. Buka file service:
```bash
sudo nano /etc/systemd/system/theoverse.service
```

2. Salin isi dari `deploy/theoverse.service` ke dalamnya, lalu ganti `USER_PLACEHOLDER` dengan username Kubuntu Anda (bisa cek dengan ketik `whoami` di terminal).

3. Aktifkan dan jalankan servicenya:
```bash
sudo systemctl daemon-reload
sudo systemctl enable theoverse
sudo systemctl start theoverse

# Periksa statusnya (pastikan statusnya active (running)):
sudo systemctl status theoverse
```

---

## ⚡ Langkah 4: Menghubungkan Domain `theoverse.my.id` ke Laptop

Ada **2 Metode** yang bisa dipilih. **Metode A (Cloudflare Tunnel)** adalah yang **PALING DIREKOMENDASIKAN** untuk server laptop rumahan.

---

### METODE A: Menggunakan Cloudflare Tunnel (⭐ Sangat Direkomendasikan)
> **Keuntungan Utama:**
> - **100% Gratis & Resmi dari Cloudflare**.
> - **TIDAK butuh IP Publik statis**.
> - **TIDAK perlu Port Forwarding di Router WiFi** (anti masalah CGNAT Indihome/Biznet/FirstMedia/MyRepublic).
> - **Otomatis dapat SSL/HTTPS resmi** tanpa perlu urus sertifikat manual.
> - Alamat IP asli laptop Anda tersembunyi aman di balik CDN Cloudflare.

#### Langkah Setup Cloudflare Tunnel:
1. Pastikan nameserver domain `theoverse.my.id` Anda sudah diarahkan ke Cloudflare (bisa dicek di dashboard Cloudflare).
2. Di dashboard Cloudflare, buka **Zero Trust** > **Networks** > **Tunnels** > **Create a tunnel**.
3. Pilih nama tunnel: `theoverse-laptop`.
4. Pilih environment: **Debian/Ubuntu 64-bit**, Cloudflare akan memberikan 1 baris perintah untuk terminal, contoh:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   sudo cloudflared service install <TOKEN_DARI_CLOUDFLARE>
   ```
5. Pada tab **Public Hostname**:
   - Subdomain: *(kosongkan jika apex, atau isi `www`)*
   - Domain: pilih `theoverse.my.id`
   - Service Type: `HTTP`
   - URL: `127.0.0.1:3000` (atau `localhost:3000`)
6. Klik **Save hostname**.
7. Selesai! Web Anda langsung aktif di `https://theoverse.my.id` dengan SSL hijau otomatis!

---

### METODE B: Menggunakan Nginx + IP Publik / Port Forwarding Router

Gunakan metode ini jika Anda memiliki IP Publik langsung dari ISP dan ingin mengelola port sendiri.

1. **Pasang Konfigurasi Nginx**:
   ```bash
   sudo cp deploy/theoverse.my.id.conf /etc/nginx/sites-available/theoverse.my.id
   sudo ln -s /etc/nginx/sites-available/theoverse.my.id /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

2. **Port Forwarding di Router WiFi**:
   - Buka pengaturan admin router WiFi rumah (biasanya `192.168.1.1` atau `192.168.0.1`).
   - Cari menu **Port Forwarding** / **Virtual Server**.
   - Forward Port **80** (HTTP) dan Port **443** (HTTPS) ke **IP Lokal Laptop Kubuntu** (cek IP lokal dengan `ip a`, misal `192.168.1.50`).

3. **Arahkan DNS Domain**:
   - Di panel registrar domain `theoverse.my.id`, buat **DNS Record A**:
     - Host: `@` -> Nilai: `[IP Publik Anda]` (cek di whatismyip.com)
     - Host: `www` -> Nilai: `[IP Publik Anda]`

4. **Pasang SSL Gratis (Certbot Let's Encrypt)**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d theoverse.my.id -d www.theoverse.my.id
   ```

---

## ⚡ Langkah 5: Tips Khusus Server Laptop Kubuntu

Agar laptop tidak mati/sleep saat layar ditutup:

1. Buka **System Settings (Pengaturan Sistem)** di Kubuntu.
2. Cari menu **Power Management (Manajemen Daya)** > **Energy Saving**.
3. Pada opsi **When laptop lid is closed (Saat layar laptop ditutup)**:
   - Pilih: **Do nothing (Jangan lakukan apa pun)** baik saat *On battery* maupun *On AC power*.
4. Pastikan opsi **Sleep automatically** dinonaktifkan (Never).

---

## 🛠️ Perintah Cepat Maintenance

```bash
# Cek log aplikasi:
sudo journalctl -u theoverse -f

# Restart aplikasi setelah update kode:
sudo systemctl restart theoverse

# Stop aplikasi:
sudo systemctl stop theoverse
```
