class Logger {
  constructor(isDev = false) {
    this.isDev = isDev;
  }

  info(message) {
    console.log(message);
  }

  error(message, error = null) {
    console.error(message);
    if (this.isDev && error) {
      console.error(error);
    }
  }

  success(message) {
    console.log(`✓ ${message}`);
  }
}

module.exports = Logger;
