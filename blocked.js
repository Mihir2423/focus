let updateInterval;
let originalUrl = null;

// Original URL functionality removed to prevent refresh issues

// Function to get timer status from background script (blocked pages can't use runtime API)
function getTimerFromBackground() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ 
        type: "getTimerStatus", 
        fromBlockedPage: true 
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(response);
      });
    } else {
      resolve(null);
    }
  });
}

// Update timer display
async function updateTimer() {
  try {
    const timerData = await getTimerFromBackground();
    console.log('Timer update - data:', timerData);
    
    if (timerData) {
      const timeLeft = Math.max(0, timerData.timeLeft);
      console.log('Timer update - timeLeft:', timeLeft, 'isRunning:', timerData.isRunning);
      updateTimerDisplay(timeLeft);
      updateTimerLabel(timerData.isBreakTime);
      
      // Update status message
      if (timerData.isRunning && timeLeft > 0) {
        if (timerData.isBreakTime) {
          document.getElementById('status').innerHTML = 
            '<strong>Break time is active</strong><br>You can access all websites during your break. Enjoy your rest!';
          
          // Show break time message - user can click Try Again to go to original URL
        } else {
          document.getElementById('status').innerHTML = 
            '<strong>Focus session is active</strong><br>Stay focused on your current task. Access will be restored when the session ends.';
          // Focus time active
        }
      } else if (timeLeft <= 0) {
        document.getElementById('status').innerHTML = 
          '<strong>Session completed!</strong><br>You can now access this website. Try refreshing the page.';
        // Stop updating if timer is done
        if (updateInterval) {
          clearInterval(updateInterval);
        }
      } else {
        document.getElementById('status').innerHTML = 
          '<strong>No active session</strong><br>The timer is not currently running.';
        // Timer not running
      }
    } else {
      // Fallback if we can't access storage
      console.log('No timer data received');
      document.getElementById('timer').textContent = '--:--';
      document.getElementById('status').innerHTML = 
        '<strong>Unable to load timer status</strong><br>Try refreshing the page or check your extension.';
    }
  } catch (e) {
    console.error('Error updating timer:', e);
    document.getElementById('timer').textContent = '--:--';
    document.getElementById('status').innerHTML = 
      '<strong>Error loading timer</strong><br>Please refresh the page.';
  }
}

function updateTimerDisplay(timeLeft) {
  document.getElementById('timer').textContent = formatTime(timeLeft);
}

function updateTimerLabel(isBreakTime) {
  const timerLabel = document.querySelector('.timer-label');
  if (timerLabel) {
    timerLabel.textContent = isBreakTime ? 'Break Time' : 'Focus Time';
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Initialize timer display
console.log('Initializing blocked page timer...');
console.log('Chrome available:', typeof chrome !== 'undefined');
console.log('Chrome storage available:', typeof chrome !== 'undefined' && chrome.storage);

// Original URL functionality disabled

updateTimer();

// Update every second
updateInterval = setInterval(updateTimer, 1000);

// Refresh page button
document.getElementById('refreshPage').addEventListener('click', function() {
  // Check if timer is actually running before reloading
  getTimerFromBackground().then(function(timerData) {
    console.log('Timer data:', timerData);
    if (timerData && timerData.isRunning && timerData.timeLeft > 0) {
      if (timerData.isBreakTime) {
        // Break time - try to go back to previous page
        console.log('Break time, trying to go back');
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = 'https://www.google.com';
        }
      } else {
        // Focus time - stay on blocked page
        console.log('Focus time, staying on blocked page');
        updateTimer();
      }
    } else {
      // Timer is not running or finished, try to go back
      console.log('Timer not running, trying to navigate away');
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // If no history, try to go to a safe page
        window.location.href = 'https://www.google.com';
      }
    }
  }).catch(function(error) {
    console.error('Error getting timer data:', error);
    // If we can't get timer status, try to go back
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://www.google.com';
    }
  });
});

// Listen for storage changes to update in real-time
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && (changes.timeLeft || changes.isTimerRunning || changes.timerEndTime || changes.isBreakTime)) {
      updateTimer();
    }
  });
}
