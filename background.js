let isTimerRunning = false;
let blockedWebsites = [];
let timerEndTime = null;
let timerInterval = null;
let focusMinutes = 25; // Default focus time
let isBreakTime = false;
let loopEnabled = false;

// Load all values from storage when extension starts
chrome.storage.sync.get(['isTimerRunning', 'blockedWebsites', 'timerEndTime', 'timeLeft', 'focusMinutes', 'isBreakTime', 'loopEnabled'], function(result) {
  if (result.isTimerRunning !== undefined) {
    isTimerRunning = result.isTimerRunning;
  }
  if (result.blockedWebsites) {
    blockedWebsites = result.blockedWebsites;
  }
  if (result.timerEndTime) {
    timerEndTime = result.timerEndTime;
  }
  if (result.focusMinutes) {
    focusMinutes = result.focusMinutes;
  }
  if (result.isBreakTime !== undefined) {
    isBreakTime = result.isBreakTime;
  }
  if (result.loopEnabled !== undefined) {
    loopEnabled = result.loopEnabled;
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
    if (changes.focusMinutes) {
      focusMinutes = changes.focusMinutes.newValue;
    }
    if (changes.isBreakTime) {
      isBreakTime = changes.isBreakTime.newValue;
    }
    if (changes.loopEnabled) {
      loopEnabled = changes.loopEnabled.newValue;
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
  } else if (request.type === 'updateFocusTime') {
    focusMinutes = request.minutes;
    // If timer is not running, also update timeLeft
    if (!isTimerRunning) {
      const newTimeLeft = focusMinutes * 60;
      chrome.storage.sync.set({ 
        focusMinutes: focusMinutes,
        timeLeft: newTimeLeft
      });
    } else {
      chrome.storage.sync.set({ focusMinutes: focusMinutes });
    }
    sendResponse({ success: true });
  } else if (request.type === 'toggleLoop') {
    loopEnabled = request.enabled;
    chrome.storage.sync.set({ loopEnabled: loopEnabled });
    sendResponse({ success: true });
  } else if (request.type === 'getTimerStatus') {
    // Calculate current time left
    let timeLeft = focusMinutes * 60; // default
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
      timerEndTime: timerEndTime,
      focusMinutes: focusMinutes,
      isBreakTime: isBreakTime,
      loopEnabled: loopEnabled
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
      let timeLeft = result.timeLeft !== undefined ? result.timeLeft : focusMinutes * 60;
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
    
    // Update storage with current time left
    chrome.storage.sync.set({ timeLeft: timeLeft });
    
    if (timeLeft <= 0) {
      // Timer finished
      clearInterval(timerInterval);
      isTimerRunning = false;
      
      if (isBreakTime) {
        // Break ended, start focus session if loop is enabled
        isBreakTime = false;
        chrome.storage.sync.set({ isBreakTime: false });
        
        if (loopEnabled) {
          // Start focus session
          timerEndTime = Date.now() + (focusMinutes * 60 * 1000);
          isTimerRunning = true;
          chrome.storage.sync.set({ 
            isTimerRunning: true,
            timerEndTime: timerEndTime,
            timeLeft: focusMinutes * 60
          });
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Break Time Over!',
            message: 'Focus session started. Stay productive!'
          });
          
          runTimerInterval();
          return;
        } else {
          chrome.storage.sync.set({ isTimerRunning: false });
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Break Time Over!',
            message: 'Ready to start your next focus session?'
          });
        }
      } else {
        // Focus session ended, start break if loop is enabled
        if (loopEnabled) {
          // Start break session (10 minutes)
          isBreakTime = true;
          timerEndTime = Date.now() + (10 * 60 * 1000); // 10 minutes break
          isTimerRunning = true;
          chrome.storage.sync.set({ 
            isTimerRunning: true,
            timerEndTime: timerEndTime,
            timeLeft: 10 * 60,
            isBreakTime: true
          });
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Focus Session Complete!',
            message: 'Time for a 10-minute break. Well done!'
          });
          
          runTimerInterval();
          return;
        } else {
          chrome.storage.sync.set({ isTimerRunning: false });
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Focus Session Complete!',
            message: 'Great work! Time for a well-deserved break.'
          });
        }
      }
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
  isBreakTime = false;
  chrome.storage.sync.set({ 
    isTimerRunning: false,
    timerEndTime: null,
    timeLeft: focusMinutes * 60,
    isBreakTime: false
  });
}

// Helper function to check if a URL should be blocked
function shouldBlockUrl(url) {
  // If timer is not running or it's break time, don't block
  if (!isTimerRunning || isBreakTime) {
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
