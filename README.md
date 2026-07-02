# Tatkal Sniper v1.2.0

**WARNING: This project is strictly for educational demonstration purposes only. It is intended to showcase browser automation and DOM manipulation techniques. Any use of this tool for actual ticket booking or commercial purposes is strongly discouraged and may violate the terms of service of the target website.**

Tatkal Sniper is a Google Chrome extension designed to assist with automating the ticket booking process on the IRCTC portal, particularly during the high-demand Tatkal window. 

The extension works by securely storing your travel details, passenger information, and payment preferences locally within your browser. When the IRCTC booking window opens, the extension autofills the required fields across the login, search, passenger, and payment pages, thereby saving valuable time.

## Key Features
* Automated Login: Pre-fills your IRCTC user ID and password.
* Journey Search Autofill: Automatically inputs the origin station, destination station, journey date, and quota.
* Passenger Details: Automatically adds passenger rows and fills in the name, age, gender, berth preference, and food choice (now directly bypassing the autocomplete panel for maximum speed).
* Payment Selection: Auto-selects your preferred payment method (such as UPI or Net Banking) on the payment page.
* Circuit Breaker: Includes fail-safe mechanisms to halt automation if the session expires or if a payment fails, preventing loops.
* Captcha Auto-Focus & Highlight: Instantly focuses on the captcha input fields on the login and review pages, applying a pulsing visual ring to ensure you never lose focus.
* Live Speed Analytics & Atomic Clock: Tracks the exact time taken to bypass each page and displays an active IRCTC server latency monitor directly in the extension popup.
* Ghost Mode (Human Emulation): Simulates human-like character-by-character typing with natural delays to prevent bot detection while filling forms.

## Installation Instructions
1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to chrome://extensions/
3. Enable "Developer mode" by toggling the switch in the top right corner.
4. Click on the "Load unpacked" button.
5. Select the folder containing the extension files.
6. The Tatkal Sniper extension will now appear in your browser toolbar.

## Usage Guide
1. Click the Tatkal Sniper icon in the Chrome toolbar to open the dashboard.
2. Enter your IRCTC credentials, journey details, passenger information, and preferences.
3. Click "Save Configuration" to store your details locally.
4. Navigate to the IRCTC portal.
5. Toggle the extension status to "Active". The extension will inject a live status console on the IRCTC page and begin automating the flow based on the current page context.

## Privacy and Security
All credentials and passenger details are stored locally on your machine using the Chrome Storage API. The extension does not transmit any of your personal information to external servers.

## Disclaimer
This extension is provided strictly for educational and personal use. Please use it responsibly and in accordance with the IRCTC terms of service. 

**The developer of this tool assumes absolutely no responsibility or liability for any actions taken by the user. If the user is found guilty of violating any laws, platform terms of service, or regulations, the developer shall not be held liable for any legal, financial, or penal consequences. By using this tool, you agree that you are doing so entirely at your own risk.**
