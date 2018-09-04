import InlineWorker from './inline-worker';

function workerHelper(e) {
  let recLength = 0;
  let recBuffers = [];
  let sampleRate;
  let numChannels;

  this.onmessage = function(e) {
    switch (e.data.command) {
      case 'init':
        init(e.data.config);
        break;
      case 'record':
        record(e.data.buffer);
        break;
      case 'exportWAV':
        exportWAV(e.data.type);
        break;
      case 'getBuffer':
        getBuffer();
        break;
      case 'clear':
        clear();
        break;
    }
  };

  function init(config) {
    sampleRate = config.sampleRate;
    numChannels = config.numChannels;
    initBuffers();
  }

  function record(inputBuffer) {
    for (let channel = 0; channel < numChannels; channel++) {
      recBuffers[channel].push(inputBuffer[channel]);
    }
    recLength += inputBuffer[0].length;
  }

  function exportWAV(type) {
    let buffers = [];
    for (let channel = 0; channel < numChannels; channel++) {
      buffers.push(mergeBuffers(recBuffers[channel], recLength));
    }
    let interleaved;
    if (numChannels === 2) {
      interleaved = interleave(buffers[0], buffers[1]);
    } else {
      interleaved = buffers[0];
    }
    let dataview = encodeWAV(interleaved);
    let audioBlob = new Blob([dataview], { type: type });

    this.postMessage(audioBlob);
  }

  function getBuffer() {
    let buffers = [];
    for (let channel = 0; channel < numChannels; channel++) {
      buffers.push(mergeBuffers(recBuffers[channel], recLength));
    }
    this.postMessage(buffers);
  }

  function clear() {
    recLength = 0;
    recBuffers = [];
    initBuffers();
  }

  function initBuffers() {
    for (let channel = 0; channel < numChannels; channel++) {
      recBuffers[channel] = [];
    }
  }

  function mergeBuffers(recBuffers, recLength) {
    let result = new Float32Array(recLength);
    let offset = 0;
    for (let i = 0; i < recBuffers.length; i++) {
      result.set(recBuffers[i], offset);
      offset += recBuffers[i].length;
    }
    return result;
  }

  function interleave(inputL, inputR) {
    let length = inputL.length + inputR.length;
    let result = new Float32Array(length);

    let index = 0;
    let inputIndex = 0;

    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  function encodeWAV(samples) {
    let buffer = new ArrayBuffer(44 + samples.length * 2);
    let view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numChannels * 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
  }

}
class Recorder {
  context: AudioContext;
  node: ScriptProcessorNode;
  config: {
    [key: string]: any
  };
  bufferLen: number;
  numChannels: number;
  inlineWorker: InlineWorker;
  recording: boolean;
  currCallback: any;

  static forceDownload(blob, filename) {
    console.log(blob);
    let url = window.URL.createObjectURL(blob);
    let link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    link.click();
  }

  constructor(source: MediaStreamAudioSourceNode, cfg?) {
    this.config = cfg || {};
    const bufferLen = this.config.bufferLen || 4096;
    const numChannels = this.config.numChannels || 2;

    this.context = source.context as AudioContext;
    this.node = this.context.createScriptProcessor.call(this.context, bufferLen, numChannels, numChannels);
    this.inlineWorker = new InlineWorker(workerHelper);
    this.inlineWorker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: numChannels,
      },
    });
    this.recording = false;
    this.node.onaudioprocess = (e) => {
      if (!this.recording) return;
      let buffer = [];
      for (let channel = 0; channel < numChannels; channel++) {
        buffer.push(e.inputBuffer.getChannelData(channel));
      }
      this.inlineWorker.postMessage({
        command: 'record',
        buffer: buffer,
      });
    };

    this.inlineWorker.setMessageHandler((e) => {
      let blob = e.data;
      this.currCallback(blob);
    });

    source.connect(this.node);
    this.node.connect(this.context.destination);    // this should not be necessary
  }

  configure(cfg) {
    for (let prop in cfg) {
      if (cfg.hasOwnProperty(prop)) {
        this.config[prop] = cfg[prop];
      }
    }
  }

  record() {
    this.recording = true;
  }
  stop() {
    this.recording = false;
  }
  clear() {
    this.inlineWorker.postMessage({ command: 'clear' });
  }
  getBuffer(cb) {
    this.inlineWorker.postMessage({ command: 'getBuffer' });
  }
  exportWAV(cb, type?) {
    this.currCallback = cb || this.config.callback;
    type = type || this.config.type || 'audio/wav';
    if (!this.currCallback) throw new Error('Callback not set');
    this.inlineWorker.postMessage({
      command: 'exportWAV',
      type: type,
    });
  }
}

export default Recorder;
