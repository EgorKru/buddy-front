export class WebRTCPeer {
  constructor(chatId, onDataChannel, onError) {
    this.chatId = chatId;
    this.onDataChannel = onDataChannel;
    this.onError = onError;
    this.peerConnection = null;
    this.dataChannel = null;
    this.localEndpoint = null;
  }

  async createOffer() {
    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const match = candidate.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
          if (match) {
            this.localEndpoint = `${match[1]}:${match[2]}`;
          }
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection.iceConnectionState === 'failed') {
          if (this.onError) this.onError(new Error('ICE connection failed'));
        }
      };

      this.dataChannel = this.peerConnection.createDataChannel('voice', {
        ordered: true,
        maxRetransmits: 3,
      });

      this.dataChannel.onopen = () => {
        if (this.onDataChannel) this.onDataChannel(this.dataChannel);
      };

      this.dataChannel.onerror = (error) => {
        if (this.onError) this.onError(error);
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      return {
        sdp: offer.sdp,
        type: offer.type,
        localEndpoint: this.localEndpoint,
      };
    } catch (error) {
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  async createAnswer(offerSdp) {
    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const match = candidate.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
          if (match) {
            this.localEndpoint = `${match[1]}:${match[2]}`;
          }
        }
      };

      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        if (this.onDataChannel) this.onDataChannel(this.dataChannel);
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection.iceConnectionState === 'failed') {
          if (this.onError) this.onError(new Error('ICE connection failed'));
        }
      };

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp,
      }));

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      return {
        sdp: answer.sdp,
        type: answer.type,
        localEndpoint: this.localEndpoint,
      };
    } catch (error) {
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  async setRemoteAnswer(answerSdp) {
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      }));
    } catch (error) {
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  sendAudioData(audioData) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      if (audioData instanceof ArrayBuffer) {
        this.dataChannel.send(audioData);
      } else if (audioData instanceof Blob) {
        audioData.arrayBuffer().then((buffer) => {
          this.dataChannel.send(buffer);
        });
      }
    }
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

