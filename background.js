let isTimerRunning = false;
let blockedWebsites = [];
let timerEndTime = null;
let timerInterval = null;

// Load all values from storage when extension starts
chrome.storage.sync.get(['isTimerRunning', 'blockedWebsites', 'timerEndTime', 'timeLeft'], function(result) {
  if (result.isTimerRunning !== undefined) {
    isTimerRunning = result.isTimerRunning;
  }
  if (result.blockedWebsites) {
    blockedWebsites = result.blockedWebsites;
  }
  if (result.timerEndTime) {
    timerEndTime = result.timerEndTime;
  }
  
  // If timer was running, restart it
  if (isTimerRunning && timerEndTime) {
    startBackgroundTimer();
  }
});

// Listen for timer status changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync') {
    if (changes.isTimerRunning) {
      isTimerRunning = changes.isTimerRunning.newValue;
    }
    if (changes.blockedWebsites) {
      blockedWebsites = changes.blockedWebsites.newValue;
    }
    if (changes.timerEndTime) {
      timerEndTime = changes.timerEndTime.newValue;
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'blockedWebsitesUpdated') {
    blockedWebsites = request.blockedWebsites;
  } else if (request.type === 'startTimer') {
    startBackgroundTimer();
    sendResponse({ success: true });
  } else if (request.type === 'pauseTimer') {
    pauseBackgroundTimer();
    sendResponse({ success: true });
  } else if (request.type === 'resetTimer') {
    resetBackgroundTimer();
    sendResponse({ success: true });
  } else if (request.type === 'getTimerStatus') {
    // Calculate current time left
    let timeLeft = 25 * 60; // default
    if (timerEndTime) {
      const now = Date.now();
      if (now < timerEndTime) {
        timeLeft = Math.ceil((timerEndTime - now) / 1000);
      } else {
        timeLeft = 0;
      }
    }
    
    sendResponse({
      isRunning: isTimerRunning,
      timeLeft: timeLeft,
      timerEndTime: timerEndTime
    });
  }
});

// Background timer functions
function startBackgroundTimer() {
  // Clear any existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Set timer end time if not already set
  if (!timerEndTime || !isTimerRunning) {
    // Get current timeLeft from storage or use default
    chrome.storage.sync.get(['timeLeft'], function(result) {
      let timeLeft = result.timeLeft !== undefined ? result.timeLeft : 25 * 60;
      timerEndTime = Date.now() + (timeLeft * 1000);
      
      isTimerRunning = true;
      chrome.storage.sync.set({ 
        isTimerRunning: true,
        timerEndTime: timerEndTime,
        timeLeft: timeLeft
      });
      
      // Start the interval
      runTimerInterval();
    });
  } else {
    // Timer was already running, just restart the interval
    isTimerRunning = true;
    chrome.storage.sync.set({ isTimerRunning: true });
    runTimerInterval();
  }
}

function runTimerInterval() {
  timerInterval = setInterval(() => {
    const now = Date.now();
    let timeLeft = 0;
    
    if (timerEndTime && now < timerEndTime) {
      timeLeft = Math.ceil((timerEndTime - now) / 1000);
    }
    
    chrome.storage.sync.set({ timeLeft: timeLeft });
    
    if (timeLeft <= 0) {
      // Timer finished
      clearInterval(timerInterval);
      isTimerRunning = false;
      chrome.storage.sync.set({ isTimerRunning: false });
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Pomodoro Timer',
        message: 'Time is up! Take a break.'
      });
    }
  }, 1000);
}

function pauseBackgroundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  isTimerRunning = false;
  chrome.storage.sync.set({ isTimerRunning: false });
}

function resetBackgroundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  isTimerRunning = false;
  timerEndTime = null;
  chrome.storage.sync.set({ 
    isTimerRunning: false,
    timerEndTime: null,
    timeLeft: 25 * 60
  });
}

// Helper function to check if a URL should be blocked
function shouldBlockUrl(url) {
  // If timer is not running, don't block
  if (!isTimerRunning) {
    return false;
  }
  
  // Check if current time is past timer end time
  const now = Date.now();
  if (timerEndTime && now >= timerEndTime) {
    // Timer has ended, stop blocking
    chrome.storage.sync.set({ isTimerRunning: false });
    isTimerRunning = false;
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check each blocked website
    for (let site of blockedWebsites) {
      // Normalize the blocked site
      let cleanSite = site.trim().toLowerCase();
      // Remove protocol if present
      cleanSite = cleanSite.replace(/^(https?:\/\/)/, '');
      // Remove www if present
      cleanSite = cleanSite.replace(/^www\./, '');
      // Remove trailing slash and any path
      cleanSite = cleanSite.replace(/\/.*$/, '');
      
      // Check if hostname contains the blocked site or vice versa
      if (hostname.includes(cleanSite) || cleanSite.includes(hostname)) {
        return true;
      }
    }
  } catch (e) {
    // If URL parsing fails, don't block
    return false;
  }
  
  return false;
}

// Block requests to blocked websites when timer is running
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    if (shouldBlockUrl(details.url)) {
      // Redirect to blocked page
      return { redirectUrl: chrome.runtime.getURL('blocked.html') };
    }
    
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Listen for tab updates to redirect if needed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (!changeInfo.url || changeInfo.status !== 'loading') {
    return;
  }
  
  if (shouldBlockUrl(changeInfo.url)) {
    // Redirect to blocked page
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
    return;
  }
});
