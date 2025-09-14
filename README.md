# Pomodoro Website Blocker Extension

A Chrome extension that helps you stay focused by blocking distracting websites during Pomodoro timer sessions.

## Features

- 25-minute Pomodoro timer that continues running even when the popup is closed
- Block specified websites during focus sessions
- Visual timer display
- Status indicators
- Automatic unblocking when timer ends
- Real-time timer display on blocked pages
- Improved website matching algorithm

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension folder
4. The extension icon will appear in your toolbar

## How to Use

1. Click the extension icon in your toolbar to open the popup
2. Add websites you want to block during focus sessions (e.g., facebook.com, twitter.com)
3. Click "Start" to begin a 25-minute Pomodoro session
4. During the session, attempts to visit blocked websites will be redirected
5. When the timer ends, website access is automatically restored
6. The timer continues to run even when the popup is closed

## Timer Controls

- **Start**: Begin a new Pomodoro session
- **Pause**: Temporarily pause the timer
- **Reset**: Reset the timer to 25 minutes

## Managing Blocked Websites

- Enter a website URL in the input field and click "Add" to block it
- Click "Remove" next to any website to unblock it
- Blocked websites are stored and persist between sessions

## How It Works

The extension uses Chrome's webRequest API to intercept navigation requests. The timer logic runs in the background script, ensuring it continues to operate even when the popup is closed. When the Pomodoro timer is active, any attempt to visit a blocked website will be redirected to a blocking page. The blocking page shows the remaining time and provides information about the focus session.

Once the timer completes, website access is automatically restored.

## Troubleshooting

If websites are not being blocked:

1. Make sure the Pomodoro timer is running (the status should show "Timer Running")
2. Check that you've added the correct website URLs to the blocked list
3. Try reloading the extension:
   - Go to `chrome://extensions`
   - Find "Pomodoro Website Blocker"
   - Click the refresh icon

## Privacy

This extension stores your blocked website list locally in your browser. No data is sent to external servers.
