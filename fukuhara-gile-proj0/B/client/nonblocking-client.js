var datagram = require('dgram');
var timer = null;
var ready = false;
var closing = false;
var TIMEOUT_DURATION = 5000;
var HEADER_SIZE = 12;
var sequenceNum = 0;
var sessionId = Math.floor((Math.random() * 2147483647)).toString(2);

// Get the host and port number from the command line arguments
if (process.argv.length != 4) {
  console.log("Usage: nodejs client <server> <port>");
  process.exit(1);
}

var serverHost = process.argv[2];
var serverPort = process.argv[3];

var clientSocket = datagram.createSocket('udp4');

// Create HELLO header


// Send initial HELLO
clientSocket.send(buf, HEADER_SIZE, 0, serverPort, serverHost, function() {
  // Timeout if no response within TIMEOUT_DURATION milliseconds
  timer = setTimeout(function() {
    console.log("No response from " + serverHost);
    timer = null;
  }, TIMEOUT_DURATION);
});

// Look for messages from the server and delegate depending on type
clientSocket.on('message', function(message) {
  // If hello, cancel timer and transition to ready

  // If alive, check timer

  // If Goodbye, close
});

process.stdin.on('data', function(dataPiece) {
  var magic = (50273).toString(2);
  var version = "00000001";
  var command = "00000001";
  var binarySequence = sequenceNum.toString(2);
  for(var i=0; i<(32-binarySequence.length()); ++i){
    binarySequence = "0" + binarySequence;
  }
  var header = magic + version + command + binarySequence + sessionId;
  var data = header + dataPiece.toString().trim();
  var message = new Buffer(data);
  clientSocket.send(message, HEADER_SIZE, message.length, serverPort,
    serverHost, function(err, bytes) {
      if (err) throw err;
    });
    if (timer == null) {
      timer = setTimeout(function() {
        console.log("No response to DATA from server");
        timer = null;
      }, 5000);
    }
});