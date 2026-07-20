---
name: Seed credentials
description: Seeded user accounts and how to recompute their password hashes
---

Four seed users exist after `pnpm --filter @workspace/db run push` + seeding:

| username | password  | role        |
|----------|-----------|-------------|
| admin    | admin123  | management  |
| ops1     | ops123    | operations  |
| coord1   | coord123  | coordinator |
| sales1   | sales123  | sales       |

To recompute correct hashes for any environment:
```bash
node -e "const c=require('crypto'),s=process.env.SESSION_SECRET||'inews-roms-secret'; ['admin123','ops123','coord123','sales123'].forEach(p=>console.log(p,c.createHash('sha256').update(p+s).digest('hex')))"
```

Then UPDATE users SET password_hash = $hash WHERE username = $user.

**Why:** Hashes depend on SESSION_SECRET from the environment — they differ across repls. Never hardcode them.
