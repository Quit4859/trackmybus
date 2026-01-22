qq# 🚍 CollegeBus Tracker

### *Stop wondering. Start tracking.*

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)
![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.0-4285F4?style=for-the-badge&logo=googlegemini)
![Three.js](https://img.shields.io/badge/Three.js-R170-000000?style=for-the-badge&logo=threedotjs)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwindcss)

> **"Are you tired of standing at the bus stop wondering where the bus is?"**
>
> College BusTracker eliminates "Last-Mile Uncertainty" for students and admins through real-time telemetry, 3D spatial visualization, and multimodal AI assistance.

---

## 🏗️ System Architecture

```mermaid
graph LR
    %% Definitions
    subgraph Users ["fa:fa-users User Ecosystem"]
        direction TB
        Driver["👨‍✈️ Driver App"]
        Student["🎓 Student App"]
        Admin["🛡️ Admin Panel"]
    end

    subgraph Core ["fa:fa-gears Transit Engine"]
        direction TB
        State["📦 Global State"]
        GPS["📍 Telemetry Logic"]
        Router["🚦 Auth Guard"]
    end

    subgraph AI_Services ["fa:fa-brain AI Intelligence"]
        direction TB
        Gemini["🧠 Gemini 3.0 Flash"]
        Vision["👁️ Vision Analysis"]
    end

    subgraph Mapping ["fa:fa-map Spatial Stack"]
        direction TB
        MapLibre["🗺️ MapLibre GL"]
        OSRM["🛣️ OSRM Routing"]
        ThreeJS["🧊 Three.js (3D)"]
    end

    %% Connections
    Driver ----> GPS
    GPS ----> State
    State ----> Student & Admin
    
    Student -- "Natural Language" --> Gemini
    Student -- "Capture Image" --> Vision
    Vision & Gemini ----> State

    Admin -- "Set Waypoints" --> OSRM
    OSRM -- "Geometry" --> State
    State -- "Render" --> MapLibre & ThreeJS

    %% Styling
    classDef userNode fill:#ecfdf5,stroke:#10b981,stroke-width:2px;
    classDef coreNode fill:#eff6ff,stroke:#3b82f6,stroke-width:2px;
    classDef aiNode fill:#f5f3ff,stroke:#8b5cf6,stroke-width:2px;
    classDef mapNode fill:#fffbeb,stroke:#f59e0b,stroke-width:2px;

    class Driver,Student,Admin userNode;
    class State,GPS,Router coreNode;
    class Gemini,Vision aiNode;
    class MapLibre,OSRM,ThreeJS mapNode;

    style Users fill:#f0fdf4,stroke:#16a34a,stroke-dasharray: 5 5
    style Core fill:#f0f9ff,stroke:#0284c7,stroke-dasharray: 5 5
    style AI_Services fill:#faf5ff,stroke:#7c3aed,stroke-dasharray: 5 5
    style Mapping fill:#fffceb,stroke:#d97706,stroke-dasharray: 5 5
```

---

## 🚀 Key Features

| Feature | Tech Stack | Description |
| :--- | :--- | :--- |
| **Live Telemetry** | `Geolocation API` + `Lerp` | Real-time bus location updates with smooth 20fps interpolation and heading synchronization. |
| **AI Copilot** | `Gemini 3.0 Flash` | Context-aware chatbot for schedules, routes, and safety inquiries. |
| **Visual Intelligence** | `Gemini Vision` | "Scan & Check" feature to analyze lost items, printed notices, or maintenance issues. |
| **3D Spatial Map** | `MapLibre` + `Three.js` | Immersive map experience with 3D buildings and realistic bus models. |
| **Role-Based Access** | `React Router` + `State` | Dedicated interfaces for Students (Tracking), Drivers (Broadcasting), and Admins (Fleet Mgmt). |

---

## 🔐 Demo Access

Explore the platform using these pre-configured accounts:

| Role | Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@gmail.com` | `admin` | Manage routes, buses, drivers, students; View fleet overview. |
| **Driver** | `driver@gmail.com` | `123123` | Broadcast live location; View assigned route; Safety dashboard. |
| **Student** | `student@gmail.com` | `123123` | Track buses; AI Chat; Visual Search; View Schedules. |

---

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/college-bus-tracker.git
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file and add your Gemini API key:
   ```env
   VITE_API_KEY=your_google_genai_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

---

## ⚡ Technical Highlights

*   **Multimodal AI Integration**: Leverages Google's Gemini 3.0 for both text-based assistance and image analysis (Zero-shot vision tasks).
*   **Driver Compass**: Implements device orientation API to provide "Heading-Up" navigation mode for drivers.
*   **Resilient State Management**: Custom `usePersistedState` implementation to maintain fleet data across reloads without a backend.
*   **Performance Optimization**: Vendor chunk splitting for heavy 3D/Map libraries to ensure fast First Contentful Paint (FCP).

---
*Built with ❤️ for Campus Commuters*
