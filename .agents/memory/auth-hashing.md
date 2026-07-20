---
name: Auth password hashing
description: SHA-256 hashing uses SESSION_SECRET as salt; operator-precedence trap and reseed requirement
---

The `hashPassword` function in `artifacts/api-server/src/lib/auth.ts`:

```ts
crypto.createHash("sha256").update(password + (process.env.SESSION_SECRET || "inews-roms-secret")).digest("hex")
```

**Why:** The original code had `password + process.env.SESSION_SECRET || "inews-roms-secret"` which JS evaluates as `(password + SESSION_SECRET) || "inews-roms-secret"` — returning the literal fallback string instead of a hash when SESSION_SECRET is undefined.

**How to apply:** Always wrap the fallback in parentheses. When seeding passwords in a new environment, compute hashes by running `node -e` with `process.env.SESSION_SECRET` sourced from the environment — never hardcode hashes against the fallback salt if SESSION_SECRET is set.
