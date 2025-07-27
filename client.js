// client.js
const socket = io();
let username, roomId;
let localStream, remoteStream, peerConnection;
let isCaller = false;

const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messageArea = document.getElementById('messageArea');
const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');
const localStatus = document.getElementById('localStatus');
const remoteStatus = document.getElementById('remoteStatus');

function joinRoom() {
  username = document.getElementById('username').value;
  roomId = document.getElementById('room').value;
  socket.emit('join-room', roomId, username);
  console.log(`[joinRoom] Joined room: ${roomId} as ${username}`);
  document.getElementById('login').style.display = 'none';
  document.getElementById('chatSection').style.display = 'block';
}

messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const msg = messageInput.value;
  appendMessage(msg, 'sender');
  socket.emit('send-message', msg);
  messageInput.value = '';
});

function appendMessage(message, type) {
  const div = document.createElement('div');
  div.classList.add('message', type);
  div.innerText = message;
  messageArea.appendChild(div);
  messageArea.scrollTop = messageArea.scrollHeight;
}

function startCall() {
  isCaller = true;
  socket.emit('incoming-call');
  console.log('[startCall] Sent incoming call request');
}

function showIncomingCallPopup() {
  console.log('[showIncomingCallPopup] Displayed incoming call popup');
  const accept = confirm("Incoming call. Accept?");
  if (accept) {
    socket.emit('call-accepted');
    console.log('[showIncomingCallPopup] Call accepted');
    isCaller = false;
    startWebRTC();
  } else {
    socket.emit('call-rejected');
    console.log('[showIncomingCallPopup] Call rejected');
  }
}

function updateDotStatus(dot, stream) {
  const hasAudio = stream && stream.getAudioTracks().length > 0;
  dot.classList.remove('green', 'red');
  dot.classList.add(hasAudio ? 'green' : 'red');
}

function startWebRTC() {
  console.log('[startWebRTC] Starting WebRTC connection...');
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream;
    updateDotStatus(localStatus, localStream);
    localAudio.srcObject = localStream;
    console.log('[startWebRTC] Media stream obtained');

    peerConnection = new RTCPeerConnection();
    console.log('[startWebRTC] RTCPeerConnection created');

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
      console.log('[startWebRTC] Added local track:', track.kind);
    });

    peerConnection.ontrack = event => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteAudio.srcObject = remoteStream;
      }
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
        console.log('[peerConnection] Added remote track:', track.kind);
        updateDotStatus(remoteStatus, remoteStream);
      });
    };

    peerConnection.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('ice-candidate', e.candidate);
        console.log('[peerConnection] Sent ICE candidate');
      }
    };

    if (isCaller) {
      peerConnection.createOffer().then(offer => {
        return peerConnection.setLocalDescription(offer);
      }).then(() => {
        socket.emit('offer', peerConnection.localDescription);
        console.log('[call-accepted] Sent offer');
      });
    }
  });
}

function dropCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  remoteStream = null;
  localAudio.srcObject = null;
  remoteAudio.srcObject = null;
  updateDotStatus(localStatus, null);
  updateDotStatus(remoteStatus, null);
  console.log('[dropCall] Call ended');
}

socket.on('user-joined', user => {
  console.log('[socket] User joined:', user);
});

socket.on('receive-message', ({ message, username }) => {
  appendMessage(`${username}: ${message}`, 'receiver');
});

socket.on('incoming-call', () => {
  console.log('[socket] Incoming call received');
  showIncomingCallPopup();
});

socket.on('call-accepted', () => {
  console.log('[socket] Call accepted by other user');
  startWebRTC();
});

socket.on('offer', offer => {
  if (!peerConnection) startWebRTC();
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
    return peerConnection.createAnswer();
  }).then(answer => {
    return peerConnection.setLocalDescription(answer);
  }).then(() => {
    socket.emit('answer', peerConnection.localDescription);
    console.log('[offer] Sent answer');
  });
});

socket.on('answer', answer => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  console.log('[answer] Set remote description');
});

socket.on('ice-candidate', candidate => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  console.log('[ice-candidate] Added remote candidate');
});
