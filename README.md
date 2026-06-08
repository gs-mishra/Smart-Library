# 📚 Smart Library Portal (QR-Based)

A premium, state-of-the-art Single Page Web Application (SPA) designed to manage smart libraries using dynamic **QR Codes** for book cataloging and member verification. The platform connects directly to **Google Firebase Firestore** for real-time cloud data sync, and features an offline **LocalStorage fallback** for immediate local sandbox testing.

---

## ✨ Key Features

### 🌟 High-Fidelity visual UI
* **Glassmorphic Aesthetics**: Designed with modern tailwind-inspired translucent sheets, backdrop blurs, customizable border frames, and subtle glowing highlights.
* **Responsive Layouts**: Features a flexible sidebar dashboard layout that folds into an icons-only sidebar on tablet and mobile viewports.
* **Micro-Animations**: Custom hover transformations, floating analytics stat cards, pulsing scanner frames, and sleek toast alerts instead of boring browser alerts.

### 🛡️ Role-Based Logins
* **Register Library**: Admins can initialize a new library entity by establishing a name and set of primary administrator login credentials.
* **Librarian / Admin Login**: Opens dashboard access to manage books, student memberships, checkout operations, and system policies.
* **Student / Member Login**: Opens student portal to browse catalog, get personal scan code, and audit borrowing history/fines. Students cannot register themselves; only admins can add student accounts.

### 📖 Catalog & Member Registries
* **Manage Books (CRUD)**: Add, edit, search, and delete book entries (Titles, Authors, Genres, ISBNs). Generates high-resolution QR codes for each catalog item.
* **Manage Students (CRUD)**: Register members with name, email, username, and password. Tracks active checkouts and fines per member, and generates their member QR codes.

### 🔄 Checkout & Return Desk (QR Integration)
* **Webcam Camera Scanner**: Integrates a real-time viewport via `html5-qrcode` to decode physical codes using your camera.
* **Image File Upload**: Decodes static QR image files directly from a file browser.
* **Offline Scanner Simulator**: Allows testing full scan checkout events in a click without needing cameras or stickers.
* **Autocompletes**: Smart live matching suggestions when typing in the issue desks.
* **Resilient Mismatch Fallback**: The desk automatically resolves inputs; if the librarian inputs a Student **Username** or Book **ISBN** instead of a database ID, the backend resolves the ID for them automatically.
* **Overdue Fine System**: Automatically computes overdue fines based on the due date and daily fine rate (configurable in settings).

---

## 📁 Repository Structure
```
e:\Smart Library\
├── index.html              # Main SPA container and layouts
├── README.md               # Repository documentation
├── FIREBASE_SETUP.md       # Step-by-step Firebase Firestore setup guide
├── css/
│   └── styles.css          # Design system styling tokens & visual rules
└── js/
    ├── firebase-config.js  # App credentials template & active Firestore keys
    ├── firebase-db.js      # Universal Database Adapter (Firestore vs LocalStorage)
    ├── qr-handler.js       # QR Code generation and webcam reader bindings
    └── app.js              # Application state router and form action events
```

---

## ⚡ Quick Start

### 1. Run the Portal
Double-click `index.html` or serve the project directory using a local web server (e.g. `npx http-server` or Live Server extension). The app runs purely on the client side—no local database setup or compilation is required!

### 2. Configure Firebase Database (Already Configured!)
Your project is pre-configured with active Firebase credentials inside `js/firebase-config.js`. 
To migrate or set up your own database rules:
1. Initialize a **Firestore Database** in the [Firebase Console](https://console.firebase.google.com/).
2. Enable Firestore read/write rules:
   ```javascript
   allow read, write: if true;
   ```
3. Set your custom project keys inside `js/firebase-config.js`.

*For detailed instructions, see [FIREBASE_SETUP.md](file:///e:/Smart%20Library/FIREBASE_SETUP.md).*

---

## 🛠️ Third-Party Dependencies
All libraries are loaded via reliable CDNs so you don't need `npm install`:
- **QR Code Generation**: [QRCode.js](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js)
- **Webcam QR Decoding**: [html5-qrcode](https://unpkg.com/html5-qrcode)
- **Dashboard Icons**: [FontAwesome 6.4](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css)
- **Database Engine**: [Google Firebase Compat SDK v9](https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js)
