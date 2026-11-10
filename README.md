# DoctorSlot

DoctorSlot is a React app using Firebase Authentication and the Firebase Realtime Database. It uses Google sign-in only; Cloud Firestore is not used.

## Run locally

1. Create a Firebase project and register a web app.
2. Enable the **Google** provider in Firebase Authentication and add your local site to the authorized domains.
3. Create a **Realtime Database** in the project.
4. Copy `.env.example` to `.env` and add the Firebase web app configuration, including the Realtime Database URL.
5. In Firebase Console, publish the rules from `database.rules.json`.
6. Run `npm install` and `npm run dev`.

The verified Google account `pathanayeshaanjum2006@gmail.com` is bootstrapped as the platform admin after the updated database rules are published and the account signs in. Admins can add public doctor profiles from the admin dashboard and book appointments; each doctor profile is assigned a database ID that patients and admins can book. Keep patient details out of doctor profiles.

The app falls back to sample doctors and appointments when Firebase is not configured. Google sign-in and persistent data require a configured Firebase project.

## Realtime Database structure

- `users/{uid}` stores the authenticated user's profile and role.
- `doctors/{uid}` stores publicly searchable provider profiles.
- `appointments/{appointmentId}` stores bookings, including `patientUid` and `doctorUid` for role-scoped queries.

Google sign-in creates patient profiles. To grant doctor or admin access, update the user's role in `users/{uid}` in the Firebase Console. Add a corresponding `doctors/{uid}` record for each doctor, with `userId` set to the same UID. Admin access is not available through public sign-in.

The rules index appointments by patient and doctor UID and restrict appointment reads and updates by role.
