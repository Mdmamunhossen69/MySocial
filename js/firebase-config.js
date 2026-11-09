// Fill in the values from: Firebase console -> Project settings -> Your apps -> Web app.
// These values are public by design (security comes from firestore.rules + App Check).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Optional: reCAPTCHA v3 site key for Firebase App Check. Leave "" to disable.
export const appCheckSiteKey = "";

// Optional: free Cloudinary account for uploading short videos from the browser.
// Create an *unsigned* upload preset in Cloudinary, then fill both values.
// Leave empty to allow video links only.
export const cloudinary = {
  cloudName: "",
  uploadPreset: ""
};
