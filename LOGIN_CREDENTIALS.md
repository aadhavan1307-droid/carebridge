# CareBridge 2.0 — Login Credentials

> **WARNING:** These are synthetic local-development credentials only.
> Do not use these credentials in production.
> Passwords are stored as hashes in the database — never in plaintext.
> This file is for LOCAL DEVELOPMENT / TESTING ONLY.

---

## Administrator

**Login:** `admin@carebridge.local`
**Password:** `Admin@2026!`
**Role:** `ADMINISTRATOR`

---

## Receptionist

**Login:** `reception@carebridge.local`
**Password:** `Reception@2026!`
**Role:** `RECEPTIONIST`

---

## Doctors

### Dr. Ananya Rao

**Doctor ID:** `DOC-201`
**Login:** `ananya.rao@carebridge.local`
**Password:** `Doctor@2026!Ananya`
**Role:** `DOCTOR`
**Specialty:** `Cardiology`
**Department:** Emergency Care
**Max Capacity:** 8 patients

### Dr. Vikram Singh

**Doctor ID:** `DOC-202`
**Login:** `vikram.singh@carebridge.local`
**Password:** `Doctor@2026!Vikram`
**Role:** `DOCTOR`
**Specialty:** `Emergency Medicine`
**Department:** Emergency Care
**Max Capacity:** 10 patients

### Dr. Meera Nair

**Doctor ID:** `DOC-203`
**Login:** `meera.nair@carebridge.local`
**Password:** `Doctor@2026!Meera`
**Role:** `DOCTOR`
**Specialty:** `Pulmonology`
**Department:** Emergency Care
**Max Capacity:** 8 patients

---

## Synthetic Test Patients (Last Populated)

> All patient data is **SYNTHETIC/TEST DATA** — not real patient information.

| Patient ID | Name & Description | Risk Level | Priority | Assigned Doctor |
|-----------|-------------------|------------|----------|-----------------|
| PAT-716427 | Arjun Kumar (SYNTHETIC/TEST DATA) | CRITICAL | P1 | Dr. Ananya Rao |
| PAT-716466 | Kavya Menon (SYNTHETIC/TEST DATA) | MODERATE | P3 | Dr. Vikram Singh |
| PAT-716492 | Rahul Prasad (SYNTHETIC/TEST DATA) | LOW | P4 | Dr. Vikram Singh |
| PAT-716511 | Nisha Iyer (SYNTHETIC/TEST DATA) | LOW | P4 | Dr. Vikram Singh |

---

## Environment

| Route | URL |
|---|---|
| Application | `http://10.144.42.33:3001` |
| Admin Login | `/login/admin` |
| Reception Login | `/login/reception` |
| Doctor Login | `/login/doctor` |

---

## NPM Commands

| Command | Description |
|---|---|
| `npm start` | Start server (no auto-seeding) |
| `npm run db:reset-data` | Wipe all operational data (keeps admin + receptionist) |
| `npm run db:populate` | Add synthetic test doctors + patients via real API |
| `npm run db:legacy-seed` | Add legacy full demo dataset (manual, development only) |

---

## Security Notes

- Passwords are stored as SHA-256 hashes in the `users.password_hash` column.
- Plaintext passwords are **never** stored in the database, API responses, audit logs, or frontend code.
- This file must **never** be deployed to a production server.
