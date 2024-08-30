const Router = require("express").Router();
const User = require("../models/UserModel");
const verifyIdToken = require("../services/firebase");

Router.post("/authentication", async (req, res) => {
  const userToken = req.headers.authorization.split(" ")[1];
  try {
    const decodedToken = await verifyIdToken(userToken);
    console.log(decodedToken, "TOKEN ----");
    if (decodedToken?.uid) {
      if (decodedToken.email) {
        const user = await User.find({ email: decodedToken.email });
        if (user.length) {
          res.status(200).send({ success: true, isSignedIn: true });
        } else {
          res.status(200).send({ success: true, isSignedIn: false });
        }
      } else {
        res.status(200).send({ success: true, isSignedIn: false });
      }
    } else {
      res.status(401).json({ success: false, message: "INVALID TOKEN!" });
    }
  } catch (error) {
    console.log(error);
    res.status(401).send({ success: false, message: "Authentication Failed!" });
  }
});

module.exports = Router;
