import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const adminApp = getApps().length
    ? getApps()[0]
    : initializeApp({
          credential: cert({
              projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
              clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
                  /\\n/g,
                  "\n"
              ),
          }),
      });

export const adminDb = getFirestore(adminApp);
