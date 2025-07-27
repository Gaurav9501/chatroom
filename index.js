const express = require("express");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname)); // serve index.html and client.js

io.on("connection", (socket) => {
  console.log("[Server] New client connected:", socket.id);

  socket.on("join", ({ username, roomId }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;
    console.log(`[Server] ${username} joined room ${roomId}`);
  });

  socket.on("offer", ({ offer, roomId }) => {
    socket.to(roomId).emit("offer", { offer });
    console.log(`[Server] Offer sent to room ${roomId}`);
  });

  socket.on("answer", ({ answer, roomId }) => {
    socket.to(roomId).emit("answer", { answer });
    console.log(`[Server] Answer sent to room ${roomId}`);
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
    console.log(`[Server] ICE candidate sent to room ${roomId}`);
  });

  socket.on("chat", ({ roomId, message, sender }) => {
    socket.to(roomId).emit("chat", { message, sender });
    console.log(`[Server] Chat from ${sender}: ${message}`);
  });

  socket.on("disconnect", () => {
    console.log("[Server] Client disconnected:", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[Server] Server running at http://localhost:${PORT}`);
});
