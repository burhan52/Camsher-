export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export class BroadcasterPeerManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onSignal: (targetId: string, signalData: any) => void;

  constructor(onSignal: (targetId: string, signalData: any) => void) {
    this.onSignal = onSignal;
  }

  setStream(stream: MediaStream) {
    this.localStream = stream;
    // Update tracks in existing peer connections
    for (const [, pc] of this.peers.entries()) {
      const senders = pc.getSenders();
      for (const track of stream.getTracks()) {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, stream);
          } catch {}
        }
      }
    }
  }

  async handleViewerJoined(viewerId: string) {
    if (!this.localStream) return;
    this.closePeer(viewerId);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peers.set(viewerId, pc);

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal(viewerId, {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(viewerId);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.onSignal(viewerId, {
        type: 'offer',
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.warn('Failed to create offer for viewer', viewerId, err);
    }
  }

  async handleSignal(fromId: string, signalData: any) {
    let pc = this.peers.get(fromId);
    if (!pc) {
      if (signalData.type === 'offer') {
        pc = new RTCPeerConnection(ICE_SERVERS);
        this.peers.set(fromId, pc);
        if (this.localStream) {
          for (const track of this.localStream.getTracks()) {
            pc.addTrack(track, this.localStream);
          }
        }
      } else {
        return;
      }
    }

    try {
      if (signalData.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      console.warn('Broadcaster signal processing error:', err);
    }
  }

  closePeer(viewerId: string) {
    const pc = this.peers.get(viewerId);
    if (pc) {
      pc.close();
      this.peers.delete(viewerId);
    }
  }

  destroy() {
    for (const [, pc] of this.peers.entries()) {
      pc.close();
    }
    this.peers.clear();
  }
}

export class ViewerPeerManager {
  private pc: RTCPeerConnection | null = null;
  private onRemoteStream: (stream: MediaStream) => void;
  private onSignal: (signalData: any) => void;

  constructor(
    onRemoteStream: (stream: MediaStream) => void,
    onSignal: (signalData: any) => void
  ) {
    this.onRemoteStream = onRemoteStream;
    this.onSignal = onSignal;
  }

  initPeer() {
    this.close();
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onRemoteStream(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        this.onRemoteStream(stream);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal({
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };
  }

  async handleSignal(signalData: any) {
    if (!this.pc) {
      this.initPeer();
    }
    const pc = this.pc!;

    try {
      if (signalData.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.onSignal({
          type: 'answer',
          sdp: pc.localDescription,
        });
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      console.warn('Viewer signal processing error:', err);
    }
  }

  close() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}
