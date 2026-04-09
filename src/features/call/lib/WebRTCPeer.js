/**
 * Базовый WebRTC peer для голосовых данных (data channel). FSD: features/call/lib
 */
import { ICE_SERVERS } from '@/shared/config/webrtc';

function checkWebRTCAvailable() {
  if (typeof window === 'undefined' || !window.RTCPeerConnection) {
    throw new Error('WebRTC not available');
  }
}

/**
 * Парсит localEndpoint из candidate (IP:port). Работает только для host-кандидатов;
 * для relay/srflx может не дать полезного значения — тогда localEndpoint остаётся null.
 * @param {string} candidateStr
 * @returns {string | null}
 */
function parseLocalEndpointFromCandidate(candidateStr) {
  const match = candidateStr.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export class WebRTCPeer {
  /**
   * @param {string} chatId
   * @param {((channel: RTCDataChannel) => void) | null} onDataChannel
   * @param {((error: Error) => void) | null} onError
   */
  constructor(chatId, onDataChannel, onError) {
    checkWebRTCAvailable();
    this.chatId = chatId;
    this.onDataChannel = onDataChannel ?? null;
    this.onError = onError ?? null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.localEndpoint = null;
    this.iceServers = ICE_SERVERS;
  }

  /**
   * @param {Error} error
   * @private
   */
  _handleError(error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('WebRTCPeer error:', error);
    }
    if (this.onError) this.onError(error);
  }

  /**
   * @returns {RTCPeerConnection}
   * @private
   */
  _initPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const parsed = parseLocalEndpointFromCandidate(event.candidate.candidate);
        if (parsed) this.localEndpoint = parsed;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        this._handleError(new Error('ICE connection failed'));
      }
    };

    return pc;
  }

  /**
   * Создаёт offer и инициализирует data channel для голоса.
   * @returns {Promise<{ sdp: string, type: string, localEndpoint: string | null }>}
   */
  async createOffer() {
    checkWebRTCAvailable();
    try {
      this.peerConnection = this._initPeerConnection();

      this.dataChannel = this.peerConnection.createDataChannel('voice', {
        ordered: true,
        maxRetransmits: 3,
      });
      this.dataChannel.onopen = () => {
        if (this.onDataChannel) this.onDataChannel(this.dataChannel);
      };
      this.dataChannel.onerror = (err) => this._handleError(err);

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      return {
        sdp: offer.sdp,
        type: offer.type,
        localEndpoint: this.localEndpoint,
      };
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  /**
   * Создаёт answer на переданный offer SDP.
   * @param {string} offerSdp
   * @returns {Promise<{ sdp: string, type: string, localEndpoint: string | null }>}
   */
  async createAnswer(offerSdp) {
    checkWebRTCAvailable();
    try {
      this.peerConnection = this._initPeerConnection();

      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        if (this.onDataChannel) this.onDataChannel(this.dataChannel);
      };

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: offerSdp })
      );

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      return {
        sdp: answer.sdp,
        type: answer.type,
        localEndpoint: this.localEndpoint,
      };
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  /**
   * Устанавливает удалённый answer. Вызывать после createOffer и получения answer от пира.
   * @param {string} answerSdp
   */
  async setRemoteAnswer(answerSdp) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized. Call createOffer first.');
    }
    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
      );
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }

  /**
   * Отправляет аудиоданные по data channel. RTCDataChannel.send() принимает Blob и ArrayBuffer.
   * @param {ArrayBuffer | Blob} audioData
   */
  sendAudioData(audioData) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(audioData);
    }
  }

  /** Закрывает data channel и peer connection. */
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
