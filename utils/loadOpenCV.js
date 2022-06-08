function loadOpenCV() {
  return new Promise((resolve) => {
    global.Module = {
      onRuntimeInitialized: resolve,
    };
    global.cv = require("./opencv.js");
  });
}

exports.loadOpenCV = loadOpenCV;
