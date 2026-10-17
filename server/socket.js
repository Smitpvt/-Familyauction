let ioInstance = null;

module.exports = {
  init: (io) => {
    ioInstance = io;
    return ioInstance;
  },
  getIO: () => {
    if (!ioInstance) {
      console.warn('Socket.io has not been initialized yet.');
    }
    return ioInstance;
  },
  emitEvent: (event, data) => {
    if (ioInstance) {
      ioInstance.emit(event, data);
    }
  }
};
