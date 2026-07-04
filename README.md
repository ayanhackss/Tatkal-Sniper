# Tatkal Sniper v1.2.0

> **⚠️ Disclaimer:** This project is strictly for educational and demonstration purposes only. It showcases browser automation and DOM manipulation techniques. Any use of this tool for actual ticket booking or commercial purposes may violate IRCTC's terms of service. The developer assumes no liability for any consequences arising from its use. By using this tool, you agree to do so entirely at your own risk.

---

Tatkal Sniper is a Google Chrome extension that automates the IRCTC ticket booking process during the high-demand Tatkal window. It securely stores your travel details, passenger information, and preferences locally in your browser, then autofills every page of the booking flow — from login to payment — with zero manual intervention.

---

## ✨ Features

### 🤖 Core Automation
- **Automated Login** — Pre-fills your IRCTC username and password and submits.
- **Journey Search Autofill** — Inputs origin/destination station, journey date, train number, class, and quota automatically.
- **Passenger Details** — Fills in all passenger rows (name, age, gender, berth preference, food choice) bypassing the slow autocomplete panel for maximum speed.
- **Train & Class Selection** — Automatically locates your configured train and class on the results page and clicks through.
- **Payment Selection** — Auto-selects your preferred payment method (UPI, Net Banking, etc.) on the payment page.
- **Captcha Auto-Focus** — Instantly focuses and highlights the captcha input field with a pulsing orange ring so you can type without clicking.

### 🛡️ Anti-Bot Evasion
- **Ghost Mode** — Simulates character-by-character typing with randomised 20–60ms keystroke delays to mimic human input patterns.
- **Mouse Simulation** — Before every button click, dispatches a curved sequence of `mousemove` events tracing a natural Bézier path to the element, replicating real cursor movement.
- **Cooling Period** — Injects a configurable randomised pause (default 600–1400ms) before each page interaction, preventing timing-based bot fingerprinting. Tunable via min/max sliders in the Preferences tab.
- **Invisible State Tracking** — Uses a JavaScript `WeakMap` instead of `data-*` attributes to track internal state, leaving no detectable footprints in the DOM.
- **Obfuscated DOM IDs** — All injected elements use class names and IDs that mimic the Angular/PrimeNG framework IRCTC already uses (e.g., `ng-core-styles`, `ng-panel-hdr`), blending in with the page's own markup.

### ⚡ Speed & Reliability
- **Session Keep-Alive** — Silently pings IRCTC every 3 minutes using `credentials: include` to keep your login session active while waiting for the Tatkal window to open. Automatically pauses during active booking.
- **Language Popup Auto-Dismiss** — Detects and dismisses the IRCTC language selection modal on every page load, automatically selecting English.
- **Circuit Breaker** — Halts automation if it detects unexpected backward navigation (e.g., being redirected to the login page after reaching the passenger page), preventing infinite booking loops.
- **Session Timeout Detection** — Monitors for IRCTC session expiry messages and automatically deactivates the extension when detected.
- **Retry with Toast** — If any page fails to autofill, a retry toast notification appears with a manual "Retry" button, with up to 2 automatic retry attempts.

### 📊 Live Dashboard
- **Floating Console** — A live status overlay appears on the IRCTC page showing the current status, active action, and passenger count. Includes Activate/Pause buttons usable without opening the popup.
- **Atomic Server Clock** — Displays an accurate countdown timer to both the AC Tatkal window (10:00 AM) and Sleeper Tatkal window (11:00 AM), based on server-synced time.
- **IRCTC Ping Monitor** — Shows live round-trip latency to the IRCTC server in the popup (green < 200ms, amber < 500ms, red ≥ 500ms).
- **Live Speed Analytics** — Tracks the exact time taken to complete each booking stage (login, search, passenger, review) and displays a per-stage breakdown in the Tips tab.

### 🧑‍💻 Passenger Management
- **Multi-Passenger Support** — Add up to 6 passengers with individual name, age, gender, berth, and food preferences.
- **Quick-Clone** — Duplicate any passenger card in one click, preserving all current field values including unsaved edits.

### ⚙️ Configuration & Preferences
- **Scheduled Auto-Launch** — Set a specific time (e.g. 09:58 AM) to automatically open IRCTC and start the booking flow.
- **Pre-Booking Reminder** — Desktop notification 10 minutes before the Tatkal window opens.
- **Auto-Trigger at Open** — Automatically starts booking the moment the Tatkal countdown reaches zero.
- **Reset Button** — Clears all saved credentials, journey details, passengers, and preferences in a single click.
- **Config Persistence** — All settings are stored locally via the Chrome Storage API. Nothing is ever sent to external servers.

---

## 🗂️ Tatkal Timings Reference

| Class | Opens At | Login By |
|-------|----------|----------|
| AC (1A, 2A, 3A, 3E, CC) | 10:00 AM | 09:58 AM |
| Sleeper (SL, 2S) | 11:00 AM | 10:58 AM |

---

## 🚀 Installation

1. Clone or download this repository to your local machine.
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the extension folder.
5. The Tatkal Sniper icon will appear in your browser toolbar.

---

## 📖 Usage Guide

1. Click the **Tatkal Sniper** icon in the Chrome toolbar.
2. Fill in your **Credentials**, **Journey details**, and **Passenger list** across the tabs.
3. Configure your **Preferences** (payment method, Ghost Mode, Mouse Simulation, Cooling Period, etc.).
4. Click **Save Details** to store everything locally.
5. Navigate to [irctc.co.in](https://www.irctc.co.in) — the extension will auto-dismiss the language popup.
6. Click **Start Auto-Booking** (or set a scheduled time). The floating console will appear on the IRCTC page and guide the automation through every step.

---

## 🔒 Privacy & Security

All credentials and personal data are stored **exclusively on your local machine** using the Chrome Storage API (`chrome.storage.local`). The extension makes no external network requests other than pings to IRCTC itself for the keep-alive and ping monitor features.
