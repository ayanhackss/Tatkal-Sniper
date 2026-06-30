document.addEventListener('DOMContentLoaded', async () => {
  // ─── DOM References ─────────────────────────────────────────────────────────
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const passwordInput = document.getElementById('password');
  const addPassengerBtn = document.getElementById('addPassengerBtn');
  const passengersContainer = document.getElementById('passengersContainer');
  const saveBtn = document.getElementById('saveBtn');
  const startBookingBtn = document.getElementById('startBookingBtn');
  const statusBadge = document.getElementById('statusBadge');
  const toast = document.getElementById('toast');
  const staleDateWarning = document.getElementById('staleDateWarning');

  // Input elements
  const usernameInput = document.getElementById('username');
  const fromStationInput = document.getElementById('fromStation');
  const toStationInput = document.getElementById('toStation');
  const journeyDateInput = document.getElementById('journeyDate');
  const trainNumberInput = document.getElementById('trainNumber');
  const journeyClassSelect = document.getElementById('journeyClass');
  const journeyQuotaSelect = document.getElementById('journeyQuota');
  const mobileNumberInput = document.getElementById('mobileNumber');
  const preferredPaymentSelect = document.getElementById('preferredPayment');
  const travelInsuranceSelect = document.getElementById('travelInsurance');
  const autoUpgradeCheckbox = document.getElementById('autoUpgrade');
  const confirmBerthsOnlyCheckbox = document.getElementById('confirmBerthsOnly');
  const autoFocusCaptchaCheckbox = document.getElementById('autoFocusCaptcha');

  // Fix #9: Confirmation modal elements
  const confirmModal = document.getElementById('confirmModal');
  const modalBody = document.getElementById('modalBody');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');

  // Maximum 6 passengers allowed on standard tickets
  const MAX_PASSENGERS = 6;

  // ─── Version Tag ─────────────────────────────────────────────────────────────
  try {
    const manifest = chrome.runtime.getManifest();
    const versionTag = document.getElementById('versionTag');
    if (versionTag && manifest) {
      versionTag.textContent = `v${manifest.version}`;
    }
  } catch (err) {
    console.warn('Could not read manifest version:', err);
  }

  // ─── Fix #4: Reset auto-booking state when popup opens ───────────────────────
  // Prevents the extension staying "active" forever if the user closes the tab
  // mid-flow without a proper deactivation signal.
  try {
    await chrome.storage.local.set({ tatkalExpressActive: false, highestBookingStage: 0 });
  } catch (err) {
    console.warn('Tatkal Sniper: Could not reset active state on popup open.', err);
  }

  // ─── 1. Tab Switching Logic (Fix #7: updates aria-selected) ─────────────────
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Update buttons + ARIA
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // Update panels
      tabPanels.forEach(panel => {
        if (panel.id === `${targetTab}Tab`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });
    });
  });

  // ─── 2. Toggle Password Visibility ──────────────────────────────────────────
  togglePasswordBtn.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      togglePasswordBtn.classList.add('active');
      togglePasswordBtn.setAttribute('aria-label', 'Hide password');
      togglePasswordBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.74-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.34-4.3c-.61 0-1.2.08-1.77.21l1.24 1.24c.17-.03.35-.05.53-.05 1.66 0 3 1.34 3 3 0 .18-.02.36-.05.53l1.24 1.24c.13-.57.21-1.16.21-1.77 0-2.76-2.24-5-5-5z"/></svg>
      `;
    } else {
      passwordInput.type = 'password';
      togglePasswordBtn.classList.remove('active');
      togglePasswordBtn.setAttribute('aria-label', 'Show password');
      togglePasswordBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
      `;
    }
  });

  // ─── 3. Dynamic Passenger Fields ─────────────────────────────────────────────
  const getPassengerCards = () => passengersContainer.querySelectorAll('.passenger-card');

  // Fix #3: Accept index parameter so the number is correct immediately on render
  const createPassengerCard = (passengerData = {}, atTop = false) => {
    const cards = getPassengerCards();
    if (cards.length >= MAX_PASSENGERS) {
      showToast(`Maximum ${MAX_PASSENGERS} passengers allowed.`, true);
      return;
    }

    // Determine card number immediately (before DOM insertion)
    const cardIndex = atTop ? 1 : cards.length + 1;

    const card = document.createElement('div');
    card.className = 'passenger-card';
    card.setAttribute('data-id', Date.now());

    // Fallbacks
    const name = passengerData.name || '';
    const age = passengerData.age || '';
    const gender = passengerData.gender || 'M';
    const berth = passengerData.berth || 'NP';
    const food = passengerData.food || 'N';

    // Fix #7: Labels use unique IDs to link to their inputs for accessibility
    const uid = Date.now() + Math.random().toString(36).slice(2, 7);

    card.innerHTML = `
      <div class="passenger-card-header">
        <span class="passenger-num">Passenger #${cardIndex}</span>
        <button type="button" class="btn-remove" title="Remove Passenger" aria-label="Remove passenger ${cardIndex}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
      
      <div class="input-group">
        <label for="pname-${uid}">Full Name (as in ID)</label>
        <input type="text" id="pname-${uid}" class="passenger-name" placeholder="Enter name" autocomplete="off">
      </div>

      <div class="row-grid">
        <div class="input-group">
          <label for="page-${uid}">Age</label>
          <input type="number" id="page-${uid}" class="passenger-age" placeholder="Age" min="1" max="120">
        </div>

        <div class="input-group">
          <label for="pgender-${uid}">Gender</label>
          <select id="pgender-${uid}" class="passenger-gender">
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="T">Transgender</option>
          </select>
        </div>
      </div>

      <div class="row-grid">
        <div class="input-group">
          <label for="pberth-${uid}">Berth Preference</label>
          <select id="pberth-${uid}" class="passenger-berth">
            <option value="NP">No Preference</option>
            <option value="LB">Lower</option>
            <option value="MB">Middle</option>
            <option value="UB">Upper</option>
            <option value="SL">Side Lower</option>
            <option value="SU">Side Upper</option>
            <option value="WS">Window Side</option>
            <option value="AS">Aisle Seat</option>
          </select>
        </div>

        <div class="input-group">
          <label for="pfood-${uid}">Food Preference</label>
          <select id="pfood-${uid}" class="passenger-food">
            <option value="N">No Food</option>
            <option value="V">Veg</option>
            <option value="NV">Non-Veg</option>
          </select>
        </div>
      </div>
    `;

    // Safely assign dynamic values via DOM properties
    card.querySelector('.passenger-name').value = name;
    card.querySelector('.passenger-age').value = age;
    card.querySelector('.passenger-gender').value = gender;
    card.querySelector('.passenger-berth').value = berth;
    card.querySelector('.passenger-food').value = food;

    // Attach Remove Event
    card.querySelector('.btn-remove').addEventListener('click', () => {
      card.remove();
      updatePassengerNumbers();
    });

    if (atTop) {
      passengersContainer.insertBefore(card, passengersContainer.firstChild);
    } else {
      passengersContainer.appendChild(card);
    }

    // Renumber all after insertion (handles atTop reordering)
    updatePassengerNumbers();
  };

  const updatePassengerNumbers = () => {
    const cards = getPassengerCards();
    cards.forEach((card, idx) => {
      const num = idx + 1;
      card.querySelector('.passenger-num').textContent = `Passenger #${num}`;
      const removeBtn = card.querySelector('.btn-remove');
      if (removeBtn) removeBtn.setAttribute('aria-label', `Remove passenger ${num}`);
    });
  };

  addPassengerBtn.addEventListener('click', () => {
    createPassengerCard({}, true);
  });

  // ─── Fix #2: Validation ───────────────────────────────────────────────────────
  const setError = (elementId, message) => {
    const el = document.getElementById(elementId);
    if (el) el.textContent = message;
  };

  const clearError = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.textContent = '';
  };

  const markInvalid = (input, isInvalid) => {
    if (!input) return;
    if (isInvalid) {
      input.classList.add('input-invalid');
    } else {
      input.classList.remove('input-invalid');
    }
  };

  // Clear errors on user input
  const clearOnInput = (input, errorId) => {
    input.addEventListener('input', () => {
      clearError(errorId);
      markInvalid(input, false);
    });
  };
  clearOnInput(usernameInput, 'username-error');
  clearOnInput(passwordInput, 'password-error');
  clearOnInput(fromStationInput, 'from-error');
  clearOnInput(toStationInput, 'to-error');
  clearOnInput(journeyDateInput, 'date-error');
  clearOnInput(mobileNumberInput, 'mobile-error');

  const validateConfig = () => {
    let isValid = true;
    const stationCodeRegex = /^[A-Z]{2,5}$/;
    const mobileRegex = /^[6-9]\d{9}$/;

    // Username
    if (!usernameInput.value.trim()) {
      setError('username-error', 'Username is required.');
      markInvalid(usernameInput, true);
      isValid = false;
    } else {
      clearError('username-error');
      markInvalid(usernameInput, false);
    }

    // Password
    if (!passwordInput.value.trim()) {
      setError('password-error', 'Password is required.');
      markInvalid(passwordInput, true);
      isValid = false;
    } else {
      clearError('password-error');
      markInvalid(passwordInput, false);
    }

    // From Station
    const fromVal = fromStationInput.value.trim().toUpperCase();
    if (!fromVal || !stationCodeRegex.test(fromVal)) {
      setError('from-error', 'Enter a valid 2–5 letter station code.');
      markInvalid(fromStationInput, true);
      isValid = false;
    } else {
      clearError('from-error');
      markInvalid(fromStationInput, false);
    }

    // To Station
    const toVal = toStationInput.value.trim().toUpperCase();
    if (!toVal || !stationCodeRegex.test(toVal)) {
      setError('to-error', 'Enter a valid 2–5 letter station code.');
      markInvalid(toStationInput, true);
      isValid = false;
    } else {
      clearError('to-error');
      markInvalid(toStationInput, false);
    }

    // Journey Date — must be today or future
    const dateVal = journeyDateInput.value;
    if (!dateVal) {
      setError('date-error', 'Journey date is required.');
      markInvalid(journeyDateInput, true);
      isValid = false;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(dateVal);
      if (selected < today) {
        setError('date-error', 'Journey date must be today or in the future.');
        markInvalid(journeyDateInput, true);
        isValid = false;
      } else {
        clearError('date-error');
        markInvalid(journeyDateInput, false);
      }
    }

    // Mobile Number
    const mobileVal = mobileNumberInput.value.trim();
    if (!mobileVal || !mobileRegex.test(mobileVal)) {
      setError('mobile-error', 'Enter a valid 10-digit Indian mobile number.');
      markInvalid(mobileNumberInput, true);
      isValid = false;
    } else {
      clearError('mobile-error');
      markInvalid(mobileNumberInput, false);
    }

    // Passengers — at least one, each with name and age
    const passengerCards = getPassengerCards();
    const passengersErrorEl = document.getElementById('passengers-error');
    if (passengerCards.length === 0) {
      if (passengersErrorEl) passengersErrorEl.textContent = 'At least one passenger is required.';
      isValid = false;
    } else {
      let passengerError = '';
      passengerCards.forEach((card, idx) => {
        const pName = card.querySelector('.passenger-name').value.trim();
        const pAge = parseInt(card.querySelector('.passenger-age').value, 10);
        if (!pName) {
          passengerError = `Passenger #${idx + 1}: Name is required.`;
        } else if (!pAge || pAge < 1 || pAge > 120) {
          passengerError = `Passenger #${idx + 1}: Age must be between 1 and 120.`;
        }
      });
      if (passengerError) {
        if (passengersErrorEl) passengersErrorEl.textContent = passengerError;
        isValid = false;
      } else {
        if (passengersErrorEl) passengersErrorEl.textContent = '';
      }
    }

    // If invalid, switch to the offending tab automatically
    if (!isValid) {
      const usernameOk = !document.getElementById('username-error').textContent;
      const passwordOk = !document.getElementById('password-error').textContent;
      if (!usernameOk || !passwordOk) {
        switchToTab('credentials');
      } else if (document.getElementById('from-error').textContent ||
                 document.getElementById('to-error').textContent ||
                 document.getElementById('date-error').textContent) {
        switchToTab('journey');
      } else if (document.getElementById('passengers-error').textContent) {
        switchToTab('passengers');
      } else if (document.getElementById('mobile-error').textContent) {
        switchToTab('preferences');
      }
    }

    return isValid;
  };

  const switchToTab = (tabName) => {
    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    tabPanels.forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const panel = document.getElementById(`${tabName}Tab`);
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
    if (panel) panel.classList.add('active');
  };

  // ─── 4. Load Saved Configuration ─────────────────────────────────────────────
  const loadConfig = async () => {
    try {
      const result = await chrome.storage.local.get('tatkalExpressConfig');
      const config = result.tatkalExpressConfig;
      
      if (config) {
        // Load credentials
        if (config.credentials) {
          usernameInput.value = config.credentials.username || '';
          passwordInput.value = config.credentials.password || '';
        }
        
        // Load journey details
        if (config.journey) {
          fromStationInput.value = config.journey.fromStation || '';
          toStationInput.value = config.journey.toStation || '';
          trainNumberInput.value = config.journey.trainNumber || '';
          journeyClassSelect.value = config.journey.journeyClass || '3A';
          journeyQuotaSelect.value = config.journey.journeyQuota || 'GENERAL';

          // Fix #5: Check for stale journey date
          const savedDate = config.journey.journeyDate;
          if (savedDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const journeyDay = new Date(savedDate);
            if (journeyDay < today) {
              // Clear stale date and show warning
              journeyDateInput.value = '';
              if (staleDateWarning) staleDateWarning.style.display = 'flex';
            } else {
              journeyDateInput.value = savedDate;
              if (staleDateWarning) staleDateWarning.style.display = 'none';
            }
          }
        }
        
        // Load preferences
        if (config.preferences) {
          mobileNumberInput.value = config.preferences.mobileNumber || '';
          preferredPaymentSelect.value = config.preferences.preferredPayment || 'UPI';
          travelInsuranceSelect.value = config.preferences.travelInsurance || 'YES';
          autoUpgradeCheckbox.checked = !!config.preferences.autoUpgrade;
          confirmBerthsOnlyCheckbox.checked = !!config.preferences.confirmBerthsOnly;
          autoFocusCaptchaCheckbox.checked = config.preferences.autoFocusCaptcha !== false;
        }

        // Load passengers
        passengersContainer.innerHTML = '';
        if (config.passengers && config.passengers.length > 0) {
          config.passengers.forEach(p => createPassengerCard(p));
        } else {
          createPassengerCard();
        }
      } else {
        createPassengerCard();
      }
    } catch (err) {
      console.error('Failed to load configuration:', err);
      createPassengerCard();
    }
  };

  // ─── 5. Save Configuration ────────────────────────────────────────────────────
  const saveConfig = async () => {
    // Fix #2: Validate before saving
    if (!validateConfig()) {
      showToast('Please fix the errors before saving.', true);
      return false;
    }

    const passengerCards = getPassengerCards();
    const passengers = [];
    
    passengerCards.forEach(card => {
      passengers.push({
        name: card.querySelector('.passenger-name').value.trim(),
        age: card.querySelector('.passenger-age').value.trim(),
        gender: card.querySelector('.passenger-gender').value,
        berth: card.querySelector('.passenger-berth').value,
        food: card.querySelector('.passenger-food').value
      });
    });

    const config = {
      credentials: {
        username: usernameInput.value.trim(),
        password: passwordInput.value.trim()
      },
      journey: {
        fromStation: fromStationInput.value.trim().toUpperCase(),
        toStation: toStationInput.value.trim().toUpperCase(),
        journeyDate: journeyDateInput.value,
        trainNumber: trainNumberInput.value.trim(),
        journeyClass: journeyClassSelect.value,
        journeyQuota: journeyQuotaSelect.value
      },
      passengers: passengers,
      preferences: {
        mobileNumber: mobileNumberInput.value.trim(),
        preferredPayment: preferredPaymentSelect.value,
        travelInsurance: travelInsuranceSelect.value,
        autoUpgrade: autoUpgradeCheckbox.checked,
        confirmBerthsOnly: confirmBerthsOnlyCheckbox.checked,
        autoFocusCaptcha: autoFocusCaptchaCheckbox.checked
      }
    };

    try {
      await chrome.storage.local.set({ tatkalExpressConfig: config });
      showToast('Configuration saved locally!');
      return true;
    } catch (err) {
      console.error('Failed to save config:', err);
      showToast('Error saving details!', true);
      return false;
    }
  };

  const showToast = (message, isError = false) => {
    toast.textContent = message;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.style.boxShadow = isError ? '0 4px 12px rgba(239, 68, 68, 0.35)' : '0 4px 12px rgba(16, 185, 129, 0.35)';
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  };

  saveBtn.addEventListener('click', saveConfig);

  // ─── Fix #9: Booking Confirmation Modal ──────────────────────────────────────
  const buildModalSummary = () => {
    const passengerCards = getPassengerCards();
    const pNames = Array.from(passengerCards)
      .map(c => c.querySelector('.passenger-name').value.trim())
      .filter(Boolean)
      .join(', ') || '—';

    const classMap = {
      ALL: 'All Classes', '1A': 'AC First (1A)', '2A': 'AC 2 Tier (2A)',
      '3A': 'AC 3 Tier (3A)', '3E': 'AC 3 Economy (3E)', CC: 'AC Chair Car (CC)',
      SL: 'Sleeper (SL)', '2S': 'Second Sitting (2S)'
    };

    const rows = [
      { label: 'From → To', value: `${fromStationInput.value.toUpperCase()} → ${toStationInput.value.toUpperCase()}` },
      { label: 'Date', value: journeyDateInput.value || '—' },
      { label: 'Class', value: classMap[journeyClassSelect.value] || journeyClassSelect.value },
      { label: 'Quota', value: journeyQuotaSelect.value },
      { label: 'Passengers', value: `${passengerCards.length} — ${pNames}` },
      { label: 'Payment', value: preferredPaymentSelect.options[preferredPaymentSelect.selectedIndex]?.text || '—' },
    ];

    return rows.map(r => `
      <div class="summary-row">
        <span class="summary-label">${r.label}</span>
        <span class="summary-value" title="${r.value}">${r.value}</span>
      </div>
    `).join('');
  };

  const openConfirmModal = () => {
    modalBody.innerHTML = buildModalSummary();
    confirmModal.style.display = 'flex';
    modalConfirmBtn.focus();
  };

  const closeConfirmModal = () => {
    confirmModal.style.display = 'none';
  };

  modalCancelBtn.addEventListener('click', closeConfirmModal);

  // Close on backdrop click
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirmModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmModal.style.display !== 'none') {
      closeConfirmModal();
    }
  });

  // ─── 6. Start Auto-Booking Trigger ───────────────────────────────────────────
  startBookingBtn.addEventListener('click', async () => {
    // Validate first
    if (!validateConfig()) {
      showToast('Please fix the errors before booking.', true);
      return;
    }

    // Fix #9: Show confirmation modal, don't proceed until confirmed
    openConfirmModal();
  });

  // Fix #10: Actually trigger booking after confirmation
  modalConfirmBtn.addEventListener('click', async () => {
    closeConfirmModal();

    const saved = await saveConfig();
    if (!saved) return;

    // Put extension in auto-booking active state
    await chrome.storage.local.set({ tatkalExpressActive: true, highestBookingStage: 0 });

    const irctcUrl = 'https://www.irctc.co.in/nget/train-search';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab && tab.url && tab.url.includes('irctc.co.in')) {
        // Already on IRCTC — redirect
        await chrome.tabs.update(tab.id, { url: irctcUrl });
        // Fix #10: Wait for the page to finish loading before closing popup
        await waitForTabComplete(tab.id);
      } else {
        // Open new IRCTC tab and wait for it to load
        const newTab = await chrome.tabs.create({ url: irctcUrl });
        await waitForTabComplete(newTab.id);
      }

      // Close popup so user sees the IRCTC page
      window.close();
    } catch (err) {
      console.error('Failed to redirect or create tab:', err);
      // Fallback: open in new tab without waiting
      window.open(irctcUrl, '_blank');
    }
  });

  // Fix #10: Promise that resolves when the given tab finishes loading
  const waitForTabComplete = (tabId) => {
    return new Promise((resolve) => {
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);

      // Safety timeout: resolve after 8s regardless, so popup can close
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 8000);
    });
  };

  // ─── 7. Check Active Tab Status ───────────────────────────────────────────────
  const checkTabStatus = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes('irctc.co.in')) {
        statusBadge.textContent = 'Active on IRCTC';
        statusBadge.classList.add('active');
      } else {
        statusBadge.textContent = 'Ready';
        statusBadge.classList.remove('active');
      }
    } catch (err) {
      console.warn('Could not read tab URL:', err);
      statusBadge.textContent = 'Ready';
      statusBadge.classList.remove('active');
    }
  };

  // ─── 8. Tatkal Countdown Timer ───────────────────────────────────────────────
  // AC Tatkal opens at 10:00 AM; Non-AC (SL, 2S) at 11:00 AM.
  const AC_CLASSES = ['1A', '2A', '3A', '3E', 'CC'];
  let countdownInterval = null;

  const getTatkalOpenTime = (classCode) => {
    const now = new Date();
    const openHour = AC_CLASSES.includes(classCode) ? 10 : 11;
    const open = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openHour, 0, 0, 0);
    // If already past today's opening, target tomorrow
    if (now >= open) open.setDate(open.getDate() + 1);
    return open;
  };

  const formatCountdown = (ms) => {
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const startCountdown = () => {
    if (countdownInterval) clearInterval(countdownInterval);

    const digitsEl = document.getElementById('countdownDigits');
    const typeEl = document.getElementById('countdownType');
    const labelEl = document.getElementById('countdownLabel');
    if (!digitsEl) return;

    const classCode = journeyClassSelect ? journeyClassSelect.value : '3A';
    const isAC = AC_CLASSES.includes(classCode);
    const openHour = isAC ? 10 : 11;

    if (typeEl) typeEl.textContent = isAC ? 'AC 10:00' : 'Non-AC 11:00';

    const tick = async () => {
      const openTime = getTatkalOpenTime(classCode);
      const now = Date.now();
      const diff = openTime.getTime() - now;

      if (diff <= 0) {
        digitsEl.textContent = '🟢 OPEN!';
        digitsEl.className = 'countdown-digits done';
        if (labelEl) labelEl.textContent = 'Tatkal is';
        clearInterval(countdownInterval);

        // Auto-trigger booking if preference is set
        const { tatkalExpressConfig: cfg } = await chrome.storage.local.get('tatkalExpressConfig');
        if (cfg && cfg.preferences && cfg.preferences.autoTriggerAtOpen) {
          console.log('Tatkal Sniper: Auto-triggering booking at Tatkal open time.');
          await chrome.storage.local.set({ tatkalExpressActive: true, highestBookingStage: 0 });
          const irctcUrl = 'https://www.irctc.co.in/nget/train-search';
          const tabs = await chrome.tabs.query({ url: '*://*.irctc.co.in/*' });
          if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { url: irctcUrl });
          } else {
            chrome.tabs.create({ url: irctcUrl });
          }
          window.close();
        }
        return;
      }

      digitsEl.textContent = formatCountdown(diff);
      // Red pulsing when < 5 minutes
      if (diff < 5 * 60 * 1000) {
        digitsEl.className = 'countdown-digits urgent';
      } else {
        digitsEl.className = 'countdown-digits';
      }
      if (labelEl) labelEl.textContent = 'Tatkal opens in';
    };

    tick(); // Immediate first tick
    countdownInterval = setInterval(tick, 1000);
  };

  // ─── 9. Clock Sync Warning ────────────────────────────────────────────────────
  const checkClockSync = async () => {
    const warningEl = document.getElementById('clockWarning');
    const warningText = document.getElementById('clockWarningText');
    if (!warningEl) return;
    try {
      const before = Date.now();
      const res = await fetch('https://worldtimeapi.org/api/ip', { cache: 'no-store' });
      const after = Date.now();
      if (!res.ok) return;
      const data = await res.json();
      const networkTime = new Date(data.datetime).getTime();
      const roundTripHalf = (after - before) / 2;
      const localTime = (before + after) / 2;
      const drift = Math.abs(networkTime - roundTripHalf - localTime);
      if (drift > 2000) {
        const driftSec = (drift / 1000).toFixed(1);
        if (warningText) warningText.textContent = `⚠ Clock is off by ~${driftSec}s — sync your system time for Tatkal!`;
        warningEl.style.display = 'flex';
      } else {
        warningEl.style.display = 'none';
      }
    } catch (e) {
      // Network unavailable — silently skip clock sync check
    }
  };

  // ─── 10. Scheduled Auto-Launch ────────────────────────────────────────────────
  const scheduleBtn = document.getElementById('scheduleBtn');
  const scheduleCancelBtn = document.getElementById('scheduleCancelBtn');
  const scheduleStatus = document.getElementById('scheduleStatus');
  const scheduledTimeInput = document.getElementById('scheduledTime');

  const refreshScheduleUI = async () => {
    try {
      const alarm = await chrome.alarms.get('scheduledLaunch');
      if (alarm) {
        const t = new Date(alarm.scheduledTime);
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        const ss = String(t.getSeconds()).padStart(2, '0');
        if (scheduleStatus) {
          scheduleStatus.style.display = 'block';
          scheduleStatus.className = 'schedule-status';
          scheduleStatus.textContent = `✓ Alarm set for ${hh}:${mm}:${ss} today`;
        }
        if (scheduleCancelBtn) scheduleCancelBtn.style.display = 'inline-flex';
        if (scheduleBtn) scheduleBtn.style.display = 'none';
      } else {
        if (scheduleStatus) scheduleStatus.style.display = 'none';
        if (scheduleCancelBtn) scheduleCancelBtn.style.display = 'none';
        if (scheduleBtn) scheduleBtn.style.display = 'inline-flex';
      }
    } catch (e) { /* alarms API not ready */ }
  };

  if (scheduleBtn) {
    scheduleBtn.addEventListener('click', async () => {
      const timeVal = scheduledTimeInput ? scheduledTimeInput.value : '';
      if (!timeVal) {
        showToast('Please select a launch time first.', true);
        return;
      }
      const [hh, mm, ss = '00'] = timeVal.split(':');
      const now = new Date();
      const launch = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        parseInt(hh), parseInt(mm), parseInt(ss), 0);
      if (launch.getTime() <= Date.now()) {
        if (scheduleStatus) {
          scheduleStatus.style.display = 'block';
          scheduleStatus.className = 'schedule-status warning';
          scheduleStatus.textContent = '⚠ That time has already passed today.';
        }
        return;
      }
      await chrome.alarms.clear('scheduledLaunch');
      await chrome.alarms.create('scheduledLaunch', { when: launch.getTime() });

      // Save the scheduled time to storage so background can use config
      await saveConfig();

      showToast(`Auto-launch scheduled for ${timeVal}!`);
      await refreshScheduleUI();
    });
  }

  if (scheduleCancelBtn) {
    scheduleCancelBtn.addEventListener('click', async () => {
      await chrome.alarms.clear('scheduledLaunch');
      showToast('Scheduled launch cancelled.');
      await refreshScheduleUI();
    });
  }

  // ─── 11. Pre-Booking Reminder Alarm ──────────────────────────────────────────
  const setupPreBookingReminder = async (enabled, classCode) => {
    await chrome.alarms.clear('preBookingReminder');
    if (!enabled) return;
    const openTime = getTatkalOpenTime(classCode || '3A');
    const reminderTime = openTime.getTime() - 10 * 60 * 1000; // 10 min before
    if (reminderTime > Date.now()) {
      await chrome.alarms.create('preBookingReminder', { when: reminderTime });
      console.log('Tatkal Sniper: Pre-booking reminder alarm set for', new Date(reminderTime).toLocaleTimeString());
    }
  };

  // ─── Extended loadConfig — includes new prefs ────────────────────────────────
  const _origLoadConfig = loadConfig;
  // Patch: re-load new checkboxes after base loadConfig runs
  const loadNewPrefs = async () => {
    try {
      const { tatkalExpressConfig: cfg } = await chrome.storage.local.get('tatkalExpressConfig');
      if (!cfg) return;
      const prefs = cfg.preferences || {};
      const preBookingReminderEl = document.getElementById('preBookingReminder');
      const autoTriggerAtOpenEl = document.getElementById('autoTriggerAtOpen');
      const scheduledTimeEl = document.getElementById('scheduledTime');
      if (preBookingReminderEl) preBookingReminderEl.checked = !!prefs.preBookingReminder;
      if (autoTriggerAtOpenEl) autoTriggerAtOpenEl.checked = !!prefs.autoTriggerAtOpen;
      if (scheduledTimeEl && prefs.scheduledTime) scheduledTimeEl.value = prefs.scheduledTime;
    } catch (e) { /* ignore */ }
  };

  // ─── Extended saveConfig — persists new prefs ────────────────────────────────
  const _origSaveConfig = saveConfig;
  const saveNewPrefs = () => {
    const preBookingReminderEl = document.getElementById('preBookingReminder');
    const autoTriggerAtOpenEl = document.getElementById('autoTriggerAtOpen');
    const scheduledTimeEl = document.getElementById('scheduledTime');
    return {
      preBookingReminder: preBookingReminderEl ? preBookingReminderEl.checked : false,
      autoTriggerAtOpen: autoTriggerAtOpenEl ? autoTriggerAtOpenEl.checked : false,
      scheduledTime: scheduledTimeEl ? scheduledTimeEl.value : ''
    };
  };

  // Wire new prefs into save so they persist
  const origSaveBtnClick = saveBtn.onclick;
  saveBtn.addEventListener('click', async () => {
    // Merge new prefs into the next save cycle
    const extra = saveNewPrefs();
    const { tatkalExpressConfig: cfg } = await chrome.storage.local.get('tatkalExpressConfig');
    if (cfg) {
      cfg.preferences = Object.assign(cfg.preferences || {}, extra);
      await chrome.storage.local.set({ tatkalExpressConfig: cfg });
    }
    // Setup/teardown reminder alarm based on new setting
    const classCode = journeyClassSelect ? journeyClassSelect.value : '3A';
    await setupPreBookingReminder(extra.preBookingReminder, classCode);
  });

  // ─── Initialization ───────────────────────────────────────────────────────────
  await loadConfig();
  await loadNewPrefs();
  await checkTabStatus();
  startCountdown();
  checkClockSync(); // Non-blocking async check
  await refreshScheduleUI();
});
