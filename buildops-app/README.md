# BUILDOPS — Saudi Arabia Management Platform

Full-stack web application for managing Manpower Rental, Equipment Rental, and Construction Projects.

## 🔐 Demo Login
- Email: `admin@buildops.sa`
- Password: `admin123`

Other accounts:
- `coordinator@buildops.sa` / `coord123`
- `finance@buildops.sa` / `fin123`

---

## 🚀 Deploy to Cloudflare Pages (Free)

### Option A: GitHub + Cloudflare (Recommended)

1. Create a GitHub repository (e.g. `buildops-app`)
2. Upload all files from this folder to the repository
3. Go to [Cloudflare Pages](https://pages.cloudflare.com)
4. Click **Create a project** → **Connect to Git**
5. Select your repository
6. Settings:
   - **Build command**: _(leave empty)_
   - **Build output directory**: `/` (root)
7. Click **Save and Deploy**
8. Your app will be live at `https://buildops-app.pages.dev`

### Option B: Direct Upload (Fastest)

1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Click **Create a project** → **Direct Upload**
3. Drag and drop this entire folder
4. Click **Deploy**
5. Live in 30 seconds!

### Custom Domain
In Cloudflare Pages → Custom domains → Add `buildops.yourcompany.com.sa`

---

## 🌐 Deploy to Other Hosts

### Netlify
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop this folder onto the deploy area
3. Done — live in seconds!

### Any Web Hosting (cPanel, SiteGround, etc.)
1. Upload all files to `public_html/` via FTP or File Manager
2. Access via your domain

### Vercel
```bash
npm i -g vercel
cd buildops-app
vercel --prod
```

---

## ⚙️ First-Time Setup

1. **Open the app** and login with admin credentials
2. **Go to Settings** (⚙️ in sidebar)
3. **Enter your Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)
4. **Fill in company details** (name, VAT number, address, bank details)
5. **Add your clients** and **coordinators**
6. Start using Manpower / Equipment / Construction modules!

---

## 📦 File Structure

```
buildops-app/
├── index.html          ← Main app shell
├── css/
│   └── style.css       ← Complete stylesheet
├── js/
│   ├── app.js          ← Core: state, auth, routing, dashboard, settings
│   ├── workforce.js    ← Manpower & Equipment (6-step workflow)
│   └── construction.js ← Construction Projects (8-step lifecycle)
├── _redirects          ← Cloudflare Pages SPA routing
├── _headers            ← Security headers
└── README.md           ← This file
```

---

## 💡 Features

### 👷 Manpower Rental (6 Steps)
1. **Requirements** — Track client requests, assign coordinators
2. **Resource Pool** — Manage workers, documents (passport, IQAMA, medical)
3. **Mobilization** — PO rate vs worker rate, margin calculation
4. **Timesheets (AI)** — Upload PDF/image, AI extracts hours automatically
5. **Invoices (ZATCA)** — ZATCA-compliant tax invoices with QR code
6. **Expenses & P&L** — Monthly P&L, coordinator commissions (5/10/15%)

### 🏗️ Equipment Rental (6 Steps)
Same workflow as Manpower, adapted for equipment fleet management.

### 📋 Construction Projects (8 Steps)
RFQ Analysis → Offer → PO Review → Planning → Execution Tracking → Billing → Demobilization → Closeout

### 🧾 ZATCA Compliance
All invoices include ZATCA-compliant QR codes encoded with:
- Seller name & VAT number
- Invoice date/time
- Total amount with VAT
- VAT amount

---

## 🔑 API Key Security

The Anthropic API key is stored in your browser's localStorage only.
For production, consider proxying API calls through a backend server to protect the key.

## 📞 Support
Built with BUILDOPS platform. All data stored locally in browser (localStorage).
For cloud backup and multi-user access, contact your IT team for a backend integration.
