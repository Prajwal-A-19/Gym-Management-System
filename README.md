# 🏋️ GymPro — Advanced Gym Management System v2.0

A full-stack gym management system with role-based dashboards for **Admin**, **Trainer**, and **Member** — built with Node.js + Express + SQLite + vanilla JS.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd GymPro
npm install

# 2. Start the server
npm start
# or for hot-reload during development:
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## 🔑 Demo Credentials

| Role    | Username   | Password     |
|---------|------------|--------------|
| Admin   | `admin`    | `admin123`   |
| Trainer | `trainer1` | `trainer123` |
| Trainer | `trainer2` | `trainer123` |
| Member  | `john_d`   | `member123`  |
| Member  | `sara_m`   | `member123`  |

---

## 📁 Project Structure

```
GymPro/
├── server.js                  # Express app entry point
├── database.js                # SQLite setup, schema, seeding
├── package.json
├── .env                       # JWT_SECRET and PORT
├── gym.sqlite                 # Auto-created on first run
│
├── middleware/
│   └── authMiddleware.js      # JWT auth + role guards
│
├── routes/
│   ├── auth.js                # Login, Register, Change Password
│   ├── admin.js               # All admin CRUD endpoints
│   ├── trainer.js             # Trainer endpoints
│   └── member.js              # Member endpoints
│
└── public/
    ├── index.html             # Smart redirect
    ├── login.html             # Login + Register page
    ├── admin.html             # Admin dashboard
    ├── trainer.html           # Trainer dashboard
    └── member.html            # Member dashboard
```

---

## 🗄️ Database Schema (12 Tables)

| Table                | Description                              |
|---------------------|------------------------------------------|
| `users`             | Auth accounts (Admin/Trainer/Member)     |
| `plans`             | Membership plans with features + pricing |
| `trainers`          | Trainer profiles linked to users         |
| `members`           | Member profiles, plan & trainer links    |
| `attendance`        | Check-in logs with timestamps            |
| `workouts`          | Trainer-assigned exercises per member    |
| `payments`          | Payment records with receipts            |
| `equipment`         | Gym equipment inventory                  |
| `classes`           | Scheduled group classes                  |
| `class_enrollments` | Member ↔ class bookings                  |
| `body_metrics`      | Weight, BMI, body measurements           |
| `goals`             | Member fitness goals                     |
| `announcements`     | Gym-wide announcements                   |

---

## 👥 Role Capabilities

### 🛡️ Admin
- **Dashboard**: KPI stats, revenue chart, attendance trend, plan distribution
- **Members**: Full CRUD — add/edit/delete, assign plans & trainers, set status
- **Trainers**: Full CRUD — add/edit/delete trainer profiles
- **Plans**: Full CRUD — name, price, duration, features, active/inactive
- **Payments**: Record, view, delete — with receipt numbers, method, status
- **Classes**: Full CRUD — schedule, capacity, assign trainer
- **Equipment**: Full CRUD — inventory, condition, maintenance dates
- **Attendance**: Log check-ins manually, view/delete records
- **Announcements**: Post, edit, delete — target All/Members/Trainers

### 💪 Trainer
- **Dashboard**: Member count, class count, today's classes
- **Profile**: Edit personal info, bio, change password
- **My Members**: View assigned members with stats, attendance, metrics
- **Workout Plans**: Add/edit/delete exercises per member per day
- **Body Metrics**: Log and view weight, BMI, measurements per member
- **My Classes**: View assigned classes, see enrolled members
- **Announcements**: View gym announcements

### 🏃 Member
- **Home**: Monthly check-ins, plan days left, workout count, goals, chart
- **Profile**: View full profile, update contact info, change password
- **Check-In**: One-click gym check-in, recent visit history
- **Workouts**: View trainer-assigned workout plan by day
- **Body Metrics**: Log own measurements, weight chart, history table
- **Goals**: Add/edit/delete personal fitness goals with target dates
- **Classes**: Browse all active classes, enroll/unenroll
- **Payments**: View own payment history with receipts
- **Announcements**: View gym announcements

---

## 🔌 API Endpoints

### Auth (`/api/auth`)
```
POST /login              – Login, returns JWT token
POST /register           – New member self-registration
POST /change-password    – Change own password (authenticated)
```

### Admin (`/api/admin`) — Requires Admin JWT
```
GET  /dashboard
GET/POST        /members
GET/PUT/DELETE  /members/:id
GET/POST        /trainers
GET             /trainers/list
PUT/DELETE      /trainers/:id
GET/POST        /plans
PUT/DELETE      /plans/:id
GET/POST        /payments
PUT/DELETE      /payments/:id
GET/POST        /equipment
PUT/DELETE      /equipment/:id
GET/POST        /classes
PUT/DELETE      /classes/:id
GET/POST        /attendance
DELETE          /attendance/:id
GET/POST        /announcements
PUT/DELETE      /announcements/:id
```

### Trainer (`/api/trainer`) — Requires Trainer JWT
```
GET/PUT         /profile
GET             /members
GET             /members/:id/attendance
GET             /members/:id/metrics
GET             /members/:id/workouts
GET/POST        /workouts
PUT/DELETE      /workouts/:id
POST            /metrics
DELETE          /metrics/:id
GET             /classes
GET             /classes/:id/enrollments
GET             /announcements
```

### Member (`/api/member`) — Requires Member JWT
```
GET/PUT         /profile
GET/POST        /attendance
GET             /workouts
GET/POST        /metrics
GET/POST/PUT    /goals
DELETE          /goals/:id
GET             /classes
POST/DELETE     /classes/:id/enroll
GET             /payments
GET             /announcements
```

---

## 🔧 Environment Variables (`.env`)

```env
JWT_SECRET=your_super_secret_key_here
PORT=3000
```

---

## 📦 Dependencies

```json
{
  "express":    "^4.18.2",   // Web framework
  "sqlite3":    "^5.1.6",    // SQLite database driver
  "bcryptjs":   "^2.4.3",    // Password hashing
  "jsonwebtoken": "^9.0.0",  // JWT auth tokens
  "cors":       "^2.8.5",    // CORS headers
  "dotenv":     "^16.0.3"    // Environment variables
}
```

---

## 🤖 Continuation Guide (for next AI)

If you're continuing this project, here is the current state:

### ✅ Completed (100%)
- [x] Full backend: server, database, all 4 route files, auth middleware
- [x] SQLite schema: 12 tables, seeded with demo data
- [x] JWT auth with role guards (Admin / Trainer / Member)
- [x] Login page with dark UI, register form, demo credential buttons
- [x] Admin dashboard: all 9 sections fully functional with CRUD modals
- [x] Trainer dashboard: all 7 sections, workout CRUD per member, metrics logging
- [x] Member dashboard: all 9 sections, check-in, goals, class enrollment, metrics
- [x] Chart.js charts in Admin (attendance trend, plan distribution, revenue) and Member/Trainer (weight progress)

### 🔜 Possible Enhancements
- [ ] **Photo uploads** — Member/trainer profile pictures (multer)
- [ ] **PDF reports** — Export payment receipts or member reports (pdfkit)
- [ ] **Email notifications** — Plan expiry alerts (nodemailer)
- [ ] **Bulk import** — CSV member import on admin panel
- [ ] **Diet/Nutrition module** — Daily calorie & macro tracking
- [ ] **Feedback/Ratings** — Members rating trainers and classes
- [ ] **Dark/Light theme toggle**
- [ ] **Mobile PWA** — Add manifest.json + service worker
- [ ] **Fingerprint check-in** — Biometric attendance simulation
- [ ] **WhatsApp/SMS reminders** — Payment due alerts
- [ ] **Multi-branch support** — Gym chain management
- [ ] **React frontend** — Migrate to React + Vite for SPA

### 🐛 Known Limitations
- SQLite is file-based; for production use PostgreSQL or MySQL (replace `sqlite3` with `pg` or `mysql2` and update `database.js`)
- No email verification on registration
- No rate limiting on API (add `express-rate-limit` for production)
- JWT tokens expire in 8 hours; add refresh token flow for production

### 🗄️ Database Location
The SQLite database file is created at `GymPro/gym.sqlite` on first run. Delete it to reset all data and re-seed.

---

## 🎨 Tech Stack Summary

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Backend     | Node.js + Express.js              |
| Database    | SQLite (via sqlite3 npm package)  |
| Auth        | JWT + bcryptjs                    |
| Frontend    | Vanilla HTML/CSS/JS (no framework)|
| Charts      | Chart.js (CDN)                    |
| Fonts       | Google Fonts (Bebas Neue, DM Sans)|
| Design      | Dark theme, custom CSS variables  |

---

*GymPro v2.0 — Built with ❤️ | All rights reserved*
