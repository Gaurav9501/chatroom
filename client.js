// client.js

const socket = io();
let username, roomId;
let localStream, remoteStream, peerConnection;
let isAudioCall = false;

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messageArea = document.getElementById('messageArea');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

function joinRoom() {
  username = document.getElementById('username').value;
  roomId = document.getElementById('room').value;

  if (!username || !roomId) return alert("Enter name and room!");

  socket.emit('join-room', roomId, username);
  document.getElementById('chatSection').classList.remove('hidden');
  log(`Joined room: ${roomId} as ${username}`);
}

socket.on('user-joined', (user) => {
  appendMessage(`${user} joined the chat.`, false);
});

socket.on('user-left', (user) => {
  appendMessage(`${user} left the chat.`, false);
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (messageInput.value) {
    socket.emit('send-message', messageInput.value);
    appendMessage(`You: ${messageInput.value}`, true);
    messageInput.value = '';
  }
});

socket.on('receive-message', ({ message, username: from }) => {
  appendMessage(`${from}: ${message}`, false);
});

function appendMessage(msg, isSender) {
  const div = document.createElement('div');
  div.className = `message ${isSender ? 'sender' : 'receiver'}`;
  div.textContent = msg;
  messageArea.appendChild(div);
  messageArea.scrollTop = messageArea.scrollHeight;
}

const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function startCall(videoEnabled = true) {
  isAudioCall = !videoEnabled;
  navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    peerConnection = new RTCPeerConnection(servers);

    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
        log('Sent ICE candidate');
      }
    };

    peerConnection.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
      }
      remoteStream.addTrack(event.track);
      log('Received remote track');
    };

    peerConnection.onconnectionstatechange = () => {
      log(`[Client] Peer connection state: ${peerConnection.connectionState}`);
    };

    peerConnection.createOffer().then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer);
      log('Sent offer');
    });
  }).catch(error => {
    log(`Error accessing media devices: ${error.message}`);
  });
}

socket.on('offer', (offer) => {
  navigator.mediaDevices.getUserMedia({ video: !isAudioCall, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    peerConnection = new RTCPeerConnection(servers);

    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
      log('Received offer and set remote description');
      return peerConnection.createAnswer();
    }).then(answer => {
      peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer);
      log('Sent answer');
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
        log('Sent ICE candidate');
      }
    };

    peerConnection.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
      }
      remoteStream.addTrack(event.track);
      log('Received remote track');
    };

    peerConnection.onconnectionstatechange = () => {
      log(`[Client] Peer connection state: ${peerConnection.connectionState}`);
    };
  }).catch(error => {
    log(`Error accessing media devices: ${error.message}`);
  });
});

socket.on('answer', (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  log('Received answer');
});

socket.on('ice-candidate', (candidate) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  log('Received ICE candidate');
});

function dropCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    log("Call ended");

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      remoteStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
  }
}

function log(msg) {
  console.log(`[LOG] ${msg}`);
}
