-- SUPABASE_SCHEMA.sql
-- Use this file to set up your PostgreSQL Database in the Supabase SQL Editor.
-- This schema has been fully synchronized with the frontend JavaScript queries.

-- Enable gen_random_uuid() support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Libraries Table
CREATE TABLE IF NOT EXISTS libraries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    admin_username TEXT NOT NULL UNIQUE,
    admin_password TEXT NOT NULL,
    library_code TEXT UNIQUE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Members (Students) Table
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT REFERENCES libraries(id) ON DELETE CASCADE,
    member_id_custom TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT,
    password TEXT NOT NULL,
    qr_code_url TEXT,
    join_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_lib_username UNIQUE (library_id, username)
);

-- 3. Create Books Catalog Table
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT REFERENCES libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    genre TEXT,
    isbn TEXT,
    barcode TEXT,
    cover_url TEXT,
    shelf_location TEXT DEFAULT 'N/A',
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_lib_barcode UNIQUE (library_id, barcode)
);

-- 4. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    library_id TEXT PRIMARY KEY REFERENCES libraries(id) ON DELETE CASCADE,
    fine_per_day NUMERIC NOT NULL DEFAULT 1.0,
    due_days_limit INTEGER NOT NULL DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Issues / Borrowing Logs Table
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    library_id TEXT REFERENCES libraries(id) ON DELETE CASCADE,
    book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
    member_id TEXT REFERENCES members(id) ON DELETE CASCADE,
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    return_date TIMESTAMPTZ,
    fine_amount NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned'))
);

-- 6. PostgreSQL Triggers for Auto-managing Available Copies & Fine Calculations

-- Trigger: When a book is issued, decrement the available copies.
CREATE OR REPLACE FUNCTION fn_issue_book()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE books
    SET available_copies = CASE WHEN available_copies > 0 THEN available_copies - 1 ELSE 0 END
    WHERE id = NEW.book_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_issue_book
AFTER INSERT ON issues
FOR EACH ROW
WHEN (NEW.status = 'issued')
EXECUTE FUNCTION fn_issue_book();

-- Trigger: When a book is returned, increment the available copies.
CREATE OR REPLACE FUNCTION fn_return_book()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE books
    SET available_copies = LEAST(total_copies, available_copies + 1)
    WHERE id = NEW.book_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_return_book
AFTER UPDATE ON issues
FOR EACH ROW
WHEN (OLD.status = 'issued' AND NEW.status = 'returned')
EXECUTE FUNCTION fn_return_book();

-- Trigger: Automatically calculate overdue fine on return based on the library's daily rate.
CREATE OR REPLACE FUNCTION fn_calculate_fine()
RETURNS TRIGGER AS $$
DECLARE
    v_fine_rate NUMERIC;
    v_days_overdue INTEGER;
BEGIN
    -- Fetch the fine rate per day from settings
    SELECT fine_per_day INTO v_fine_rate FROM settings WHERE library_id = NEW.library_id;
    IF v_fine_rate IS NULL THEN
        v_fine_rate := 1.0;
    END IF;

    -- Calculate days overdue if returned late
    IF NEW.return_date > NEW.due_date THEN
        v_days_overdue := CEIL(EXTRACT(EPOCH FROM (NEW.return_date - NEW.due_date)) / 86400);
        NEW.fine_amount := v_days_overdue * v_fine_rate;
    ELSE
        NEW.fine_amount := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_calculate_fine
BEFORE UPDATE ON issues
FOR EACH ROW
WHEN (OLD.status = 'issued' AND NEW.status = 'returned')
EXECUTE FUNCTION fn_calculate_fine();


-- Row Level Security (RLS) Policies (Enable/run to secure database tables)
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies (for development and general prototyping)
CREATE POLICY "Allow public access" ON libraries FOR ALL USING (true);
CREATE POLICY "Allow public access" ON members FOR ALL USING (true);
CREATE POLICY "Allow public access" ON books FOR ALL USING (true);
CREATE POLICY "Allow public access" ON settings FOR ALL USING (true);
CREATE POLICY "Allow public access" ON issues FOR ALL USING (true);
