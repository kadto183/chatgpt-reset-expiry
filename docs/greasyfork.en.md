# ChatGPT Reset Expiry

If ChatGPT only shows the date when a reset credit expires, this userscript reveals the **exact expiration time down to the second**.

## Features

- Shows the exact expiration time of ChatGPT Reset Credits
- Converts timestamps to the browser's current local timezone
- Handles UTC offsets and daylight saving time automatically
- Starts collapsed and only surfaces results after valid reset-credit data is detected
- Keeps the main panel focused on active credits
- Moves expired credits and secondary diagnostics into a collapsed More section
- Supports dragging and remembers the panel position
- Adapts automatically to light and dark themes
- Copies all active expiration times with one click

## Privacy & Security

This userscript runs locally in your browser:

- No account data is uploaded
- Cookies, tokens, and login credentials are not stored
- Protected ChatGPT requests are not replayed
- ChatGPT account settings are not modified
- The script only inspects response data that the ChatGPT page has already received

## Language & Timezone

- Mainland China timezones: Simplified Chinese UI
- Hong Kong, Macau, and Taiwan timezones: Traditional Chinese UI
- Other regions: English UI
- Times are always displayed using the browser / operating system's current timezone

Source code:
https://github.com/kadto183/chatgpt-reset-expiry

> This is an independent community project and is not affiliated with or endorsed by OpenAI.
