document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  let username, roomId;
  let localStream, peerConnection;
  let isCaller = false;
  let iceCandidatesQueue = [];

  const servers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  };

  // DOM elements
  const joinBtn = document.getElementById("joinBtn");
  const callBtn = document.getElementById("callBtn");
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");
  const messageArea = document.getElementById("messageArea");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  function log(...args) {
    console.log("[Client]", ...args);
  }

  function showMessage(message, sender = 'you') {
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.textContent = message;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  joinBtn.addEventListener("click", () => {
    username = document.getElementById("username").value;
    roomId = document.getElementById("room").value;

    if (!username || !roomId) {
      alert("Username and Room ID are required");
      return;
    }

    socket.emit("join", { username, roomId });
    log("Joined room:", roomId);
  });

  callBtn.addEventListener("click", async () => {
    isCaller = true;
    await startLocalStream();
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    log("Sending offer:", offer);
    socket.emit("offer", { offer, roomId });
  });

  sendBtn.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (message) {
      socket.emit("chat", { roomId, message, sender: username });
      showMessage(message, "you");
      messageInput.value = "";
    }
  });

  socket.on("chat", ({ message, sender }) => {
    if (sender !== username) {
      showMessage(`${sender}: ${message}`, "other");
    }
  });

  socket.on("offer", async ({ offer }) => {
    log("Received offer:", offer);
    await startLocalStream();
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    log("Sending answer:", answer);
    socket.emit("answer", { answer, roomId });
  });

  socket.on("answer", async ({ answer }) => {
    log("Received answer:", answer);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    // Apply queued ICE candidates now
    iceCandidatesQueue.forEach(candidate => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e =>
        log("Error adding queued ICE candidate:", e)
      );
    });
    iceCandidatesQueue = [];
  });

  socket.on("ice-candidate", (candidate) => {
    log("Received ICE candidate:", candidate);
    if (peerConnection && peerConnection.remoteDescription?.type) {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e =>
        log("Error adding ICE candidate:", e)
      );
    } else {
      iceCandidatesQueue.push(candidate);
      log("ICE candidate queued");
    }
  });

  async function startLocalStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      log("Local stream started");
    } catch (e) {
      log("Error getting local media:", e);
    }
  }

  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        log("Sending ICE candidate:", event.candidate);
        socket.emit("ice-candidate", { candidate: event.candidate, roomId });
      }
    };

    peerConnection.ontrack = (event) => {
      log("Received remote track");
      remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onconnectionstatechange = () => {
      log("Peer connection state:", peerConnection.connectionState);
    };

    if (localStream) {
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      log("Tracks added to peer connection");
    }
  }
});
