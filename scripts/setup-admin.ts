/**
 * Admin Setup Script
 *
 * After deploying the app, run this to create the first admin user:
 * 1. Create an admin account via /admin/login signup flow (you may need to add a signup page)
 * 2. Get the user ID from Supabase dashboard (auth.users table)
 * 3. Run the SQL migration to add that user to the admins table:
 *
 * UPDATE: For now, admins should be created manually in Supabase dashboard:
 * 1. Go to Supabase dashboard > Auth > Users
 * 2. Create a new user with admin email
 * 3. Copy the user ID
 * 4. Go to SQL Editor and run:
 *    INSERT INTO public.admins (id, email) VALUES ('<user-id>', '<admin-email>');
 */
