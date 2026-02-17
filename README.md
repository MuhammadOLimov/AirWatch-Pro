# 🌍 AirWatch Pro v2.0

**Real-Time Atmospheric Pollution Detection & Visualization System**

> Muallif: **Istamqulov Farzod Abdushurovich** · DI22-12

---

## 🚀 Ishga tushirish

### Talablar
- Node.js >= 18.0.0
- npm >= 8.0.0

### O'rnatish

```bash
# 1. Loyihani klonlash yoki papkaga o'tish
cd airwatch-pro

# 2. Kutubxonalarni o'rnatish
npm install

# 3. Backendni ishga tushirish
npm start
# yoki development rejimida:
npm run dev

# 4. Brauzerda ochish
# http://localhost:3000
```

---

## 📁 Fayl tuzilmasi

```
airwatch-pro/
├── index.html        ← Frontend (ko'p tilli, dark/light mode)
├── backend.js        ← Node.js + Express backend server
├── package.json      ← NPM konfiguratsiya
└── README.md         ← Ushbu fayl
```

---

## 🌐 API Endpoints

| Method | Endpoint                          | Tavsif                        |
|--------|-----------------------------------|-------------------------------|
| GET    | `/api`                            | API ma'lumoti                 |
| GET    | `/api/health`                     | Server holati                 |
| GET    | `/api/v1/cities`                  | Barcha shaharlar              |
| GET    | `/api/v1/search?q=tashkent`       | Shahar qidirish               |
| GET    | `/api/v1/air-quality/:cityId`     | Joriy AQI ma'lumoti           |
| GET    | `/api/v1/historical/:cityId`      | Tarixiy ma'lumot (24h-720h)   |
| GET    | `/api/v1/forecast/:cityId`        | 7 kunlik bashorat             |
| GET    | `/api/v1/stations/nearby`         | Yaqin stantsiyalar (GPS)      |
| GET    | `/api/v1/rankings`                | Shahar reytingi               |
| POST   | `/api/v1/alerts/subscribe`        | Ogohlantirish obunasi         |
| DELETE | `/api/v1/alerts/:id`              | Obunani bekor qilish          |
| GET    | `/api/v1/stats`                   | Global statistika             |
| WS     | `ws://localhost:3000/ws/live`     | Real-vaqt WebSocket           |

---

## 🎨 Frontend Xususiyatlari

### 🌍 Ko'p tilli qo'llab-quvvatlash
- **O'zbek (UZ)** — asosiy til
- **Rus (RU)** — to'liq tarjima
- **Ingliz (EN)** — to'liq tarjima
- Til o'zgarishi avtomatik saqlanadi (localStorage)

### 🌙 Kunduzgi/Tungi Rejim
- Dark mode (kosmik qora fon)
- Light mode (moviy-oq toza fon)
- Tanlagan rejim saqlanadi (localStorage)
- Barcha UI elementlari adaptlashadi

### 📊 Dashboard
- **4 ta metrik karta** — AQI, PM2.5, PM10, NO₂
- **Interaktiv grafik** — 24h, 7d, 30d oralig'ida
- **7 kunlik bashorat** — scrollable kartochkalar
- **Stantsiya xaritasi** — Canvas-da heatmap
- **Ifloslantiruvchilar** — animatsiyali progress barlar
- **Backend holat paneli** — real-vaqt holat

### 🔔 Ogohlantirish tizimi
- Email, shahar, ifloslantiruvchi va chegara sozlanadi
- Backend ulanganda real POST so'rov yuboradi
- Demo rejimida local simulatsiya

### 🏆 Shaharlar Reytingi
- AQI bo'yicha 10 ta shahar
- Har biriga click qilganda dashboard yangilanadi

---

## 🔧 WebSocket Ulanish

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/live?city=tashkent');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // { type: 'update', city_id: 'tashkent', data: { aqi: 142, pm25: 58.3, ... } }
  console.log('Live AQI:', data.data.aqi);
};

// Shahar o'zgartirish
ws.send(JSON.stringify({ type: 'subscribe', city: 'beijing' }));
```

---

## 📡 API Misollar

```bash
# Joriy AQI olish
curl http://localhost:3000/api/v1/air-quality/tashkent

# Tarixiy ma'lumot (72 soat)
curl http://localhost:3000/api/v1/historical/beijing?hours=72

# 7 kunlik bashorat
curl http://localhost:3000/api/v1/forecast/new-delhi

# Yaqin stantsiyalar
curl "http://localhost:3000/api/v1/stations/nearby?lat=41.2995&lon=69.2401&radius=500"

# Reyting (eng ifloslangan)
curl "http://localhost:3000/api/v1/rankings?order=desc&limit=5"

# Ogohlantirish yaratish
curl -X POST http://localhost:3000/api/v1/alerts/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"siz@email.com","city":"tashkent","threshold":100,"pollutant":"aqi"}'
```

---

## 🏙️ Qo'llab-quvvatlanadigan Shaharlar

| ID | Shahar | Davlat |
|----|--------|--------|
| `tashkent` | Toshkent | 🇺🇿 O'zbekiston |
| `samarkand` | Samarqand | 🇺🇿 O'zbekiston |
| `namangan` | Namangan | 🇺🇿 O'zbekiston |
| `fergana` | Farg'ona | 🇺🇿 O'zbekiston |
| `bukhara` | Buxoro | 🇺🇿 O'zbekiston |
| `beijing` | Beijing | 🇨🇳 Xitoy |
| `new-delhi` | New Delhi | 🇮🇳 Hindiston |
| `london` | London | 🇬🇧 Britaniya |
| `los-angeles` | Los Angeles | 🇺🇸 AQSh |
| `tokyo` | Tokio | 🇯🇵 Yaponiya |
| `moscow` | Moskva | 🇷🇺 Rossiya |
| `dubai` | Dubai | 🇦🇪 BAA |
| `paris` | Parij | 🇫🇷 Fransiya |
| `new-york` | Nyu-York | 🇺🇸 AQSh |
| `sydney` | Sidni | 🇦🇺 Avstraliya |

---

## ☁️ Production Deployment

```bash
# Heroku
heroku create airwatch-pro
git push heroku main

# Vercel (faqat frontend)
vercel --prod

# Docker
docker build -t airwatch-pro .
docker run -p 3000:3000 airwatch-pro

# PM2 (server)
npm install -g pm2
pm2 start backend.js --name airwatch
pm2 save && pm2 startup
```

---

## 📊 AQI Shkalasi

| AQI | Daraja | Tavsif |
|-----|--------|--------|
| 0–50 | 🟢 Yaxshi | Minimal xavf |
| 51–100 | 🟡 O'rtacha | Sezgirlar ehtiyot bo'lsin |
| 101–150 | 🟠 Sezgirlar uchun | Sezgir guruhlar ta'sirlangan |
| 151–200 | 🔴 Zararli | Barcha ta'sirlangan |
| 201–300 | 🟣 Juda zararli | Sog'liq ogohlantirishlari |
| 301+ | ⚫ Xavfli | Favqulodda holat |

---

## 🛠️ Texnologiyalar

**Frontend:**
- Vanilla HTML5/CSS3/JavaScript (framework yo'q)
- Canvas API — animatsiyalar va grafik
- CSS Variables — theme switching
- Web Storage API — sozlamalarni saqlash

**Backend:**
- Node.js + Express.js
- WebSocket (ws kutubxona)
- node-cron — fon vazifalari
- REST API (JSON)

---

*© 2026 AirWatch Pro · Istamqulov Farzod Abdushurovich · DI22-12*
