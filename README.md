# CampusVenue — Seminar Hall & Auditorium Allocation App

A lightweight, minimal-file **React (Vite) + Node.js (Express)** application for managing campus seminar hall and auditorium allocations, designed cleanly for a **2-person team**.

## Features
- **Live Slot Availability Checker**: Filter venues by date, start/end time, and minimum attendee count.
- **Smart Conflict Detection**: Automatically blocks overlapping time slots and suggests alternative free halls with enough capacity.
- **Schedule & Booking Tracker**: Search and filter all bookings (`Approved`, `Pending`, `Rejected`) and cancel requests.
- **Admin Coordinator Panel** *(Demo PIN: `1234`)*: Approve/reject requests with remarks, add new halls, and toggle maintenance mode.

---

## Project Structure & 2-Person Ownership (Only 10 Core Files)

| File | Owner | Responsibility |
| :--- | :--- | :--- |
| `package.json`, `vite.config.js`, `index.html` | **Shared** | Project setup, Vite dev proxy (`/api` -> `localhost:5000`), entry HTML |
| `src/main.jsx` | **Arushi Verma (Person 1)** | React app entry point |
| `src/App.jsx` | **Arushi Verma (Person 1)** | Venue directory, availability filter, booking modal, conflict suggestions UI, schedule view |
| `src/styles.css` | **Arushi Verma (Person 1)** | Responsive UI layout, badges, cards, modal & toast styling |
| `server/server.js` | **Ifyouknowyouknow2 (Person 2)** | Express REST API, time-overlap conflict engine, alternative hall recommender, admin endpoints |
| `server/data.json` | **Ifyouknowyouknow2 (Person 2)** | Pre-seeded halls & bookings JSON persistence |
| `src/AdminPanel.jsx` | **Ifyouknowyouknow2 (Person 2)** | Admin PIN lock, approval/rejection workflow, add new venue & maintenance toggle |

---

## Quick Start

```bash
npm install
npm run dev
```

- **Frontend (React + Vite):** `http://localhost:5173`
- **Backend API (Express):** `http://localhost:5000`
- **Admin Demo PIN:** `1234`

---

## 2-Person Git Workflow & Branch Setup

This repository is initialized with a realistic 2-branch history merged into `main`:
- `feature/backend-admin` (**Person 2**): Backend API, conflict engine, sample data, and Admin Panel.
- `feature/frontend-booking` (**Person 1**): Frontend UI, live availability checker, booking flow, and styles.

### How Both Members Work Without Merge Conflicts
1. **Person 1** works on `feature/frontend-booking` (`src/App.jsx`, `src/styles.css`, `src/main.jsx`):
   ```bash
   git checkout -b feature/frontend-booking
   # make changes
   git add src/App.jsx src/styles.css src/main.jsx
   git commit -m "feat(ui): improve booking modal and schedule filters"
   git push -u origin feature/frontend-booking
   ```
2. **Person 2** works on `feature/backend-admin` (`server/server.js`, `server/data.json`, `src/AdminPanel.jsx`):
   ```bash
   git checkout -b feature/backend-admin
   # make changes
   git add server/ src/AdminPanel.jsx
   git commit -m "feat(api): add conflict engine and admin approvals"
   git push -u origin feature/backend-admin
   ```
3. **Merge into `main`** (via GitHub Pull Request or locally):
   ```bash
   git checkout main
   git merge --no-ff feature/backend-admin
   git merge --no-ff feature/frontend-booking
   ```

### Optional: Set Your Real Names on Git Commits
Before making new commits, each member should configure their own Git identity on their laptop:
```bash
git config user.name "Your Real Name"
git config user.email "your.email@example.com"
```
