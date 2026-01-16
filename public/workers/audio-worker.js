

self.addEventListener('message', async (event) => {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'ENCODE_AUDIO':
        await encodeAudio(payload, id);
        break;
      
      case 'DECODE_AUDIO':
        await decodeAudio(payload, id);
        break;
      
      case 'ANALYZE_AUDIO':
        await analyzeAudio(payload, id);
        break;
      
      case 'COMPRESS_AUDIO':
        await compressAudio(payload, id);
        break;
      
      default:
        postMessage({
          id,
          type: 'ERROR',
          error: `Unknown task type: ${type}`
        });
    }
  } catch (error) {
    postMessage({
      id,
      type: 'ERROR',
      error: error.message || 'Unknown error'
    });
  }
});

async function encodeAudio(payload, id) {
  const { audioBuffer, format = 'webm' } = payload;

  postMessage({
    id,
    type: 'ENCODE_COMPLETE',
    data: {
      encodedAudio: audioBuffer,
      format
    }
  });
}

async function decodeAudio(payload, id) {
  const { audioData } = payload;

  postMessage({
    id,
    type: 'DECODE_COMPLETE',
    data: {
      decodedAudio: audioData
    }
  });
}

async function analyzeAudio(payload, id) {
  const { audioBuffer } = payload;
  
  try {
    
    const channelData = audioBuffer.getChannelData ? audioBuffer.getChannelData(0) : new Float32Array(audioBuffer);
    
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);
    const level = Math.min(100, Math.floor(rms * 100));
    
    postMessage({
      id,
      type: 'ANALYZE_COMPLETE',
      data: {
        level,
        duration: audioBuffer.duration || 0,
        sampleRate: audioBuffer.sampleRate || 0
      }
    });
  } catch (error) {
    postMessage({
      id,
      type: 'ERROR',
      error: `Analysis failed: ${error.message}`
    });
  }
}

async function compressAudio(payload, id) {
  const { audioData, quality = 0.7 } = payload;

  postMessage({
    id,
    type: 'COMPRESS_COMPLETE',
    data: {
      compressedAudio: audioData,
      originalSize: audioData.byteLength || 0,
      compressedSize: audioData.byteLength || 0,
      compressionRatio: 1.0
    }
  });
}

postMessage({
  type: 'READY',
  message: 'Audio Worker initialized'
});

