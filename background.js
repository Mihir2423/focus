let isTimerRunning = false;
let blockedWebsites = [];
let timerEndTime = null;
let timerInterval = null;
let focusMinutes = 25;
let isBreakTime = false;
let loopEnabled = false;

chrome.storage.sync.get(
  [
    "isTimerRunning",
    "blockedWebsites",
    "timerEndTime",
    "timeLeft",
    "focusMinutes",
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
    if (result.isBreakTime !== undefined) {
      isBreakTime = result.isBreakTime;
    }
    if (result.loopEnabled !== undefined) {
      loopEnabled = result.loopEnabled;
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
  } else if (request.type === "toggleLoop") {
    loopEnabled = request.enabled;
    chrome.storage.sync.set({ loopEnabled: loopEnabled }, function () {
      console.log("Background: Loop enabled set to", loopEnabled);
      sendResponse({ success: true });
    });
    return true;
  } else if (request.type === "getTimerStatus") {
    let timeLeft = focusMinutes * 60;
    if (timerEndTime && isTimerRunning) {
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
      loopEnabled: loopEnabled,
    });
  }
});

function startBackgroundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  if (!timerEndTime || !isTimerRunning) {
    chrome.storage.sync.get(["timeLeft"], function (result) {
      let timeLeft =
        result.timeLeft !== undefined ? result.timeLeft : focusMinutes * 60;
      timerEndTime = Date.now() + timeLeft * 1000;

      isTimerRunning = true;
      chrome.storage.sync.set({
        isTimerRunning: true,
        timerEndTime: timerEndTime,
        timeLeft: timeLeft,
      });

      runTimerInterval();
    });
  } else {
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

          runTimerInterval();
          return;
        } else {
          chrome.storage.sync.set({ isTimerRunning: false });
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
          timerEndTime = Date.now() + 10 * 60 * 1000;
          isTimerRunning = true;
          chrome.storage.sync.set({
            isTimerRunning: true,
            timerEndTime: timerEndTime,
            timeLeft: 10 * 60,
            isBreakTime: true,
          });

          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "Focus Session Complete!",
            message: "Time for a 10-minute break. Well done!",
          });

          runTimerInterval();
          return;
        } else {
          chrome.storage.sync.set({ isTimerRunning: false });
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

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    for (let site of blockedWebsites) {
      let cleanSite = site.trim().toLowerCase();

      cleanSite = cleanSite.replace(/^(https?:\/\/)/, "");

      cleanSite = cleanSite.replace(/^www\./, "");

      cleanSite = cleanSite.replace(/\/.*$/, "");

      if (hostname.includes(cleanSite) || cleanSite.includes(hostname)) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }

  return false;
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
