document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  let username, roomId;
  let localStream, peerConnection;
  let iceCandidatesQueue = [];
  let isCallStarted = false;

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

  const joinBtn = document.getElementById("joinBtn");
  const startAudioCallBtn = document.getElementById("startAudioCallBtn");
  const startVideoCallBtn = document.getElementById("startVideoCallBtn");
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");
  const messageArea = document.getElementById("messageArea");

  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const localAudio = document.getElementById("localAudio");
  const remoteAudio = document.getElementById("remoteAudio");

  function log(...args) {
    console.log("[Client]", ...args);
  }

  function showMessage(message, sender = "you") {
    const div = document.createElement("div");
    if (sender === "info") {
      div.className = "info";
      div.textContent = message;
    } else {
      div.className = `message ${sender}`;
      div.textContent = message;
    }
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  joinBtn.addEventListener("click", () => {
    username = document.getElementById("username").value.trim();
    roomId = document.getElementById("room").value.trim();

    if (!username || !roomId) {
      alert("Username and Room ID are required");
      return;
    }

    socket.emit("join", { username, roomId });
    log("Joined room:", roomId);

    showMessage(`${username} joined the room`, "info");

    // Enable call buttons and send message button after joining
    startAudioCallBtn.disabled = false;
    startVideoCallBtn.disabled = false;
    sendBtn.disabled = false;
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

  socket.on("user-joined", (user) => {
    if (user !== username) {
      showMessage(`${user} joined the room`, "info");
    }
  });

  socket.on("user-left", (user) => {
    showMessage(`${user} left the room`, "info");
  });

  socket.on("offer", async ({ offer }) => {
    log("Received offer:", offer);
    if (!localStream) {
      await startLocalStream(currentCallType);
    }
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

    iceCandidatesQueue.forEach(candidate => {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
        log("Error adding queued ICE candidate:", e);
      });
    });
    iceCandidatesQueue = [];
  });

  socket.on("ice-candidate", (candidate) => {
    log("Received ICE candidate:", candidate);
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
        log("Error adding ICE candidate:", e);
      });
    } else {
      iceCandidatesQueue.push(candidate);
      log("Remote description not ready, ICE candidate queued");
    }
  });

  // --- Call buttons logic ---

  let currentCallType = null; // "audio" or "video"

  startAudioCallBtn.addEventListener("click", async () => {
    currentCallType = "audio";
    await startLocalStream("audio");
    startCall();
  });

  startVideoCallBtn.addEventListener("click", async () => {
    currentCallType = "video";
    await startLocalStream("video");
    startCall();
  });

  async function startLocalStream(type) {
    try {
      if (localStream) {
        // stop old tracks
        localStream.getTracks().forEach(track => track.stop());
      }
      let constraints;
      if (type === "audio") {
        constraints = { audio: true, video: false };
      } else if (type === "video") {
        constraints = { audio: true, video: true };
      } else {
        constraints = { audio: true, video: false };
      }
      localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (type === "audio") {
        localAudio.srcObject = localStream;
        localAudio.style.display = "inline-block";
        localVideo.style.display = "none";
      } else {
        localVideo.srcObject = localStream;
        localVideo.style.display = "inline-block";
        localAudio.style.display = "none";
      }

      log("Local stream started", type);
    } catch (e) {
      log("Error accessing media devices", e);
      alert("Could not access microphone/camera.");
    }
  }

  function createPeerConnection() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        log("Sending ICE candidate:", event.candidate);
        socket.emit("ice-candidate", { candidate: event.candidate, roomId });
      }
    };

    peerConnection.ontrack = (event) => {
      log("Received remote track");

      // Detect video or audio track
      const track = event.track;
      if (track.kind === "video") {
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.style.display = "inline-block";
        remoteAudio.style.display = "none";
      } else if (track.kind === "audio") {
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.style.display = "inline-block";
        remoteVideo.style.display = "none";
      }
    };

    peerConnection.onconnectionstatechange = () => {
      log("Peer connection state:", peerConnection.connectionState);
    };

    if (localStream) {
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      log("Tracks added to peer connection");
    }
  }

  async function startCall() {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    log("Sending offer:", offer);
    socket.emit("offer", { offer, roomId });
  }

  // Handle leaving
  window.addEventListener("beforeunload", () => {
    socket.emit("leave", { username, roomId });
  });

  socket.on("connect", () => {
    log("Connected to signaling server");
  });
});
