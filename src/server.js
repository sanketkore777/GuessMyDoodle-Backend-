const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectToDatabase = require("../lib/dbConnection.js");
const auth = require("./routes/isAccountExists.js");
const newuser = require("./routes/createUser.js");

// const bodyParser = require("body-parser");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
// Connect to MongoDB
connectToDatabase();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Socket.IO connection
io.on("connection", (socket) => {
  console.log("A user connected");

  // Listen for a chat message
  socket.on("chat message", async (msg) => {
    console.log("Message received:", msg);

    // Broadcast the message to all connected clients
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.use("/auth", auth);
app.use("/account", newuser);
// app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
// app.use(bodyParser.json());
// Start the server
const PORT = process.env.PORT || "5000";
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
