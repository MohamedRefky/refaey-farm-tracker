# Refaey Farm Tracker

> A lightweight, modern, and responsive web application designed for poultry farm management, broiler flock cycle tracking, and production efficiency analytics.

**Live Demo:** [https://mohamedrefky.github.io/refaey-farm-tracker/](https://mohamedrefky.github.io/refaey-farm-tracker/)

---

## Key Features

- **Multi-Type Flock Cycle Management:**
  - Create broiler cycles with multiple hand-typed poultry types (with bird count & chick cost per type), and add new types anytime.
  - Close cycles upon completion of sales with start/end date validation.
  - Real-time net profit/loss calculation per cycle and per bird type.

- **Flock & Mortality Tracking:**
  - Automated **Mortality Rate (%)** calculation per cycle and per type.
  - Real-time counts for active birds, sold birds, and remaining birds per type.

- **Shared Cycle Expenses & Feed Purchases:**
  - Record shared expenses once for the entire cycle (`علف`، `دواء`، `غاز`، `مصاريف أخرى`) — automatically distributed across flock types proportionally by bird count.
  - Feed unit selector supporting **50 kg bags**, **100 kg bags**, and **kilograms (kg)** with automatic total weight calculation.

- **Sales & Receivables Notebook:**
  - Fast mobile-friendly sales logging per chicken type (bird count + total sale value).
  - Receivables tracker ("مستحق لنا عند الغير") with partial/full payment collection, payment history editing/cancellation, and automatic consistency sync.

- **Offline-First & Multi-Tab Safe Storage:**
  - Data is currently stored locally on the user's device (`localStorage`) with explicit failure alerts, cross-tab synchronization (`storage` event), offline recording protection (`navigator.onLine`), and sync hooks ready for future Firebase integration.

- **Interactive & Clean UI:**
  - Sleek, mobile-first, and responsive interface.
  - Dark & Light mode toggle.
  - Zero dependencies or backend server required — runs 100% in the browser.

---

## Quick Start

### 1. Run Locally
Simply open `index.html` in any modern web browser on your desktop or mobile phone.

### 2. Live Demo via GitHub Pages
You can host this project online for free with GitHub Pages:
1. Push this repository to your GitHub account.
2. Navigate to **Settings** > **Pages**.
3. Under **Build and deployment**, select the `main` branch as the source and click **Save**.
4. Your tracker will be live and accessible from anywhere via a public URL!

---

## Project Architecture

```text
refaey-farm-tracker/
├── index.html            # Clean semantic HTML entry point
├── css/
│   └── style.css         # Modern design tokens, responsive layout & animations
├── js/
│   ├── data.js           # Dataset, localStorage persistence & helpers
│   ├── calculations.js   # Poultry KPIs, cost/profit formulas & charts
│   └── app.js            # UI controller, 1-tap quick actions, modal & themes
├── README.md
└── .gitignore
```

---

## Tech Stack

- **HTML5** (Semantic structure)
- **Vanilla CSS3** (Custom properties, flexbox, CSS grid, micro-animations)
- **Modular JavaScript (ES6+)** (Separation of concerns: data, math, UI)
- **Typography:** Cairo & JetBrains Mono (via Google Fonts)

---

## License
This project is open-source and available under the [MIT License](LICENSE).
