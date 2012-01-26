
exports.green = function(msg) {
  return '\u001b[32m' + msg + '\u001b[0m';
}

exports.yellow = function(msg) {
  return '\u001b[33m' + msg + '\u001b[0m';
}

exports.red = function(msg) {
  return '\u001b[31m' + msg + '\u001b[0m';
}
