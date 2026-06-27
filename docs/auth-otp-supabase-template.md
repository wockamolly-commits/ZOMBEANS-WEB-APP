# Supabase Email OTP Template

Supabase email passwordless auth uses the Magic Link email template for both
magic links and manual email OTP codes. The app now verifies `{{ .Token }}` with
`supabase.auth.verifyOtp({ email, token, type: "email" })`, so the hosted
Supabase project must not render `{{ .ConfirmationURL }}` in that template.

## Dashboard Setting

In Supabase Dashboard, update the auth templates by purpose:

### OTP code templates

Use the OTP template for:

- Magic Link
- Confirm sign up

1. Open Authentication > Emails > Templates.
2. Select one of the templates above.
3. Replace the body with the contents of:
   `supabase/email-templates/magic-link-otp.html`
4. Make sure the template contains `{{ .Token }}`.
5. Make sure it does not contain `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`,
   or any `<a href="...">` sign-in button.

The template is a branded, responsive HTML email styled to match the app's
dark forest-green + bone-gold theme:

- Table-based layout with fully inline styles for broad client support
  (Gmail, Apple Mail, Outlook/MSO fallbacks, mobile).
- The 6-digit `{{ .Token }}` is rendered as a large, letter-spaced "ticket"
  card so it is easy to read and copy at a glance.
- Header shows the official ZOMBEANS logo with the brand tagline
  "Rise Up From The Dead"; footer repeats the tagline. No emojis are used.
- The logo loads from `{{ .SiteURL }}/images/brand/zombeans-logo.png`, so the
  Supabase Site URL must point at the deployed app and that asset must be
  publicly reachable. If an image is blocked/unreachable, the `alt="ZOMBEANS"`
  text shows in its place.
- Includes a hidden inbox preheader, an expiration notice, and a
  "Do not share this code" security note. Copy stays customer-facing and does
  not reference internal/staff auth flows.

### Device / browser / location info

Supabase auth email templates do not expose request metadata (IP, user agent,
geolocation), so login-context details are intentionally omitted rather than
faked. If that data is needed later, send a separate notification email from
an app-side hook where the request context is available.

Suggested subject:

```text
Your Zombeans sign-in code
```

Use a staff-specific subject such as `Your Zombeans staff verification code`
if the dashboard allows a separate subject for staff code emails.

### Staff invitation template

Use Supabase Auth's Invite user template only for the first staff onboarding
email. Paste the contents of:

`supabase/email-templates/staff-invitation.html`

into Authentication > Emails > Templates > Invite user.

Suggested subject:

```text
Your Zombeans staff invitation
```

This template contains `{{ .ConfirmationURL }}` and intentionally does not
contain `{{ .Token }}`. The 6-digit code is requested only after the staff
member opens the invitation link and lands on `/login`.

The app no longer accepts `/auth/confirm` link verification. If a user opens an
old link, they are sent back to `/login` to request a 6-digit code.

## OTP Length

In Supabase Dashboard:

1. Open Authentication > Providers.
2. Select Email.
3. Set Email OTP length to `6` digits.
4. Save.

The login UI accepts exactly 6 digits, so this hosted Auth setting must stay in
sync with the app.
