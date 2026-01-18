# 🚍 CollegeBus Tracker
### The Future of Campus Commuting

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.0-4285F4?style=for-the-badge&logo=googlegemini)
![Three.js](https://img.shields.io/badge/Three.js-R170-000000?style=for-the-badge&logo=threedotjs)

> **🚀 Quick Start:** `admin@gmail.com` (123123) ➔ Create Route ➔ Driver: `driver@gmail.com` (123123) ➔ Go Live.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph "User Ecosystem"
        Driver[👨‍✈️ Driver App]
        Student[🎓 Student/Parent App]
        Admin[🛡️ Admin Dashboard]
    end

    subgraph "Core Engine (React 18)"
        State[📦 Global State Manager]
        GPS[📍 GPS & Sensor Logic]
        Router[🔄 Role-Based Router]
    end

    subgraph "External Services"
        Gemini[🧠 Google Gemini AI]
        MapService[🗺️ MapLibre / OpenFreeMap]
        OSRM[🛣️ OSRM Routing API]
    end

    %% Telemetry Flow
    Driver -->|Throttled Updates 50ms| GPS
    GPS -->|Sync| State
    State -->|Broadcast| Student
    State -->|Broadcast| Admin

    %% AI Flow
    Student -->|Chat Query| Gemini
    Student -->|Vision Scan| Gemini
    Gemini -->|AI Response| Student

    %% Mapping Flow
    Admin -->|Waypoints| OSRM
    OSRM -->|Geometry| State
    State -->|3D Render| MapService
```

---

## 🚀 Key Features

| Feature | Tech | Benefit |
| :--- | :--- | :--- |
| **Live Tracking** | `Geolocation` + `Lerp` | Smooth 20fps bus movement & heading sync. |
| **AI Assistant** | `Gemini 3.0 Flash` | 24/7 support for schedules & lost item detection. |
| **3D Maps** | `MapLibre` + `R3F` | High-fidelity 3D buildings & vehicle visualization. |
| **Smart Pathing** | `OSRM API` | Precise road-snapped routing for accurate ETAs. |

---

## ⚡ Technical Highlights

*   **Multimodal AI**: Vision-based analysis for campus maintenance and lost/found reports.
*   **Driver Compass**: Heading-up mode using device orientation and Three.js interpolation.
*   **Resilient GPS**: Auto-reconnect and signal filtering for high-motion accuracy in transit.
*   **Performance PWA**: Vendor-split bundles for hardware-accelerated mapping and 3D rendering.

---

## 📂 Project Anatomy

```bash
src/
├── components/      # 🧩 3D Models, Maps, AI Chat, Dashboards
├── services/        # 🔌 Gemini SDK & Routing Logic
├── App.tsx          # 🚦 Global State & Security Router
└── types.ts         # 📐 Interface Definitions
```

---
*Enterprise Reliability • Spatial Precision • Intelligent Logistics*