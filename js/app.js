// app.js
// Main application UI logic, router, and event controllers

// --- GLOBAL APP STATE ---
let currentSession = null; // Stores user details after authentication
let currentLoginRole = 'admin'; // 'admin' or 'student'
let currentScannerTarget = null; // 'book' or 'member' field target
let appSettings = {
  fineRate: 1.00, // dollars per day overdue
  maxBooksLimit: 5
};

// On Page Load
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Database
  if (window.smartLibDB) {
    window.smartLibDB.init();
  }

  // Set system fine policies from local storage if existing
  const savedFineRate = localStorage.getItem("smart_lib_setting_fine_rate");
  if (savedFineRate) {
    appSettings.fineRate = parseFloat(savedFineRate);
  }
  const savedMaxBooks = localStorage.getItem("smart_lib_setting_max_books");
  if (savedMaxBooks) {
    appSettings.maxBooksLimit = parseInt(savedMaxBooks);
  }

  // Load registered libraries in the login dropdown
  await loadLibrariesDropdown();

  // Show status indicators in Settings tab
  updateSystemSettingsIndicator();

  // Set initial login role toggle
  setLoginRole('admin');
});

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  const container = document.getElementById("toast-root");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'circle-check';
  if (type === 'danger') icon = 'triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid fa-${icon}"></i>
    <div style="flex-grow: 1;">${message}</div>
  `;

  container.appendChild(toast);

  // Automatically remove toast after 3.5 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- PORTAL ROUTER ---
function switchView(viewId) {
  document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
  const view = document.getElementById(viewId);
  if (view) {
    view.classList.add("active");
  }
}

function switchPortalTab(tabName) {
  document.getElementById("tab-login").classList.remove("active");
  document.getElementById("tab-register").classList.remove("active");
  document.getElementById("form-login").style.display = "none";
  document.getElementById("form-register").style.display = "none";

  if (tabName === 'login') {
    document.getElementById("tab-login").classList.add("active");
    document.getElementById("form-login").style.display = "block";
    loadLibrariesDropdown();
  } else {
    document.getElementById("tab-register").classList.add("active");
    document.getElementById("form-register").style.display = "block";
  }
}

function setLoginRole(role) {
  currentLoginRole = role;
  document.getElementById("toggle-role-admin").classList.remove("active");
  document.getElementById("toggle-role-student").classList.remove("active");

  const usernameLabel = document.getElementById("login-username-label");
  const usernameInput = document.getElementById("login-username");

  if (role === 'admin') {
    document.getElementById("toggle-role-admin").classList.add("active");
    usernameLabel.textContent = "Admin Username";
    usernameInput.placeholder = "e.g., admin_main";
  } else {
    document.getElementById("toggle-role-student").classList.add("active");
    usernameLabel.textContent = "Student Username";
    usernameInput.placeholder = "e.g., student123";
  }
}

// --- LIBRARIES FETCH ---
async function loadLibrariesDropdown() {
  const select = document.getElementById("login-library-select");
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Loading libraries...</option>';

  try {
    const libraries = await window.smartLibDB.getLibraries();
    
    if (libraries.length === 0) {
      select.innerHTML = '<option value="" disabled>No libraries registered. Please register a library first.</option>';
      // Automatically swap to register tab to guide new user
      switchPortalTab('register');
      showToast("Create a library first to initialize admin permissions.", "info");
      return;
    }

    select.innerHTML = '';
    libraries.forEach((lib, index) => {
      const option = document.createElement("option");
      option.value = lib.id;
      option.textContent = lib.name;
      if (index === 0) option.selected = true; // Auto select first library
      select.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="" disabled>Error loading libraries</option>';
  }
}

// --- SUBMIT: LIBRARY REGISTRATION ---
async function handleRegisterLibrarySubmit(e) {
  e.preventDefault();
  const name = document.getElementById("register-lib-name").value;
  const code = document.getElementById("register-lib-code").value;
  const user = document.getElementById("register-admin-user").value;
  const pass = document.getElementById("register-admin-password").value;

  if (user.length < 3 || pass.length < 4) {
    showToast("Credentials must be: Username (min 3 chars), Password (min 4 chars)", "danger");
    return;
  }

  try {
    const newLib = await window.smartLibDB.registerLibrary(name, user, pass, code);
    showToast(`Successfully registered library: ${newLib.name}!`, "success");
    e.target.reset();
    switchPortalTab('login');
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// --- SUBMIT: LOGIN ---
async function handleLoginSubmit(e) {
  e.preventDefault();
  const libraryId = document.getElementById("login-library-select").value;
  const user = document.getElementById("login-username").value;
  const pass = document.getElementById("login-password").value;

  if (!libraryId) {
    showToast("Please select a library.", "danger");
    return;
  }

  try {
    const session = await window.smartLibDB.loginUser(libraryId, user, pass, currentLoginRole);
    currentSession = session;
    
    showToast(`Logged in successfully! Welcome, ${session.name}`, "success");
    e.target.reset();

    if (session.role === 'admin') {
      enterAdminDashboard();
    } else {
      enterStudentDashboard();
    }
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// --- LOGOUT ---
function handleLogout() {
  currentSession = null;
  switchView('home-view');
  showToast("Logged out successfully.", "info");
  loadLibrariesDropdown();
}

// ==========================================
// ADMIN DASHBOARD MODULES
// ==========================================
function enterAdminDashboard() {
  switchView('admin-view');
  document.getElementById("admin-profile-name").textContent = currentSession.name;
  document.getElementById("admin-profile-lib").textContent = currentSession.libraryName;
  document.getElementById("admin-active-lib-badge").textContent = `ID: ${currentSession.libraryId}`;
  
  // Set default tab active
  const sidebarLinks = document.querySelectorAll("#admin-view .sidebar-link");
  sidebarLinks.forEach(l => l.classList.remove("active"));
  sidebarLinks[0].classList.add("active");
  
  switchDashboardTab('admin-sub-overview', sidebarLinks[0]);
}

function switchDashboardTab(subviewId, element) {
  // Toggle subviews
  document.querySelectorAll("#admin-view .dash-subview").forEach(v => v.classList.remove("active"));
  document.getElementById(subviewId).classList.add("active");

  // Highlight active sidebar link
  document.querySelectorAll("#admin-view .sidebar-link").forEach(l => l.classList.remove("active"));
  if (element) {
    element.classList.add("active");
    document.getElementById("admin-section-title").textContent = element.querySelector("span").textContent;
  }

  // Load data relating to subview
  if (subviewId === 'admin-sub-overview') {
    loadAdminStatsAndRecent();
  } else if (subviewId === 'admin-sub-books') {
    loadAdminBooksTable();
  } else if (subviewId === 'admin-sub-members') {
    loadAdminMembersTable();
  } else if (subviewId === 'admin-sub-desk') {
    loadAdminDesk();
  } else if (subviewId === 'admin-sub-settings') {
    loadSettingsPanel();
  }
}

// VIEW 1: STATS AND RECENT ACTIVITIES
async function loadAdminStatsAndRecent() {
  try {
    const libId = currentSession.libraryId;
    const books = await window.smartLibDB.getBooks(libId);
    const members = await window.smartLibDB.getMembers(libId);
    const issues = await window.smartLibDB.getIssues(libId);

    // Stats
    document.getElementById("stat-total-books").textContent = books.length;
    document.getElementById("stat-total-members").textContent = members.length;

    const activeIssues = issues.filter(i => i.status === 'issued');
    document.getElementById("stat-issued-books").textContent = activeIssues.length;

    // Calculate total fines
    let totalFines = 0;
    issues.forEach(i => {
      totalFines += calculateIssueFine(i);
    });
    document.getElementById("stat-active-fines").textContent = `₹${totalFines.toFixed(2)}`;

    // Build Recent Activities (merging creation logs, borrows, returns)
    const recentActTable = document.getElementById("table-recent-activities-body");
    recentActTable.innerHTML = "";

    // Sort issues by issueDate desc
    const sortedIssues = [...issues].sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)).slice(0, 5);

    if (sortedIssues.length === 0) {
      recentActTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No activity logged yet.</td></tr>`;
      return;
    }

    sortedIssues.forEach(issue => {
      const row = document.createElement("tr");
      const date = new Date(issue.issueDate).toLocaleDateString();
      const dueDate = new Date(issue.dueDate).toLocaleDateString();
      
      const fineVal = calculateIssueFine(issue);
      const isReturned = issue.status === 'returned';

      row.innerHTML = `
        <td>${date}</td>
        <td><strong>${issue.bookTitle}</strong></td>
        <td>${issue.memberName}</td>
        <td><span class="badge ${isReturned ? 'badge-success' : 'badge-info'}">${issue.status}</span></td>
        <td>${dueDate}</td>
        <td>
          <span style="font-weight:600; color: ${fineVal > 0 ? 'var(--color-accent)' : 'var(--color-secondary)'}">
            ${fineVal > 0 ? `Fine: ₹${fineVal.toFixed(2)}` : 'No Fine'}
          </span>
        </td>
      `;
      recentActTable.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    showToast("Error updating overview stats.", "danger");
  }
}

// VIEW 2: BOOK RECORDS (CRUD)
let cachedBooks = [];
async function loadAdminBooksTable() {
  try {
    cachedBooks = await window.smartLibDB.getBooks(currentSession.libraryId);
    populateBookFilterSelects(cachedBooks);
    renderBooksTable(cachedBooks);
  } catch (err) {
    showToast("Error loading books catalog.", "danger");
  }
}

function renderBooksTable(books) {
  const tbody = document.getElementById("table-books-body");
  tbody.innerHTML = "";

  if (books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No books cataloged in this library.</td></tr>`;
    return;
  }

  books.forEach(b => {
    const tr = document.createElement("tr");
    const isAvail = b.availability === 'available';
    const qrDataStr = `smartlib://book/${b.id}`;

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap: 10px;">
          <div class="book-qr-btn" onclick="openQRCodeModal('${qrDataStr}', 'Book QR: ${b.title}')" title="View/Download QR Code">
            <i class="fa-solid fa-qrcode"></i>
          </div>
          <span style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${b.id}</span>
        </div>
      </td>
      <td><strong>${b.title}</strong></td>
      <td>${b.author}</td>
      <td>
        <div>${b.genre}</div>
        <div style="font-size:11px; color: var(--text-secondary); margin-top:2px;"><i class="fa-solid fa-location-dot" style="font-size:9px; margin-right:4px;"></i>${b.shelfLocation || 'N/A'}</div>
      </td>
      <td><code>${b.isbn}</code></td>
      <td><strong>${b.copyCount || 1}</strong></td>
      <td><span class="badge ${isAvail ? 'badge-success' : 'badge-danger'}">${b.availability}</span></td>
      <td>
        <div style="display:flex; gap: 8px;">
          <button class="btn btn-secondary btn-icon" onclick="openEditBookModal('${b.id}')" title="Edit Book"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-icon" onclick="deleteBookRecord('${b.id}')" title="Delete Book"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterBooksTable() {
  const q = document.getElementById("book-search-input").value.toLowerCase().trim();
  const filterAuthor = document.getElementById("book-filter-author").value;
  const filterGenre = document.getElementById("book-filter-genre").value;
  
  let filtered = cachedBooks;
  
  if (q) {
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(q) || 
      b.isbn.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    );
  }
  
  if (filterAuthor) {
    filtered = filtered.filter(b => b.author === filterAuthor);
  }
  
  if (filterGenre) {
    filtered = filtered.filter(b => b.genre === filterGenre);
  }
  
  renderBooksTable(filtered);
}

function populateBookFilterSelects(books) {
  const authorSelect = document.getElementById("book-filter-author");
  const genreSelect = document.getElementById("book-filter-genre");
  if (!authorSelect || !genreSelect) return;
  
  const selectedAuthor = authorSelect.value;
  const selectedGenre = genreSelect.value;
  
  const authors = [...new Set(books.map(b => b.author))].sort();
  const genres = [...new Set(books.map(b => b.genre))].sort();
  
  authorSelect.innerHTML = '<option value="">All Authors</option>';
  authors.forEach(auth => {
    const opt = document.createElement("option");
    opt.value = auth;
    opt.textContent = auth;
    if (auth === selectedAuthor) opt.selected = true;
    authorSelect.appendChild(opt);
  });
  
  genreSelect.innerHTML = '<option value="">All Categories</option>';
  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    if (g === selectedGenre) opt.selected = true;
    genreSelect.appendChild(opt);
  });
}

// Edit Book Modal triggers
function openAddBookModal() {
  document.getElementById("modal-book-title").textContent = "Add New Book Record";
  document.getElementById("form-book-submit").reset();
  document.getElementById("modal-book-id").value = "";
  document.getElementById("book-copy-count").value = 1;
  document.getElementById("book-shelf-location").value = "";
  openModal("modal-book");
}

function openEditBookModal(bookId) {
  const book = cachedBooks.find(b => b.id === bookId);
  if (!book) return;

  document.getElementById("modal-book-title").textContent = "Update Book Records";
  document.getElementById("modal-book-id").value = book.id;
  document.getElementById("book-title").value = book.title;
  document.getElementById("book-author").value = book.author;
  document.getElementById("book-genre").value = book.genre;
  document.getElementById("book-isbn").value = book.isbn;
  document.getElementById("book-copy-count").value = book.copyCount || 1;
  document.getElementById("book-shelf-location").value = book.shelfLocation || "";

  openModal("modal-book");
}

async function handleBookFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("modal-book-id").value;
  const title = document.getElementById("book-title").value;
  const author = document.getElementById("book-author").value;
  const genre = document.getElementById("book-genre").value;
  const isbn = document.getElementById("book-isbn").value;
  const copyCount = document.getElementById("book-copy-count").value;
  const shelfLocation = document.getElementById("book-shelf-location").value;

  const data = { title, author, genre, isbn, copyCount, shelfLocation };

  try {
    const libId = currentSession.libraryId;
    if (id) {
      // Update
      await window.smartLibDB.updateBook(libId, id, data);
      showToast("Book record updated successfully.", "success");
    } else {
      // Create
      await window.smartLibDB.addBook(libId, data);
      showToast("Book added to catalog database.", "success");
    }
    closeModal("modal-book");
    loadAdminBooksTable();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

async function deleteBookRecord(bookId) {
  if (!confirm("Are you sure you want to delete this book record? This cannot be undone.")) return;

  try {
    await window.smartLibDB.deleteBook(currentSession.libraryId, bookId);
    showToast("Book record deleted.", "success");
    loadAdminBooksTable();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// VIEW 3: MEMBER RECORDS (CRUD)
let cachedMembers = [];
async function loadAdminMembersTable() {
  try {
    const libId = currentSession.libraryId;
    cachedMembers = await window.smartLibDB.getMembers(libId);
    const issues = await window.smartLibDB.getIssues(libId);

    renderMembersTable(cachedMembers, issues);
  } catch (err) {
    showToast("Error loading member registrations.", "danger");
  }
}

function renderMembersTable(members, issues = []) {
  const tbody = document.getElementById("table-members-body");
  tbody.innerHTML = "";

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No student members registered yet. Only admins can register members.</td></tr>`;
    return;
  }

  members.forEach(m => {
    const tr = document.createElement("tr");
    const qrDataStr = `smartlib://member/${m.id}`;

    // Get active checkouts and fines
    const activeIssues = issues.filter(i => i.memberId === m.id && i.status === 'issued');
    let totalFine = 0;
    issues.filter(i => i.memberId === m.id).forEach(i => {
      totalFine += calculateIssueFine(i);
    });

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap: 10px;">
          <div class="book-qr-btn" onclick="openQRCodeModal('${qrDataStr}', 'Member Scan ID: ${m.name}')" title="View/Download QR Code">
            <i class="fa-solid fa-qrcode"></i>
          </div>
          <span style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${m.id}</span>
        </div>
      </td>
      <td><strong>${m.name}</strong></td>
      <td><code>${m.username}</code></td>
      <td>
        <div style="font-size:13px;">${m.email}</div>
        <div style="font-size:11px; color: var(--text-secondary); margin-top:2px;"><i class="fa-solid fa-phone" style="font-size:9px; margin-right:4px;"></i>${m.phone || 'N/A'}</div>
      </td>
      <td><span style="font-size:13px; max-width:180px; display:block; word-wrap:break-word;">${m.address || 'N/A'}</span></td>
      <td><span class="badge ${activeIssues.length > 0 ? 'badge-info' : 'badge-success'}">${activeIssues.length} Active</span></td>
      <td>
        <span style="font-weight:600; color: ${totalFine > 0 ? 'var(--color-accent)' : 'var(--text-muted)'}">
          ₹${totalFine.toFixed(2)}
        </span>
      </td>
      <td>
        <div style="display:flex; gap: 8px;">
          <button class="btn btn-secondary btn-icon" onclick="viewStudentIDCard('${m.id}')" title="View ID Card" style="color: var(--color-secondary);"><i class="fa-solid fa-id-card"></i></button>
          <button class="btn btn-secondary btn-icon" onclick="openEditMemberModal('${m.id}')" title="Edit Student"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-danger btn-icon" onclick="deleteMemberRecord('${m.id}')" title="Remove Student"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterMembersTable() {
  const q = document.getElementById("member-search-input").value.toLowerCase().trim();
  if (!q) {
    loadAdminMembersTable();
    return;
  }
  const filtered = cachedMembers.filter(m => 
    m.name.toLowerCase().includes(q) || 
    m.username.toLowerCase().includes(q) || 
    m.email.toLowerCase().includes(q) ||
    m.id.includes(q)
  );
  renderMembersTable(filtered);
}

// Edit Member Modals
function openAddMemberModal() {
  document.getElementById("modal-member-title").textContent = "Add Student/Member Record";
  document.getElementById("form-member-submit").reset();
  document.getElementById("modal-member-id").value = "";
  document.getElementById("member-username").disabled = false;
  openModal("modal-member");
}

function openEditMemberModal(memberId) {
  const m = cachedMembers.find(mem => mem.id === memberId);
  if (!m) return;

  document.getElementById("modal-member-title").textContent = "Update Student Records";
  document.getElementById("modal-member-id").value = m.id;
  document.getElementById("member-name").value = m.name;
  document.getElementById("member-username").value = m.username;
  document.getElementById("member-username").disabled = true; // Protect primary logins username changes
  document.getElementById("member-email").value = m.email;
  document.getElementById("member-phone").value = m.phone || "";
  document.getElementById("member-address").value = m.address || "";
  document.getElementById("member-password").value = m.password;

  openModal("modal-member");
}

async function handleMemberFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("modal-member-id").value;
  const name = document.getElementById("member-name").value;
  const username = document.getElementById("member-username").value;
  const email = document.getElementById("member-email").value;
  const phone = document.getElementById("member-phone").value;
  const address = document.getElementById("member-address").value;
  const password = document.getElementById("member-password").value;

  const data = { name, username, email, phone, address, password };

  try {
    const libId = currentSession.libraryId;
    if (id) {
      await window.smartLibDB.updateMember(libId, id, data);
      showToast("Student profile updated.", "success");
      closeModal("modal-member");
      loadAdminMembersTable();
    } else {
      const newMember = await window.smartLibDB.addMember(libId, data);
      showToast("Student registered successfully! They can now log in.", "success");
      closeModal("modal-member");
      await loadAdminMembersTable();
      // Auto open newly generated ID card
      viewStudentIDCard(newMember.id);
    }
  } catch (err) {
    showToast(err.message, "danger");
  }
}

async function deleteMemberRecord(memberId) {
  if (!confirm("Are you sure you want to remove this student? All their checkout permissions will be revoked.")) return;

  try {
    await window.smartLibDB.deleteMember(currentSession.libraryId, memberId);
    showToast("Student registration removed.", "success");
    loadAdminMembersTable();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// VIEW 4: DESK WORKPLACE (CHECKOUT / ISSUE & RETURNS)
let allLibBooksList = [];
let allLibMembersList = [];

async function loadAdminDesk() {
  try {
    const libId = currentSession.libraryId;
    allLibBooksList = await window.smartLibDB.getBooks(libId);
    allLibMembersList = await window.smartLibDB.getMembers(libId);

    // Render active checkouts panel
    loadActiveCheckoutsList();

    // Populate simulator tags
    populateScannerSimulators();
  } catch (err) {
    console.error(err);
  }
}

// Show Member suggestions on text input
function showDeskMemberSuggestions(val) {
  const container = document.getElementById("desk-member-suggestions");
  if (!val.trim()) {
    container.style.display = "none";
    return;
  }
  const filtered = allLibMembersList.filter(m => 
    m.name.toLowerCase().includes(val.toLowerCase()) || 
    m.username.toLowerCase().includes(val.toLowerCase()) ||
    m.id.toLowerCase().includes(val.toLowerCase())
  ).slice(0, 5);

  if (filtered.length === 0) {
    container.style.display = "none";
    return;
  }

  container.innerHTML = "";
  filtered.forEach(m => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = `
      <div class="title">${m.name}</div>
      <div class="subtitle">Username: ${m.username} | ID: ${m.id}</div>
    `;
    div.onclick = () => {
      document.getElementById("desk-member-input").value = m.id;
      container.style.display = "none";
    };
    container.appendChild(div);
  });
  container.style.display = "block";
}

// Show Book suggestions
function showDeskBookSuggestions(val) {
  const container = document.getElementById("desk-book-suggestions");
  if (!val.trim()) {
    container.style.display = "none";
    return;
  }
  const filtered = allLibBooksList.filter(b => 
    b.title.toLowerCase().includes(val.toLowerCase()) || 
    b.author.toLowerCase().includes(val.toLowerCase()) || 
    b.id.toLowerCase().includes(val.toLowerCase())
  ).slice(0, 5);

  if (filtered.length === 0) {
    container.style.display = "none";
    return;
  }

  container.innerHTML = "";
  filtered.forEach(b => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = `
      <div class="title">${b.title}</div>
      <div class="subtitle">Author: ${b.author} | Status: ${b.availability}</div>
    `;
    div.onclick = () => {
      document.getElementById("desk-book-input").value = b.id;
      container.style.display = "none";
    };
    container.appendChild(div);
  });
  container.style.display = "block";
}

// Hide auto completes when clicking out
document.addEventListener("click", (e) => {
  const mDiv = document.getElementById("desk-member-suggestions");
  const bDiv = document.getElementById("desk-book-suggestions");
  if (mDiv && !e.target.closest("#desk-member-input")) mDiv.style.display = "none";
  if (bDiv && !e.target.closest("#desk-book-input")) bDiv.style.display = "none";
});

// Load Active Checkouts
async function loadActiveCheckoutsList() {
  const container = document.getElementById("desk-checkout-list");
  if (!container) return;

  try {
    const libId = currentSession.libraryId;
    const issues = await window.smartLibDB.getIssues(libId);
    const active = issues.filter(i => i.status === 'issued');

    container.innerHTML = "";

    if (active.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
          <i class="fa-solid fa-calendar-check" style="font-size: 32px; margin-bottom: 12px;"></i>
          <p>No active book checkouts found.</p>
        </div>`;
      return;
    }

    active.forEach(i => {
      const fineVal = calculateIssueFine(i);
      const isOverdue = fineVal > 0;
      const dueDateStr = new Date(i.dueDate).toLocaleDateString();

      const card = document.createElement("div");
      card.className = "glass-panel";
      card.style.padding = "20px";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "8px";
      card.style.borderLeft = isOverdue ? "4px solid var(--color-accent)" : "4px solid var(--color-info)";

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="font-size:15px; margin-bottom:2px;">${i.bookTitle}</h4>
            <span style="font-size:12px; color: var(--text-secondary);">Student: <strong>${i.memberName}</strong></span>
          </div>
          <span class="badge ${isOverdue ? 'badge-danger' : 'badge-info'}">${isOverdue ? 'Overdue' : 'Active'}</span>
        </div>
        <div style="font-size:12px; color: var(--text-muted); display:flex; justify-content:space-between; margin-top:8px; border-top:1px solid var(--border-color); padding-top:8px;">
          <span>Due: ${dueDateStr}</span>
          <span style="font-weight:600; color: ${isOverdue ? 'var(--color-accent)' : 'var(--color-secondary)'}">
            ${isOverdue ? `Fine: ₹${fineVal.toFixed(2)}` : 'No Fine'}
          </span>
        </div>
        <div style="margin-top:10px; display:flex; gap: 8px;">
          <button class="btn btn-secondary btn-icon" style="padding: 6px 12px; font-size:12px; border-radius:6px; flex-grow:1;" onclick="processBookReturn('${i.id}', ${fineVal})">
            <i class="fa-solid fa-arrow-rotate-left"></i> Return Book
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

// Issue Book Process submission
async function handleDeskOperationSubmit(e) {
  e.preventDefault();
  const memberId = document.getElementById("desk-member-input").value.trim();
  const bookId = document.getElementById("desk-book-input").value.trim();
  const days = document.getElementById("desk-days-input").value;

  try {
    const libId = currentSession.libraryId;

    // Call API
    await window.smartLibDB.issueBook(libId, bookId, memberId, days);
    
    showToast("Book issued successfully!", "success");
    e.target.reset();
    
    // Refresh Desk
    loadAdminDesk();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// Return Book Process
async function processBookReturn(issueId, fineVal) {
  let collectText = "";
  if (fineVal > 0) {
    collectText = `An overdue fine of ₹${fineVal.toFixed(2)} is due. Please collect this amount before returning. `;
  }

  if (!confirm(`${collectText}Confirm return of this book?`)) return;

  try {
    const libId = currentSession.libraryId;
    await window.smartLibDB.returnBook(libId, issueId, fineVal);
    showToast("Book returned and availability updated.", "success");
    
    // Refresh Desk
    loadAdminDesk();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// Quick Return Scanner Process
async function processQuickReturnByBookId(scannedId) {
  try {
    const libId = currentSession.libraryId;
    
    // Find book by scanned code (ID or ISBN) from global catalog cache
    let resolvedBookId = scannedId;
    let bookTitle = scannedId;
    
    const book = allLibBooksList.find(b => b.id === scannedId || b.isbn === scannedId);
    if (book) {
      resolvedBookId = book.id;
      bookTitle = book.title;
    }
    
    // Fetch all active issues for this library
    const issues = await window.smartLibDB.getIssues(libId);
    const activeIssue = issues.find(i => i.bookId === resolvedBookId && i.status === 'issued');
    
    if (!activeIssue) {
      showToast(`No active checkout records found for "${bookTitle}".`, "danger");
      return;
    }
    
    const fineVal = calculateIssueFine(activeIssue);
    let collectText = "";
    if (fineVal > 0) {
      collectText = `An overdue fine of ₹${fineVal.toFixed(2)} is due. Please collect this amount before returning. `;
      if (!confirm(`${collectText}Confirm return of "${activeIssue.bookTitle}"?`)) {
        return;
      }
    }
    
    // Settle return
    await window.smartLibDB.returnBook(libId, activeIssue.id, fineVal);
    showToast(`Successfully returned "${activeIssue.bookTitle}"!`, "success");
    
    // Refresh Desk views
    loadAdminDesk();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// Offline QR Simulator list population
function populateScannerSimulators() {
  const booksContainer = document.getElementById("mock-books-list");
  const membersContainer = document.getElementById("mock-members-list");

  if (booksContainer) {
    booksContainer.innerHTML = "";
    // Only grab available books for issue suggestions
    const availBooks = allLibBooksList.filter(b => b.availability === 'available').slice(0, 5);
    if (availBooks.length === 0) {
      booksContainer.innerHTML = `<span style="font-size:11px; color:var(--text-muted);">No available books</span>`;
    }
    availBooks.forEach(b => {
      const span = document.createElement("span");
      span.className = "mock-qr-tag";
      span.textContent = b.title.slice(0, 15) + "...";
      span.title = `Book Code: smartlib://book/${b.id}`;
      span.onclick = () => {
        simulateQRScan(`smartlib://book/${b.id}`);
      };
      booksContainer.appendChild(span);
    });
  }

  if (membersContainer) {
    membersContainer.innerHTML = "";
    const sliceMembers = allLibMembersList.slice(0, 5);
    if (sliceMembers.length === 0) {
      membersContainer.innerHTML = `<span style="font-size:11px; color:var(--text-muted);">No students registered</span>`;
    }
    sliceMembers.forEach(m => {
      const span = document.createElement("span");
      span.className = "mock-qr-tag";
      span.textContent = m.name;
      span.title = `Member Code: smartlib://member/${m.id}`;
      span.onclick = () => {
        simulateQRScan(`smartlib://member/${m.id}`);
      };
      membersContainer.appendChild(span);
    });
  }
}

function simulateQRScan(decodedText) {
  showToast(`Simulated scan result: ${decodedText}`, "info");
  handleQRScanSuccess(decodedText);
}

// VIEW 5: SETTINGS
function loadSettingsPanel() {
  document.getElementById("settings-fine-rate").value = appSettings.fineRate.toFixed(2);
  document.getElementById("settings-max-books").value = appSettings.maxBooksLimit;
  updateSystemSettingsIndicator();
}

function updateFineRate(val) {
  const parsed = parseFloat(val);
  if (isNaN(parsed) || parsed < 0) {
    showToast("Invalid fine rate.", "danger");
    return;
  }
  appSettings.fineRate = parsed;
  localStorage.setItem("smart_lib_setting_fine_rate", parsed);
  showToast(`Daily fine rate updated to ₹${parsed.toFixed(2)}`, "success");
}

function updateMaxBooksLimit(val) {
  const parsed = parseInt(val);
  if (isNaN(parsed) || parsed < 1) {
    showToast("Invalid limit.", "danger");
    return;
  }
  appSettings.maxBooksLimit = parsed;
  localStorage.setItem("smart_lib_setting_max_books", parsed);
  showToast(`Borrowing limit updated to ${parsed} books`, "success");
}

function updateSystemSettingsIndicator() {
  const dbInd = document.getElementById("database-mode-indicator");
  const dbDesc = document.getElementById("database-mode-desc");
  if (!dbInd) return;

  const isSupabase = window.smartLibDB.isSupabase;
  if (isSupabase) {
    dbInd.innerHTML = `<span class="badge badge-success"><i class="fa-solid fa-cloud"></i> Supabase Active</span>`;
    dbDesc.textContent = "Your portal is connected directly to Supabase Cloud PostgreSQL. Authentication details and records are saved dynamically online.";
  } else {
    dbInd.innerHTML = `<span class="badge badge-info"><i class="fa-solid fa-hard-drive"></i> LocalStorage Offline</span>`;
    dbDesc.textContent = "Running offline. All student credentials, book cataloging, and borrow records are saved securely inside your browser's LocalStorage database.";
  }
}

// ==========================================
// STUDENT/MEMBER DASHBOARD MODULES
// ==========================================
function enterStudentDashboard() {
  switchView('student-view');
  document.getElementById("student-profile-name").textContent = currentSession.name;
  document.getElementById("student-profile-lib").textContent = currentSession.libraryName;
  document.getElementById("student-active-lib-badge").textContent = currentSession.libraryName;

  const sidebarLinks = document.querySelectorAll("#student-view .sidebar-link");
  sidebarLinks.forEach(l => l.classList.remove("active"));
  sidebarLinks[0].classList.add("active");

  switchStudentTab('student-sub-profile', sidebarLinks[0]);
}

function switchStudentTab(subviewId, element) {
  document.querySelectorAll("#student-view .dash-subview").forEach(v => v.classList.remove("active"));
  document.getElementById(subviewId).classList.add("active");

  document.querySelectorAll("#student-view .sidebar-link").forEach(l => l.classList.remove("active"));
  if (element) {
    element.classList.add("active");
    document.getElementById("student-section-title").textContent = element.querySelector("span").textContent;
  }

  if (subviewId === 'student-sub-profile') {
    loadStudentProfile();
  } else if (subviewId === 'student-sub-browse') {
    loadStudentBrowseCatalog();
  } else if (subviewId === 'student-sub-issues') {
    loadStudentBorrowRecords();
  }
}

// STUDENT SUBVIEW 1: PROFILE AND MEMBER SCAN QR
async function loadStudentProfile() {
  try {
    const libId = currentSession.libraryId;
    const memId = currentSession.id;

    // Display fields
    document.getElementById("student-display-name").textContent = currentSession.name;
    document.getElementById("student-display-username").innerHTML = `<i class="fa-solid fa-user" style="margin-right: 6px;"></i> Username: <code>${currentSession.username}</code>`;
    
    // Find detailed user email
    const members = await window.smartLibDB.getMembers(libId);
    const profile = members.find(m => m.id === memId);
    if (profile) {
      document.getElementById("student-display-email").innerHTML = `<i class="fa-solid fa-envelope" style="margin-right: 6px;"></i> Email: ${profile.email}`;
      document.getElementById("student-display-phone").innerHTML = `<i class="fa-solid fa-phone" style="margin-right: 6px;"></i> Mobile: ${profile.phone || 'N/A'}`;
      document.getElementById("student-display-address").innerHTML = `<i class="fa-solid fa-location-dot" style="margin-right: 6px;"></i> Address: ${profile.address || 'N/A'}`;
    }
    document.getElementById("student-display-id").innerHTML = `<i class="fa-solid fa-fingerprint" style="margin-right: 6px;"></i> Student Code: <code>${memId}</code>`;

    // Generate Member QR Code inside profile view
    const qrHolder = document.getElementById("student-profile-qr-holder");
    const qrValue = `smartlib://member/${memId}`;
    window.smartLibQR.generate(qrHolder, qrValue, 120, 120);

    // Load Stats Summary
    const issues = await window.smartLibDB.getIssues(libId);
    const myIssues = issues.filter(i => i.memberId === memId);
    const active = myIssues.filter(i => i.status === 'issued');

    document.getElementById("student-stat-books-count").textContent = active.length;

    // Calculate Fines & next due date
    let myFines = 0;
    let nextDueDate = null;

    myIssues.forEach(i => {
      myFines += calculateIssueFine(i);
      
      if (i.status === 'issued') {
        const dDate = new Date(i.dueDate);
        if (!nextDueDate || dDate < nextDueDate) {
          nextDueDate = dDate;
        }
      }
    });

    document.getElementById("student-stat-fines").textContent = `₹${myFines.toFixed(2)}`;
    document.getElementById("student-stat-due-date").textContent = nextDueDate ? nextDueDate.toLocaleDateString() : "None";

  } catch (err) {
    console.error(err);
  }
}

// STUDENT SUBVIEW 2: BROWSE CATALOG
let studentCachedBooks = [];
async function loadStudentBrowseCatalog() {
  try {
    studentCachedBooks = await window.smartLibDB.getBooks(currentSession.libraryId);
    populateStudentFilterSelects(studentCachedBooks);
    renderStudentBooksGrid(studentCachedBooks);
  } catch (err) {
    showToast("Error loading catalog.", "danger");
  }
}

function renderStudentBooksGrid(books) {
  const container = document.getElementById("student-books-catalog");
  container.innerHTML = "";

  if (books.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">No books available in this library.</div>`;
    return;
  }

  books.forEach(b => {
    const card = document.createElement("div");
    card.className = "book-card glass-panel";
    const isAvail = b.availability === 'available';

    card.innerHTML = `
      <div class="book-title">${b.title}</div>
      <div class="book-author">by ${b.author}</div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom: 6px;">
        <i class="fa-solid fa-tags" style="margin-right:6px;"></i>${b.genre}
      </div>
      <div style="font-size:12px; color:var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between;">
        <span><i class="fa-solid fa-location-dot" style="margin-right:6px;"></i>${b.shelfLocation || 'N/A'}</span>
        <span>Copies: <strong>${b.copyCount || 1}</strong></span>
      </div>
      <div class="book-meta">
        <span>ISBN: ${b.isbn}</span>
        <span class="badge ${isAvail ? 'badge-success' : 'badge-danger'}">${b.availability}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterStudentBooks() {
  const q = document.getElementById("student-book-search").value.toLowerCase().trim();
  const filterAuthor = document.getElementById("student-filter-author").value;
  const filterGenre = document.getElementById("student-filter-genre").value;
  
  let filtered = studentCachedBooks;
  
  if (q) {
    filtered = filtered.filter(b => 
      b.title.toLowerCase().includes(q) || 
      b.isbn.toLowerCase().includes(q)
    );
  }
  
  if (filterAuthor) {
    filtered = filtered.filter(b => b.author === filterAuthor);
  }
  
  if (filterGenre) {
    filtered = filtered.filter(b => b.genre === filterGenre);
  }
  
  renderStudentBooksGrid(filtered);
}

function populateStudentFilterSelects(books) {
  const authorSelect = document.getElementById("student-filter-author");
  const genreSelect = document.getElementById("student-filter-genre");
  if (!authorSelect || !genreSelect) return;
  
  const selectedAuthor = authorSelect.value;
  const selectedGenre = genreSelect.value;
  
  const authors = [...new Set(books.map(b => b.author))].sort();
  const genres = [...new Set(books.map(b => b.genre))].sort();
  
  authorSelect.innerHTML = '<option value="">All Authors</option>';
  authors.forEach(auth => {
    const opt = document.createElement("option");
    opt.value = auth;
    opt.textContent = auth;
    if (auth === selectedAuthor) opt.selected = true;
    authorSelect.appendChild(opt);
  });
  
  genreSelect.innerHTML = '<option value="">All Categories</option>';
  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    if (g === selectedGenre) opt.selected = true;
    genreSelect.appendChild(opt);
  });
}

// STUDENT SUBVIEW 3: BORROW RECORDS
async function loadStudentBorrowRecords() {
  const tbody = document.getElementById("student-table-issues-body");
  if (!tbody) return;

  try {
    const libId = currentSession.libraryId;
    const memId = currentSession.id;
    const issues = await window.smartLibDB.getIssues(libId);
    const myIssues = issues.filter(i => i.memberId === memId);

    tbody.innerHTML = "";

    if (myIssues.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">You have not borrowed any books yet.</td></tr>`;
      return;
    }

    // Sort: active issues first, then returned date desc
    const sorted = [...myIssues].sort((a, b) => {
      if (a.status === 'issued' && b.status !== 'issued') return -1;
      if (a.status !== 'issued' && b.status === 'issued') return 1;
      return new Date(b.issueDate) - new Date(a.issueDate);
    });

    sorted.forEach(i => {
      const row = document.createElement("tr");
      const issueDate = new Date(i.issueDate).toLocaleDateString();
      const dueDate = new Date(i.dueDate).toLocaleDateString();
      const returnDate = i.returnDate ? new Date(i.returnDate).toLocaleDateString() : "Pending Return";
      
      const fineVal = calculateIssueFine(i);
      const isReturned = i.status === 'returned';

      row.innerHTML = `
        <td><strong>${i.bookTitle}</strong></td>
        <td>${issueDate}</td>
        <td>${dueDate}</td>
        <td><span style="color: ${isReturned ? 'var(--text-primary)' : 'var(--color-warning)'}">${returnDate}</span></td>
        <td>
          <span style="font-weight:600; color: ${fineVal > 0 ? 'var(--color-accent)' : 'var(--color-secondary)'}">
            ${fineVal > 0 ? `₹${fineVal.toFixed(2)}` : 'No Fine'}
          </span>
        </td>
        <td><span class="badge ${isReturned ? 'badge-success' : 'badge-info'}">${i.status}</span></td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    showToast("Error retrieving borrowing logs.", "danger");
  }
}

// ==========================================
// UTILITIES AND MODALS AND QR BINDINGS
// ==========================================

// Global calculations for Fines
function calculateIssueFine(issue) {
  if (issue.status === 'returned') {
    return issue.finePaid || 0;
  }
  // Calculate current fine
  const now = new Date();
  const due = new Date(issue.dueDate);
  if (now > due) {
    const diffTime = Math.abs(now - due);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays * appSettings.fineRate;
  }
  return 0;
}

// Modal open/close helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

// View QR Code Modal
function openQRCodeModal(dataText, headerTitle) {
  document.getElementById("modal-qr-header-title").textContent = headerTitle;
  document.getElementById("modal-qr-description").textContent = `Data content: ${dataText}. Scan to load this ID into the desk forms.`;
  
  const canvas = document.getElementById("modal-qr-canvas");
  window.smartLibQR.generate(canvas, dataText, 200, 200);
  
  openModal("modal-qr");
}

function downloadModalQRCode() {
  const qrDiv = document.getElementById("modal-qr-canvas");
  const img = qrDiv.querySelector("img");
  
  if (img) {
    const link = document.createElement("a");
    link.href = img.src;
    link.download = `smartlib_qr_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("QR Code image downloaded.", "success");
  } else {
    // Canvas download option
    const canvas = qrDiv.querySelector("canvas");
    if (canvas) {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `smartlib_qr_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("QR Code image downloaded.", "success");
    } else {
      showToast("Could not download image format.", "danger");
    }
  }
}

// --- ACTIVE SCANNER CONTROLS ---
function openScannerFor(fieldType) {
  currentScannerTarget = fieldType; // 'book' or 'member'
  openModal("modal-scanner");

  // Start Scanner
  window.smartLibQR.startScanner(
    "scanner-view-camera-source",
    handleQRScanSuccess,
    (err) => {
      // Quiet background failure to not spam logs
    }
  ).then(() => {
    showToast("Camera feed online.", "info");
  }).catch(err => {
    showToast("Failed to initialize webcam. Please use image upload or offline simulator.", "warning");
  });
}

function closeScannerModal() {
  window.smartLibQR.stopScanner();
  closeModal("modal-scanner");
}

// Callback when QR code is scanned successfully
function handleQRScanSuccess(decodedText) {
  // Parse code
  const result = window.smartLibQR.parseCode(decodedText);
  
  closeScannerModal();
  showToast(`QR Code decoded: ${result.id} (${result.type})`, "success");

  // Determine where to fill the code
  if (currentScannerTarget === 'book') {
    if (result.type === 'member') {
      showToast("Warning: You scanned a Member ID into the Book slot. Filling it in Member ID slot instead.", "warning");
      document.getElementById("desk-member-input").value = result.id;
    } else {
      document.getElementById("desk-book-input").value = result.id;
    }
  } else if (currentScannerTarget === 'member') {
    if (result.type === 'book') {
      showToast("Warning: You scanned a Book ID into the Member slot. Filling it in Book ID slot instead.", "warning");
      document.getElementById("desk-book-input").value = result.id;
    } else {
      document.getElementById("desk-member-input").value = result.id;
    }
  } else if (currentScannerTarget === 'return') {
    if (result.type === 'member') {
      showToast("Error: You scanned a Member ID. Please scan a Book QR to process a return.", "danger");
    } else {
      processQuickReturnByBookId(result.id);
    }
  } else {
    // Default fallback to fill whatever was open or alert
    showToast(`Code ID: ${result.id}`, "info");
  }

  // Focus desk form inputs
  document.getElementById("desk-member-input").dispatchEvent(new Event('keyup'));
  document.getElementById("desk-book-input").dispatchEvent(new Event('keyup'));
}

// Upload file QR scanner callback
async function handleImageQRUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    showToast("Decoding QR from uploaded image...", "info");
    await window.smartLibQR.scanFile(file, (decodedText) => {
      handleQRScanSuccess(decodedText);
      e.target.value = ""; // clear file field
    }, (err) => {
      showToast("No readable QR Code found in this image.", "danger");
      e.target.value = "";
    });
  } catch (err) {
    showToast(err.message, "danger");
    e.target.value = "";
  }
}

// --- MEMBERSHIP ID CARD GENERATION & DOWNLOADS ---
let activeIDCardMember = null;

function viewStudentIDCard(memberId) {
  const m = cachedMembers.find(mem => mem.id === memberId);
  if (!m) return;
  displayIDCardModal(m);
}

function viewMyIDCard() {
  if (!currentSession) return;
  displayIDCardModal({
    id: currentSession.id,
    name: currentSession.name,
    username: currentSession.username,
    email: currentSession.email || 'N/A',
    phone: currentSession.phone || 'N/A',
    address: currentSession.address || 'N/A',
    libraryName: currentSession.libraryName
  });
}

function displayIDCardModal(member) {
  activeIDCardMember = member;
  
  // Fill text details
  document.getElementById("idcard-lib-name").textContent = member.libraryName || currentSession.libraryName || "Smart Library";
  document.getElementById("idcard-student-name").textContent = member.name;
  document.getElementById("idcard-student-id").textContent = member.id;
  document.getElementById("idcard-student-username").textContent = member.username;
  document.getElementById("idcard-student-phone").textContent = member.phone || "N/A";
  document.getElementById("idcard-student-email").textContent = member.email || "N/A";
  
  // Generate QR inside the card
  const holder = document.getElementById("idcard-qr-holder");
  const qrValue = `smartlib://member/${member.id}`;
  window.smartLibQR.generate(holder, qrValue, 75, 75);
  
  openModal("modal-idcard");
}

async function downloadMemberIDCard() {
  if (!activeIDCardMember) {
    showToast("No active card selected to download.", "danger");
    return;
  }
  
  const member = activeIDCardMember;
  const libName = (member.libraryName || currentSession.libraryName || "Smart Library").toUpperCase();
  
  // 1. Create canvas element
  const canvas = document.createElement("canvas");
  canvas.width = 380;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  
  // 2. Draw Card Background (Rounded Rectangle styling)
  ctx.fillStyle = "#1e3a8a"; // Navy base
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
  } else {
    ctx.rect(0, 0, canvas.width, canvas.height);
  }
  ctx.fill();
  
  // Draw subtle overlay gradient
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.25)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
  } else {
    ctx.rect(0, 0, canvas.width, canvas.height);
  }
  ctx.fill();

  // Draw border line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
  } else {
    ctx.rect(0, 0, canvas.width, canvas.height);
  }
  ctx.stroke();

  // 3. Draw Header Section
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(0, 0, canvas.width, 45); // Banner bg
  
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(0, 44, canvas.width, 1); // Border bottom
  
  // Library Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px 'Outfit', sans-serif";
  ctx.fillText(libName, 18, 26);
  
  // Badge Title
  ctx.fillStyle = "#93c5fd";
  ctx.font = "600 9px 'Outfit', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("MEMBERSHIP PASS", canvas.width - 18, 26);
  ctx.textAlign = "left"; // reset

  // 4. Draw Student Avatar placeholder
  ctx.fillStyle = "#60a5fa";
  ctx.beginPath();
  ctx.arc(40, 100, 22, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.arc(40, 95, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 118, 14, Math.PI, 0, false);
  ctx.fill();

  // 5. Draw Student details
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px 'Outfit', sans-serif";
  ctx.fillText(member.name, 80, 85);
  
  ctx.fillStyle = "#93c5fd";
  ctx.font = "normal 11px monospace";
  ctx.fillText(`ID: ${member.id}`, 80, 104);
  
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "500 11px 'Outfit', sans-serif";
  ctx.fillText(`Username: ${member.username}`, 80, 122);
  
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "normal 10px 'Outfit', sans-serif";
  ctx.fillText(`Phone: ${member.phone || 'N/A'}`, 80, 140);
  ctx.fillText(`Email: ${member.email || 'N/A'}`, 80, 155);

  // 6. Draw QR Code representation
  const qrDiv = document.getElementById("idcard-qr-holder");
  const qrImg = qrDiv.querySelector("img") || qrDiv.querySelector("canvas");
  
  if (qrImg) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(canvas.width - 98, 65, 80, 80, 6);
    } else {
      ctx.rect(canvas.width - 98, 65, 80, 80);
    }
    ctx.fill();
    ctx.drawImage(qrImg, canvas.width - 94, 69, 72, 72);
  }

  // 7. Footer Text
  ctx.fillStyle = "#93c5fd";
  ctx.font = "normal 8px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Valid at all library branches. Non-transferable.", canvas.width / 2, 222);

  // 8. Convert to download link
  try {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `smartlib_pass_${member.username}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Library ID Card downloaded successfully!", "success");
  } catch (err) {
    console.error("Canvas export failed:", err);
    showToast("Failed to export ID Card image.", "danger");
  }
}
