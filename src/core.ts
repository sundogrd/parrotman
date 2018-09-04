let WORKER_PATH = 'recorderWorker.js';

class Recorder {
  context: BaseAudioContext;
  node: ScriptProcessorNode;
  config: {
    [key: string]: any
  };
  bufferLen: number;
  numChannels: number;
  worker: Worker;
  recording: boolean;
  currCallback: any;

  static forceDownload(blob, filename) {
    console.log(blob);
    let url = window.URL.createObjectURL(blob);
    let link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'output.wav';
    let click = document.createEvent('Event');
    click.initEvent('click', true, true);
    link.dispatchEvent(click);
  }

  constructor(source: MediaStreamAudioSourceNode, cfg?) {
    const bufferLen = this.config.bufferLen || 4096;
    const numChannels = this.config.numChannels || 2;
    this.config = cfg || {};
    this.context = source.context;
    this.node = this.context.createScriptProcessor.call(this.context, bufferLen, numChannels, numChannels);
    this.worker = new Worker(this.config.workerPath || WORKER_PATH);
    this.worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate,
        numChannels: numChannels,
      },
    });
    let recording = false;
    let currCallback;
    this.node.onaudioprocess = (e) => {
      if (!recording) return;
      let buffer = [];
      for (let channel = 0; channel < numChannels; channel++) {
        buffer.push(e.inputBuffer.getChannelData(channel));
      }
      this.worker.postMessage({
        command: 'record',
        buffer: buffer,
      });
    };

    this.worker.onmessage = function (e) {
      let blob = e.data;
      currCallback(blob);
    };

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
    this.worker.postMessage({ command: 'clear' });
  }
  getBuffer(cb) {
    this.worker.postMessage({ command: 'getBuffer' });
  }
  exportWAV(cb, type?) {
    const currCallback = cb || this.config.callback;
    type = type || this.config.type || 'audio/wav';
    if (!currCallback) throw new Error('Callback not set');
    this.worker.postMessage({
      command: 'exportWAV',
      type: type,
    });
  }
}

export default Recorder;
