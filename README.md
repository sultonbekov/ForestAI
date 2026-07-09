# 🌳 Forest AI

**Daraxtlarni dron va sun'iy intellekt yordamida raqamli monitoring qilish tizimi**
_Цифровой мониторинг деревьев с помощью дронов и ИИ_

O'zbekiston bo'ylab daraxtlarni avtomatik hisobga olish, sog'lig'ini kuzatish va yashillik darajasini vizualizatsiya qilish uchun interaktiv dashboard prototipi. Huquqiy asos — **PF-47-son Farmon** (25.03.2026, "Yashil makon" loyihasi).

![Forest AI](https://img.shields.io/badge/status-prototype-emerald) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple)

---

## ✨ Imkoniyatlar / Возможности

- 🛰 **Sun'iy yo'ldosh xaritasi** (Esri World Imagery) — real tasvir ustida hududlar maskasi
- 🗺 **Interaktiv xarita** — 14 viloyat va 206 tuman, yashillik darajasi bo'yicha rangli
- 🔍 **Drill-down** — xaritani 5 marta yaqinlashtirilganda viloyatlardan tumanlarga o'tish
- 📊 **3D ustunli diagramma** — o'sish animatsiyasi bilan, Viloyat / Tuman rejimlari
- 🏷 **Foiz yozuvlari** — har bir hudud ustida yashillik %
- 🌐 **Ikki til** — UZ / RU
- 📈 **Statistika paneli** — daraxtlar soni, sog'lig'i, NDVI, 2021–2026 dinamikasi
- 🎛 **Viloyat filtri** — tuman diagrammasida ma'lum viloyat tumanlarini ko'rish

> Ma'lumotlar prototip uchun sintetik (barqaror seed bilan generatsiya qilinadi). Hudud chegaralari — real (WGS84 GeoJSON).

---

## 🚀 Ishga tushirish / Запуск

### Talablar
- Node.js 18+ va npm

### Development

```bash
cd prototype
npm install
npm run dev
```

Brauzerda oching: **http://localhost:5173**

### Production build

```bash
cd prototype
npm run build
npm run preview
```

---

## 🐳 Docker

Konteynerda ishga tushirish (nginx orqali statik serve):

```bash
cd prototype
docker build -t forest-ai .
docker run -p 8080:80 forest-ai
```

Yoki `docker compose` bilan (loyiha ildizidan):

```bash
docker compose up --build
```

Brauzerda: **http://localhost:8080**

---

## 🧱 Texnologiyalar / Стек

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite |
| Xarita | Leaflet + react-leaflet (Esri sun'iy yo'ldosh tayllari) |
| 3D | Three.js (extrude bar chart) |
| Grafiklar | Recharts |
| Stil | Tailwind CSS |
| Serve (Docker) | nginx |

---

## 📁 Struktura

```
Forest_AI/
├── Forest_AI.pptx              # Loyiha taqdimoti
├── docker-compose.yml
├── prototype/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/data/
│   │   ├── regions.geojson     # 14 viloyat (ADM1)
│   │   └── uzbekistan.geojson  # 206 tuman (ADM2)
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── MapView.tsx     # 2D xarita + drill-down
│       │   ├── Chart3D.tsx     # 3D ustunli diagramma
│       │   ├── RegionPanel.tsx # statistika paneli
│       │   └── ...
│       ├── data/generateStats.ts
│       ├── hooks/useRegionData.ts
│       └── i18n.ts
```

---

## 🔗 O'xshash loyihalar

- [FlyPix AI](https://flypix.ai/) — Germaniya
- [TreeDetect](https://www.treedetect.com/) — Budapesht, Vengriya

---

## 👤 Muallif

**Isabek Sultonbekov** · 2026

Prototip · Raqamli daraxt monitoringi taklifi
