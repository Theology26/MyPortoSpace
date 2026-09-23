# 🌌 MyPortoSpace — Full-Stack 3D Interactive Portfolio & CMS

> **Live Portfolio of Yosia Gracetheo Boimau (@Theology26)**  
> *Full-Stack Systems Builder • Video Editor • Virtual Jockey (VJ)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20WebGL-black.svg)](https://threejs.org/)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Serverless%20Ready-black.svg)](https://vercel.com/)

---

## ✨ Features & Architecture

- **🪐 3D WebGL Space Universe**:
  - Photorealistic Earth 3D globe with atmospheric Rayleigh scattering shaders and day/night city lights.
  - Realistic orbital satellite telemetry powered by NASA & Space agency models (CALIPSO, CloudSat, Deep Space 1, IBEX, LLCD, Space Systems Loral SSL-1300).
- **🪪 Physics-Driven Interactive Lanyard Pass**:
  - Drag, fling, and spring physics simulation with real-time rubber tensor curves.
- **⚡ Automated GitHub Telemetry & Live Sync**:
  - Dynamic byte-level language percentage breakdown across all repositories.
  - Real-time cache in SQLite with single-click refresh button.
- **💼 Dynamic ATS CV / Resume Generator**:
  - Single-click A4 Portrait ATS-compliant CV generator (`/api/cv/download`) that automatically aggregates GitHub repositories, career experiences, and verified credentials.
- **🛠️ Secured SQLite Admin Dashboard (`/admin`)**:
  - Full CRUD control over hero headings, tech tags, lanyard pass telemetry, credentials, gallery, and space environment parameters.
- **🚀 Vercel Serverless Ready**:
  - Pre-configured `vercel.json` and serverless Express handler with `/tmp` database resiliency.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Three.js WebGL, Tailwind CSS, Lucide Icons, Canvas API
- **Backend**: Node.js, Express 5, SQLite3 / In-Memory resilient fallback
- **Engines**: Headless DomPDF/HTML ATS generation, GitHub REST API v3
- **Deployment**: Vercel Serverless Function & Standalone Node.js

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Theology26/MyPortoSpace.git
cd MyPortoSpace
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
node server.js
```
Open [http://localhost:3000](http://localhost:3000) to view the portfolio.

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub (`Theology26/MyPortoSpace`).
2. Log in to [Vercel](https://vercel.com/) and click **"New Project"**.
3. Import the `MyPortoSpace` repository.
4. Click **Deploy**! No extra configuration required — `vercel.json` and `api/index.js` handle everything out of the box.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) © 2025 Yosia Gracetheo Boimau.
