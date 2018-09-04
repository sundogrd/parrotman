let WORKER_ENABLED = !!((global as any) === (global as any).window && (global as any).URL && (global as any).Blob && (global as any).Worker);

class InlineWorker {
  worker: Worker;
  handler: (this: Worker, ev: MessageEvent) => any;
  constructor (func) {
    let functionBody;
    this.handler = () => {
      return;
    };

    if (WORKER_ENABLED) {
      functionBody = func.toString().trim().match(
        /^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/
      )[1];

      this.worker = new (global as any).Worker((global as any).URL.createObjectURL(
        new (global as any).Blob([ functionBody ], { type: 'text/javascript' })
      ));
      this.worker.onmessage = this.handler.bind(this.worker);
    }

    // setTimeout(func.bind(this.worker), 0);
  }
  postMessage(data) {
    const self = this;
    setTimeout(() => {
      self.worker.postMessage(data);
    }, 0);
  }
  setMessageHandler(func) {
    this.handler = func;
    this.worker.onmessage = this.handler.bind(this.worker);
  }
}

export default InlineWorker;
