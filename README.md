# Refaey Farm Tracker

> A lightweight, modern, and responsive web application designed for poultry farm management, broiler flock cycle tracking, and production efficiency analytics.

**Live Demo:** [https://mohamedrefky.github.io/refaey-farm-tracker/](https://mohamedrefky.github.io/refaey-farm-tracker/)

---

## Key Features

- **Flock Cycle Management:**
  - Create and track multiple broiler cycles simultaneously.
  - Close cycles upon completion of sales.
  - Real-time net profit/loss calculation per cycle with cycle-by-cycle comparisons.

- **Flock & Mortality Tracking:**
  - Automated **Mortality Rate (%)** calculation with alerts for abnormal rates.
  - Real-time counts for active birds, sold birds, and remaining inventory in the farm.

- **Production Efficiency & Key Metrics:**
  - **Feed Conversion Ratio (FCR):** Calculates feed consumed per kilogram of live body weight sold (a lower ratio indicates better feed efficiency).
  - **Cost per Bird:** Dynamic distribution of total expenses across live birds.
  - **Profit per Bird:** Average net revenue and profit margin per bird sold.

- **Expense & Income Ledger:**
  - Categorized expense tracking (Chicks, Feed, Medication/Vaccines, Labor, Utilities, Transport, and Others).
  - Detailed sales records (bird count, total weight in kg, sale price, and buyer).
  - Visual breakdown charts showing where budget was allocated.

- **Debt & Receivables Tracker:**
  - Track receivables ("Owed to me") and payables ("Owed by me").
  - Simple one-click settlement status toggle.

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
│   ├── calculations.js   # Poultry KPIs, FCR, cost/profit formulas & charts
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
