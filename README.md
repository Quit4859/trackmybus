# 🚍 CollegeBus Tracker

### Next-Gen Real-Time Transit & AI-Powered Commute Management

**CollegeBus Tracker** is a sophisticated, full-stack transit platform designed to modernize the college commute experience. By merging high-precision GPS telemetry with Google Gemini's multimodal AI, the app eliminates the guesswork from campus transportation, ensuring safety, efficiency, and real-time connectivity for students, drivers, and administrators.

---

## 🚀 Key Features

### 📍 Precision Live Tracking
*   **Sub-Meter Telemetry**: Real-time bus location updates powered by MapLibre GL and high-accuracy GPS.
*   **3D Fleet Visualization**: Interactive 3D bus models using Three.js (React Three Fiber) that rotate based on actual vehicle heading.
*   **Smart Routing**: High-fidelity path rendering using OSRM (Open Source Routing Machine) for accurate route geometry.
*   **Dynamic ETA**: Real-time arrival calculations based on live traffic and current stops.

### 🤖 Intelligent Assistant (Gemini AI)
*   **Multimodal Support**: Context-aware chatbot for transit FAQs, schedule queries, and route information.
*   **Visual Intelligence**: Gemini Vision integration allowing users to "Scan & Check" lost items, maintenance issues, or physical notice boards for automated data extraction.
*   **Adaptive Conversations**: Remembers chat history to provide personalized assistance for frequent commuters.

### 🛠 Role-Based Ecosystem
*   **Student/Parent Portal**: Minimalist, card-based UI for tracking assigned routes and communicating with drivers.
*   **Driver Dashboard**: "Heading-Up" navigation mode, live signal status, and one-tap tracking toggle for battery-efficient broadcasting.
*   **Admin Command Center**: A comprehensive fleet management suite for plotting new routes via map-taps, assigning drivers to vehicles, and managing student databases.

---

## 🏗 Technical Architecture

Built with a performance-first mindset to handle real-time data streams and complex 3D rendering in restricted mobile environments.

*   **Frontend**: React 18 with TypeScript for type-safe state management.
*   **Styling**: Tailwind CSS for a modern, high-contrast "Inter" typography-driven UI.
*   **Mapping**: MapLibre GL with 3D building extrusions and OpenFreeMap vector tiles.
*   **3D Graphics**: Three.js, @react-three/fiber, and @react-three/drei for realistic vehicle models.
*   **AI Engine**: Google GenAI SDK (Gemini 2.5 Flash / Gemini 3) for real-time natural language and computer vision.
*   **Animations**: Framer Motion for fluid transitions and gesture-based bottom sheet interactions.

---

## 🎨 Design Philosophy

The app adheres to **Modern Commute UX** principles:
*   **One-Handed Operation**: Critical controls (recenter, help, scan) are positioned within the "natural thumb zone."
*   **High Contrast & Legibility**: Designed for outdoor visibility in varying light conditions.
*   **Resilience**: Robust global error handling and "offline-aware" UI components that gracefully handle GPS signal drops.
*   **Performance**: Intelligent code-splitting and manual chunking to ensure rapid "Time to Interactive" (TTI) on mobile networks.

---

## 🛡 Security & Privacy
*   **Window Shadowing**: Protection against cross-origin frame hijacking.
*   **Scoped Access**: Strict permission-based views to protect driver privacy and student data.
*   **Transient Telemetry**: Live coordinates are only broadcasted during active shifts.

---
*Created with passion for safer, smarter campus transit.*