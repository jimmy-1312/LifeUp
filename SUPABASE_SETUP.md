# Supabase setup

1. Create a Supabase project.
2. In **SQL Editor**, run `supabase/schema.sql`.
3. Copy `supabase-config.example.js` to `supabase-config.js`, then add the Project URL and **anon/publishable** key from the project's Connect/API settings. Do not use the service-role key in a browser.
4. In **Authentication → URL Configuration**, add the exact local app URL used in your browser (for example `http://127.0.0.1:4173/`) to Redirect URLs and set Site URL accordingly. The app returns email-confirmation links to the current page.
5. In **Authentication → Providers → Email**, keep email/password enabled. New accounts require a password of at least 8 characters. If email confirmation remains enabled, users must confirm their email before signing in; this is the recommended setting.

The login and registration forms use Supabase Auth for passwords and sessions; passwords are never stored in the app database or browser local storage. On first sign-in, users create a profile and receive the starter achievement collections. Profile details and achievement progress are written to that user's `public.profiles` row protected by Row Level Security, so a signed-in user can only read or update their own row.

Run the site through a local web server (not by opening `index.html` directly). For example, from the project folder run `python -m http.server 4173`, then open `http://127.0.0.1:4173/`. Register with an email address you can access, confirm it if prompted, sign in, and complete the profile setup. Existing users can return with the same email and password; their profile and achievement progress load from Supabase. Use the profile button in the header to sign out.
