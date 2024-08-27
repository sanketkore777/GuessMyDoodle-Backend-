const express = require("express");
const Router = express.Router();
const User = require("../models/UserModel");
const verifyIdToken = require("../services/firebase");

Router.post("/newuser", async (req, res) => {
  try {
    // Access the JSON data directly from req.body
    console.log(req.body);
    const { nickname, age } = req.body;
    const reqToken = req.headers.authorization?.split(" ")[1];

    if (reqToken) {
      // Verify the Firebase ID token
      const decodedToken = await verifyIdToken(reqToken);
      const email = decodedToken.email;

      if (email) {
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res
            .status(401)
            .json({ success: false, message: "User already exists!" });
        }

        // Create a new user if they don't exist
        const newUser = new User({ nickname, email, age });
        await newUser.save();
        return res
          .status(201)
          .json({ success: true, message: "User account created!" });
      }
    }

    // If token is not provided or email is not found in the token
    return res.status(400).json({ success: false, message: "Invalid token!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create User!" });
  }
});

module.exports = Router;
