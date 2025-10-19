// Logger utility for Moneo extension

const Logger = {
  prefix: 'Moneo:',
  
  log(...args) {
    console.log(this.prefix, ...args);
  },
  
  info(...args) {
    console.info(this.prefix, ...args);
  },
  
  warn(...args) {
    console.warn(this.prefix, ...args);
  },
  
  error(...args) {
    console.error(this.prefix, ...args);
  },
  
  debug(...args) {
    if (this.isDebugMode()) {
      console.debug(this.prefix, ...args);
    }
  },
  
  isDebugMode() {
    return localStorage.getItem('moneo_debug') === 'true';
  },
  
  group(label) {
    console.group(this.prefix, label);
  },
  
  groupEnd() {
    console.groupEnd();
  },
  
  time(label) {
    console.time(this.prefix + ' ' + label);
  },
  
  timeEnd(label) {
    console.timeEnd(this.prefix + ' ' + label);
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}

