let isTimerRunning = false;
let blockedWebsites = [];
let timerEndTime = null;
let timerInterval = null;
let focusMinutes = 25;
let breakMinutes = 10;
let isBreakTime = false;
let loopEnabled = false;

chrome.storage.sync.get(
  [
    "isTimerRunning",
    "blockedWebsites",
    "timerEndTime",
    "timeLeft",
    "focusMinutes",
    "breakMinutes",
    "isBreakTime",
    "loopEnabled",
  ],
  function (result) {
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
    if (result.breakMinutes) {
      breakMinutes = result.breakMinutes;
    }
    if (result.isBreakTime !== undefined) {
      isBreakTime = result.isBreakTime;
    }
    if (result.loopEnabled !== undefined) {
      loopEnabled = result.loopEnabled;
    }

    // Initialize timeLeft if not set
    if (result.timeLeft === undefined) {
      chrome.storage.sync.set({ timeLeft: focusMinutes * 60 });
    }

    if (isTimerRunning && timerEndTime) {
      startBackgroundTimer();
    }
  }
);

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === "sync") {
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

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "blockedWebsitesUpdated") {
    blockedWebsites = request.blockedWebsites;
  } else if (request.type === "startTimer") {
    startBackgroundTimer();
    sendResponse({ success: true });
  } else if (request.type === "pauseTimer") {
    pauseBackgroundTimer();
    sendResponse({ success: true });
  } else if (request.type === "resetTimer") {
    resetBackgroundTimer();
    sendResponse({ success: true });
  } else if (request.type === "updateFocusTime") {
    focusMinutes = request.minutes;
    chrome.storage.sync.set({ focusMinutes: focusMinutes }, function () {
      if (!isTimerRunning) {
        chrome.storage.sync.set({ timeLeft: focusMinutes * 60 });
      }
      console.log("Background: Focus time updated to", focusMinutes);
      sendResponse({ success: true });
    });
    return true;
  } else if (request.type === "updateBreakTime") {
    breakMinutes = request.minutes;
    chrome.storage.sync.set({ breakMinutes: breakMinutes }, function () {
      console.log("Background: Break time updated to", breakMinutes);
      sendResponse({ success: true });
    });
    return true;
  } else if (request.type === "toggleLoop") {
    loopEnabled = request.enabled;
    chrome.storage.sync.set({ loopEnabled: loopEnabled }, function () {
      console.log("Background: Loop enabled set to", loopEnabled);
      sendResponse({ success: true });
    });
    return true;
  } else if (request.type === "getTimerStatus") {
    chrome.storage.sync.get(["timeLeft"], function (result) {
      let timeLeft = result.timeLeft !== undefined ? result.timeLeft : focusMinutes * 60;
      const isFromBlockedPage = request.fromBlockedPage || false;
      
      // If timer is running, calculate from end time
      if (timerEndTime && isTimerRunning) {
        const now = Date.now();
        if (now < timerEndTime) {
          timeLeft = Math.ceil((timerEndTime - now) / 1000);
        } else {
          // Timer has ended - this should be handled by the timer completion logic
          timeLeft = 0;
        }
      } else if (!isTimerRunning) {
        // Timer is not running (paused or stopped)
        if (result.timeLeft !== undefined) {
          // Use saved timeLeft (for paused state)
          timeLeft = result.timeLeft;
          console.log('Using saved timeLeft for paused timer:', timeLeft);
        } else {
          // No saved timeLeft - use default based on context
          if (isFromBlockedPage) {
            timeLeft = 0; // Blocked page shows 00:00 when timer not running
          } else {
            timeLeft = focusMinutes * 60; // Extension shows full duration when timer not running
          }
          console.log('Using default timeLeft for stopped timer:', timeLeft, 'isFromBlockedPage:', isFromBlockedPage);
        }
      }

      sendResponse({
        isRunning: isTimerRunning,
        timeLeft: timeLeft,
        timerEndTime: timerEndTime,
        focusMinutes: focusMinutes,
        breakMinutes: breakMinutes,
        isBreakTime: isBreakTime,
        loopEnabled: loopEnabled,
      });
    });
    return true;
  }
});

function startBackgroundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  chrome.storage.sync.get(["timeLeft"], function (result) {
    let timeLeft = result.timeLeft !== undefined ? result.timeLeft : focusMinutes * 60;
    
    // If timer was paused, use the saved remaining time
    // If timer was reset or never started, use the full duration
    timerEndTime = Date.now() + timeLeft * 1000;

    isTimerRunning = true;
    chrome.storage.sync.set({
      isTimerRunning: true,
      timerEndTime: timerEndTime,
      timeLeft: timeLeft,
    });

    // Close or redirect tabs with blocked websites when timer starts
    closeBlockedTabs();

    runTimerInterval();
  });
}

function runTimerInterval() {
  timerInterval = setInterval(() => {
    const now = Date.now();
    let timeLeft = 0;

    if (timerEndTime && now < timerEndTime) {
      timeLeft = Math.ceil((timerEndTime - now) / 1000);
      
      // Update the timeLeft in storage while timer is running
      chrome.storage.sync.set({ timeLeft: timeLeft }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error updating timeLeft:', chrome.runtime.lastError);
        }
      });
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      isTimerRunning = false;

      if (isBreakTime) {
        isBreakTime = false;
        chrome.storage.sync.set({ isBreakTime: false });

        if (loopEnabled) {
          timerEndTime = Date.now() + focusMinutes * 60 * 1000;
          isTimerRunning = true;
          chrome.storage.sync.set({
            isTimerRunning: true,
            timerEndTime: timerEndTime,
            timeLeft: focusMinutes * 60,
          });

          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "Break Time Over!",
            message: "Focus session started. Stay productive!",
          });

          // Close tabs with blocked websites when focus time starts
          closeBlockedTabs();

          runTimerInterval();
          return;
        } else {
          // Loop disabled - reset timer to full duration after break
          isTimerRunning = false;
          timerEndTime = null;
          isBreakTime = false;
          chrome.storage.sync.set({ 
            isTimerRunning: false,
            timerEndTime: null,
            timeLeft: focusMinutes * 60,
            isBreakTime: false
          });
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "Break Time Over!",
            message: "Ready to start your next focus session?",
          });
        }
      } else {
        if (loopEnabled) {
          isBreakTime = true;
          timerEndTime = Date.now() + breakMinutes * 60 * 1000;
          isTimerRunning = true;
          chrome.storage.sync.set({
            isTimerRunning: true,
            timerEndTime: timerEndTime,
            timeLeft: breakMinutes * 60,
            isBreakTime: true,
          });

          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "Focus Session Complete!",
            message: `Time for a ${breakMinutes}-minute break. Well done!`,
          });

          runTimerInterval();
          return;
        } else {
          // Loop disabled - reset timer to full duration
          isTimerRunning = false;
          timerEndTime = null;
          isBreakTime = false;
          chrome.storage.sync.set({ 
            isTimerRunning: false,
            timerEndTime: null,
            timeLeft: focusMinutes * 60,
            isBreakTime: false
          });
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "Focus Session Complete!",
            message: "Great work! Time for a well-deserved break.",
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

  // Calculate and save the actual remaining time when pausing
  if (timerEndTime) {
    const now = Date.now();
    const remainingTime = Math.max(0, Math.ceil((timerEndTime - now) / 1000));
    console.log('Pausing timer with remaining time:', remainingTime);
    
    // Clear timerEndTime when paused so it doesn't interfere with display
    timerEndTime = null;
    
    chrome.storage.sync.set({ 
      isTimerRunning: false,
      timerEndTime: null,
      timeLeft: remainingTime
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('Error pausing timer:', chrome.runtime.lastError);
      } else {
        console.log('Timer paused successfully');
      }
    });
  } else {
    chrome.storage.sync.set({ 
      isTimerRunning: false,
      timerEndTime: null
    });
  }
  
  isTimerRunning = false;
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
    isBreakTime: false,
  });
}

function shouldBlockUrl(url) {
  if (!isTimerRunning || isBreakTime) {
    return false;
  }

  const now = Date.now();
  if (timerEndTime && now >= timerEndTime) {
    chrome.storage.sync.set({ isTimerRunning: false });
    isTimerRunning = false;
    return false;
  }

  return isUrlInBlockedList(url);
}

function isUrlInBlockedList(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    for (let site of blockedWebsites) {
      let cleanSite = site.trim().toLowerCase();

      // Remove protocol
      cleanSite = cleanSite.replace(/^(https?:\/\/)/, "");
      
      // Remove www prefix
      cleanSite = cleanSite.replace(/^www\./, "");
      
      // Remove path for hostname comparison
      cleanSite = cleanSite.replace(/\/.*$/, "");

      // Check if the blocked site matches the hostname or if the URL contains the blocked site
      if (hostname === cleanSite || 
          hostname.includes(cleanSite) || 
          cleanSite.includes(hostname) ||
          fullUrl.includes(cleanSite)) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }

  return false;
}

function closeBlockedTabs() {
  // Don't close tabs during break time
  if (isBreakTime) {
    return;
  }
  
  // Get all tabs and check which ones should be blocked
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      // Redirect any tab that is on a blocked website (regardless of current timer state)
      if (tab.url && isUrlInBlockedList(tab.url)) {
        chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("blocked.html") });
      }
    });
  });
}

chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (shouldBlockUrl(details.url)) {
      return { redirectUrl: chrome.runtime.getURL("blocked.html") };
    }

    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (!changeInfo.url || changeInfo.status !== "loading") {
    return;
  }

  if (shouldBlockUrl(changeInfo.url)) {
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
    return;
  }
});

// Also listen for when tabs become active to check if they should be blocked
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab.url && shouldBlockUrl(tab.url)) {
      chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("blocked.html") });
    }
  });
});
