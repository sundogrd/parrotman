import Recorder from './core';

// // ++++++++++  -----------------  ++++++++++//
// // ++++++++++  Demo click events  ++++++++++//
// // ++++++++++  -----------------  ++++++++++//

// (function () {
//   $(document).ready(init);

//   function init() {
//     let parrotman = new Parrotman();

//     $('#start-recording').on('click', function () {
//       parrotman.startRecording();
//     });

//     $('#stop-recording').on('click', function () {
//       parrotman.stopRecording('wav', 'wavFile');
//     });
//   }
// })();

class Parrotman {
  mediaStream: MediaStream;
  rec: Recorder;
  constructor() {
    this.mediaStream = null;
    this.rec = null;
  }
  startRecording() {
    let audioContext = new AudioContext();
    this._record(audioContext);
  }
  stopRecording(format, filename, callback) {
    // stop the media stream -- mediaStream.stop() is deprecated since Chrome 45
    if (typeof(this.mediaStream.stop) === 'function') {
      this.mediaStream.stop();
    } else {
      this.mediaStream.getTracks()[0].stop();
    }
    // stop Recorder.js
    this.rec.stop();

    // export it to WAV or Uint8Array
    this.rec.exportWAV((e) => {
      this.clear();
      if (format === 'wav') {
        Recorder.forceDownload(e, '' + filename + '.wav');
      } else if (format === 'Uint8Array') {
        this._convertToArrayBuffer(e, function (e) {
          let newFile = new Uint8Array(e.target.result);
          callback(null, newFile);

        });
      }
    });
  }
  clear() {
    this.rec.clear();
    this.mediaStream = null;
  }

  _convertToArrayBuffer(file, callback) {
    let fileReader = new FileReader();
    fileReader.onloadend = callback;
    fileReader.readAsArrayBuffer(file);
  }
  _record (context) {
    // ask for permission and start recording
    console.log('1');
    navigator.getUserMedia({ audio: true }, (localMediaStream) => {
      this.mediaStream = localMediaStream;

      console.log('2');

            // create a stream source to pass to Recorder.js
      let mediaStreamSource = context.createMediaStreamSource(localMediaStream);

            // create new instance of Recorder.js using the mediaStreamSource
      this.rec = new Recorder(mediaStreamSource);

      this.rec.record();
    }, function (err) {
      console.log('Browser not supported : ' + err);
    });
  }
}

export default Parrotman;
