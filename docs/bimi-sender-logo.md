# BIMI sender logo (Zombeans)

Goal: show the Zombeans logo as the sender avatar next to auth emails in Gmail,
Apple Mail, Yahoo, etc.

BIMI only renders if the message passes **DMARC with an enforced policy**
(`p=quarantine` or `p=reject`) **and** is sent from a domain you control. So the
order of work is: custom SMTP on `zombeans.xyz` -> SPF/DKIM/DMARC ->
BIMI record. Gmail and Apple Mail additionally require a paid **VMC**
(Verified Mark Certificate); Yahoo/Fastmail will show the logo from the SVG
alone.

The logo file lives at:

```
public/images/brand/zombeans-logo-bimi.svg
```

Once deployed it is publicly reachable at:

```
https://zombeans.xyz/images/brand/zombeans-logo-bimi.svg
```

It is authored to the BIMI-required **SVG Tiny Portable/Secure (SVG_PS)**
profile: `baseProfile="tiny-ps"`, square `viewBox`, a `<title>`, a solid
(non-transparent) background, and no scripts, animation, or external references.

It is a true-vector trace of the official logo (`zombeans-logo.png`), not a
redraw. Regenerate it with:

```
npm i potrace --no-save
node scripts/trace-bimi-logo.mjs
```

The script classifies each pixel to the nearest brand color and traces each
color as a layered vector path (the logo's white die-cut border is its own
layer). Output stays under BIMI's ~32 KB limit.

---

## 1. Send auth email from your own domain (custom SMTP)

Supabase Dashboard -> Authentication -> Emails -> SMTP Settings. Point it at a
provider (Resend, SendGrid, Postmark, Amazon SES, or Google Workspace) sending
as e.g. `noreply@zombeans.xyz`. Without this, emails come from a Supabase
address you cannot brand.

## 2. SPF (TXT record on the root domain)

One SPF record only; merge includes if you already have one. Examples:

```
; Resend
zombeans.xyz.   TXT   "v=spf1 include:_spf.resend.com ~all"

; SendGrid
zombeans.xyz.   TXT   "v=spf1 include:sendgrid.net ~all"

; Google Workspace
zombeans.xyz.   TXT   "v=spf1 include:_spf.google.com ~all"
```

## 3. DKIM

Provider-generated. Add the exact CNAME/TXT records the provider gives you
(e.g. `resend._domainkey`, `s1._domainkey`, `google._domainkey`). DKIM must
align with the From domain for DMARC to pass.

## 4. DMARC (TXT record on `_dmarc`) — must be enforced for BIMI

```
_dmarc.zombeans.xyz.   TXT   "v=DMARC1; p=quarantine; sp=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:dmarc@zombeans.xyz; ruf=mailto:dmarc@zombeans.xyz; fo=1"
```

- `p=quarantine` is the minimum BIMI accepts; `p=reject` is stronger.
- Start at `p=none` only while testing alignment, then raise it — BIMI will
  NOT show the logo at `p=none`.
- Make sure `dmarc@zombeans.xyz` (or your chosen mailbox) exists to receive
  aggregate reports.

## 5. BIMI (TXT record on `default._bimi`)

```
default._bimi.zombeans.xyz.   TXT   "v=BIMI1; l=https://zombeans.xyz/images/brand/zombeans-logo-bimi.svg; a=https://zombeans.xyz/.well-known/vmc/zombeans-vmc.pem"
```

- `l=` is the SVG logo URL (must be HTTPS, publicly reachable, no redirects).
- `a=` is the VMC certificate URL. **Omit `a=` if you don't have a VMC yet:**

```
default._bimi.zombeans.xyz.   TXT   "v=BIMI1; l=https://zombeans.xyz/images/brand/zombeans-logo-bimi.svg;"
```

  Without a VMC, Yahoo/Fastmail show the logo; Gmail and Apple Mail will not.

## 6. VMC (optional, for Gmail + Apple Mail)

A Verified Mark Certificate is issued by a CA (DigiCert or Entrust), typically
requires a **registered trademark** of the logo, and costs roughly a few
hundred USD/year. Host the issued `.pem` at the `a=` URL above. A self-hosted
path like `/.well-known/vmc/zombeans-vmc.pem` works since the file ships from
`public/`.

---

## Verify

- Logo loads: open the `l=` URL in a browser.
- DNS published: check the TXT records for `_dmarc.zombeans.xyz` and
  `default._bimi.zombeans.xyz`.
- Use a BIMI/DMARC inspector (e.g. bimigroup.org tools, MXToolbox, or
  dmarcian) to confirm alignment and that the SVG passes the SVG_PS profile.
- Send a real `/login` test, then check the sender avatar in Gmail/Yahoo.

## Quick path vs. full path

- **Quickest avatar (no DNS):** if the sender is a Google Workspace mailbox,
  set that account's Google profile picture to the logo — Gmail shows it
  without BIMI or a VMC.
- **Brand logo everywhere:** complete steps 1-6 above.
