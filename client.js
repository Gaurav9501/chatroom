const socket = io();

let username, roomId;
let localStream, remoteStream, peerConnection;
let isAudioCall = false;

const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');

function log(...args) {
  console.log('[LOG]', ...args);
}

function monitorAudioStream(audioEl, statusElId) {
  const statusEl = document.getElementById(statusElId);
  const check = () => {
    if (audioEl.srcObject && audioEl.srcObject.getAudioTracks().some(t => t.enabled)) {
      statusEl.textContent = '🟢';
    } else {
      statusEl.textContent = '🔴';
    }
  };
  setInterval(check, 1000);
}

function joinRoom() {
  username = document.getElementById('username').value;
  roomId = document.getElementById('roomId').value;
  if (!username || !roomId) return alert('Please enter both fields');
  socket.emit('join', { username, roomId });
  log(`[joinRoom] Joined room: ${roomId} as ${username}`);
}

function startCall() {
  if (!roomId) return alert('Join room first');
  isAudioCall = true;
  socket.emit('start-call', { roomId, from: username });
  log('[startCall] Sent incoming call request');
}

socket.on('user-joined', ({ username: otherUser }) => {
  log('[socket] User joined:', otherUser);
});

socket.on('incoming-call', ({ from }) => {
  log('[socket] Incoming call received from', from);
  if (confirm(`${from} is calling you. Accept?`)) {
    socket.emit('call-accepted', { roomId, from: username });
    startWebRTC(true);
    log('[incoming-call] Call accepted');
  } else {
    log('[incoming-call] Call rejected');
  }
});

socket.on('call-accepted', () => {
  log('[socket] Call accepted by other user');
  startWebRTC(false);
});

async function startWebRTC(isReceiver) {
  log('[startWebRTC] Starting WebRTC connection...');
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localAudio.srcObject = localStream;
  monitorAudioStream(localAudio, 'localAudioStatus');
  log('[startWebRTC] Media stream obtained');

  peerConnection = new RTCPeerConnection();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
    log(`[startWebRTC] Added local track: ${track.kind}`);
  });

  peerConnection.ontrack = event => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteAudio.srcObject = remoteStream;
      monitorAudioStream(remoteAudio, 'remoteAudioStatus');

      remoteAudio.play().catch(e => {
        console.warn('[peerConnection] Remote audio play error:', e);
      });

      log('[peerConnection] Created remote media stream');
    }

    remoteStream.addTrack(event.track);
    log(`[peerConnection] Received remote track: ${event.track.kind}`);
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate, roomId });
      log('[peerConnection] Sent ICE candidate');
    }
  };

  if (!isReceiver) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer, roomId });
    log('[startWebRTC] Sent offer');
  }
}

socket.on('offer', async ({ offer }) => {
  if (!peerConnection) return log('[offer] No peerConnection found');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { answer, roomId });
  log('[offer] Received offer and sent answer');
});

socket.on('answer', async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  log('[answer] Received answer and set remote description');
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    log('[ice-candidate] Added ICE candidate');
  } catch (e) {
    log('[ice-candidate] Error adding candidate', e);
  }
});
