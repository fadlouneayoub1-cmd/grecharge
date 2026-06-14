-- ==========================================
-- RECHARGE & SIM MANAGER - DATABASE SCHEMA
-- Execute this script in your Supabase SQL Editor
-- ==========================================

-- 1. Create Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    dealer_number TEXT,
    activity TEXT,
    address TEXT,
    notes TEXT
);

-- 2. Create Sales Table (Transactions)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    operator TEXT NOT NULL, -- 'Maroc Telecom', 'Orange', 'Inwi'
    product_type TEXT NOT NULL, -- 'Recharge', 'SIM'
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_brut NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    net_to_pay NUMERIC DEFAULT 0,
    payment_status TEXT NOT NULL, -- 'Payé', 'En Crédit'
    notes TEXT
);

-- 3. Create Credits Table (Dettes)
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Non payé' -- 'Non payé', 'Partiellement payé', 'Payé'
);

-- 4. Create Credit Payments Table (Règlements de dettes)
CREATE TABLE IF NOT EXISTS credit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    credit_id UUID REFERENCES credits(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    notes TEXT
);

-- 5. Create Expenses Table (Frais divers)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    category TEXT,
    notes TEXT
);

-- 6. Create Stock Table (Inventaire des articles)
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    operator TEXT NOT NULL, -- 'Maroc Telecom', 'Orange', 'Inwi'
    product_type TEXT NOT NULL, -- 'Recharge', 'SIM'
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    min_threshold INTEGER DEFAULT 10
);

-- 7. Disable Row Level Security (RLS) on all tables to allow connection read/write
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
