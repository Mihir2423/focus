let timeLeft = 25 * 60; // 25 minutes in seconds
let isRunning = false;

const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const websiteInput = document.getElementById('websiteInput');
const addWebsiteBtn = document.getElementById('addWebsiteBtn');
const websitesList = document.getElementById('websitesList');
const statusDisplay = document.getElementById('status');

// Load data from storage when popup opens
document.addEventListener('DOMContentLoaded', function() {
  updateTimerStatus();
  
  // Load blocked websites
  chrome.storage.sync.get(['blockedWebsites'], function(result) {
    const blockedWebsites = result.blockedWebsites || [];
    renderWebsitesList(blockedWebsites);
  });
  
  // Update timer display every second
  setInterval(updateTimerStatus, 1000);
});

// Update timer status from background
function updateTimerStatus() {
  chrome.runtime.sendMessage({ type: 'getTimerStatus' }, function(response) {
    if (response) {
      isRunning = response.isRunning;
      timeLeft = response.timeLeft;
      
      updateTimerDisplay();
      
      if (isRunning) {
        statusDisplay.textContent = 'Timer Running';
        statusDisplay.className = 'status running';
      } else {
        statusDisplay.textContent = 'Timer Not Running';
        statusDisplay.className = 'status not-running';
      }
    }
  });
}

// Timer functions
function startTimer() {
  chrome.runtime.sendMessage({ type: 'startTimer' }, function(response) {
    if (response && response.success) {
      updateTimerStatus();
    }
  });
}

function pauseTimer() {
  chrome.runtime.sendMessage({ type: 'pauseTimer' }, function(response) {
    if (response && response.success) {
      updateTimerStatus();
    }
  });
}

function resetTimer() {
  chrome.runtime.sendMessage({ type: 'resetTimer' }, function(response) {
    if (response && response.success) {
      updateTimerStatus();
    }
  });
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Event listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Website blocking functions
function renderWebsitesList(websites) {
  websitesList.innerHTML = '';
  websites.forEach(website => {
    const websiteItem = document.createElement('div');
    websiteItem.className = 'website-item';
    websiteItem.innerHTML = `
      <span>${website}</span>
      <button class="remove-btn" data-website="${website}">Remove</button>
    `;
    websitesList.appendChild(websiteItem);
  });
  
  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-btn').forEach(button => {
    button.addEventListener('click', function() {
      const website = this.getAttribute('data-website');
      removeWebsite(website);
    });
  });
}

function addWebsite() {
  const website = websiteInput.value.trim();
  if (!website) return;
  
  chrome.storage.sync.get(['blockedWebsites'], function(result) {
    const blockedWebsites = result.blockedWebsites || [];
    if (!blockedWebsites.includes(website)) {
      blockedWebsites.push(website);
      chrome.storage.sync.set({ blockedWebsites: blockedWebsites }, function() {
        renderWebsitesList(blockedWebsites);
        websiteInput.value = '';
        // Notify background script of updated blocked websites
        chrome.runtime.sendMessage({ type: 'blockedWebsitesUpdated', blockedWebsites: blockedWebsites });
      });
    }
  });
}

function removeWebsite(websiteToRemove) {
  chrome.storage.sync.get(['blockedWebsites'], function(result) {
    const blockedWebsites = result.blockedWebsites || [];
    const updatedWebsites = blockedWebsites.filter(website => website !== websiteToRemove);
    chrome.storage.sync.set({ blockedWebsites: updatedWebsites }, function() {
      renderWebsitesList(updatedWebsites);
      // Notify background script of updated blocked websites
      chrome.runtime.sendMessage({ type: 'blockedWebsitesUpdated', blockedWebsites: updatedWebsites });
    });
  });
}

// Event listener for adding websites
addWebsiteBtn.addEventListener('click', addWebsite);
websiteInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    addWebsite();
  }
});
