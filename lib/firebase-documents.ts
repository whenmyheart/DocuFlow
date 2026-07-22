import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence, signInAnonymously, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, orderBy, query } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAVM3G9UQbdlw41pndaturMMmiVU6bw2Fk",
  authDomain: "docuflow-e9f4e.firebaseapp.com",
  projectId: "docuflow-e9f4e",
  storageBucket: "docuflow-e9f4e.firebasestorage.app",
  messagingSenderId: "690963051022",
  appId: "1:690963051022:web:1d6b4c30e31dd598f7825f",
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export type CloudDocument = {
  id: string;
  title: string;
  text: string;
  savedAt: number;
};

let userPromise: Promise<User> | null = null;

async function getAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  if (!userPromise) {
    userPromise = (async () => {
      await setPersistence(auth, browserLocalPersistence);
      return (await signInAnonymously(auth)).user;
    })().finally(() => {
      userPromise = null;
    });
  }
  return userPromise;
}

function userDocuments(userId: string) {
  return collection(db, "users", userId, "documents");
}

export async function loadCloudDocuments(): Promise<CloudDocument[]> {
  const user = await getAnonymousUser();
  const snapshot = await getDocs(query(userDocuments(user.uid), orderBy("savedAt", "desc")));

  return snapshot.docs.map((savedDocument) => {
    const data = savedDocument.data();
    return {
      id: savedDocument.id,
      title: String(data.title ?? "제목 없는 문서"),
      text: String(data.text ?? ""),
      savedAt: Number(data.savedAt ?? 0),
    };
  });
}

export async function saveCloudDocument(document: Omit<CloudDocument, "id">): Promise<CloudDocument> {
  const user = await getAnonymousUser();
  const reference = await addDoc(userDocuments(user.uid), document);
  return { id: reference.id, ...document };
}

export async function deleteCloudDocument(documentId: string) {
  const user = await getAnonymousUser();
  await deleteDoc(doc(db, "users", user.uid, "documents", documentId));
}
