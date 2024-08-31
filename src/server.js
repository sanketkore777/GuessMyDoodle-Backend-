const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectToDatabase = require("../lib/dbConnection.js");
const auth = require("./routes/isAccountExists.js");
const newuser = require("./routes/createUser.js");
const cors = require("cors");
const verifyIdToken = require("./services/firebase.js");
const User = require("./models/UserModel.js");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

connectToDatabase();

// createRoom
// roomCreateError
// roomCreated

const rooms = {};
const userRooms = {};

io.on("connection", (client) => {
  // creating room

  client.on("createRoom", async (roomData) => {
    try {
      const decodedToken = await verifyIdToken(roomData.userIdToken);
      let nickname;
      let userAuthkey = decodedToken.uid;
      if (
        decodedToken.email &&
        decodedToken.firebase.sign_in_provider === "google.com"
      ) {
        console.log("block 1");
        let email = decodedToken.email;
        const user = await User.find({ email });
        if (user.length) {
          nickname = user[0].nickname;
        } else {
          client.emit("roomCreateError", { message: "User account not found" });
          return;
        }
      } else if (decodedToken.firebase.sign_in_provider === "anonymous") {
        console.log("block 2");
        nickname = ` Guest_${decodedToken.uid}`;
      } else {
        client.emit("roomCreateError", { message: "User account not found" });
        return;
      }

      const roomId = generateRoomId();
      const newRoom = {
        id: roomId,
        name: roomData.roomName,
        creator: nickname,
        isPrivate: roomData.isPrivate,
        password: roomData.password,
        users: [],
        usersData: [],
        drawings: [],
      };
      newRoom[userAuthkey] = nickname;

      userRooms[client.id] = roomId;
      let creatorData = {
        nickname,
        score: 0,
        isTurnOver: false,
      };

      console.log(newRoom.users, "ROOM USERS --- ii", newRoom.usersData);
      if (!newRoom.users.includes(nickname)) {
        newRoom.users.push(nickname);
        newRoom.usersData.push(creatorData);
      }

      console.log(newRoom.users, "ROOM USERS --- ii", newRoom.usersData);
      rooms[roomId] = newRoom;
      // client.join(newRoom);
      console.log(rooms);
      client.emit("roomCreated", { id: newRoom.id });
    } catch (error) {
      console.error("Error", error);
      client.emit("roomCreateError", { message: "Something went wrong" });
    }
  });

  // Joining room

  client.on("joinRoom", async (joinData) => {
    const decodedToken = await verifyIdToken(joinData.userIdToken);
    let nickname;

    let userAuthkey = decodedToken.uid;
    if (
      decodedToken.email &&
      decodedToken.firebase.sign_in_provider === "google.com"
    ) {
      let email = decodedToken.email;
      const user = await User.find({ email });
      if (user.length) {
        nickname = user[0].nickname;
      } else {
        client.emit("roomJoinError", { message: "User account not found" });
        return;
      }
    } else if (decodedToken.firebase.sign_in_provider === "anonymous") {
      nickname = `Guest_${decodedToken.uid}`;
    } else {
      client.emit("roomJoinError", { message: "User account not found" });
      return;
    }

    const room = rooms[joinData.roomId];
    if (room) {
      if (room.isPrivate && room.password !== joinData.password) {
        client.emit("roomJoinError", { message: "Incorrect password." });
        return;
      } else if (room.users.length > 6) {
        client.emit("roomJoinError", { message: "Room is full" });
        return;
      }

      room[userAuthkey] = nickname;
      client.join(joinData.roomId);
      userRooms[client.id] = joinData.roomId;
      console.log(room.users, "ROOM USERS --- i", room.usersData);
      let creatorData = {
        nickname,
        score: 0,
        isTurnOver: false,
      };
      if (!room.users.includes(nickname)) {
        room.users.push(nickname);
        room.usersData.push(creatorData);
      }
      console.log(room.users, "ROOM USERS --- ii", room.usersData);
      client.emit("roomJoined", { roomId: room.id, userAuthkey });
      client.broadcast.to(joinData.roomId).emit("userJoined", {
        message: ` A user with id ${client.id} has joined the room`,
      });

      if (room.users.length === 2) {
        client.to(joinData.roomId).emit("start-game", {
          roomId: joinData.roomId,
          message: "Game started",
        });
      }
    } else {
      client.emit("roomJoinError", { message: "Room not found." });
    }
  });

  client.on("message", ({ roomId, message, userAuthkey }) => {
    console.log(message, "MESSAGE --- i");
    if (rooms[roomId][userAuthkey]) {
      client
        .to(roomId)
        .emit("recieve-message", {
          roomId,
          message,
          nickname: rooms[roomId][userAuthkey],
          timeStamp: Date.now(),
        });
    }
  });

  client.on("draw", ({ roomId, line }) => {
    const room = rooms[roomId];
    if (room) {
      if (line && Array.isArray(line.points)) {
        room.drawings.push(line);
        client.broadcast.to(roomId).emit("draw", { roomId, line });
      } else {
        console.error("Invalid line data:", line);
      }
    }
  });

  client.on("undo", ({ roomId, updatedLines }) => {
    const room = rooms[roomId];
    if (room) {
      room.drawings = updatedLines;
      client.broadcast.to(roomId).emit("undo", { roomId, updatedLines });
    }
  });

  client.on("redo", ({ roomId, updatedLines }) => {
    const room = rooms[roomId];
    if (room) {
      room.drawings = updatedLines;
      client.broadcast.to(roomId).emit("redo", { roomId, updatedLines });
    }
  });

  client.on("disconnect", () => {
    console.log("USER DISCONNECTED --- ", client.id);
    const roomId = userRooms[client.id];
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (userId) => userId !== client.id
      );
      client.broadcast.to(roomId).emit("userLeft", {
        message: `A user with id ${client.id} has left the room.`,
      });
    }
    delete userRooms[client.id];
  });
});

function generateRoomId() {
  return crypto.randomUUID();
}

app.use("/auth", auth);
app.use("/account", newuser);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
