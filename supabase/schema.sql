-- Drop existing tables and types to start fresh (useful if you ran the previous script)
drop publication if exists supabase_realtime;
drop table if exists public.deliveries cascade;
drop table if exists public.orders cascade;
drop table if exists public.items cascade;
drop table if exists public.users cascade;
drop table if exists public.shops cascade;

drop type if exists delivery_status cascade;
drop type if exists delivery_type cascade;
drop type if exists user_role cascade;

-- Enable pgcrypto for UUIDs
create extension if not exists "pgcrypto";

-- Enums
create type delivery_status as enum ('dispatched', 'at_pickup', 'picked_up', 'en_route', 'arrived');
create type delivery_type as enum ('parcel', 'marketplace');
create type user_role as enum ('buyer', 'shop_owner');

-- Shops table (created first so users can reference it)
create table public.shops (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    banner_url text,
    categories text[],
    lat double precision,
    lng double precision,
    whatsapp_number text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Users table
create table public.users (
    id uuid references auth.users not null primary key,
    phone text unique,
    name text,
    role user_role default 'buyer' not null,
    shop_id uuid references public.shops(id) on delete set null, -- Only for shop_owners
    saved_locations jsonb default '[]'::jsonb,
    onboarding_seen boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Items table
create table public.items (
    id uuid default gen_random_uuid() primary key,
    shop_id uuid references public.shops(id) on delete cascade not null,
    name text not null,
    banner_url text,
    categories text[],
    category text not null,
    weight_grams integer not null,
    price numeric(10, 2) not null,
    quantity integer default 0 not null,
    in_stock boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Orders table
create table public.orders (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete set null,
    shop_id uuid references public.shops(id) on delete set null not null,
    items jsonb not null, -- Array of { item_id, quantity, price }
    total_weight_grams integer not null,
    status delivery_status default 'dispatched' not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Deliveries table (tracks the robot)
create table public.deliveries (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references public.orders(id) on delete set null,
    type delivery_type not null,
    start_point text,
    drop_point text,
    robot_lat double precision,
    robot_lng double precision,
    status delivery_status default 'dispatched' not null,
    eta_seconds integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- ROW LEVEL SECURITY (RLS) --

-- Enable RLS on tables
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.shops enable row level security;

-- Policies for `users`
create policy "Users can view their own profile." on public.users
    for select using (auth.uid() = id);

create policy "Users can update their own profile." on public.users
    for update using (auth.uid() = id);

-- Policies for `shops`
create policy "Anyone can view shops." on public.shops
    for select using (true);

-- Policies for `items`
create policy "Anyone can view items." on public.items
    for select using (true);

create policy "Shop owners can insert items to their own shop." on public.items
    for insert with check (
        exists (
            select 1 from public.users
            where users.id = auth.uid() 
            and users.role = 'shop_owner'
            and users.shop_id = items.shop_id
        )
    );

create policy "Shop owners can update items in their own shop." on public.items
    for update using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() 
            and users.role = 'shop_owner'
            and users.shop_id = items.shop_id
        )
    );

create policy "Shop owners can delete items in their own shop." on public.items
    for delete using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() 
            and users.role = 'shop_owner'
            and users.shop_id = items.shop_id
        )
    );

-- Realtime enablement
create publication supabase_realtime;
alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.items;
