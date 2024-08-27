const Router = require("express").Router();
const admin = require("firebase-admin");

var serviceAccount = require("../services/firebase");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

Router.post("/authentication", async (req, res) => {
  const userToken = req.headers.authorization.split(" ")[1];
  try {
    await verifyToken(userToken);
    res.status(200).send({ message: "Authentication successful" });
  } catch (error) {
    console.log(error);
    res.status(401).send({ message: "Authentication failed", error: error });
  }
});

const verifyToken = async (idToken) => {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const uid = decodedToken.uid;
  // Proceed with your authentication logic, e.g., creating a session
};

module.exports = Router;
