const socket = io();
let username, roomId;
let localStream, peerConnection;
let isCaller = false;
let iceCandidatesQueue = [];

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function log(...args) {
  console.log("[Client]", ...args);
}

function joinRoom() {
  username = document.getElementById('username').value.trim();
  roomId = document.getElementById('room').value.trim();

  if (!username || !roomId) {
    alert("Username and room ID are required");
    return;
  }

  log("Joining room:", roomId, "as:", username);
  socket.emit('join-room', roomId, username);
  document.getElementById('chatSection').classList.remove('hidden');
}

document.getElementById('joinBtn').addEventListener('click', joinRoom);

document.getElementById('sendBtn').addEventListener('click', () => {
  const msg = document.getElementById('messageInput').value.trim();
  if (msg) {
    socket.emit('send-message', msg);
    log("Sent message:", msg);
    document.getElementById('messageInput').value = '';
  }
});

document.getElementById('callBtn').addEventListener('click', startCall);

socket.on('receive-message', ({ message, username: from }) => {
  log(`Message from ${from}:`, message);
});

socket.on('user-joined', (user) => {
  log(`${user} joined the room.`);
});

socket.on('user-left', (user) => {
  log(`${user} left the room.`);
});

socket.on('room-full', () => {
  log("Room is full. Cannot join.");
});

function setupPeerConnection() {
  log("Creating RTCPeerConnection");
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      log("Sending ICE candidate:", event.candidate);
      socket.emit('ice-candidate', event.candidate);
    }
  };

  peerConnection.ontrack = event => {
    log("Received remote track");
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      log("Set remote video stream");
    }
  };

  peerConnection.onconnectionstatechange = () => {
    log("Peer connection state:", peerConnection.connectionState);
  };

  if (localStream) {
    log("Adding local stream tracks to peer connection");
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
}

function startCall() {
  isCaller = true;
  log("Starting call...");

  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    document.getElementById('localVideo').srcObject = stream;
    log("Got local media stream");

    setupPeerConnection();

    peerConnection.createOffer().then(offer => {
      log("Created offer:", offer);
      return peerConnection.setLocalDescription(offer);
    }).then(() => {
      log("Sending offer to peer");
      socket.emit('offer', peerConnection.localDescription);
    }).catch(err => {
      log("Error creating offer:", err);
    });
  }).catch(err => {
    log("Error accessing media devices:", err);
  });
}

socket.on('offer', (offer) => {
  log("Received offer:", offer);
  isCaller = false;

  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    document.getElementById('localVideo').srcObject = stream;
    log("Got local stream after offer");

    setupPeerConnection();

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
      log("Set remote description from offer");
      return peerConnection.createAnswer();
    }).then(answer => {
      log("Created answer:", answer);
      return peerConnection.setLocalDescription(answer);
    }).then(() => {
      log("Sending answer");
      socket.emit('answer', peerConnection.localDescription);
    });

    iceCandidatesQueue.forEach(candidate => {
      log("Adding queued ICE candidate:", candidate);
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    iceCandidatesQueue = [];
  }).catch(err => {
    log("Error getting stream for answer:", err);
  });
});

socket.on('answer', (answer) => {
  log("Received answer:", answer);
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
    .then(() => log("Set remote description from answer"))
    .catch(err => log("Failed to set remote desc:", err));
});

socket.on('ice-candidate', (candidate) => {
  log("Received ICE candidate:", candidate);
  const rtcCandidate = new RTCIceCandidate(candidate);

  if (peerConnection && peerConnection.remoteDescription?.type) {
    peerConnection.addIceCandidate(rtcCandidate)
      .then(() => log("Added ICE candidate"))
      .catch(err => log("Failed to add ICE candidate:", err));
  } else {
    log("Queueing ICE candidate (remote not ready)");
    iceCandidatesQueue.push(candidate);
  }
});
