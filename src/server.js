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

const rooms = {};
const userRooms = {};

io.on("connection", (client) => {
  client.on("createRoom", async (roomData) => {
    try {
      const decodedToken = await verifyIdToken(roomData.userIdToken);
      const nickname = await getUserNickname(decodedToken, client);
      if (!nickname) return;

      const roomId = generateRoomId();
      const newRoom = createRoom(
        roomId,
        roomData.roomName,
        nickname,
        roomData.isPrivate,
        roomData.password
      );

      rooms[roomId] = newRoom;
      userRooms[client.id] = roomId;
      newRoom.users.push({ id: client.id, nickname });

      client.emit("roomCreated", newRoom);
      console.log(
        `${newRoom.creator} created Room: ${newRoom.name} with ID: ${newRoom.id}`
      );
    } catch (error) {
      console.error("Error in createRoom:", error);
      client.emit("roomCreateError", {
        message: "An error occurred while creating the room.",
      });
    }
  });

  client.on("joinRoom", async (joinData) => {
    try {
      const room = rooms[joinData.roomId];
      if (!room) {
        client.emit("roomJoinError", { message: "Room not found." });
        return;
      }

      const decodedToken = await verifyIdToken(joinData.userIdToken);
      const nickname = await getUserNickname(decodedToken, client);
      if (!nickname) return;

      if (room.isPrivate && room.password !== joinData.password) {
        client.emit("roomJoinError", { message: "Incorrect password." });
        return;
      }

      if (room.users.length >= 6) {
        client.emit("roomJoinError", { message: "Room is full" });
        return;
      }

      client.join(joinData.roomId);
      userRooms[client.id] = joinData.roomId;
      room.users.push({ id: client.id, nickname });

      client.emit("roomJoined", room);
      client.broadcast.to(joinData.roomId).emit("userJoined", {
        message: `A user with id ${client.id} has joined the room.`,
      });

      if (room.users.length === 6) {
        io.to(joinData.roomId).emit("start-game", {
          roomId: joinData.roomId,
          message: "Game started",
        });
      }
    } catch (error) {
      console.error("Error in joinRoom:", error);
      client.emit("roomJoinError", {
        message: "An error occurred while joining the room.",
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
    const roomId = userRooms[client.id];
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (user) => user.id !== client.id
      );
      client.broadcast.to(roomId).emit("userLeft", {
        message: `A user with id ${client.id} has left the room.`,
      });
      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      }
    }
    delete userRooms[client.id];
  });
});

async function getUserNickname(decodedToken, client) {
  let nickname;
  if (decodedToken.email) {
    const user = await User.findOne({ email: decodedToken.email });
    if (user) {
      nickname = user.nickname;
    } else {
      client.emit("roomJoinError", { message: "User account not found" });
    }
  } else if (decodedToken.provider_id === "anonymous") {
    nickname = `Guest_${decodedToken.uid}`;
  } else {
    client.emit("roomJoinError", { message: "User account not found" });
  }
  return nickname;
}

function createRoom(id, name, creator, isPrivate, password) {
  return {
    id,
    name,
    creator,
    isPrivate,
    password,
    users: [],
    drawings: [],
  };
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}

app.use("/auth", auth);
app.use("/account", newuser);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
