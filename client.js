window.onload = () => {
  const socket = io();
  let username, roomId;
  let localStream, remoteStream, peerConnection;
  let callAccepted = false;
  let isCaller = false;

  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const messageArea = document.getElementById('messageArea');

  const localAudio = document.getElementById('localAudio');
  const remoteAudio = document.getElementById('remoteAudio');

  const body = document.body;
  let incomingCallDiv;

  function joinRoom() {
    username = document.getElementById('username').value.trim();
    roomId = document.getElementById('room').value.trim();

    if (!username || !roomId) {
      alert("Enter name and room!");
      return;
    }

    socket.emit('join-room', roomId, username);
    document.getElementById('chatSection').style.display = 'block';
    log(`[joinRoom] Joined room: ${roomId} as ${username}`);
  }

  socket.on('user-joined', (user) => {
    appendMessage(`${user} joined the chat.`, false);
    log(`[socket] User joined: ${user}`);
  });

  socket.on('user-left', (user) => {
    appendMessage(`${user} left the chat.`, false);
    dropCall();
    log(`[socket] User left: ${user}`);
  });

  messageForm.addEventListener('submit', e => {
    e.preventDefault();
    if (messageInput.value.trim()) {
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
    div.className = isSender ? 'message sender' : 'message receiver';
    div.textContent = msg;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  function startCall() {
    callAccepted = false;
    isCaller = true;

    socket.emit('incoming-call');
    log('[startCall] Sent incoming call request');
  }

  function showIncomingCallPopup() {
    if (incomingCallDiv) return;

    incomingCallDiv = document.createElement('div');
    incomingCallDiv.style = `
      position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
      background: white; padding: 20px; border: 2px solid #333; z-index: 1000;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      text-align: center;
    `;
    incomingCallDiv.innerHTML = `
      <p>Incoming call</p>
      <button id="acceptCallBtn">Accept</button>
      <button id="rejectCallBtn">Reject</button>
    `;
    body.appendChild(incomingCallDiv);

    document.getElementById('acceptCallBtn').onclick = () => {
      socket.emit('call-accepted');
      body.removeChild(incomingCallDiv);
      incomingCallDiv = null;
      callAccepted = true;
      isCaller = false;
      log('[showIncomingCallPopup] Call accepted');
      startWebRTC();
    };

    document.getElementById('rejectCallBtn').onclick = () => {
      socket.emit('call-rejected');
      body.removeChild(incomingCallDiv);
      incomingCallDiv = null;
      callAccepted = false;
      log('[showIncomingCallPopup] Call rejected');
    };
  }

  function startWebRTC() {
    log('[startWebRTC] Starting WebRTC connection...');
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      localStream = stream;
      localAudio.srcObject = stream;
      monitorAudioStream(localAudio, 'localAudioStatus');
      log('[startWebRTC] Media stream obtained');

      peerConnection = new RTCPeerConnection(servers);
      log('[startWebRTC] RTCPeerConnection created');

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
        log(`[startWebRTC] Added local track: ${track.kind}`);
      });

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate);
          log('[peerConnection] Sent ICE candidate');
        }
      };

      peerConnection.ontrack = event => {
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteAudio.srcObject = remoteStream;
          monitorAudioStream(remoteAudio, 'remoteAudioStatus');
          log('[peerConnection] Created remote media stream');
        }
        remoteStream.addTrack(event.track);
        log(`[peerConnection] Received remote track: ${event.track.kind}`);

        remoteAudio.play().catch(e => {
          console.warn('[peerConnection] Remote audio play error:', e);
        });
      };

      peerConnection.oniceconnectionstatechange = () => {
        log('[peerConnection] ICE connection state: ' + peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
          dropCall();
        }
      };

      if (isCaller) {
        return peerConnection.createOffer()
          .then(offer => peerConnection.setLocalDescription(offer))
          .then(() => {
            socket.emit('offer', peerConnection.localDescription);
            log('[call-accepted] Sent offer');
          })
          .catch(err => log('[call-accepted] Error creating or sending offer: ' + err));
      } else {
        return peerConnection.createAnswer()
          .then(answer => peerConnection.setLocalDescription(answer))
          .then(() => {
            socket.emit('answer', peerConnection.localDescription);
            log('[startWebRTC] Sent answer');
          })
          .catch(err => log('[startWebRTC] Error creating answer: ' + err));
      }
    }).catch(err => {
      log(`[startWebRTC] Error accessing audio devices: ${err.message}`);
      alert(`Error accessing audio devices: ${err.message}`);
    });
  }

  socket.on('incoming-call', () => {
    log('[socket] Incoming call received');
    showIncomingCallPopup();
  });

  socket.on('call-accepted', () => {
    callAccepted = true;
    log('[socket] Call accepted by other user');
    if (isCaller && !peerConnection) {
      startWebRTC();
    }
  });

  socket.on('call-rejected', () => {
    log('[socket] Call rejected by other user');
    alert('Call was rejected');
  });

  socket.on('offer', (offer) => {
    log('[socket] Offer received');
    if (!peerConnection) {
      startWebRTC().then(() => {
        return peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      });
    } else {
      peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => log('[offer] Set remote description (offer)'))
      .catch(err => log('[offer] Error setting remote description: ' + err));
  });

  socket.on('answer', (answer) => {
    log('[socket] Answer received');
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => log('[answer] Set remote description (answer)'))
      .catch(err => log('[answer] Error setting remote description: ' + err));
  });

  socket.on('ice-candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => log('[ice-candidate] Added ICE candidate'))
      .catch(err => log('[ice-candidate] Error adding ICE candidate: ' + err));
  });

  window.dropCall = () => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
      log("[dropCall] Call ended");

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        log("[dropCall] Local stream stopped");
      }

      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
        log("[dropCall] Remote stream stopped");
      }

      localAudio.srcObject = null;
      remoteAudio.srcObject = null;

      setAudioStatus('localAudioStatus', false);
      setAudioStatus('remoteAudioStatus', false);
    }
  };

  function log(msg) {
    console.log(`[LOG] ${msg}`);
  }

  function setAudioStatus(elementId, active) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.style.background = active ? 'limegreen' : 'red';
  }

  function monitorAudioStream(audioElement, statusElementId) {
    if (!audioElement) return;

    audioElement.onplay = () => {
      setAudioStatus(statusElementId, true);
      console.log(`[AudioStatus] ${audioElement.id} playing`);
    };

    audioElement.onpause = () => {
      setAudioStatus(statusElementId, false);
      console.log(`[AudioStatus] ${audioElement.id} paused`);
    };

    audioElement.onerror = (e) => {
      setAudioStatus(statusElementId, false);
      console.warn(`[AudioStatus] ${audioElement.id} error`, e);
    };

    if (!audioElement.paused) {
      setAudioStatus(statusElementId, true);
    }
  }

  window.joinRoom = joinRoom;
  window.startCall = startCall;
};
