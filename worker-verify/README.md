# Sage Energy – Worker Verification System

A full-stack web application for verifying workers and storing their identity, guarantor, and address information.

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | HTML · CSS · Vanilla JS             |
| Backend   | Node.js · Express.js                |
| Database  | MongoDB Atlas                       |
| Images    | Cloudinary                          |
| Maps      | Google Maps JavaScript API          |
| Auth      | JWT · bcrypt                        |
| Deploy    | Vercel (frontend) · Render (backend)|

---

## Project Structure

```
worker-verify/
├── backend/
│   ├── config/          # DB + Cloudinary setup
│   ├── controllers/     # Route handlers
│   ├── middleware/       # Auth, role-check, upload
│   ├── models/          # MongoDB schemas
│   ├── routes/          # Express routers
│   ├── scripts/         # createAdmin.js seed script
│   ├── .env.example
│   └── server.js
└── frontend/
    ├── assets/css/      # Main stylesheet
    ├── assets/js/       # config.js · api.js · auth.js · maps.js
    ├── admin/           # Super Admin pages
    ├── staff/           # Staff pages
    └── index.html       # Login page
```

---

## Setup Instructions

### 1 — Prerequisites

- Node.js 18+
- A MongoDB Atlas account (free tier works)
- A Cloudinary account (free tier works)
- A Google Cloud account with Maps JavaScript API enabled

---

### 2 — Backend Setup

```bash
cd backend
cp .env.example .env
npm install
```

Edit `.env` and fill in:

```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/worker-verify
JWT_SECRET=any_long_random_string_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000   # or your Vercel URL
```

#### Seed the Super Admin account

```bash
node scripts/createAdmin.js
```

This creates:
- **Username:** `admin`
- **Password:** `Admin@1234`

> ⚠️ Change the password immediately after first login!

#### Start the backend

```bash
npm run dev    # development (nodemon auto-reload)
npm start      # production
```

API runs at `http://localhost:5000`

---

### 3 — Frontend Setup

1. Open `frontend/assets/js/config.js`
2. Set your API URL and Google Maps API key:

```js
const CONFIG = {
  API_URL: 'http://localhost:5000/api',     // → your Render URL in prod
  GOOGLE_MAPS_API_KEY: 'AIza...'           // → your Google Maps key
};
```

3. Open `frontend/index.html` in a browser (or serve with any static server):

```bash
# Quick local server (Python)
cd frontend
python3 -m http.server 3000
```

Then visit `http://localhost:3000`

---

### 4 — Production Deployment

#### Backend → Render.com

1. Push `backend/` to a GitHub repo
2. Create a new **Web Service** on Render
3. Set **Build Command:** `npm install`
4. Set **Start Command:** `npm start`
5. Add all environment variables from `.env`

#### Frontend → Vercel

1. Push `frontend/` to a GitHub repo (or a subfolder)
2. Import to Vercel — it auto-detects static HTML
3. Update `config.js` with your Render backend URL

---

## API Endpoints

### Auth
| Method | Path                      | Access |
|--------|---------------------------|--------|
| POST   | /api/auth/login           | Public |
| GET    | /api/auth/me              | Any    |
| PUT    | /api/auth/change-password | Any    |

### Workers
| Method | Path                       | Access     |
|--------|----------------------------|------------|
| GET    | /api/workers               | Any logged |
| POST   | /api/workers               | Any logged |
| GET    | /api/workers/:id           | Any logged |
| GET    | /api/workers/search?q=     | Any logged |
| PUT    | /api/workers/:id/status    | Super Admin|

### Staff Management
| Method | Path                          | Access     |
|--------|-------------------------------|------------|
| GET    | /api/staff                    | Super Admin|
| POST   | /api/staff                    | Super Admin|
| GET    | /api/staff/:id                | Super Admin|
| PUT    | /api/staff/:id                | Super Admin|
| DELETE | /api/staff/:id                | Super Admin|
| PUT    | /api/staff/:id/reset-password | Super Admin|

### Dashboard
| Method | Path                   | Access     |
|--------|------------------------|------------|
| GET    | /api/dashboard/admin   | Super Admin|
| GET    | /api/dashboard/staff   | Staff      |

---

## Default Login

| Field    | Value        |
|----------|--------------|
| Username | `admin`      |
| Password | `Admin@1234` |
| Role     | Super Admin  |

---

## Features

- **JWT Authentication** with role-based access control
- **Multi-step worker registration** form (5 steps)
- **Two guarantors** per worker with full details
- **Google Maps** location pinning for workers and guarantors
- **Cloudinary** image upload for passports and house photos
- **Verification workflow** – Pending → Verified / Rejected
- **Audit trail** for every status change
- **Search** by name, phone, NIN, or guarantor name
- **Responsive** mobile-friendly design
- **Toast notifications** for all actions

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens expire in 7 days
- Role-based middleware on all sensitive routes
- File uploads validated by type and size (5 MB max)
- CORS restricted to configured frontend URL in production
