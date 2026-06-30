// Listen for installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Tatkal Sniper extension installed.');
  
  // Set up default configs if they don't exist
  const result = await chrome.storage.local.get('tatkalExpressConfig');
  if (!result.tatkalExpressConfig) {
    const defaultConfig = {
      credentials: { username: '', password: '' },
      journey: { fromStation: '', toStation: '', journeyDate: '', journeyClass: '3A', journeyQuota: 'GENERAL', trainNumber: '' },
      passengers: [],
      preferences: {
        mobileNumber: '',
        preferredPayment: 'UPI',
        autoUpgrade: false,
        confirmBerthsOnly: false,
        autoFocusCaptcha: true,
        travelInsurance: 'YES'
      }
    };
    await chrome.storage.local.set({ tatkalExpressConfig: defaultConfig });
  }

  // Fix #4b: Ensure active state is clean on install/update
  await chrome.storage.local.set({ tatkalExpressActive: false, highestBookingStage: 0 });

  // Fix #4b: Create a recurring alarm to auto-reset stale active state
  // Fires every 30 minutes. If the extension is "active" with no booking in
  // progress (e.g. user closed IRCTC tab mid-flow), this resets it cleanly.
  chrome.alarms.create('autoResetBookingState', { periodInMinutes: 30 });
});

// Fix #4b: Handle the auto-reset alarm + new scheduled alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // ── Auto-reset stale active state ──────────────────────────────────────────
  if (alarm.name === 'autoResetBookingState') {
    try {
      const { tatkalExpressActive } = await chrome.storage.local.get('tatkalExpressActive');
      if (tatkalExpressActive) {
        const irctcTabs = await chrome.tabs.query({ url: '*://*.irctc.co.in/*' });
        if (irctcTabs.length === 0) {
          await chrome.storage.local.set({ tatkalExpressActive: false, highestBookingStage: 0 });
          console.log('Tatkal Sniper: Auto-reset active state (no IRCTC tabs found).');
        }
      }
    } catch (err) {
      console.error('Tatkal Sniper: Auto-reset alarm error:', err);
    }
  }

  // ── Scheduled Auto-Launch ──────────────────────────────────────────────────
  if (alarm.name === 'scheduledLaunch') {
    try {
      console.log('Tatkal Sniper: Scheduled launch alarm fired — opening IRCTC.');
      await chrome.storage.local.set({ tatkalExpressActive: true, highestBookingStage: 0 });

      const irctcUrl = 'https://www.irctc.co.in/nget/train-search';
      const existing = await chrome.tabs.query({ url: '*://*.irctc.co.in/*' });
      if (existing.length > 0) {
        // Reuse existing IRCTC tab
        await chrome.tabs.update(existing[0].id, { url: irctcUrl, active: true });
        await chrome.windows.update(existing[0].windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: irctcUrl, active: true });
      }
    } catch (err) {
      console.error('Tatkal Sniper: Scheduled launch alarm error:', err);
    }
  }

  // ── Pre-Booking Reminder Notification ─────────────────────────────────────
  if (alarm.name === 'preBookingReminder') {
    try {
      const { tatkalExpressConfig: cfg } = await chrome.storage.local.get('tatkalExpressConfig');
      const classCode = cfg && cfg.journey ? (cfg.journey.journeyClass || '3A') : '3A';
      const AC_CLASSES = ['1A', '2A', '3A', '3E', 'CC'];
      const openTime = AC_CLASSES.includes(classCode) ? '10:00 AM' : '11:00 AM';

      chrome.notifications.create('tatkalReminder', {
        type: 'basic',
        iconUrl: '../assets/icon128.png',
        title: '⚡ Tatkal Sniper — Get Ready!',
        message: `Tatkal booking opens at ${openTime} — just 10 minutes away! Open IRCTC and stand by.`,
        priority: 2,
        requireInteraction: true
      });
      console.log('Tatkal Sniper: Pre-booking reminder notification fired.');
    } catch (err) {
      console.error('Tatkal Sniper: Pre-booking reminder notification error:', err);
    }
  }
});

// Update Badge status based on whether the user is on the IRCTC page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    if (tab.url.includes('irctc.co.in')) {
      const { tatkalExpressActive = false } = await chrome.storage.local.get('tatkalExpressActive');
      if (tatkalExpressActive) {
        await chrome.action.setBadgeText({ text: 'ON', tabId: tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId: tabId }); // Emerald green
      } else {
        await chrome.action.setBadgeText({ text: 'READY', tabId: tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#6366F1', tabId: tabId }); // Indigo
      }
    } else {
      // Clear badge on other sites
      await chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  } catch (err) {
    console.error('TatkalExpress background status badge error:', err);
  }
});

// Fix #4b: Also reset when all IRCTC tabs are closed
chrome.tabs.onRemoved.addListener(async () => {
  try {
    const { tatkalExpressActive } = await chrome.storage.local.get('tatkalExpressActive');
    if (!tatkalExpressActive) return;

    const irctcTabs = await chrome.tabs.query({ url: '*://*.irctc.co.in/*' });
    if (irctcTabs.length === 0) {
      await chrome.storage.local.set({ tatkalExpressActive: false });
      console.log('Tatkal Sniper: Active state reset — all IRCTC tabs closed.');
    }
  } catch (err) {
    // Tab queries can fail if the browser is shutting down — ignore silently
  }
});

// Listen for messages from Content Script or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'deactivateAutoBooking') {
    (async () => {
      try {
        await chrome.storage.local.set({ tatkalExpressActive: false });
        const tabs = await chrome.tabs.query({ url: '*://*.irctc.co.in/*' });
        for (const tab of tabs) {
          try {
            await chrome.action.setBadgeText({ text: 'READY', tabId: tab.id });
            await chrome.action.setBadgeBackgroundColor({ color: '#6366F1', tabId: tab.id });
          } catch (e) { /* Tab might have closed */ }
        }
        sendResponse({ status: 'deactivated' });
      } catch (err) {
        console.error('TatkalExpress background deactivate error:', err);
        sendResponse({ status: 'error', error: err.message });
      }
    })();
    return true;
  }

  // ── Session Watchdog: content script detected session timeout ────────────────
  // Reloads the IRCTC tab to the login page so auto-login can recover.
  if (message.action === 'sessionTimeout') {
    (async () => {
      try {
        console.log('Tatkal Sniper: Session timeout detected by content script. Recovering...');
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId) {
          // Brief pause then reload to the home/train-search page
          await new Promise(r => setTimeout(r, 1500));
          await chrome.tabs.update(tabId, { url: 'https://www.irctc.co.in/nget/train-search' });
        }
        sendResponse({ status: 'reloading' });
      } catch (err) {
        console.error('Tatkal Sniper: Session recovery error:', err);
        sendResponse({ status: 'error' });
      }
    })();
    return true;
  }
});
