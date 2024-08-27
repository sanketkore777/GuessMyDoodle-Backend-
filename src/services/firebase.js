const admin = require("firebase-admin");
const serviceAccount = require("../config/firebaseConfig");

//firebase initialization
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyIdToken = async (idToken) => {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken;
};

module.exports = verifyIdToken;
