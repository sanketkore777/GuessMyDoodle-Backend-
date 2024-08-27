const Router = require("express").Router();

Router.get("/newuser", (req, res) => {
  try {
    const reqToken = req.headers.authorization?.split(" ")[1];
    if (reqToken) {
    }
  } catch (error) {}
});
