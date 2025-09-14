let timeLeft = 25 * 60;
let isRunning = false;
let focusMinutes = 25;
let isBreakTime = false;
let loopEnabled = false;

const timerDisplay = document.getElementById("timer");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const websiteInput = document.getElementById("websiteInput");
const addWebsiteBtn = document.getElementById("addWebsiteBtn");
const websitesList = document.getElementById("websitesList");
const statusDisplay = document.getElementById("status");
const focusTimeInput = document.getElementById("focusTimeInput");
const updateTimeBtn = document.getElementById("updateTimeBtn");
const loopToggle = document.getElementById("loopToggle");

// Accordion elements
const accordionHeader = document.querySelector('.accordion-header');
const settingsContent = document.getElementById('settingsContent');

document.addEventListener("DOMContentLoaded", function () {
  updateTimerStatus();

  chrome.storage.sync.get(["blockedWebsites"], function (result) {
    const blockedWebsites = result.blockedWebsites || [];
    renderWebsitesList(blockedWebsites);
  });

  // Add event listener for accordion
  if (accordionHeader) {
    accordionHeader.addEventListener('click', function() {
      this.classList.toggle('active');
      settingsContent.classList.toggle('active');
    });
  }

  setInterval(updateTimerStatus, 1000);
});

function updateTimerStatus() {
  chrome.runtime.sendMessage({ type: "getTimerStatus" }, function (response) {
    if (response) {
      isRunning = response.isRunning;
      isBreakTime = response.isBreakTime || false;

      if (isRunning) {
        timeLeft = response.timeLeft;
      } else {
        if (focusMinutes && focusMinutes > 0) {
          timeLeft = focusMinutes * 60;
        } else {
          timeLeft = response.timeLeft;
        }
      }

      if (response.focusMinutes && !focusTimeInput.matches(":focus")) {
        focusMinutes = response.focusMinutes;
        focusTimeInput.value = focusMinutes;
      }

      if (response.loopEnabled !== undefined) {
        loopEnabled = response.loopEnabled;
        loopToggle.checked = loopEnabled;
      }

      updateTimerDisplay();
      updateStatusDisplay();
      updateControls();
    }
  });
}

function updateStatusDisplay() {
  if (isRunning) {
    if (isBreakTime) {
      statusDisplay.textContent = "Break Time";
      statusDisplay.className = "status-badge status-break";
    } else {
      statusDisplay.textContent = "Focus Time";
      statusDisplay.className = "status-badge status-running";
    }
  } else {
    statusDisplay.textContent = "Not Running";
    statusDisplay.className = "status-badge status-stopped";
  }
}

function updateControls() {
  const timerLabel = document.querySelector(".timer-label");
  if (isBreakTime) {
    timerLabel.textContent = "Break Time";
  } else {
    timerLabel.textContent = "Focus Time";
  }

  const timerSection = document.querySelector(".timer-section");
  if (isRunning && !isBreakTime) {
    timerSection.classList.add("timer-running");
  } else {
    timerSection.classList.remove("timer-running");
  }
}

function startTimer() {
  chrome.runtime.sendMessage({ type: "startTimer" }, function (response) {
    if (response && response.success) {
      updateTimerStatus();
    }
  });
}

function pauseTimer() {
  chrome.runtime.sendMessage({ type: "pauseTimer" }, function (response) {
    if (response && response.success) {
      updateTimerStatus();
    }
  });
}

function resetTimer() {
  chrome.runtime.sendMessage({ type: "resetTimer" }, function (response) {
    if (response && response.success) {
      updateTimerStatus();
    }
  });
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function updateFocusTime() {
  const minutes = parseInt(focusTimeInput.value);
  if (minutes && minutes > 0 && minutes <= 180) {
    chrome.runtime.sendMessage(
      { type: "updateFocusTime", minutes: minutes },
      function (response) {
        if (response && response.success) {
          focusMinutes = minutes;
          if (!isRunning) {
            timeLeft = minutes * 60;
            updateTimerDisplay();
          }
        }
      }
    );
  } else {
    alert("Please enter a valid time between 1 and 180 minutes.");
    focusTimeInput.value = focusMinutes;
  }
}

function toggleLoop() {
  chrome.runtime.sendMessage(
    { type: "toggleLoop", enabled: loopToggle.checked },
    function (response) {
      if (response && response.success) {
        loopEnabled = loopToggle.checked;
      }
    }
  );
}

startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
updateTimeBtn.addEventListener("click", updateFocusTime);
loopToggle.addEventListener("change", toggleLoop);

focusTimeInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    updateFocusTime();
  }
});

function renderWebsitesList(websites) {
  if (websites.length === 0) {
    websitesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌐</div>
        <div>No websites blocked yet</div>
      </div>
    `;
    return;
  }

  websitesList.innerHTML = "";
  websites.forEach((website) => {
    const websiteItem = document.createElement("div");
    websiteItem.className = "website-item";
    websiteItem.innerHTML = `
      <span class="website-url">${website}</span>
      <button class="remove-btn" data-website="${website}">Remove</button>
    `;
    websitesList.appendChild(websiteItem);
  });

  document.querySelectorAll(".remove-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const website = this.getAttribute("data-website");
      removeWebsite(website);
    });
  });
}

function addWebsite() {
  const website = websiteInput.value.trim();
  if (!website) return;

  chrome.storage.sync.get(["blockedWebsites"], function (result) {
    const blockedWebsites = result.blockedWebsites || [];
    if (!blockedWebsites.includes(website)) {
      blockedWebsites.push(website);
      chrome.storage.sync.set(
        { blockedWebsites: blockedWebsites },
        function () {
          renderWebsitesList(blockedWebsites);
          websiteInput.value = "";

          chrome.runtime.sendMessage({
            type: "blockedWebsitesUpdated",
            blockedWebsites: blockedWebsites,
          });
        }
      );
    }
  });
}

function removeWebsite(websiteToRemove) {
  chrome.storage.sync.get(["blockedWebsites"], function (result) {
    const blockedWebsites = result.blockedWebsites || [];
    const updatedWebsites = blockedWebsites.filter(
      (website) => website !== websiteToRemove
    );
    chrome.storage.sync.set({ blockedWebsites: updatedWebsites }, function () {
      renderWebsitesList(updatedWebsites);

      chrome.runtime.sendMessage({
        type: "blockedWebsitesUpdated",
        blockedWebsites: updatedWebsites,
      });
    });
  });
}

addWebsiteBtn.addEventListener("click", addWebsite);
websiteInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    addWebsite();
  }
});
