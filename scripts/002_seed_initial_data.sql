-- Insert admin user (you'll need to create the auth user first)
-- This is a template - update with actual admin user IDs

-- Example gifts to start with
-- Note: Replace 'admin-user-id' with actual admin user UUID from auth.users
-- You can find this in Supabase dashboard after creating an admin account

-- Sample gifts that can be customized
INSERT INTO public.gifts (name, emoji, max_winners, current_winners, created_by)
VALUES
  ('Premium Wallet', '👜', 5, 0, 'ADMIN_USER_ID_HERE'),
  ('Leather Bag', '🎒', 3, 0, 'ADMIN_USER_ID_HERE'),
  ('Sunglasses Set', '😎', 10, 0, 'ADMIN_USER_ID_HERE'),
  ('Premium Umbrella', '☂️', 4, 0, 'ADMIN_USER_ID_HERE'),
  ('Scarf Bundle', '🧣', 6, 0, 'ADMIN_USER_ID_HERE')
ON CONFLICT DO NOTHING;
