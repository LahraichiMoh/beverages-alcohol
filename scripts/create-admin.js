const {
    createClient
} = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdmin() {
    const email = 'admin@rouemaroc.games';
    const password = 'password123'; // Default password

    console.log(`Checking if user ${email} exists...`);

    // 1. Check if user exists in Auth
    const {
        data: {
            users
        },
        error: listError
    } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    let user = users.find(u => u.email === email);
    let userId;

    if (user) {
        console.log('User already exists in Auth.');
        userId = user.id;
    } else {
        console.log('User does not exist. Creating...');
        const {
            data: newUser,
            error: createError
        } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (createError) {
            console.error('Error creating user:', createError);
            return;
        }

        user = newUser.user;
        userId = user.id;
        console.log('User created successfully.');
        console.log(`Credentials -> Email: ${email}, Password: ${password}`);
    }

    // 2. Add to public.admins table
    console.log(`Adding user ${userId} to admins table...`);

    const {
        error: insertError
    } = await supabase
        .from('admins')
        .insert([{
            id: userId,
            email: email
        }])
        .select();

    if (insertError) {
        if (insertError.code === '23505') { // Unique violation
            console.log('User is already an admin.');
        } else {
            console.error('Error adding to admins table:', insertError);
        }
    } else {
        console.log('User successfully promoted to admin.');
    }
}

createAdmin();