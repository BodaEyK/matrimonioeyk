# Copilot Instructions for Boda Edgardo & Kiara Project

## Overview
This project manages wedding invitations and RSVP workflows for Edgardo & Kiara. It consists of two main HTML frontends and a Google Apps Script backend for data storage and business logic.

## Architecture
- **Frontend:**
  - `boda-edgardo.html`: Main guest-facing invitation and RSVP page.
  - `admin-boda.html`: Admin dashboard for managing guests and RSVPs.
  - Both use custom CSS variables for theming and reference Google Fonts.
  - QR code generation is handled via `qrcodejs` (CDN).
- **Backend:**
  - `google-apps-script.js`: Google Apps Script acting as a REST-like API, storing data in Google Sheets.
  - Two sheets: `Invitados` (guests) and `RSVP` (responses), with specific column structures.
  - All data flows between HTML and backend via HTTP requests to the Apps Script web app URL.

## Developer Workflows
- **Backend Deployment:**
  - Deploy `google-apps-script.js` as a new "Web App" in Google Apps Script after every change.
  - Update the web app URL in both HTML files after each deployment.
- **Frontend Updates:**
  - Edit HTML/CSS directly in `boda-edgardo.html` and `admin-boda.html`.
  - Ensure the backend URL is current in both files.

## Project-Specific Patterns
- **Data Model:**
  - Guests and RSVP data are stored in Google Sheets with fixed column names (see script comments).
- **Communication:**
  - All cross-component communication is via HTTP requests to the Apps Script endpoint.
- **Styling:**
  - Uses CSS variables for color and theme consistency.
- **Localization:**
  - All UI and comments are in Spanish.

## Key Files
- `google-apps-script.js`: Backend logic, API endpoints, and data model documentation.
- `boda-edgardo.html`: Guest-facing UI, RSVP form, and integration with backend.
- `admin-boda.html`: Admin UI for managing invitations and responses.

## Example: Connecting Frontend to Backend
- Update the Apps Script web app URL in both HTML files after each deployment.
- Example API call (from HTML):
  ```js
  fetch('https://script.google.com/macros/s/WEB_APP_URL/exec', { ... })
  ```

## Conventions
- Always redeploy the Apps Script as a new version after backend changes.
- Keep sheet/tab names and column headers exactly as specified in the script comments.
- Use Spanish for all UI and code comments.

---
For more details, see comments in `google-apps-script.js` and the structure of both HTML files.