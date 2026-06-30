(async () => {
  console.log('Tatkal Sniper: Content script injected.');

  // Helper to safely verify extension context without throwing uncaught exceptions
  const isContextValid = () => {
    try {
      return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  };

  // Retrieve activation state and config safely
  let tatkalExpressActive = false;
  let tatkalExpressConfig = null;
  let teSignInTimeout = null;

  try {
    if (isContextValid()) {
      const state = await chrome.storage.local.get(['tatkalExpressActive', 'tatkalExpressConfig']);
      tatkalExpressActive = state.tatkalExpressActive || false;
      tatkalExpressConfig = state.tatkalExpressConfig || null;
    }
  } catch (e) {
    console.warn('Tatkal Sniper: Extension context invalidated on initial load.');
    return;
  }

  if (!tatkalExpressConfig) {
    console.log('Tatkal Sniper: No initial configuration found. Standing by...');
  }

  // Listen for storage changes to synchronize configuration and state in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.tatkalExpressActive) {
      tatkalExpressActive = changes.tatkalExpressActive.newValue;
      console.log('Tatkal Sniper: Active state updated from storage:', tatkalExpressActive);
      updateConsoleContent();
      if (tatkalExpressActive) {
        triggerAutoActions();
      }
    }

    if (changes.tatkalExpressConfig) {
      tatkalExpressConfig = changes.tatkalExpressConfig.newValue;
      console.log('Tatkal Sniper: Configuration updated from storage.');
      updateConsoleContent();
      if (tatkalExpressActive) {
        triggerAutoActions();
      }
    }
  });

  // Inject CSS for the live floating console on IRCTC
  const injectStyles = () => {
    const id = 'tatkal-express-styles';
    if (document.getElementById(id)) return;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      #tatkalExpressConsole {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 20px rgba(249, 115, 22, 0.15);
        z-index: 999999;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #1e293b;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .te-header {
        background: linear-gradient(135deg, #f97316, #f59e0b);
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        color: white;
      }
      .te-title {
        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .te-dot {
        width: 8px;
        height: 8px;
        background: #34d399;
        border-radius: 50%;
        box-shadow: 0 0 8px #34d399;
      }
      .te-dot.inactive {
        background: #f87171;
        box-shadow: 0 0 8px #f87171;
      }
      .te-body {
        padding: 14px;
      }
      .te-status-text {
        font-size: 0.76rem;
        color: #475569;
        margin-bottom: 10px;
        line-height: 1.4;
      }
      .te-status-text strong {
        color: #1e293b;
      }
      .te-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .te-btn {
        width: 100%;
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.08);
        color: #1e293b;
        padding: 8px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .te-btn:hover {
        background: rgba(0, 0, 0, 0.08);
        border-color: rgba(0, 0, 0, 0.15);
      }
      .te-btn-primary {
        background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%);
        border: none;
        color: #fff;
        box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);
      }
      .te-btn-primary:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(249, 115, 22, 0.4);
      }
      .te-btn-danger {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.2);
      }
      .te-btn-danger:hover {
        background: #ef4444;
        color: #fff;
      }
      .te-passenger-badge {
        font-size: 0.7rem;
        padding: 2px 6px;
        background: rgba(251, 146, 60, 0.15);
        color: #f97316;
        border-radius: 4px;
        border: 1px solid rgba(251, 146, 60, 0.2);
      }
      
      /* Glowing highlighting for target forms */
      .te-highlight {
        outline: 2px solid #fb923c !important;
        box-shadow: 0 0 10px rgba(251, 146, 60, 0.6) !important;
      }
      /* Health Monitor Progress Bar */
      .te-progress {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .te-step {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.72rem;
        color: #6b7280;
        transition: color 0.3s ease;
      }
      .te-step.active {
        color: #fff;
        font-weight: 600;
      }
      .te-step.done {
        color: #34d399;
      }
      .te-step-icon {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid currentColor;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
      }
      .te-step.active .te-step-icon {
        background: currentColor;
        box-shadow: 0 0 6px currentColor;
      }
      .te-step.done .te-step-icon {
        background: transparent;
        border-color: #34d399;
      }
      .te-step.done .te-step-icon::after {
        content: '✓';
        color: #34d399;
        font-size: 10px;
      }
      
      /* Toast Notifications for Retries */
      .te-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: sans-serif;
      }
      .te-toast button {
        background: white;
        color: #ef4444;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
  };

  // Build the live floating console UI on top of IRCTC
  const createConsole = () => {
    let consoleEl = document.getElementById('tatkalExpressConsole');
    if (consoleEl) return;

    injectStyles();

    consoleEl = document.createElement('div');
    consoleEl.id = 'tatkalExpressConsole';

    updateConsoleContent(consoleEl);
    document.body.appendChild(consoleEl);
  };

  const updateConsoleContent = (consoleEl = null) => {
    const el = consoleEl || document.getElementById('tatkalExpressConsole');
    if (!el) return;

    const isActive = tatkalExpressActive;
    const passengerCount = (tatkalExpressConfig && tatkalExpressConfig.passengers) ? tatkalExpressConfig.passengers.length : 0;

    let statusMsg = 'Standing by. Click "Activate" or start auto-booking from extension popup.';
    let currentStepIdx = -1;
    if (isActive) {
      const pageType = detectPageType();
      if (pageType === 'login') {
        statusMsg = 'Login page detected. Autofilling credentials... Solve Captcha!';
        currentStepIdx = 0;
      }
      else if (pageType === 'search') {
        statusMsg = 'Plan My Journey page detected. Ready to fill station details.';
        currentStepIdx = 1;
      }
      else if (pageType === 'results') {
        statusMsg = 'Train list detected. Selecting train and class...';
        currentStepIdx = 2;
      }
      else if (pageType === 'passenger') {
        statusMsg = 'Passenger details page detected. Ready to inject passenger data.';
        currentStepIdx = 3;
      }
      else if (pageType === 'review') {
        statusMsg = '⚡ Review Journey: Enter the CAPTCHA — Continue will auto-click!';
        currentStepIdx = 4;
      }
      else if (pageType === 'payment') {
        statusMsg = 'Payment options page detected. Scrolled to preferred method.';
        currentStepIdx = 5;
      }
      else statusMsg = 'Auto-booking active. Navigate through the booking process.';
    }

    const steps = ['Login', 'Search', 'Select Train', 'Passengers', 'Review', 'Payment'];
    const progressHTML = isActive ? `
      <div class="te-progress">
        ${steps.map((s, i) => `
          <div class="te-step ${i < currentStepIdx ? 'done' : (i === currentStepIdx ? 'active' : '')}">
            <div class="te-step-icon"></div>
            ${s}
          </div>
        `).join('')}
      </div>
    ` : '';

    el.innerHTML = `
      <div class="te-header">
        <div class="te-title">
          <div class="te-dot"></div>
          Tatkal Sniper Live
        </div>
        <span class="te-passenger-badge"></span>
      </div>
      <div class="te-body">
        <div class="te-status-text">
          Status: <strong class="te-status-label"></strong><br>
          <span class="te-status-desc" style="font-size:0.7rem; color:#9ca3af; display:block; margin-top:4px;"></span>
        </div>
        <div class="te-actions">
          <div class="te-active-actions" style="display: none; flex-direction: column; gap: 8px;">
            <button class="te-btn te-btn-primary" id="teAutofillBtn">⚡ Auto-Fill Current Page</button>
            <button class="te-btn te-btn-danger" id="teDeactivateBtn">Pause Auto-Booking</button>
          </div>
          <div class="te-inactive-actions" style="display: none; flex-direction: column; gap: 8px;">
            <button class="te-btn te-btn-primary" id="teActivateBtn">Activate Auto-Booking</button>
          </div>
        </div>
        ${progressHTML}
      </div>
    `;

    // Safely configure dynamic UI states via DOM properties to satisfy extension guidelines
    const dot = el.querySelector('.te-dot');
    if (dot) {
      dot.className = isActive ? 'te-dot' : 'te-dot inactive';
    }

    const badge = el.querySelector('.te-passenger-badge');
    if (badge) {
      badge.textContent = `${passengerCount} Pax`;
    }

    const statusLabel = el.querySelector('.te-status-label');
    if (statusLabel) {
      statusLabel.textContent = isActive ? 'Active' : 'Paused';
    }

    const statusDesc = el.querySelector('.te-status-desc');
    if (statusDesc) {
      statusDesc.textContent = statusMsg;
    }

    const activeActions = el.querySelector('.te-active-actions');
    const inactiveActions = el.querySelector('.te-inactive-actions');
    if (activeActions && inactiveActions) {
      if (isActive) {
        activeActions.style.display = 'flex';
        inactiveActions.style.display = 'none';
      } else {
        activeActions.style.display = 'none';
        inactiveActions.style.display = 'flex';
      }
    }

    // Attach Event Listeners
    setTimeout(() => {
      const fillBtn = el.querySelector('#teAutofillBtn');
      if (fillBtn) fillBtn.addEventListener('click', triggerManualAutofill);

      const deactivateBtn = el.querySelector('#teDeactivateBtn');
      if (deactivateBtn) deactivateBtn.addEventListener('click', deactivateExtension);

      const activateBtn = el.querySelector('#teActivateBtn');
      if (activateBtn) activateBtn.addEventListener('click', activateExtension);
    }, 50);
  };

  // Detector for IRCTC pages based on URL and DOM selectors
  const detectPageType = () => {
    const url = window.location.href;

    // Check if the login modal dialog or user-login page is open in the DOM
    const hasLoginFields = (() => {
      const passwordInput = document.querySelector('input[type="password"]');
      const userIdInput = document.querySelector('input[formcontrolname="userId"]') || 
                          document.querySelector('input[placeholder*="User Name" i]');
      
      const isVisible = (el) => {
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return false;
        const style = window.getComputedStyle(el);
        return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
      };

      return isVisible(passwordInput) && isVisible(userIdInput);
    })();

    if (url.includes('/profile/user-login') || hasLoginFields) {
      return 'login';
    }

    const hasPassengerFields = (() => {
      // Match all known IRCTC name-field variants including the current "Full Name as per Govt. ID"
      const el = document.querySelector('input[formcontrolname*="passengerName"]') ||
        document.querySelector('input[placeholder*="Passenger Name"]') ||
        document.querySelector('input[placeholder*="Full Name"]') ||
        document.querySelector('input[placeholder*="Govt. ID"]') ||
        document.querySelector('input[placeholder*="Govt ID"]');
      return el && el.offsetWidth > 0 && el.offsetHeight > 0;
    })();

    if (url.includes('/booking/psgninput') || url.includes('/book/passenger-association') || hasPassengerFields) {
      return 'passenger';
    }

    if (url.includes('/booking/payment-options') || url.includes('/book/payment-options') || url.includes('bkgPaymentOptions') || url.includes('/payment/') || document.querySelector('app-payment-options') || document.querySelector('app-bkg-payment-options')) {
      return 'payment';
    }

    if (url.includes('/booking/reviewBooking') || url.includes('/booking/review-booking')) {
      return 'review';
    }

    // Precise URL-based routing checks for Angular SPA pages (extremely robust and immune to ad/footer DOM changes)
    if (url.includes('/booking/train-list') || url.includes('/train-list')) {
      return 'results';
    }

    if (url.includes('/train-search')) {
      return 'search';
    }

    return 'unknown';
  };

  // State Management Triggers
  const activateExtension = async () => {
    tatkalExpressActive = true;
    await chrome.storage.local.set({ tatkalExpressActive: true });
    updateConsoleContent();
    triggerAutoActions();
  };

  const deactivateExtension = async () => {
    tatkalExpressActive = false;
    await chrome.storage.local.set({ tatkalExpressActive: false });
    // Notify background script to clear state and update badge
    chrome.runtime.sendMessage({ action: 'deactivateAutoBooking' });
    updateConsoleContent();
  };

  const triggerManualAutofill = () => {
    console.log('Tatkal Sniper: Manual autofill triggered.');
    executeAutofill(detectPageType(), true);
  };

  // Helper: Perform a robust simulated click that bubbles and works with framework event listeners
  const clickElement = (el) => {
    if (!el) return;
    try {
      el.focus();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    } catch (err) {
      console.warn('Tatkal Sniper: clickElement pointer events failed:', err);
    }
    try {
      el.click();
    } catch (err) {
      console.warn('Tatkal Sniper: clickElement native click failed, falling back to custom click event:', err);
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      } catch (clickErr) {
        console.error('Tatkal Sniper: click event dispatch failed:', clickErr);
      }
    }
  };

  // Helper: Autofill an input field compatible with Angular two-way binding
  const fillAngularInput = (inputEl, value) => {
    if (!inputEl) return;
    inputEl.focus();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

    // Step 1: Clear the field first so Angular detects a real change even if value is the same
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(inputEl, '');
    } else {
      inputEl.value = '';
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Step 2: Set the new value
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Dispatch Enter key events to force custom controls (like calendars/dropdowns) to parse and save
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

    inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  // Helper: Detect if IRCTC is showing a loading/please-wait overlay
  const isPageLoading = () => {
    const loadingSelectors = [
      '.ui-blockui',
      '.p-blockui',
      '.please-wait',
      '[class*="loading"]',
      '[class*="spinner"]',
      '.overlay-container .overlay',
    ];
    const hasSpinner = loadingSelectors.some(sel => {
      const el = document.querySelector(sel);
      return el && el.offsetWidth > 0 && el.offsetHeight > 0;
    });

    if (hasSpinner) return true;

    // Fast check: if "please wait" is not present in the body text, skip scanning elements completely
    const body = document.body;
    const bodyText = body ? (body.innerText || '') : '';
    if (!bodyText || !bodyText.toUpperCase().includes('PLEASE WAIT')) {
      return false;
    }

    // Scan only leaf elements to prevent reading massive recursive textContent strings
    return Array.from(document.querySelectorAll('div, span')).some(el => {
      if (el.children.length > 0) return false; // Only inspect leaf nodes
      const txt = el.textContent.trim().toUpperCase();
      return (txt === 'PLEASE WAIT...' || txt === 'PLEASE WAIT') && el.offsetWidth > 0 && el.offsetHeight > 0;
    });
  };

  // Helper: Wait until the page is not in a loading state (up to maxWait ms)
  const waitForPageReady = async (maxWait = 5000) => {
    const start = Date.now();
    while (isPageLoading() && Date.now() - start < maxWait) {
      console.log('Tatkal Sniper: Page loading — waiting...');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  // Helper: Autofill an Angular PrimeNG Calendar input field by simulating keystrokes
  const fillAngularCalendar = async (inputEl, value) => {
    if (!inputEl) return;
    console.log(`Tatkal Sniper: Start programmatically typing date "${value}" into calendar...`);
    inputEl.focus();

    // Select all content so the value is overwritten
    inputEl.select();

    // Clear the field using native property descriptors or direct assignment, then dispatch input event
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(inputEl, '');
    } else {
      inputEl.value = '';
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Simulate typing character-by-character to trigger custom event listeners on the calendar component
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      
      // Update DOM value
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputEl, inputEl.value + char);
      } else {
        inputEl.value += char;
      }

      // Dispatch exact KeyboardEvents matching real human typing
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

      // Tiny delay to let Angular change detection cycles parse each character
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    console.log('Tatkal Sniper: Date typed fully. Finalizing calendar selection...');
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Dispatch Enter key events to force calendar to parse and save
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

    // Blur to close the overlay calendar drop-down and write to Angular model
    inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  // Helper: Autofill an Angular PrimeNG Autocomplete field by simulating keystrokes
  const fillAngularAutocomplete = (inputEl, value) => {
    return new Promise(async (resolve) => {
      if (!inputEl) {
        resolve();
        return;
      }
      console.log(`Tatkal Sniper: programmatically typing "${value}" into autocomplete...`);
      inputEl.focus();

      // Select all content and clear using native descriptors
      inputEl.select();

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputEl, '');
      } else {
        inputEl.value = '';
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate character-by-character typing to trigger search panel queries reliably
      for (let i = 0; i < value.length; i++) {
        const char = value[i];
        
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(inputEl, inputEl.value + char);
        } else {
          inputEl.value += char;
        }

        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

        await new Promise(resolve => setTimeout(resolve, 30));
      }

      console.log(`Tatkal Sniper: Typed "${value}". Waiting for suggestion panel...`);

      // Poll to wait for the PrimeNG panel list items to open and load dynamically (handles slow networks)
      let attempts = 0;
      const maxAttempts = 30; // 3 seconds total (30 * 100ms)
      const interval = setInterval(() => {
        const items = document.querySelectorAll('.ui-autocomplete-list-item, .p-autocomplete-item, li[role="option"], .p-autocomplete-list-item');
        attempts++;

        if (items.length > 0) {
          clearInterval(interval);
          let matched = false;
          for (const item of items) {
            if (item.textContent.toUpperCase().includes(value.toUpperCase())) {
              item.click();
              matched = true;
              console.log(`Tatkal Sniper: Autocomplete selected matching item: "${item.textContent.trim()}"`);
              break;
            }
          }
          if (!matched) {
            items[0].click();
            console.log(`Tatkal Sniper: Autocomplete fallback click first item: "${items[0].textContent.trim()}"`);
          }
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn(`Tatkal Sniper: Autocomplete panel did not load items for "${value}" after 3s.`);
          // Ultimate fallback: press Enter and blur
          inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
          resolve();
        }
      }, 100);
    });
  };

  // Helper: Select option from an Angular PrimeNG custom Dropdown
  const selectPrimeNGDropdown = async (dropdownEl, targetValue) => {
    if (!dropdownEl) return;

    // Check if a native select is present under the hood
    const nativeSelect = dropdownEl.querySelector('select');
    if (nativeSelect) {
      nativeSelect.value = targetValue;
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Interact with PrimeNG Custom UI element to trigger internal state changes
    const clickArea = dropdownEl.querySelector('.ui-dropdown-trigger') ||
      dropdownEl.querySelector('.p-dropdown-trigger') ||
      dropdownEl.querySelector('.ui-dropdown') ||
      dropdownEl.querySelector('.p-dropdown') ||
      dropdownEl;

    if (clickArea) {
      clickArea.click();

      // Wait for panel list items to mount
      await new Promise(resolve => setTimeout(resolve, 350));

      const panelItems = document.querySelectorAll('.ui-dropdown-item, .p-dropdown-item, .ui-dropdown-item-label, .p-dropdown-item-label');
      if (panelItems.length > 0) {
        let matchedItem = null;
        for (const item of panelItems) {
          const text = item.textContent.toUpperCase();
          const target = targetValue.toUpperCase().replace(/_/g, ' ');

          if (text.includes(`(${target})`) || text === target || text.includes(target) ||
              (targetValue && text.includes(targetValue.toUpperCase()))) {
            matchedItem = item;
            break;
          }
        }

        if (matchedItem) {
          matchedItem.click();
          console.log(`Tatkal Sniper: Selected PrimeNG dropdown option: "${matchedItem.textContent.trim()}"`);
        } else {
          // Click trigger again to close dropdown if no match found
          clickArea.click();
        }
      }
    }
  };

  // Helper: Find "+ Add Passenger" button by scanning the page text content
  // Picks the most specific (shortest text, smallest) visible element to avoid
  // accidentally matching large container divs that also contain the text.
  const findAddPassengerButton = () => {
    const elements = Array.from(document.querySelectorAll('a, button, span, label'));
    const candidates = elements.filter(el => {
      const txt = el.textContent.trim().toUpperCase();
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      return isVisible && txt.includes('ADD PASSENGER') && !txt.includes('INFANT WITHOUT BERTH');
    });
    // Sort by text length ascending to pick the most specific/smallest element
    candidates.sort((a, b) => a.textContent.trim().length - b.textContent.trim().length);
    return candidates[0] || null;
  };

  const findLoginHeaderButton = () => {
    const elements = Array.from(document.querySelectorAll('a, button, span'));
    return elements.find(el => {
      const txt = el.textContent.trim().toUpperCase();
      const isLoginText = (txt === 'LOGIN' || txt === 'LOGIN / REGISTER' || txt === 'LOGIN/REGISTER') && !txt.includes('AGENT');
      if (isLoginText) {
        return el.offsetWidth > 0 && el.offsetHeight > 0;
      }
      return false;
    });
  };

  const fillLoginPage = async () => {
    // Wait up to 3 seconds for login elements to mount in the DOM (handles transition render delays)
    let usernameInput = null;
    let passwordInput = null;
    let retries = 0;

    while (retries < 10) {
      usernameInput = document.querySelector('input[formcontrolname="userId"]') ||
        document.querySelector('input[formcontrolname*="user" i]') ||
        document.querySelector('input[placeholder*="User" i]') ||
        document.querySelector('input[id*="user" i]');

      passwordInput = document.querySelector('input[formcontrolname="password"]') ||
        document.querySelector('input[type="password"]') ||
        document.querySelector('input[placeholder*="Password" i]') ||
        document.querySelector('input[id*="pwd" i]');

      if (usernameInput && passwordInput) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      retries++;
    }

    if (!usernameInput || !passwordInput) {
      console.log('Tatkal Sniper: Login inputs not found in the DOM (modal may have been closed).');
      return;
    }

    const creds = tatkalExpressConfig ? tatkalExpressConfig.credentials : null;
    if (creds && creds.username) {
      // Only inject username/password if they are not already filled!
      // This stops constant focus-blurs that close modal dialogs or block logins
      if (usernameInput.value !== creds.username) {
        fillAngularInput(usernameInput, creds.username);
      }
      if (passwordInput.value !== creds.password) {
        fillAngularInput(passwordInput, creds.password);
      }
    }

    // Only proceed to auto-login if the fields are actually filled (either by us or browser autofill/user)
    if (!usernameInput.value || !passwordInput.value) {
      console.log('Tatkal Sniper: Username or password field is empty. Skipping auto-login trigger.');
      return;
    }

    const getVisibleCaptchaInput = () => {
      const inputs = [
        document.querySelector('input[formcontrolname="captcha"]'),
        document.querySelector('input[id="captcha"]'),
        document.querySelector('input[placeholder*="Captcha" i]')
      ];
      return inputs.find(el => el && el.offsetWidth > 0 && el.offsetHeight > 0) || null;
    };

    const captchaInput = getVisibleCaptchaInput();

    // Dynamic sign-in finder and click trigger
    const clickSignIn = () => {
      let loginBtn = null;

      // 1. First preference: Look inside the form enclosing the username/password
      if (usernameInput) {
        const form = usernameInput.closest('form');
        if (form) {
          loginBtn = form.querySelector('button[type="submit"]') ||
                     form.querySelector('button.loginBtn') ||
                     form.querySelector('button') ||
                     form.querySelector('input[type="submit"]');
        }
      }

      // 2. Second preference: Look for element with login button classes
      if (!loginBtn) {
        loginBtn = document.querySelector('button.loginBtn') ||
                   document.querySelector('.loginBtn button') ||
                   document.querySelector('input.loginBtn');
      }

      // 3. Third preference: Search standard clickable elements by text, normalizing whitespace (e.g. non-breaking spaces)
      if (!loginBtn) {
        loginBtn = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a')).find(el => {
          const txt = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toUpperCase();
          return txt === 'SIGN IN' || txt === 'SIGN-IN' || txt === 'LOGIN';
        });
      }

      // 4. Fourth preference: Fallback to any span/div text matching
      if (!loginBtn) {
        loginBtn = Array.from(document.querySelectorAll('span, div')).find(el => {
          const txt = el.textContent.replace(/\s+/g, ' ').trim().toUpperCase();
          return txt === 'SIGN IN' || txt === 'SIGN-IN';
        });
      }

      if (loginBtn) {
        console.log('Tatkal Sniper: Found Sign In button:', loginBtn);
        // Use a 2-second throttle timestamp to allow subsequent clicks if a click failed/ran too early
        const now = Date.now();
        const lastClicked = parseInt(loginBtn.dataset.teLastClicked || '0', 10);
        if (now - lastClicked > 2000) {
          loginBtn.dataset.teLastClicked = now.toString();
          console.log('Tatkal Sniper: Automatically clicking Sign In button...');
          loginBtn.focus();
          loginBtn.click();
          return true;
        } else {
          console.log('Tatkal Sniper: Sign In button clicked recently, throttling click.');
        }
      } else {
        console.warn('Tatkal Sniper: Sign In button not found in the DOM.');
      }
      return false;
    };

    // Attach Enter key submit listener to inputs
    const attachEnterListener = (inputEl) => {
      if (inputEl && !inputEl.dataset.teListenerAttached) {
        inputEl.dataset.teListenerAttached = "true";
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            clickSignIn();
          }
        });
      }
    };

    attachEnterListener(usernameInput);
    attachEnterListener(passwordInput);

    // Auto-focus and highlight captcha for extremely rapid manual entry
    if (captchaInput && (!tatkalExpressConfig || tatkalExpressConfig.preferences?.autoFocusCaptcha !== false)) {
      if (!captchaInput.classList.contains('te-highlight')) {
        captchaInput.classList.add('te-highlight');
        captchaInput.focus();
      }
      attachEnterListener(captchaInput);

      // Auto-submit on captcha blur (when user finishes typing and focus shifts)
      if (!captchaInput.dataset.teLoginListenerAttached) {
        captchaInput.dataset.teLoginListenerAttached = 'true';
        captchaInput.addEventListener('blur', () => {
          if (captchaInput.value.trim().length >= 3) {
            setTimeout(clickSignIn, 200);
          }
        });
      }

      // If a captcha input became visible, clear any scheduled auto-login click
      if (teSignInTimeout) {
        clearTimeout(teSignInTimeout);
        teSignInTimeout = null;
      }
    } else {
      // If there is no visible captcha input found on the page, wait 800ms and click Sign In automatically
      // Deduplicate using teSignInTimeout to prevent multiple overlapping timeouts
      if (!teSignInTimeout) {
        console.log('Tatkal Sniper: No visible captcha detected. Scheduling auto-login click in 800ms...');
        teSignInTimeout = setTimeout(() => {
          teSignInTimeout = null;
          const checkCaptcha = getVisibleCaptchaInput();
          if (!checkCaptcha) {
            console.log('Tatkal Sniper: No visible captcha input detected. Triggering auto-login sign in...');
            clickSignIn();
          } else {
            console.log('Tatkal Sniper: Captcha input became visible during delay. Cancelling auto-login.');
          }
        }, 800);
      }
    }
  };

  // Autofill Search / Journey selection page
  const fillSearchPage = async () => {
    const journey = tatkalExpressConfig.journey;
    if (!journey || !journey.fromStation) return;

    const autocompletes = document.querySelectorAll('p-autocomplete');

    // From Station
    const fromInput = document.querySelector('p-autocomplete[id="origin"] input') ||
      (autocompletes[0] && autocompletes[0].querySelector('input')) ||
      document.querySelector('input[aria-autocomplete="list"][placeholder*="From"]');
    if (fromInput && journey.fromStation && !fromInput.dataset.teAutofilled) {
      await fillAngularAutocomplete(fromInput, journey.fromStation);
      fromInput.dataset.teAutofilled = "true";
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // To Station
    const toInput = document.querySelector('p-autocomplete[id="destination"] input') ||
      (autocompletes[1] && autocompletes[1].querySelector('input')) ||
      document.querySelector('input[aria-autocomplete="list"][placeholder*="To"]');
    if (toInput && journey.toStation && !toInput.dataset.teAutofilled) {
      await fillAngularAutocomplete(toInput, journey.toStation);
      toInput.dataset.teAutofilled = "true";
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Date
    const calendars = document.querySelectorAll('p-calendar');
    const dateInput = document.querySelector('p-calendar[id="jDate"] input') ||
      (calendars[0] && calendars[0].querySelector('input')) ||
      document.querySelector('#jDate input') ||
      document.querySelector('p-calendar input') ||
      document.querySelector('input[placeholder*="Journey Date"]') ||
      document.querySelector('input[placeholder*="dd-mm-yyyy"]') ||
      document.querySelector('input[placeholder*="dd/mm/yyyy"]');
    if (dateInput && journey.journeyDate) {
      console.log(`Tatkal Sniper: Journey Date specified in popup config: "${journey.journeyDate}"`);
      // Extract numbers (digits) from the journeyDate string to safely support any separator format
      const numbers = journey.journeyDate.match(/\d+/g);
      if (numbers && numbers.length === 3) {
        let day, month, year;

        // Determine day, month, year based on position and length of the year
        if (numbers[0].length === 4) {
          // YYYY MM DD
          year = numbers[0];
          month = numbers[1];
          day = numbers[2];
        } else if (numbers[2].length === 4) {
          // DD MM YYYY
          day = numbers[0];
          month = numbers[1];
          year = numbers[2];
        } else {
          // Fallback: DD MM YY (or YY MM DD if first part > 12)
          if (parseInt(numbers[0]) > 12 && parseInt(numbers[1]) <= 12) {
            day = numbers[0];
            month = numbers[1];
            year = numbers[2];
          } else {
            year = numbers[0];
            month = numbers[1];
            day = numbers[2];
          }
        }

        if (day && month && year) {
          // Pad to standard 2-digit day and month, and reconstruct 4-digit year if 2-digit
          day = day.padStart(2, '0');
          month = month.padStart(2, '0');
          if (year.length === 2) {
            year = '20' + year;
          }

          const formattedDate = `${day}/${month}/${year}`; // DD/MM/YYYY
          console.log(`Tatkal Sniper: Parsed target date: "${formattedDate}". Current input value: "${dateInput.value}"`);

          // Normalize hyphens and slashes to prevent infinite reload loops
          const normalizedInput = dateInput.value.replace(/[-/]/g, '');
          const normalizedTarget = formattedDate.replace(/[-/]/g, '');
          if (normalizedInput !== normalizedTarget) {
            console.log(`Tatkal Sniper: Date mismatch. Triggering calendar autofill for: "${formattedDate}"`);
            await fillAngularCalendar(dateInput, formattedDate);
            await new Promise(resolve => setTimeout(resolve, 150));
          } else {
            console.log('Tatkal Sniper: Date input already matches configured target date.');
          }
        }
      } else {
        console.warn(`Tatkal Sniper: Invalid journey date format in configuration: "${journey.journeyDate}"`);
      }
    }

    const dropdowns = document.querySelectorAll('p-dropdown');

    // Journey Class Dropdown Selection (Only if not already selected to avoid dropdown cycling!)
    if (journey.journeyClass && journey.journeyClass !== 'ALL') {
      const classDropdown = document.querySelector('p-dropdown[formcontrolname="class"]') ||
        document.querySelector('p-dropdown[id="journeyClass"]') ||
        (dropdowns[0]) ||
        document.querySelector('p-dropdown[placeholder*="Class"]');
      if (classDropdown) {
        const labelEl = classDropdown.querySelector('.ui-dropdown-label, .p-dropdown-label');
        const currentText = labelEl ? labelEl.textContent.toUpperCase() : '';
        if (!currentText.includes(journey.journeyClass.toUpperCase())) {
          await selectPrimeNGDropdown(classDropdown, journey.journeyClass);
        }
      }
    }

    // Quota Dropdown Selection (Only if not already selected to avoid dropdown cycling!)
    if (journey.journeyQuota) {
      const quotaDropdown = document.querySelector('p-dropdown[formcontrolname="quota"]') ||
        document.querySelector('p-dropdown[id="journeyQuota"]') ||
        (dropdowns[1]) ||
        document.querySelector('p-dropdown[placeholder*="Quota"]');
      if (quotaDropdown) {
        const labelEl = quotaDropdown.querySelector('.ui-dropdown-label, .p-dropdown-label');
        const currentText = labelEl ? labelEl.textContent.toUpperCase() : '';
        const targetQuotaText = journey.journeyQuota.replace('_', ' ').toUpperCase();
        if (!currentText.includes(targetQuotaText)) {
          await selectPrimeNGDropdown(quotaDropdown, journey.journeyQuota);
        }
      }
    }

    // Find, highlight, and automatically click the Search/Find Trains button exactly once
    let searchBtn = document.querySelector('button[type="submit"][class*="search"]') ||
      document.querySelector('button[label*="Search"]') ||
      document.querySelector('button[label="Find Trains"]') ||
      document.querySelector('.search_btn') ||
      document.querySelector('button[class*="search"]') ||
      document.querySelector('button[type="submit"]');

    if (!searchBtn) {
      searchBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const txt = btn.textContent.trim().toUpperCase();
        return txt.includes('SEARCH') || txt.includes('FIND TRAINS');
      });
    }

    if (searchBtn && !searchBtn.dataset.teClicked) {
      searchBtn.dataset.teClicked = "true";
      searchBtn.classList.add('te-highlight');
      console.log('Tatkal Sniper: Details pre-filled. Auto-clicking Search button...');
      searchBtn.click();
    }
  };


  // Helper: unified query to count passenger name input rows on the page.
  // The IRCTC booking page wraps the name field in a <p-autocomplete>
  // with placeholder="Full Name as per Govt. ID" and aria-autocomplete="list".
  // It has NO formcontrolname on the inner <input> — placeholder is the only reliable key.
  const getPassengerNameInputs = () => {
    // Primary: exact placeholder used on psgninput page
    let results = document.querySelectorAll('input[placeholder="Full Name as per Govt. ID"]');
    if (results.length > 0) return results;

    // Secondary: any input inside a p-autocomplete that is visible
    results = Array.from(document.querySelectorAll('p-autocomplete input[type="text"]')).filter(
      el => el.offsetWidth > 0 && (el.placeholder || '').toLowerCase().includes('name')
    );
    if (results.length > 0) return results;

    // Tertiary: older IRCTC variants
    results = document.querySelectorAll(
      'input[placeholder*="Passenger Name"], input[formcontrolname*="passengerName"], input[placeholder*="Full Name"]'
    );
    if (results.length > 0) return results;

    // Last resort: any visible text input inside a table <td>
    const tableInputs = Array.from(document.querySelectorAll('td input[type="text"], tr input[type="text"]')).filter(el => {
      const ph = (el.placeholder || '').toLowerCase();
      return el.offsetWidth > 0 &&
        !ph.includes('age') && !ph.includes('mobile') && !ph.includes('gst') && !ph.includes('captcha');
    });
    return tableInputs;
  };

  // Helper: Automatically dismiss the "Select Passengers from Master List" modal dialog if it pops up
  const closeMasterListDialog = () => {
    const dialogs = document.querySelectorAll('p-dialog, .p-dialog, .ui-dialog');
    if (dialogs.length === 0) return;

    for (const dialog of dialogs) {
      if (dialog.offsetWidth > 0 && dialog.offsetHeight > 0) {
        const text = dialog.textContent.toUpperCase();
        if (text.includes('MASTER LIST') || text.includes('SELECT PASSENGER') || text.includes('ADD PASSENGER')) {
          // Find and click the close button in the header first
          const headerClose = dialog.querySelector('.p-dialog-header-close, .ui-dialog-titlebar-close, button[class*="close"]');
          if (headerClose && headerClose.offsetWidth > 0) {
            console.log('Tatkal Sniper: Auto-closing visible Master List dialog header close button...');
            headerClose.click();
            return;
          }

          // Or find any button inside containing "Close" or "Cancel"
          const buttons = Array.from(dialog.querySelectorAll('button'));
          const closeBtn = buttons.find(btn => {
            const btnText = btn.textContent.trim().toUpperCase();
            return (btnText === 'CLOSE' || btnText === 'CANCEL') && btn.offsetWidth > 0;
          });
          if (closeBtn) {
            console.log(`Tatkal Sniper: Auto-clicking "${closeBtn.textContent.trim()}" button to close Master List dialog...`);
            closeBtn.click();
            return;
          }
        }
      }
    }
  };

  // Autofill Passenger rows
  const fillPassengerPage = async () => {
    const passengers = tatkalExpressConfig.passengers;
    if (!passengers || passengers.length === 0) return;

    // Automatically close the master list dialog if it popped up to avoid blocking the page
    closeMasterListDialog();

    // Wait up to 5 seconds for at least 1 passenger row to mount in the DOM
    let nameInputs = getPassengerNameInputs();
    let retries = 0;
    while (nameInputs.length === 0 && retries < 10) {
      closeMasterListDialog();
      await new Promise(resolve => setTimeout(resolve, 200));
      nameInputs = getPassengerNameInputs();
      retries++;
    }

    if (nameInputs.length === 0) {
      console.log('Tatkal Sniper: Passenger input rows not found – will retry on next DOM update.');
      return;
    }

    // --- Phase 1: Add all missing passenger rows FIRST, before filling any data ---
    // For each missing row, click "+ Add Passenger" and confirm the count goes up.
    const neededRows = passengers.length;
    while (getPassengerNameInputs().length < neededRows) {
      const currentCount = getPassengerNameInputs().length;
      const addBtn = findAddPassengerButton();
      if (!addBtn) {
        console.warn('Tatkal Sniper: Add Passenger button not found – cannot add more rows.');
        break;
      }
      console.log(`Tatkal Sniper: Adding passenger row #${currentCount + 1} of ${neededRows}...`);
      addBtn.click();

      // Wait up to 2s for Angular to render the new row, checking every 200ms
      let waited = 0;
      while (getPassengerNameInputs().length <= currentCount && waited < 2000) {
        await new Promise(resolve => setTimeout(resolve, 200));
        waited += 200;
      }

      if (getPassengerNameInputs().length <= currentCount) {
        console.warn(`Tatkal Sniper: Row count did not increase after 2s. Stopping at ${currentCount} rows.`);
        break;
      }
    }

    nameInputs = getPassengerNameInputs();
    console.log(`Tatkal Sniper: ${nameInputs.length} passenger row(s) ready. Filling details for ${passengers.length} passenger(s)...`);

    // Ensure dialog is closed
    closeMasterListDialog();

    // Fill passenger details by looping through inputs
    for (let idx = 0; idx < passengers.length; idx++) {
      const p = passengers[idx];

      // ── Passenger Name (p-autocomplete) ───────────────────────────────────
      // The name field on IRCTC psgninput is a PrimeNG <p-autocomplete> component.
      // It behaves like the station search — we must use fillAngularAutocomplete
      // so Angular's internal change detection updates the reactive form model.
      const allNameInputs = getPassengerNameInputs();
      const nameInput = allNameInputs[idx];
      if (nameInput && p.name && nameInput.value !== p.name) {
        console.log(`Tatkal Sniper: Filling name for passenger #${idx + 1} via autocomplete: "${p.name}"`);
        await fillAngularAutocomplete(nameInput, p.name);
        // After autocomplete fires, close any dropdown suggestion panel by pressing Escape
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      // ── Passenger Age ──────────────────────────────────────────────────────
      // formcontrolname="passengerAge", type="number", placeholder="Age"
      // Confirmed from live DOM inspection.
      const allAgeInputs = document.querySelectorAll('input[formcontrolname="passengerAge"]');
      const ageInput = allAgeInputs[idx];
      if (ageInput && p.age && ageInput.value !== String(p.age)) {
        fillAngularInput(ageInput, String(p.age));
        console.log(`Tatkal Sniper: Filled age for passenger #${idx + 1}: ${p.age}`);
      }

      await new Promise(resolve => setTimeout(resolve, 120));

      // ── Gender (native <select>, formcontrolname="passengerGender") ────────
      // Options confirmed: "", "M", "F", "T"
      const allGenderSelects = document.querySelectorAll('select[formcontrolname="passengerGender"]');
      const genderSelect = allGenderSelects[idx];
      if (genderSelect && p.gender && genderSelect.value !== p.gender) {
        genderSelect.value = p.gender;
        genderSelect.dispatchEvent(new Event('change', { bubbles: true }));
        genderSelect.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`Tatkal Sniper: Set gender for passenger #${idx + 1}: ${p.gender}`);
      }

      await new Promise(resolve => setTimeout(resolve, 120));

      // ── Berth Preference (native <select>, formcontrolname="passengerBerthChoice") ──
      // Options confirmed: "", "LB", "MB", "UB", "SL", "SU"
      // Note: "NP" (No Preference) is represented as empty string "" in this select.
      const allBerthSelects = document.querySelectorAll('select[formcontrolname="passengerBerthChoice"]');
      const berthSelect = allBerthSelects[idx];
      if (berthSelect) {
        // Map our stored value "NP" -> "" (empty = no preference on IRCTC)
        const berthValue = p.berth === 'NP' ? '' : (p.berth || '');
        if (berthSelect.value !== berthValue) {
          berthSelect.value = berthValue;
          berthSelect.dispatchEvent(new Event('change', { bubbles: true }));
          berthSelect.dispatchEvent(new Event('input', { bubbles: true }));
          console.log(`Tatkal Sniper: Set berth for passenger #${idx + 1}: ${berthValue || 'No Preference'}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 120));

      // ── Food Preference ───────────────────────────────────────────────────
      // formcontrolname="passengerFoodChoice" (if present — not all trains have it)
      const allFoodSelects = document.querySelectorAll('select[formcontrolname="passengerFoodChoice"]');
      const foodSelect = allFoodSelects[idx];
      if (foodSelect && p.food && foodSelect.value !== p.food) {
        foodSelect.value = p.food;
        foodSelect.dispatchEvent(new Event('change', { bubbles: true }));
        foodSelect.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Mobile Number — confirmed id="mobileNumber", formcontrolname="mobileNumber"
    const mobileInput = document.querySelector('input[formcontrolname="mobileNumber"]') ||
      document.querySelector('input#mobileNumber') ||
      document.querySelector('input[placeholder*="mobile number" i]') ||
      document.querySelector('input[placeholder*="Mobile Number"]');
    if (mobileInput && tatkalExpressConfig.preferences.mobileNumber &&
        mobileInput.value !== tatkalExpressConfig.preferences.mobileNumber) {
      fillAngularInput(mobileInput, tatkalExpressConfig.preferences.mobileNumber);
      console.log('Tatkal Sniper: Filled mobile number.');
    }

    // Auto-Upgrade — confirmed formcontrolname="autoUpgradationSelected", id="autoUpgradation"
    if (tatkalExpressConfig.preferences.autoUpgrade) {
      const upgradeCheckbox = document.querySelector('input[formcontrolname="autoUpgradationSelected"]') ||
        document.querySelector('input#autoUpgradation');
      if (upgradeCheckbox && !upgradeCheckbox.checked) {
        upgradeCheckbox.click();
        console.log('Tatkal Sniper: Checked auto-upgrade.');
      }
    }

    // Confirm Berth Booking Preference
    if (tatkalExpressConfig.preferences.confirmBerthsOnly) {
      const confirmCheckbox = document.querySelector('label[for*="confirmBerth"]') ||
        document.querySelector('input[formcontrolname="bookOnlyIfConfirmBerths"]');
      if (confirmCheckbox && !confirmCheckbox.checked) {
        confirmCheckbox.click();
      }
    }

    // Travel Insurance Radio Selection
    const travelInsurancePref = tatkalExpressConfig.preferences.travelInsurance || 'YES';
    const yesRadio = document.querySelector('input[id*="travelInsuranceOptedY"]') ||
      document.querySelector('p-radioButton[value="Y"] input') ||
      document.querySelector('input[value="Y"][name*="insurance"]') ||
      document.querySelector('input[value="yes"][name*="insurance"]');

    const noRadio = document.querySelector('input[id*="travelInsuranceOptedN"]') ||
      document.querySelector('p-radioButton[value="N"] input') ||
      document.querySelector('input[value="N"][name*="insurance"]') ||
      document.querySelector('input[value="no"][name*="insurance"]');

    const selectInsuranceRadio = (radioEl) => {
      if (!radioEl) return;
      radioEl.click();
      const parent = radioEl.closest('p-radioButton') || radioEl.closest('.ui-radiobutton') || radioEl.closest('.p-radiobutton');
      if (parent) {
        parent.click();
      }
    };

    if (travelInsurancePref === 'YES' && yesRadio && !yesRadio.checked) {
      selectInsuranceRadio(yesRadio);
      console.log('Tatkal Sniper: Auto-selected Travel Insurance OPT-IN (YES)');
    } else if (travelInsurancePref === 'NO' && noRadio && !noRadio.checked) {
      selectInsuranceRadio(noRadio);
      console.log('Tatkal Sniper: Auto-selected Travel Insurance OPT-OUT (NO)');
    }

    // Auto-select Payment Mode on Passenger Input Page based on popup preferences
    const paymentPref = tatkalExpressConfig.preferences.preferredPayment || 'UPI';
    console.log(`Tatkal Sniper: Selecting payment mode: ${paymentPref}`);

    // Helper: walk up ancestor chain (up to maxLevels) to collect meaningful text
    // NOTE: PrimeNG radios hide the native <input> with CSS (opacity:0/position:absolute),
    //       so we MUST NOT filter by the input's own offsetWidth/offsetHeight.
    //       Instead we check the parent container's visibility.
    const getAncestorText = (el, maxLevels = 6) => {
      let node = el;
      for (let i = 0; i < maxLevels; i++) {
        if (!node) break;
        const txt = node.textContent.trim().toUpperCase();
        if (txt.length > 3) return txt; // return first ancestor with any real text
        node = node.parentElement;
      }
      return '';
    };

    // Check if a container element is actually visible on screen
    const isContainerVisible = (el) => {
      let node = el;
      for (let i = 0; i < 4; i++) {
        if (!node) break;
        if (node.offsetWidth > 0 && node.offsetHeight > 0) return true;
        node = node.parentElement;
      }
      return false;
    };

    // Scan ALL radio inputs (including PrimeNG hidden ones) — visibility check is on parent
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
    let paymentRadio = null;

    for (const radio of allRadios) {
      // Skip if the entire parent container is invisible (truly hidden section)
      if (!isContainerVisible(radio.parentElement)) continue;

      // Build text from: explicit <label for="id">, then walking up ancestors
      const labelEl = radio.id ? document.querySelector(`label[for="${radio.id}"]`) : null;
      const labelTxt = labelEl ? labelEl.textContent.trim().toUpperCase() : '';
      const ancestorTxt = getAncestorText(radio.parentElement);
      const combinedTxt = labelTxt + ' ' + ancestorTxt;

      const useUPIOptionOnPassengerPage = (paymentPref === 'UPI');

      if (useUPIOptionOnPassengerPage) {
        // Target: "Pay through BHIM/UPI" — must exclude the combined Cards+UPI_CC option
        if ((combinedTxt.includes('BHIM/UPI') || combinedTxt.includes('BHIM')) &&
          !combinedTxt.includes('CREDIT') && !combinedTxt.includes('NET BANKING')) {
          paymentRadio = radio;
          console.log(`Tatkal Sniper: Found BHIM/UPI radio. Label text: "${labelTxt || ancestorTxt.slice(0, 60)}"`);
          break;
        }
      } else {
        // Target: "Pay through Credit & Debit Cards / Net Banking..."
        if (combinedTxt.includes('CREDIT') || combinedTxt.includes('DEBIT') ||
          combinedTxt.includes('NET BANKING') || combinedTxt.includes('CARD') ||
          combinedTxt.includes('WALLET') || combinedTxt.includes('EMI')) {
          paymentRadio = radio;
          console.log(`Tatkal Sniper: Found Cards/NB radio. Label text: "${labelTxt || ancestorTxt.slice(0, 60)}"`);
          break;
        }
      }
    }

    if (paymentRadio) {
      if (!paymentRadio.checked) {
        console.log(`Tatkal Sniper: Clicking payment radio for: ${paymentPref}`);
        // Scroll to the parent container (not the hidden input itself)
        const scrollTarget = paymentRadio.closest('.p-radiobutton, .ui-radiobutton, label, div') || paymentRadio.parentElement;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Click the native input
        paymentRadio.click();
        paymentRadio.dispatchEvent(new Event('change', { bubbles: true }));
        // Also click the PrimeNG wrapper container so Angular registers the change
        const primeWrapper = paymentRadio.closest('p-radiobutton, .p-radiobutton, .ui-radiobutton');
        if (primeWrapper) primeWrapper.click();
        const parentLabel = paymentRadio.closest('label');
        if (parentLabel) parentLabel.click();
      } else {
        console.log(`Tatkal Sniper: Payment mode "${paymentPref}" is already selected.`);
      }
    } else {
      console.warn(`Tatkal Sniper: Could not find payment radio for preference: ${paymentPref}. Radios found: ${allRadios.length}`);
    }

    // Wait briefly for Angular to register the payment selection, then click Continue
    await new Promise(resolve => setTimeout(resolve, 150));

    const continueBtn = Array.from(document.querySelectorAll('button, input[type="submit"], a')).find(el => {
      const txt = el.textContent.trim().toUpperCase();
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      return isVisible && (txt === 'CONTINUE' || txt === 'PROCEED' || txt.includes('CONTINUE'));
    });

    if (continueBtn && !continueBtn.dataset.teClicked) {
      continueBtn.dataset.teClicked = 'true';
      console.log('Tatkal Sniper: Clicking Continue button to proceed to payment gateway...');
      continueBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      continueBtn.click();
    } else if (!continueBtn) {
      console.warn('Tatkal Sniper: Continue button not found on passenger page.');
    }

    console.log('Tatkal Sniper: Passenger details autofilled successfully.');
  };

  // Handle the Review Journey page — focus captcha, auto-click Continue when filled
  const fillReviewPage = () => {
    // Find the captcha input field
    const captchaInput = document.querySelector('input[placeholder*="Captcha" i]') ||
      document.querySelector('input[id*="captcha" i]') ||
      document.querySelector('input[formcontrolname*="captcha" i]') ||
      document.querySelector('input[type="text"][placeholder*="Enter" i]');

    if (!captchaInput) {
      console.log('Tatkal Sniper: Captcha input not found on Review page yet.');
      return;
    }

    // Highlight and auto-focus so user can type immediately
    if (!captchaInput.classList.contains('te-highlight')) {
      captchaInput.classList.add('te-highlight');
      captchaInput.focus();
      console.log('Tatkal Sniper: Captcha field focused. Type the captcha — Continue will auto-click.');
    }

    // Attach listener only once (guard with dataset flag)
    if (captchaInput.dataset.teReviewListenerAttached) return;
    captchaInput.dataset.teReviewListenerAttached = 'true';

    // Auto-click Continue when user presses Enter in captcha field
    captchaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clickContinueOnReviewPage();
      }
    });

    // Also auto-click Continue when captcha field loses focus (blur) with a value filled
    captchaInput.addEventListener('blur', () => {
      if (captchaInput.value.trim().length >= 3) {
        setTimeout(clickContinueOnReviewPage, 200);
      }
    });
  };

  const clickContinueOnReviewPage = () => {
    const continueBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find(el => {
      const txt = el.textContent.trim().toUpperCase();
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      return isVisible && (txt === 'CONTINUE' || txt.includes('CONTINUE'));
    });
    if (continueBtn && !continueBtn.dataset.teClicked) {
      continueBtn.dataset.teClicked = 'true';
      console.log('Tatkal Sniper: Captcha filled. Auto-clicking Continue on Review page...');
      continueBtn.click();
    }
  };

  // Autofill/Highlight/Select payment choice page
  // Autofill/Highlight/Select payment choice page
  const highlightPaymentPage = async () => {
    const paymentChoice = tatkalExpressConfig.preferences.preferredPayment;
    if (!paymentChoice) return;

    const body = document.body;
    console.log(`Tatkal Sniper: Running automated payment selection check for: ${paymentChoice}`);

    // Helper: Check if an element is inside the top header/navigation menu
    const isInHeader = (el) => {
      let current = el;
      while (current && current !== document.body) {
        const tag = current.tagName.toUpperCase();
        if (tag === 'HEADER' || tag === 'NAV' || tag === 'APP-HEADER') return true;
        
        // If we hit any main content page components (like APP-BKG-PAYMENT-OPTIONS), we are definitely NOT in the header!
        if (tag.startsWith('APP-') && tag !== 'APP-HEADER') {
          return false;
        }
        
        const cls = String(current.className || '').toLowerCase();
        const id = String(current.id || '').toLowerCase();
        
        if (cls.includes('top-bar') || cls.includes('topbar') || cls.includes('navbar') || cls.includes('nav-bar') ||
            id.includes('top-bar') || id.includes('topbar') || id.includes('navbar') || id.includes('nav-bar')) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    // Helper 1: Click matching category in the left sidebar
    const clickLeftPaymentCategory = () => {
      // Prioritize searching inside the payment options block/tabs container to avoid matching top header menus
      let elements = [];
      const tabsContainer = document.querySelector('.payment-tabs, app-payment-options, app-bkg-payment-options, .payment-tab, .payment-tabs-li');
      if (tabsContainer) {
        elements = Array.from(tabsContainer.querySelectorAll('div, span, li, a, td, tr, label, button'));
      }

      // Fallback to full document if container is not matched
      if (elements.length === 0) {
        elements = Array.from(document.querySelectorAll('div, span, li, a, p-tabmenuitem, td, tr, label, button'));
      }

      const choiceUpper = paymentChoice.toUpperCase();

      const categoryMap = {
        'UPI': ['BHIM', 'UPI', 'USSD'],
        'IPAY': ['IPAY', 'IRCTC IPAY'],
        'EWALLET': ['E-WALLET', 'EWALLET', 'E WALLET', 'IRCTC E-WALLET', 'IRCTC EWALLET', 'IRCTC E WALLET'],
        'MULTIPLE': ['MULTIPLE PAYMENT', 'MULTIPLE'],
        'NETBANKING': ['NETBANKING', 'NET BANKING'],
        'GATEWAY': ['PAYMENT GATEWAY', 'CREDIT CARD', 'DEBIT CARD'],
        'WALLETS': ['WALLETS', 'CASH CARD'],
        'EMI': ['EMI'],
        'LOYALTY': ['LOYALITY', 'LOYALTY']
      };

      const queries = categoryMap[choiceUpper] || [choiceUpper];

      let candidates = [];
      for (const el of elements) {
        const txt = el.textContent.trim().toUpperCase();
        // Skip if not visible, has too much text, or is inside the top header menu
        if (el.offsetWidth === 0 || el.offsetHeight === 0 || txt.length > 100 || isInHeader(el)) continue;

        const isMatch = queries.some(q => txt.includes(q));
        if (isMatch) {
          candidates.push({ el, text: txt });
        }
      }

      if (candidates.length > 0) {
        // Sort by text length ascending to click the most specific leaf element
        candidates.sort((a, b) => a.text.length - b.text.length);
        const target = candidates[0].el;
        console.log(`Tatkal Sniper: Clicking left payment category: "${candidates[0].text}"`);
        clickElement(target);
        
        // Also click parent elements (up to 2 levels) to ensure Angular event listeners on outer wrappers are fired
        let clickParent = target.parentElement;
        for (let i = 0; i < 2; i++) {
          if (clickParent && clickParent !== document.body) {
            const tagName = clickParent.tagName.toUpperCase();
            if (tagName === 'TD' || tagName === 'DIV' || tagName === 'LI' || tagName === 'A' || tagName.includes('TAB')) {
              console.log(`Tatkal Sniper: Clicking left payment category parent wrapper (${tagName}):`, clickParent);
              clickElement(clickParent);
            }
            clickParent = clickParent.parentElement;
          } else {
            break;
          }
        }
        return true;
      }
      return false;
    };

    // Helper 2: Click matching gateway option in the right side panel
    const clickRightPaymentOption = () => {
      const choiceUpper = paymentChoice.toUpperCase();
      const allDivs = Array.from(document.querySelectorAll('div, label, p-radioButton, input, span, td, a'));
      
      let candidates = [];
      for (const el of allDivs) {
        const txt = el.textContent.trim().toUpperCase();
        if (el.offsetWidth === 0 || el.offsetHeight === 0 || txt.length > 200 || isInHeader(el)) continue;

        let matchesChoice = false;
        if (choiceUpper === 'UPI') {
          matchesChoice = txt.includes('UPI') || txt.includes('BHIM') || txt.includes('PAYTM') || txt.includes('PHONEPE');
        } else if (choiceUpper === 'IPAY') {
          matchesChoice = txt.includes('IPAY') || txt.includes('IRCTC IPAY') || txt.includes('CREDIT') || txt.includes('DEBIT') || txt.includes('POWERED BY IRCTC');
        } else if (choiceUpper === 'EWALLET') {
          matchesChoice = txt.includes('EWALLET') || txt.includes('E-WALLET') || txt.includes('E WALLET') || txt.includes('IRCTC EWALLET') || txt.includes('IRCTC E-WALLET') || txt.includes('IRCTC E WALLET');
        } else if (choiceUpper === 'MULTIPLE') {
          matchesChoice = txt.includes('MULTIPLE') || txt.includes('SERVICE') || txt.includes('GATEWAY') || txt.includes('PINE') || txt.includes('PAYTM');
        } else if (choiceUpper === 'NETBANKING') {
          matchesChoice = txt.includes('NET BANKING') || txt.includes('NETBANKING') || txt.includes('BANK');
        } else if (choiceUpper === 'GATEWAY') {
          matchesChoice = txt.includes('GATEWAY') || txt.includes('CREDIT CARD') || txt.includes('DEBIT CARD') || txt.includes('CARD');
        } else if (choiceUpper === 'WALLETS') {
          matchesChoice = txt.includes('WALLET') || txt.includes('CASH CARD') || txt.includes('MOBIKWIK') || txt.includes('PAYTM');
        } else if (choiceUpper === 'EMI') {
          matchesChoice = txt.includes('EMI') || txt.includes('INSTALLMENT');
        } else if (choiceUpper === 'LOYALTY') {
          matchesChoice = txt.includes('LOYALTY') || txt.includes('LOYALITY') || txt.includes('REDEMPTION');
        }

        if (matchesChoice) {
          candidates.push({ el, text: txt });
        }
      }

      // Fallback: If no candidate matched the specific search, look for first visible radio/input inside right panel
      if (candidates.length === 0) {
        console.log('Tatkal Sniper: Specific right panel option not matched. Finding first available radio option...');
        const rightPanelRadios = Array.from(document.querySelectorAll('p-radioButton, input[type="radio"]')).filter(el => {
          return el.offsetWidth > 0 && el.offsetHeight > 0 && !isInHeader(el);
        });

        if (rightPanelRadios.length > 0) {
          const firstRadio = rightPanelRadios[0];
          candidates.push({ el: firstRadio, text: firstRadio.textContent || 'FIRST RADIO' });
        }
      }

      if (candidates.length > 0) {
        // Sort by text length ascending to get the most specific option wrapper
        candidates.sort((a, b) => a.text.length - b.text.length);
        const target = candidates[0].el;
        console.log(`Tatkal Sniper: Clicking right payment option: "${candidates[0].text}"`);
        
        clickElement(target);
        const nativeInput = target.querySelector('input[type="radio"]');
        if (nativeInput) clickElement(nativeInput);
        
        // Highlight it
        target.classList.add('te-highlight');
        return true;
      }
      return false;
    };

    // Helper 3: Click the orange "Pay & Book" / "Pay" button
    const clickPayAndBookButton = () => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a, span'));
      const payBtn = buttons.find(el => {
        const txt = el.textContent.trim().toUpperCase();
        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
        return isVisible && (
          txt === 'PAY & BOOK' || 
          txt === 'PAY AND BOOK' || 
          txt === 'PAY' || 
          txt.includes('PAY & BOOK') || 
          txt.includes('PAY AND BOOK') ||
          txt.includes('ADD AND PAY') ||
          txt.includes('ADD & PAY')
        );
      });

      if (payBtn && !payBtn.dataset.teClicked) {
        payBtn.dataset.teClicked = 'true';
        payBtn.classList.add('te-highlight');
        console.log(`Tatkal Sniper: Auto-clicking final Pay & Book / Add and Pay button: "${payBtn.textContent.trim()}"`);
        clickElement(payBtn);
        return true;
      }
      return false;
    };

    // Step 1: Click left sidebar category (if not already clicked)
    if (!body.dataset.teLeftCategoryClicked) {
      const categoryClicked = clickLeftPaymentCategory();
      if (categoryClicked) {
        body.dataset.teLeftCategoryClicked = "true";
        body.dataset.teLeftCategoryTime = Date.now().toString();
      } else {
        console.log('Tatkal Sniper: Left sidebar categories not loaded or visible yet. Waiting...');
        return;
      }
    }

    // Step 2: Click right sidebar option (if not already clicked)
    if (!body.dataset.teRightOptionClicked) {
      const leftTime = parseInt(body.dataset.teLeftCategoryTime || '0', 10);
      const elapsed = Date.now() - leftTime;
      if (elapsed < 600) {
        console.log('Tatkal Sniper: Waiting for right side options to render...');
        return; // Wait at least 600ms for right-side options to load after left click
      }

      // Check if "ADD AND PAY" button is already visible (insufficient balance bypass)
      const hasAddAndPay = Array.from(document.querySelectorAll('button, input, a, span')).some(el => {
        const txt = el.textContent.toUpperCase();
        return (txt.includes('ADD AND PAY') || txt.includes('ADD & PAY')) && el.offsetWidth > 0 && el.offsetHeight > 0;
      });

      if (hasAddAndPay) {
        console.log('Tatkal Sniper: "Add and Pay" button is visible (insufficient balance). Bypassing right option selection.');
        body.dataset.teRightOptionClicked = "true";
        body.dataset.teRightOptionTime = Date.now().toString();
      } else {
        const optionClicked = clickRightPaymentOption();
        if (optionClicked) {
          body.dataset.teRightOptionClicked = "true";
          body.dataset.teRightOptionTime = Date.now().toString();
        } else {
          console.warn('Tatkal Sniper: Right side options not found or mismatch. Retrying in next cycle...');
          return;
        }
      }
    }

    // Step 3: Click final "Pay & Book" button (if not already clicked)
    if (!body.dataset.tePayBookClicked) {
      const rightTime = parseInt(body.dataset.teRightOptionTime || '0', 10);
      const elapsed = Date.now() - rightTime;
      if (elapsed < 800) {
        console.log('Tatkal Sniper: Waiting before clicking final Pay & Book button...');
        return;
      }

      const payBookClicked = clickPayAndBookButton();
      if (payBookClicked) {
        body.dataset.tePayBookClicked = "true";
      }
    }
  };

  // Automate train selection, class click, and book now transition
  const selectTrainAndClass = async () => {
    // Decoupled Confirmation/Alert dismisser logic: Run continuously whenever confirmation popups render
    const agreeBtn = Array.from(document.querySelectorAll('span, button, div, a')).find(el => {
      const txt = el.textContent.trim().toUpperCase();
      return txt === 'I AGREE' || txt === 'AGREE' || txt === 'YES' || txt === 'OK' || txt === 'PROCEED' || txt.includes('I AGREE');
    });

    if (agreeBtn) {
      const rect = agreeBtn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const now = Date.now();
        const lastClicked = parseInt(agreeBtn.dataset.teLastClicked || '0', 10);
        if (now - lastClicked > 2000) {
          agreeBtn.dataset.teLastClicked = now.toString();
          console.log('Tatkal Sniper: Automatically clicking visible confirmation dialog button: ' + agreeBtn.textContent.trim());
          clickElement(agreeBtn);
          return; // Pause and let the mutation observer re-evaluate once DOM updates
        }
      }
    }

    const journey = tatkalExpressConfig.journey;
    if (!journey) {
      console.log('Tatkal Sniper: No journey configuration found.');
      return;
    }

    const trainNo = journey.trainNumber ? journey.trainNumber.trim() : '';
    const targetClass = journey.journeyClass || '3A';

    console.log(`Tatkal Sniper: Scanning page for train [${trainNo || 'FIRST AVAILABLE'}] and class [${targetClass}]`);

    // 1. Locate the train card container
    let matchedCard = null;

    if (trainNo) {
      // Find the specific leaf node containing the train number
      const leafElements = Array.from(document.querySelectorAll('strong, span, div, a, b, td, th')).filter(el => el.children.length === 0);
      const trainNumEl = leafElements.find(el => {
        const txt = el.textContent.trim();
        return txt.includes(trainNo) && txt.length < 50;
      });

      if (trainNumEl) {
        console.log(`Tatkal Sniper: Found train number leaf element:`, trainNumEl);
        // Traverse up to find the enclosing train card container
        let current = trainNumEl;
        while (current && current !== document.body) {
          const txt = current.textContent.toUpperCase();
          const hasClassOptions = txt.includes('REFRESH') || txt.includes('CHAIR CAR') || txt.includes('SITTING') || txt.includes('SLEEPER') || txt.includes('AVAILABLE-') || txt.includes('WL');
          const hasActionBtns = txt.includes('BOOK NOW') || txt.includes('OTHER DATES');
          const isCardTag = current.tagName.startsWith('APP-') || current.classList.contains('train-container') || current.classList.contains('train-card');

          if ((hasClassOptions && hasActionBtns) || isCardTag) {
            matchedCard = current;
            break;
          }
          current = current.parentElement;
        }
      }
    }

    // Fallback: If no train number is specified or no card matched, search for the first train card using "Runs On:" indicator
    if (!matchedCard) {
      const runsOnLeafElements = Array.from(document.querySelectorAll('div, span, td, th')).filter(el => el.children.length === 0 && el.textContent.includes('Runs On:'));
      for (const runsOnEl of runsOnLeafElements) {
        let current = runsOnEl;
        while (current && current !== document.body) {
          const txt = current.textContent.toUpperCase();
          const hasClassOptions = txt.includes('REFRESH') || txt.includes('CHAIR CAR') || txt.includes('SITTING') || txt.includes('SLEEPER') || txt.includes('AVAILABLE-') || txt.includes('WL');
          const hasActionBtns = txt.includes('BOOK NOW') || txt.includes('OTHER DATES');
          if (hasClassOptions && hasActionBtns) {
            matchedCard = current;
            break;
          }
          current = current.parentElement;
        }
        if (matchedCard) {
          console.log('Tatkal Sniper: Selecting first train card on screen as fallback.');
          break;
        }
      }
    }

    // Ultimate fallback to existing selectors
    if (!matchedCard) {
      const trainCards = Array.from(document.querySelectorAll('app-train-list-by-train, div[class*="train-list-by-train"], div.train-container, div[class*="train-card"]'));
      if (trainCards.length > 0) {
        matchedCard = trainCards[0];
        console.log('Tatkal Sniper: Selector fallback to first train card.');
      }
    }

    if (!matchedCard) {
      console.log('Tatkal Sniper: Train results list cards not found on this screen yet.');
      return;
    }

    // Highlighting the matched train card
    if (!matchedCard.classList.contains('te-highlight')) {
      matchedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      matchedCard.classList.add('te-highlight');
      console.log('Tatkal Sniper: Found train! Scroll and highlight applied.');
    }

    // 2. Find and click the Class button (e.g. SL, 3A, 2A) inside that train card
    let targetClassBtn = null;
    const normTarget = targetClass.toUpperCase().replace(/\s+/g, '');

    // Search for elements containing the class name, preferring smaller/leaf elements
    const classCandidates = Array.from(matchedCard.querySelectorAll('td, div, span, button, strong, li, a')).filter(el => {
      if (el.children.length > 3) return false; // Skip large layouts
      
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase();
      if (!txt) return false;

      // Class-specific matching rules
      const hasExactClass = txt === normTarget || txt.includes(`(${normTarget})`);
      const hasACPrefix = txt.includes(`AC ${normTarget}`) || txt.includes(`AC${normTarget}`);
      
      const isSleeper = normTarget === 'SL' && (txt.includes('SLEEPER') || txt.includes('SL'));
      const is3A = normTarget === '3A' && (txt.includes('AC 3 TIER') || txt.includes('AC3TIER') || txt.includes('3A') || txt.includes('3 A'));
      const is2A = normTarget === '2A' && (txt.includes('AC 2 TIER') || txt.includes('AC2TIER') || txt.includes('2A') || txt.includes('2 A'));
      const is1A = normTarget === '1A' && (txt.includes('AC FIRST CLASS') || txt.includes('AC1') || txt.includes('1A'));
      const is3E = normTarget === '3E' && (txt.includes('AC 3 ECONOMY') || txt.includes('AC3E') || txt.includes('3E'));
      const isCC = normTarget === 'CC' && (txt.includes('CHAIR CAR') || txt.includes('CC'));
      const is2S = normTarget === '2S' && (txt.includes('SECOND SITTING') || txt.includes('2S'));

      return hasExactClass || hasACPrefix || isSleeper || is3A || is2A || is1A || is3E || isCC || is2S;
    });

    if (classCandidates.length > 0) {
      // Sort candidates:
      // 1. Fewer children first (leaf nodes)
      // 2. Shorter text length first (more specific match)
      classCandidates.sort((a, b) => {
        const childrenDiff = a.children.length - b.children.length;
        if (childrenDiff !== 0) return childrenDiff;
        return a.textContent.length - b.textContent.length;
      });
      targetClassBtn = classCandidates[0];
      console.log('Tatkal Sniper: Selected best class button candidate:', targetClassBtn);
    }

    // Check if seat availability details (like AVAILABLE-, WL, RAC, REGRET) are already loaded and visible in this card
    const hasAvailabilityLoaded = Array.from(matchedCard.querySelectorAll('div, span, td, strong')).some(el => {
      const txt = el.textContent.trim().toUpperCase();
      return txt.includes('AVAILABLE-') || txt.includes('WL') || txt.includes('RAC') || txt.includes('CURR_AVBL') || txt.includes('REGRET');
    });

    if (!hasAvailabilityLoaded) {
      if (targetClassBtn) {
        const now = Date.now();
        const lastClicked = parseInt(targetClassBtn.dataset.teLastClicked || '0', 10);
        if (now - lastClicked > 5000) { // Limit click to at most once every 5 seconds to prevent spamming slow requests
          targetClassBtn.dataset.teLastClicked = now.toString();
          console.log(`Tatkal Sniper: Clicking class button inside train card: "${targetClassBtn.textContent.trim()}"`);
          clickElement(targetClassBtn);
        } else {
          console.log('Tatkal Sniper: Class button clicked recently. Waiting for availability response...');
        }
      } else {
        console.log('Tatkal Sniper: Target class button not found inside matched train card.');
      }
      return; // Early return! Do not proceed to select date or click Book Now since availability is not loaded.
    }

    // Once availability is loaded, select the specific journey date card to enable the Book Now button
    // Helper to check if a specific element or its parent/child is visually selected/active
    const checkVisualSelection = (el) => {
      if (!el) return false;
      const hasClass = (elem) => {
        if (!elem || !elem.classList) return false;
        for (const cls of elem.classList) {
          const c = cls.toLowerCase();
          // Exclude carousel wrappers, train containers, custom highlights, and generic outer wrappers
          if (c.includes('carousel') || c.includes('train') || c.includes('te-') || c.includes('card-wrapper')) continue;
          if (c.includes('selected') || c.includes('active') || c === 'ui-state-active' || c.includes('highlight')) {
            return true;
          }
        }
        if (elem.getAttribute('aria-selected') === 'true') return true;
        return false;
      };
      
      if (hasClass(el)) return true;
      // Only check immediate parent to avoid climbing up to active train card or carousel item wrapper
      if (el.parentElement && hasClass(el.parentElement)) return true;
      
      const desc = el.querySelectorAll('*');
      for (const d of desc) {
        if (hasClass(d)) return true;
      }
      return false;
    };

    let dateCard = null;
    const allDivs = Array.from(matchedCard.querySelectorAll('div, td, span, li, a'));

    // Try finding configured date card
    if (journey.journeyDate) {
      const numbers = journey.journeyDate.match(/\d+/g);
      if (numbers && numbers.length === 3) {
        let day, month;
        if (numbers[0].length === 4) {
          month = parseInt(numbers[1]);
          day = parseInt(numbers[2]);
        } else {
          day = parseInt(numbers[0]);
          month = parseInt(numbers[1]);
        }

        const monthsShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const targetMonth = monthsShort[month - 1];
        const targetDay = String(day).padStart(2, '0');
        const targetDayShort = String(day);

        const dateCardCandidates = allDivs.filter(el => {
          const rawTxt = el.textContent.trim().toUpperCase();
          // Strip availability stats like AVAILABLE-0096, WL-6 to avoid false matches on day number
          const cleanTxt = rawTxt.replace(/(AVAILABLE|WL|RAC|REGRET|CURR_AVBL)-?\d*/g, '').trim();
          
          const hasMonth = cleanTxt.includes(targetMonth);
          const dayRegex = new RegExp(`\\b0?${day}\\b`);
          const hasDay = dayRegex.test(cleanTxt);
          const isNotBookNow = !rawTxt.includes('BOOK NOW') && !rawTxt.includes('OTHER DATES');
          return hasMonth && hasDay && isNotBookNow && el.offsetWidth > 0 && el.offsetHeight > 0 && rawTxt.length < 80;
        });

        if (dateCardCandidates.length > 0) {
          // Sort to prioritize status containing leaf elements
          dateCardCandidates.sort((a, b) => {
            const aHasStatus = /AVAILABLE|WL|RAC|REGRET|CURR_AVBL/.test(a.textContent.toUpperCase());
            const bHasStatus = /AVAILABLE|WL|RAC|REGRET|CURR_AVBL/.test(b.textContent.toUpperCase());
            if (aHasStatus && !bHasStatus) return -1;
            if (!aHasStatus && bHasStatus) return 1;
            return a.textContent.length - b.textContent.length;
          });
          dateCard = dateCardCandidates[0];
          console.log('Tatkal Sniper: Matched configured journey date card:', dateCard);
        }
      }
    }

    // Fallback: Find the first visible date card
    if (!dateCard) {
      console.log('Tatkal Sniper: Specific configured journey date card not found or matched. Finding first visible date card...');
      const fallbackDates = allDivs.filter(el => {
        const txt = el.textContent.toUpperCase();
        const hasStatus = /AVAILABLE|WL|RAC|REGRET|CURR_AVBL/.test(txt);
        const isNotBookNow = !txt.includes('BOOK NOW') && !txt.includes('OTHER DATES');
        return hasStatus && isNotBookNow && el.offsetWidth > 0 && el.offsetHeight > 0 && txt.length < 80;
      });

      if (fallbackDates.length > 0) {
        // Sort by visual horizontal coordinates to find the leftmost group (representing the first card)
        fallbackDates.sort((a, b) => {
          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();
          return rectA.left - rectB.left;
        });

        const leftmostLeft = fallbackDates[0].getBoundingClientRect().left;
        const leftmostCandidates = fallbackDates.filter(el => Math.abs(el.getBoundingClientRect().left - leftmostLeft) < 15);

        // Sort by text length (shortest text first) to get the most specific leaf node in the leftmost card
        leftmostCandidates.sort((a, b) => a.textContent.length - b.textContent.length);
        dateCard = leftmostCandidates[0];
        console.log('Tatkal Sniper: Selecting first date card as fallback:', dateCard);
      }
    }

    // Handle date card clicks and selection guards
    if (dateCard) {
      const isSelected = checkVisualSelection(dateCard);
      const now = Date.now();
      const lastClicked = parseInt(dateCard.dataset.teLastClicked || '0', 10);

      if (isSelected) {
        console.log('Tatkal Sniper: Date card is visually selected. Ready to click Book Now.');
      } else if (now - lastClicked < 600) {
        console.log('Tatkal Sniper: Date card clicked recently. Waiting for selection to register in DOM...');
        return; // Early return! Wait for the MutationObserver to evaluate in the next cycle.
      } else if (now - lastClicked < 2500) {
        console.log('Tatkal Sniper: Date card clicked, visual check fallback triggered. Proceeding to Book Now.');
      } else {
        dateCard.dataset.teLastClicked = now.toString();
        console.log(`Tatkal Sniper: Selecting date card. Clicking:`, dateCard);
        clickElement(dateCard);
        
        // Click any interactive child divs inside (e.g. <div class="pre-avl"> or with tabindex)
        const interactiveChildren = dateCard.querySelectorAll('div.pre-avl, div.pre-avail, div[class*="avl"], div[class*="avail"], div[tabindex="0"]');
        for (const child of interactiveChildren) {
          console.log('Tatkal Sniper: Clicking date card interactive child:', child);
          clickElement(child);
        }
        
        // Also click parent elements (up to 2 levels) to ensure click listeners on outer wrappers (like TD or card DIV) are triggered
        let clickParent = dateCard.parentElement;
        for (let i = 0; i < 2; i++) {
          if (clickParent && clickParent !== matchedCard && clickParent !== document.body) {
            const tagName = clickParent.tagName.toUpperCase();
            if (tagName === 'TD' || tagName === 'DIV' || tagName === 'A') {
              console.log(`Tatkal Sniper: Clicking date card parent wrapper (${tagName}):`, clickParent);
              clickElement(clickParent);
            }
            clickParent = clickParent.parentElement;
          } else {
            break;
          }
        }
        return; // Early return! Let Angular process selection before we scan for Book Now.
      }
    } else {
      console.warn('Tatkal Sniper: No date card (configured or fallback) found. Skipping Book Now click.');
      return; // Early return! Avoid premature submission error.
    }

    // Now scan and click the "Book Now" button for this train
    let bookBtn = null;
    const bookBtnCandidates = Array.from(matchedCard.querySelectorAll('button, input, a, span, div')).filter(el => {
      const txt = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toUpperCase();
      return txt === 'BOOK NOW' || txt.includes('BOOK NOW');
    });

    if (bookBtnCandidates.length > 0) {
      // Sort candidates to prioritize button/input elements over divs/spans
      bookBtnCandidates.sort((a, b) => {
        const aIsInteractive = a.tagName === 'BUTTON' || a.tagName === 'INPUT' || a.tagName === 'A';
        const bIsInteractive = b.tagName === 'BUTTON' || b.tagName === 'INPUT' || b.tagName === 'A';
        if (aIsInteractive && !bIsInteractive) return -1;
        if (!aIsInteractive && bIsInteractive) return 1;
        return a.textContent.length - b.textContent.length;
      });
      bookBtn = bookBtnCandidates[0];
    }

    // Page-wide fallback search for visible Book Now button
    if (!bookBtn) {
      const fallbackCandidates = Array.from(document.querySelectorAll('button, input, a, span, div')).filter(el => {
        const txt = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toUpperCase();
        const rect = el.getBoundingClientRect();
        return (txt === 'BOOK NOW' || txt.includes('BOOK NOW')) && rect.width > 0 && rect.height > 0;
      });

      if (fallbackCandidates.length > 0) {
        fallbackCandidates.sort((a, b) => {
          const aIsInteractive = a.tagName === 'BUTTON' || a.tagName === 'INPUT' || a.tagName === 'A';
          const bIsInteractive = b.tagName === 'BUTTON' || b.tagName === 'INPUT' || b.tagName === 'A';
          if (aIsInteractive && !bIsInteractive) return -1;
          if (!aIsInteractive && bIsInteractive) return 1;
          return a.textContent.length - b.textContent.length;
        });
        bookBtn = fallbackCandidates[0];
      }
    }

    if (bookBtn) {
      const isDisabled = bookBtn.disabled || bookBtn.classList.contains('disabled') || bookBtn.getAttribute('disabled') !== null;
      if (!isDisabled) {
        const now = Date.now();
        const lastClicked = parseInt(bookBtn.dataset.teLastClicked || '0', 10);
        if (now - lastClicked > 3000) {
          bookBtn.dataset.teLastClicked = now.toString();
          console.log('Tatkal Sniper: Booking button found and enabled. Clicking Book Now:', bookBtn);
          clickElement(bookBtn);
        }
      }
    }
  };

  // Global guard to prevent concurrent autofill executions (MutationObserver fires during fills)
  let isFillingInProgress = false;

  // Routing to individual page handlers
  const executeAutofill = async (pageType, force = false) => {
    if (!tatkalExpressActive && !force) return;
    // Prevent re-entrant calls — filling inputs triggers DOM mutations which retrigger this
    if (isFillingInProgress && !force) {
      console.log('Tatkal Sniper: Fill already in progress, skipping re-entrant call.');
      return;
    }

    console.log(`Tatkal Sniper: Executing autofill for page [${pageType}]`);
    isFillingInProgress = true;
    try {
      // Wait for any IRCTC loading spinners to clear before interacting with the page
      await waitForPageReady(5000);

      switch (pageType) {
      case 'login':
        await withRetry(pageType, fillLoginPage);
        break;
      case 'search':
        // If not logged in, trigger header Login click to open overlay first!
        const loginHeaderBtn = findLoginHeaderButton();
        if (loginHeaderBtn) {
          console.log('Tatkal Sniper: User not logged in. Clicking LOGIN button to trigger overlay...');
          loginHeaderBtn.click();
        } else {
          await withRetry(pageType, fillSearchPage);
        }
        break;
      case 'results':
        await withRetry(pageType, selectTrainAndClass);
        break;
      case 'passenger':
        await withRetry(pageType, fillPassengerPage);
        break;
      case 'review':
        await withRetry(pageType, fillReviewPage);
        break;
      case 'payment':
        await withRetry(pageType, highlightPaymentPage);
        break;
        default:
          console.log('Tatkal Sniper: Page elements not yet detected or fully loaded.');
      }
    } finally {
      // Always release the lock so future calls aren't permanently blocked
      isFillingInProgress = false;
    }
  };

  // ── Session Watchdog ────────────────────────────────────────────────────────
  const detectSessionTimeout = () => {
    const textMatches = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div')).some(el => {
      if (!el || el.children.length > 0) return false;
      const txt = el.textContent.toLowerCase();
      return txt.includes('session has expired') || txt.includes('session expired') || txt.includes('session out');
    });
    return textMatches || window.location.href.includes('/timeout');
  };

  // ── Toast Notifications on IRCTC ─────────────────────────────────────────────
  const showContentToast = (msg, onRetry = null) => {
    const existing = document.getElementById('te-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'te-toast';
    toast.className = 'te-toast';
    toast.innerHTML = `<span>${msg}</span>`;

    if (onRetry) {
      const btn = document.createElement('button');
      btn.textContent = 'Retry';
      btn.onclick = () => {
        toast.remove();
        onRetry();
      };
      toast.appendChild(btn);
    }

    document.body.appendChild(toast);
    if (!onRetry) setTimeout(() => toast.remove(), 4000);
  };

  // ── Retry Logic Wrapper ──────────────────────────────────────────────────────
  const retryCounters = {};
  const withRetry = async (pageType, fn, maxRetries = 2) => {
    try {
      await fn();
      retryCounters[pageType] = 0; // Reset on success
    } catch (err) {
      console.error(`Tatkal Sniper: Error in autofill for ${pageType}`, err);
      const attempts = retryCounters[pageType] || 0;
      if (attempts < maxRetries) {
        retryCounters[pageType] = attempts + 1;
        showContentToast(`Tatkal Sniper: Failed to fill ${pageType}. Attempt ${attempts + 1}/${maxRetries}`, () => {
          executeAutofill(pageType, true);
        });
      } else {
        showContentToast(`Tatkal Sniper: Autofill failed for ${pageType}. Please fill manually.`);
      }
    }
  };

  // Automated trigger logic
  const triggerAutoActions = async () => {
    // Check if extension context is still valid (stops errors when extension reloads/updates)
    if (!isContextValid()) {
      console.warn('Tatkal Sniper: Extension context invalidated. Disconnecting observer.');
      if (typeof observer !== 'undefined') observer.disconnect();
      return;
    }

    try {
      // Dynamically retrieve the freshest active status and configuration from storage
      const state = await chrome.storage.local.get(['tatkalExpressActive', 'tatkalExpressConfig', 'highestBookingStage']);
      tatkalExpressActive = state.tatkalExpressActive || false;
      tatkalExpressConfig = state.tatkalExpressConfig || tatkalExpressConfig;
      let highestBookingStage = state.highestBookingStage || 0;

      if (tatkalExpressActive && detectSessionTimeout()) {
        console.log('Tatkal Sniper: Session timeout detected. Sending recovery message to background.');
        chrome.runtime.sendMessage({ action: 'sessionTimeout' });
        return;
      }

      // Detect explicitly failed payment URLs
      const urlLower = window.location.href.toLowerCase();
      if (tatkalExpressActive && (urlLower.includes('/failure') || urlLower.includes('/error') || urlLower.includes('paymentstatus=fail') || urlLower.includes('paymentstatus=error'))) {
         console.warn('Tatkal Sniper: Payment failure detected in URL. Halting automation.');
         await chrome.storage.local.set({ tatkalExpressActive: false, highestBookingStage: 0 });
         showContentToast('Tatkal Sniper: Payment failed or error encountered. Automation halted.');
         return;
      }

      if (!tatkalExpressConfig) {
        console.log('Tatkal Sniper: Standing by. Waiting for journey details to be filled.');
        return;
      }

      const pageType = detectPageType();

      // Circuit Breaker for backwards progression
      const PAGE_STAGES = { 'unknown': 0, 'login': 1, 'search': 1, 'results': 2, 'passenger': 3, 'review': 4, 'payment': 5 };
      const currentStage = PAGE_STAGES[pageType] || 0;

      if (tatkalExpressActive && currentStage > 0) {
        if (currentStage === 1 && highestBookingStage >= 3) {
          console.warn(`Tatkal Sniper: Unexpected redirection to stage ${currentStage} (from advanced stage ${highestBookingStage}). Halting automation to prevent infinite loop.`);
          await chrome.storage.local.set({ tatkalExpressActive: false, highestBookingStage: 0 });
          showContentToast('Tatkal Sniper: Unexpected redirection detected. Automation halted to prevent loops.');
          return;
        } else if (currentStage > highestBookingStage) {
          await chrome.storage.local.set({ highestBookingStage: currentStage });
        }
      }

      await executeAutofill(pageType);
    } catch (err) {
      console.warn('Tatkal Sniper: Failed to retrieve state from storage (context may be invalidated):', err);
      if (typeof observer !== 'undefined') observer.disconnect();
    }
  };

  // Bootstrapping the live console UI
  createConsole();

  // Create observer to watch for dynamic page updates (Angular navigation)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    // Check if extension context is still valid
    if (!isContextValid()) {
      observer.disconnect();
      return;
    }

    // Check if the URL changed (SPAs don't reload page)
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('Tatkal Sniper: Navigation detected. URL changed to:', lastUrl);
      updateConsoleContent();

      // Clear highlight on new page
      document.querySelectorAll('.te-highlight').forEach(el => el.classList.remove('te-highlight'));

      // Delay slightly to let page render
      setTimeout(triggerAutoActions, 200);
    } else {
      // Even if URL didn't change, elements might have loaded dynamically.
      // We throttle calls to avoid freezing the tab.
      if (tatkalExpressActive) {
        throttledAutoActions();
      }
    }
  });

  // Simple throttle mechanism — increased to 2500ms to reduce interference during slow fills
  let throttleTimeout = null;
  const throttledAutoActions = () => {
    if (throttleTimeout) return;
    // Don't schedule a re-run if a fill is actively in progress
    if (isFillingInProgress) return;
    // Check if extension context is still valid
    if (!isContextValid()) {
      if (typeof observer !== 'undefined') observer.disconnect();
      return;
    }
    throttleTimeout = setTimeout(() => {
      triggerAutoActions();
      throttleTimeout = null;
    }, 500);
  };

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Execute initial scan after a short load delay
  setTimeout(() => {
    // Check if extension context is still valid
    if (!isContextValid()) return;
    updateConsoleContent();
    triggerAutoActions();
  }, 1000);
})();
