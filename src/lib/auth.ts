import { observe } from "./telemetry";
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

async function signIn() {
  if (auth.currentUser?.isAnonymous) {
    // Link in place: legacy submissions and membership retain their UID.
    try {
      return await linkWithPopup(auth.currentUser, googleProvider);
    } catch (error) {
      if (
        (error as { code?: string }).code === "auth/credential-already-in-use"
      ) {
        throw new Error(
          "This Google account already has a workshop identity. Ask your facilitator to migrate the old record before switching accounts; your current progress has been kept.",
        );
      }
      throw error;
    }
  }
  googleProvider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, googleProvider);
}
export const isGoogleStudent = (
  user: import("firebase/auth").User | null | undefined,
) =>
  !!user &&
  !user.isAnonymous &&
  user.emailVerified &&
  user.providerData.some(
    (p) => p.providerId === GoogleAuthProvider.PROVIDER_ID,
  );

export const googleSignIn = () => observe("auth.google", () => signIn());
