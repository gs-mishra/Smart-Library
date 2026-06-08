// supabase-db.js
// Supabase Database Wrapper for Smart Library
// Implements client CRUD and transparently falls back to LocalStorage when Supabase config is default.

class SupabaseLibraryDB {
  constructor() {
    this.isSupabase = false;
    this.client = null;
    this.init();
  }

  init() {
    if (window.isSupabaseConfigured && window.isSupabaseConfigured()) {
      try {
        if (typeof supabase !== 'undefined') {
          // Initialize Supabase Client
          this.client = supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.anonKey);
          this.isSupabase = true;
          console.log("SupabaseLibraryDB: Connected to Supabase Cloud Database.");
        } else {
          console.warn("SupabaseLibraryDB: Supabase SDK not found. Falling back to LocalStorage.");
        }
      } catch (err) {
        console.error("SupabaseLibraryDB: Failed to initialize Supabase:", err);
      }
    } else {
      console.log("SupabaseLibraryDB: Running in Local Database Mode (LocalStorage).");
    }

    // Initialize LocalStorage empty tables if they don't exist
    if (!this.isSupabase) {
      if (!localStorage.getItem('smart_lib_libraries')) {
        localStorage.setItem('smart_lib_libraries', JSON.stringify([]));
      }
      if (!localStorage.getItem('smart_lib_books')) {
        localStorage.setItem('smart_lib_books', JSON.stringify([]));
      }
      if (!localStorage.getItem('smart_lib_members')) {
        localStorage.setItem('smart_lib_members', JSON.stringify([]));
      }
      if (!localStorage.getItem('smart_lib_issues')) {
        localStorage.setItem('smart_lib_issues', JSON.stringify([]));
      }
    }
  }

  // --- HELPER LOCALSTORAGE OPERATIONS ---
  _getLocal(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  _setLocal(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- LIBRARIES ---
  async getLibraries() {
    if (this.isSupabase) {
      const { data, error } = await this.client.from('libraries').select('*');
      if (error) {
        console.error("Supabase getLibraries error:", error);
        throw error;
      }
      return data.map(l => ({
        id: l.id,
        name: l.name,
        adminUser: l.admin_user,
        adminPassword: l.admin_password,
        code: l.code || '',
        createdAt: l.created_at
      }));
    } else {
      return this._getLocal('smart_lib_libraries');
    }
  }

  async registerLibrary(name, adminUser, adminPassword, code) {
    const usernameClean = adminUser.trim().toLowerCase();
    const codeClean = code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase();
    
    if (this.isSupabase) {
      // Check duplicate admin username
      const { data: existing, error: queryErr } = await this.client
        .from('libraries')
        .select('id')
        .eq('admin_user', usernameClean);
      
      if (queryErr) throw queryErr;
      if (existing && existing.length > 0) {
        throw new Error("Admin username already taken.");
      }

      const id = 'lib_' + Math.random().toString(36).substr(2, 9);
      const newLibRow = {
        id: id,
        name: name,
        admin_user: usernameClean,
        admin_password: adminPassword,
        code: codeClean
      };

      const { data, error } = await this.client
        .from('libraries')
        .insert(newLibRow)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        name: data.name,
        adminUser: data.admin_user,
        adminPassword: data.admin_password,
        code: data.code,
        createdAt: data.created_at
      };
    } else {
      const libs = this._getLocal('smart_lib_libraries');
      if (libs.some(l => l.adminUser === usernameClean)) {
        throw new Error("Admin username already taken.");
      }
      const newLib = {
        id: 'lib_' + Math.random().toString(36).substr(2, 9),
        name: name,
        adminUser: usernameClean,
        adminPassword: adminPassword,
        code: codeClean,
        createdAt: new Date().toISOString()
      };
      libs.push(newLib);
      this._setLocal('smart_lib_libraries', libs);
      return newLib;
    }
  }

  // --- LOGIN ---
  async loginUser(libraryId, username, password, role) {
    const usernameClean = username.trim().toLowerCase();

    if (this.isSupabase) {
      if (role === 'admin') {
        const { data, error } = await this.client
          .from('libraries')
          .select('*')
          .eq('id', libraryId)
          .single();
        
        if (error || !data) throw new Error("Library or admin account not found.");
        
        if (data.admin_user === usernameClean && data.admin_password === password) {
          return {
            id: data.id,
            libraryId: data.id,
            libraryName: data.name,
            username: data.admin_user,
            name: "Librarian Admin",
            role: "admin"
          };
        } else {
          throw new Error("Invalid admin credentials.");
        }
      } else {
        // Student login
        const { data, error } = await this.client
          .from('members')
          .select('*')
          .eq('library_id', libraryId)
          .eq('username', usernameClean)
          .single();
        
        if (error || !data) throw new Error("Student account not found.");

        if (data.password === password) {
          // Fetch Library name
          const { data: libData } = await this.client
            .from('libraries')
            .select('name')
            .eq('id', libraryId)
            .single();

          return {
            id: data.id,
            libraryId: libraryId,
            libraryName: libData ? libData.name : "Library",
            username: data.username,
            name: data.name,
            role: "student"
          };
        } else {
          throw new Error("Incorrect password.");
        }
      }
    } else {
      // LocalStorage Mode
      const libs = this._getLocal('smart_lib_libraries');
      const lib = libs.find(l => l.id === libraryId);
      if (!lib) throw new Error("Library not found.");

      if (role === 'admin') {
        if (lib.adminUser === usernameClean && lib.adminPassword === password) {
          return {
            id: lib.id,
            libraryId: lib.id,
            libraryName: lib.name,
            username: lib.adminUser,
            name: "Librarian Admin",
            role: "admin"
          };
        } else {
          throw new Error("Invalid admin credentials.");
        }
      } else {
        const members = this._getLocal('smart_lib_members');
        const member = members.find(m => m.libraryId === libraryId && m.username === usernameClean);
        if (!member) throw new Error("Student account not found.");
        if (member.password === password) {
          return {
            id: member.id,
            libraryId: libraryId,
            libraryName: lib.name,
            username: member.username,
            name: member.name,
            role: "student"
          };
        } else {
          throw new Error("Incorrect password.");
        }
      }
    }
  }

  // --- BOOKS ---
  async getBooks(libraryId) {
    if (this.isSupabase) {
      const { data, error } = await this.client
        .from('books')
        .select('*')
        .eq('library_id', libraryId);
      
      if (error) throw error;
      
      return data.map(b => ({
        id: b.id,
        libraryId: b.library_id,
        title: b.title,
        author: b.author,
        genre: b.genre,
        isbn: b.isbn,
        copyCount: parseInt(b.copy_count || 1),
        shelfLocation: b.shelf_location || 'N/A',
        availability: b.availability,
        createdAt: b.created_at
      }));
    } else {
      const books = this._getLocal('smart_lib_books');
      return books.filter(b => b.libraryId === libraryId);
    }
  }

  async addBook(libraryId, bookData) {
    const id = 'book_' + Math.random().toString(36).substr(2, 9);
    const bookRow = {
      id: id,
      library_id: libraryId,
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      genre: bookData.genre.trim(),
      isbn: bookData.isbn.trim(),
      copy_count: parseInt(bookData.copyCount || 1),
      shelf_location: bookData.shelfLocation ? bookData.shelfLocation.trim() : 'N/A',
      availability: bookData.availability || 'available'
    };

    if (this.isSupabase) {
      const { data, error } = await this.client
        .from('books')
        .insert(bookRow)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        libraryId: data.library_id,
        title: data.title,
        author: data.author,
        genre: data.genre,
        isbn: data.isbn,
        copyCount: data.copy_count,
        shelfLocation: data.shelf_location,
        availability: data.availability,
        createdAt: data.created_at
      };
    } else {
      const books = this._getLocal('smart_lib_books');
      const bookObj = {
        id: id,
        libraryId,
        title: bookRow.title,
        author: bookRow.author,
        genre: bookRow.genre,
        isbn: bookRow.isbn,
        copyCount: bookRow.copy_count,
        shelfLocation: bookRow.shelf_location,
        availability: bookRow.availability,
        createdAt: new Date().toISOString()
      };
      books.push(bookObj);
      this._setLocal('smart_lib_books', books);
      return bookObj;
    }
  }

  async updateBook(libraryId, bookId, bookData) {
    const bookRow = {};
    if (bookData.title !== undefined) bookRow.title = bookData.title.trim();
    if (bookData.author !== undefined) bookRow.author = bookData.author.trim();
    if (bookData.genre !== undefined) bookRow.genre = bookData.genre.trim();
    if (bookData.isbn !== undefined) bookRow.isbn = bookData.isbn.trim();
    if (bookData.copyCount !== undefined) bookRow.copy_count = parseInt(bookData.copyCount);
    if (bookData.shelfLocation !== undefined) bookRow.shelf_location = bookData.shelfLocation.trim();
    if (bookData.availability !== undefined) bookRow.availability = bookData.availability;

    if (this.isSupabase) {
      const { data, error } = await this.client
        .from('books')
        .update(bookRow)
        .eq('id', bookId)
        .eq('library_id', libraryId)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        libraryId: data.library_id,
        title: data.title,
        author: data.author,
        genre: data.genre,
        isbn: data.isbn,
        copyCount: data.copy_count,
        shelfLocation: data.shelf_location,
        availability: data.availability,
        createdAt: data.created_at
      };
    } else {
      const books = this._getLocal('smart_lib_books');
      const idx = books.findIndex(b => b.id === bookId && b.libraryId === libraryId);
      if (idx !== -1) {
        books[idx] = { ...books[idx], ...bookData };
        this._setLocal('smart_lib_books', books);
        return books[idx];
      }
      throw new Error("Book not found.");
    }
  }

  async deleteBook(libraryId, bookId) {
    if (this.isSupabase) {
      const { error } = await this.client
        .from('books')
        .delete()
        .eq('id', bookId)
        .eq('library_id', libraryId);
      if (error) throw error;
      return true;
    } else {
      let books = this._getLocal('smart_lib_books');
      books = books.filter(b => !(b.id === bookId && b.libraryId === libraryId));
      this._setLocal('smart_lib_books', books);
      return true;
    }
  }

  // --- MEMBERS ---
  async getMembers(libraryId) {
    if (this.isSupabase) {
      const { data, error } = await this.client
        .from('members')
        .select('*')
        .eq('library_id', libraryId);
      
      if (error) throw error;
      
      return data.map(m => ({
        id: m.id,
        libraryId: m.library_id,
        username: m.username,
        name: m.name,
        email: m.email,
        phone: m.phone,
        address: m.address,
        password: m.password,
        createdAt: m.created_at
      }));
    } else {
      const members = this._getLocal('smart_lib_members');
      return members.filter(m => m.libraryId === libraryId);
    }
  }

  async addMember(libraryId, memberData) {
    const usernameClean = memberData.username.trim().toLowerCase();
    let id = "";

    if (this.isSupabase) {
      // 1. Fetch Library Short Code
      let libCode = "CEN";
      const { data: lib, error: libErr } = await this.client
        .from('libraries')
        .select('code, name')
        .eq('id', libraryId)
        .maybeSingle();
      
      if (lib) {
        libCode = (lib.code ? lib.code : lib.name.slice(0, 3)).toUpperCase().trim();
      }

      // 2. Fetch current member count for this library
      const { count, error: countErr } = await this.client
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('library_id', libraryId);
      
      const seq = (count || 0) + 1;
      const seqStr = seq.toString().padStart(4, '0');
      const year = new Date().getFullYear();
      
      // Custom ID: Lib[Year][Code][Sequence]
      id = `Lib${year}${libCode}${seqStr}`;

      const memberRow = {
        id: id,
        library_id: libraryId,
        username: usernameClean,
        name: memberData.name.trim(),
        email: memberData.email.trim(),
        phone: memberData.phone.trim(),
        address: memberData.address ? memberData.address.trim() : null,
        password: memberData.password
      };

      // Uniqueness check in library
      const { data: existing, error: queryErr } = await this.client
        .from('members')
        .select('id')
        .eq('library_id', libraryId)
        .eq('username', usernameClean);
      
      if (queryErr) throw queryErr;
      if (existing && existing.length > 0) {
        throw new Error("Student username already exists in this library.");
      }

      const { data, error } = await this.client
        .from('members')
        .insert(memberRow)
        .select()
        .single();
      
      if (error) throw error;

      return {
        id: data.id,
        libraryId: data.library_id,
        username: data.username,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        password: data.password,
        createdAt: data.created_at
      };
    } else {
      const members = this._getLocal('smart_lib_members');
      const libs = this._getLocal('smart_lib_libraries');
      
      const lib = libs.find(l => l.id === libraryId);
      let libCode = "CEN";
      if (lib) {
        libCode = (lib.code ? lib.code : lib.name.slice(0, 3)).toUpperCase().trim();
      }

      const count = members.filter(m => m.libraryId === libraryId).length;
      const seq = count + 1;
      const seqStr = seq.toString().padStart(4, '0');
      const year = new Date().getFullYear();
      id = `Lib${year}${libCode}${seqStr}`;

      if (members.some(m => m.libraryId === libraryId && m.username === usernameClean)) {
        throw new Error("Student username already exists in this library.");
      }

      const memberObj = {
        id: id,
        libraryId,
        username: usernameClean,
        name: memberData.name.trim(),
        email: memberData.email.trim(),
        phone: memberData.phone.trim(),
        address: memberData.address ? memberData.address.trim() : null,
        password: memberData.password,
        createdAt: new Date().toISOString()
      };
      members.push(memberObj);
      this._setLocal('smart_lib_members', members);
      return memberObj;
    }
  }

  async updateMember(libraryId, memberId, memberData) {
    const memberRow = {};
    if (memberData.name !== undefined) memberRow.name = memberData.name.trim();
    if (memberData.email !== undefined) memberRow.email = memberData.email.trim();
    if (memberData.phone !== undefined) memberRow.phone = memberData.phone.trim();
    if (memberData.address !== undefined) memberRow.address = memberData.address.trim();
    if (memberData.password !== undefined) memberRow.password = memberData.password;

    if (this.isSupabase) {
      const { data, error } = await this.client
        .from('members')
        .update(memberRow)
        .eq('id', memberId)
        .eq('library_id', libraryId)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        libraryId: data.library_id,
        username: data.username,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        password: data.password,
        createdAt: data.created_at
      };
    } else {
      const members = this._getLocal('smart_lib_members');
      const idx = members.findIndex(m => m.id === memberId && m.libraryId === libraryId);
      if (idx !== -1) {
        members[idx] = { ...members[idx], ...memberData };
        this._setLocal('smart_lib_members', members);
        return members[idx];
      }
      throw new Error("Member not found.");
    }
  }

  async deleteMember(libraryId, memberId) {
    if (this.isSupabase) {
      // 1. Get all active issues for this member to reset books status
      const { data: activeIssues, error: issueErr } = await this.client
        .from('issues')
        .select('book_id')
        .eq('member_id', memberId)
        .eq('library_id', libraryId)
        .eq('status', 'issued');
      
      if (!issueErr && activeIssues && activeIssues.length > 0) {
        const bookIds = activeIssues.map(i => i.book_id);
        // Reset these books to 'available'
        await this.client
          .from('books')
          .update({ availability: 'available' })
          .in('id', bookIds)
          .eq('library_id', libraryId);
      }

      // 2. Delete the member (cascades and deletes all issues records)
      const { error } = await this.client
        .from('members')
        .delete()
        .eq('id', memberId)
        .eq('library_id', libraryId);
      if (error) throw error;
      return true;
    } else {
      // LocalStorage Mode
      let members = this._getLocal('smart_lib_members');
      let issues = this._getLocal('smart_lib_issues');
      let books = this._getLocal('smart_lib_books');

      // Find active books checked out by this member
      const memberIssues = issues.filter(i => i.memberId === memberId && i.libraryId === libraryId && i.status === 'issued');
      memberIssues.forEach(i => {
        const book = books.find(b => b.id === i.bookId && b.libraryId === libraryId);
        if (book) {
          book.availability = 'available';
        }
      });

      // Filter out member and their issues
      members = members.filter(m => !(m.id === memberId && m.libraryId === libraryId));
      issues = issues.filter(i => !(i.memberId === memberId && i.libraryId === libraryId));

      this._setLocal('smart_lib_books', books);
      this._setLocal('smart_lib_members', members);
      this._setLocal('smart_lib_issues', issues);
      return true;
    }
  }

  // --- ISSUES & RETURNS ---
  async getIssues(libraryId) {
    if (this.isSupabase) {
      const { data, error } = await this.client
        .from('issues')
        .select('*')
        .eq('library_id', libraryId);
      
      if (error) throw error;

      return data.map(i => ({
        id: i.id,
        libraryId: i.library_id,
        bookId: i.book_id,
        bookTitle: i.book_title,
        memberId: i.member_id,
        memberName: i.member_name,
        issueDate: i.issue_date,
        dueDate: i.due_date,
        returnDate: i.return_date,
        finePaid: parseFloat(i.fine_paid || 0),
        status: i.status
      }));
    } else {
      const issues = this._getLocal('smart_lib_issues');
      return issues.filter(i => i.libraryId === libraryId);
    }
  }

  async issueBook(libraryId, bookId, memberId, durationDays = 14) {
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(issueDate.getDate() + parseInt(durationDays));

    let resolvedBookId = bookId.trim();
    let resolvedMemberId = memberId.trim();
    let bookTitle = "";
    let memberName = "";

    if (this.isSupabase) {
      // 1. Resolve Book (ID or ISBN)
      let { data: book, error: bErr } = await this.client
        .from('books')
        .select('*')
        .eq('id', resolvedBookId)
        .eq('library_id', libraryId)
        .maybeSingle();

      if (!book) {
        // Try resolving by ISBN
        const { data: bookIsbn } = await this.client
          .from('books')
          .select('*')
          .eq('isbn', resolvedBookId)
          .eq('library_id', libraryId)
          .maybeSingle();
        
        book = bookIsbn;
      }

      if (!book) throw new Error("Book not found by ID or ISBN.");
      if (book.availability !== 'available') throw new Error("Book is already issued.");
      resolvedBookId = book.id;
      bookTitle = book.title;

      // 2. Resolve Member (ID or Username)
      let { data: member, error: mErr } = await this.client
        .from('members')
        .select('*')
        .eq('id', resolvedMemberId)
        .eq('library_id', libraryId)
        .maybeSingle();
      
      if (!member) {
        // Try resolving by Username
        const { data: memberUser } = await this.client
          .from('members')
          .select('*')
          .eq('username', resolvedMemberId.toLowerCase())
          .eq('library_id', libraryId)
          .maybeSingle();
        
        member = memberUser;
      }

      if (!member) throw new Error("Member not found by ID or Username.");
      resolvedMemberId = member.id;
      memberName = member.name;

      // 3. Insert Issue log
      const id = 'issue_' + Math.random().toString(36).substr(2, 9);
      const issueRow = {
        id: id,
        library_id: libraryId,
        book_id: resolvedBookId,
        book_title: bookTitle,
        member_id: resolvedMemberId,
        member_name: memberName,
        issue_date: issueDate.toISOString(),
        due_date: dueDate.toISOString(),
        return_date: null,
        fine_paid: 0,
        status: 'issued'
      };

      const { data: newIssue, error: iErr } = await this.client
        .from('issues')
        .insert(issueRow)
        .select()
        .single();
      
      if (iErr) throw iErr;

      // 4. Update book status to 'issued'
      const { error: updBookErr } = await this.client
        .from('books')
        .update({ availability: 'issued' })
        .eq('id', resolvedBookId);
      
      if (updBookErr) console.error("Error updating book status:", updBookErr);

      return {
        id: newIssue.id,
        libraryId: newIssue.library_id,
        bookId: newIssue.book_id,
        bookTitle: newIssue.book_title,
        memberId: newIssue.member_id,
        memberName: newIssue.member_name,
        issueDate: newIssue.issue_date,
        dueDate: newIssue.due_date,
        returnDate: newIssue.return_date,
        finePaid: newIssue.fine_paid,
        status: newIssue.status
      };
    } else {
      // LocalStorage Mode
      const books = this._getLocal('smart_lib_books');
      const members = this._getLocal('smart_lib_members');
      const issues = this._getLocal('smart_lib_issues');

      let book = books.find(b => b.id === resolvedBookId && b.libraryId === libraryId);
      if (!book) {
        book = books.find(b => b.isbn === resolvedBookId && b.libraryId === libraryId);
        if (book) resolvedBookId = book.id;
      }

      let member = members.find(m => m.id === resolvedMemberId && m.libraryId === libraryId);
      if (!member) {
        member = members.find(m => m.username === resolvedMemberId.toLowerCase() && m.libraryId === libraryId);
        if (member) resolvedMemberId = member.id;
      }

      if (!book) throw new Error("Book not found by ID or ISBN.");
      if (!member) throw new Error("Member not found by ID or Username.");
      if (book.availability !== 'available') throw new Error("Book is already issued.");

      bookTitle = book.title;
      memberName = member.name;

      const newIssue = {
        id: 'issue_' + Math.random().toString(36).substr(2, 9),
        libraryId,
        bookId: resolvedBookId,
        bookTitle,
        memberId: resolvedMemberId,
        memberName,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        returnDate: null,
        finePaid: 0,
        status: 'issued'
      };

      book.availability = 'issued';
      this._setLocal('smart_lib_books', books);

      issues.push(newIssue);
      this._setLocal('smart_lib_issues', issues);

      return newIssue;
    }
  }

  async returnBook(libraryId, issueId, finePaid = 0) {
    const returnDate = new Date().toISOString();

    if (this.isSupabase) {
      // 1. Fetch current issue record to resolve book ID
      const { data: issue, error: fetchErr } = await this.client
        .from('issues')
        .select('*')
        .eq('id', issueId)
        .eq('library_id', libraryId)
        .single();
      
      if (fetchErr || !issue) throw new Error("Issue log not found.");

      // 2. Update issue log
      const { error: updErr } = await this.client
        .from('issues')
        .update({
          return_date: returnDate,
          status: 'returned',
          fine_paid: finePaid
        })
        .eq('id', issueId);
      
      if (updErr) throw updErr;

      // 3. Update book availability back to 'available'
      const { error: bookErr } = await this.client
        .from('books')
        .update({ availability: 'available' })
        .eq('id', issue.book_id);
      
      if (bookErr) console.error("Error setting book status to available:", bookErr);

      return {
        id: issueId,
        libraryId: libraryId,
        bookId: issue.book_id,
        bookTitle: issue.book_title,
        memberId: issue.member_id,
        memberName: issue.member_name,
        issueDate: issue.issue_date,
        dueDate: issue.due_date,
        returnDate,
        finePaid,
        status: 'returned'
      };
    } else {
      const issues = this._getLocal('smart_lib_issues');
      const books = this._getLocal('smart_lib_books');

      const issue = issues.find(i => i.id === issueId && i.libraryId === libraryId);
      if (!issue) throw new Error("Issue log not found.");

      issue.returnDate = returnDate;
      issue.status = 'returned';
      issue.finePaid = finePaid;

      // Update book status
      const book = books.find(b => b.id === issue.bookId && b.libraryId === libraryId);
      if (book) {
        book.availability = 'available';
      }

      this._setLocal('smart_lib_issues', issues);
      this._setLocal('smart_lib_books', books);

      return issue;
    }
  }
}

// Instantiate globally
window.smartLibDB = new SupabaseLibraryDB();
