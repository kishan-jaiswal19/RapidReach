# 🚨 RapidReach: Smarter Emergency Response Network

**RapidReach** is a cutting-edge, AI-powered emergency safety application designed to bridge the gap between distress signals and professional aid. By combining real-time tracking, intelligent voice analysis, and family safety monitoring, RapidReach ensures that help is never more than a tap—or a word—away.

---

## ✨ Features that Save Lives

### 🔘 1. One-Tap SOS (The Master Trigger)
A high-visibility, "Hold to Activate" SOS button that prevents accidental triggers. When held, it instantly broadcasts your coordinates and medical info to the emergency network.

### 🎙️ 2. AI-Powered Voice SOS (Gemini Dispatch)
Built with **Google Gemini AI**, the app listens to your spoken distress calls. It isn't just word matching—it understands *intent*.
- **"I see smoke coming from the kitchen!"** ➡️ AI automatically categorizes as a **Fire Emergency** and alerts the Fire Department.
- **"My chest feels tight and I can't breathe."** ➡️ AI recognizes a **Medical Crisis** and triggers an Ambulance request.

### 🗺️ 3. Real-Time Emergency Mapping
Integrated **Leaflet.js Maps** provide a live heatmap of nearby incidents and track emergency responders in real-time. Know exactly where the help is and how long it will take to arrive.

### 🏥 4. Secure Medical ID
Your digital life insurance. Store blood type, critical allergies, current medications, and pre-existing conditions. This profile is instantly shared with responders the moment you trigger an alert.

### 👨‍👩‍👧‍👦 5. Family Safety Status
A private dashboard to monitor the safety of your loved ones. Get instant notifications if a family member enters an "Alerting" state and track their last known location.

### 🌐 6. Bilingual Support
In an emergency, every second counts—and so does every word. RapidReach fully supports both **English** and **Hindi**, including voice recognition in both languages, ensuring localized accessibility.

---

## 🛠️ The Technology Stack

RapidReach uses a high-performance, modern architecture to ensure 100% uptime and sub-second response times:

- **Frontend & Frameworks:**
  - **React 18 + Vite:** For a lightning-fast, zero-jank UI.
  - **TypeScript:** Ensuring type-safe, mission-critical code.
  - **Tailwind CSS:** For a polished, responsive, and accessible interface.
  - **Framer Motion:** Smooth, intuitive animations for high-stress situations.

- **Backend & Real-time Data:**
  - **Firebase Authentication:** Secure Google-based login.
  - **Cloud Firestore:** Real-time database for incident tracking and family updates.
  - **Firebase Security Rules:** Hardened, zero-trust rules to protect sensitive medical PII.

- **AI & Intelligence:**
  - **Google Gemini API:** Powering the voice intent analysis and automated dispatch routing.
  - **Web Speech API:** For real-time, low-latency audio processing.

- **Geospatial Services:**
  - **Leaflet & OpenStreetMap:** High-accuracy location mapping and coordinate management.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A Firebase Project (with Firestore and Auth enabled)
- A Google AI Studio (Gemini) API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kishan-jaiswal19
   cd rapidreach
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Add Firebase Config:**
   Place your `firebase-applet-config.json` in the root directory.

5. **Run Development Server:**
   ```bash
   npm run dev
   ```

---

## 🛡️ Security First

Sensitive medical data is protected by strict ownership-based Firestore rules. Only you and authorized responders (during an active alert) can access your medical profile. RapidReach does not sell or share user data with third-party advertisers.

---

## 🤝 Contributing

Safety is a community effort. If you'd like to improve the AI dispatch algorithms or add more languages, please feel free to fork this repository and submit a PR!

---

**RapidReach—Because in an emergency, speed is everything.** 🚑💨
