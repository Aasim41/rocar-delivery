-- Add rating and feedback columns to orders table
alter table public.orders 
add column if not exists rating integer check (rating >= 1 and rating <= 5),
add column if not exists feedback text;
