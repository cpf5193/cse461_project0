var datagram = require('dgram');

var timer = null;
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
var buf = new Buffer(makeHeaderString(0));

//////////////////////////////////
// Send initial HELLO to server
//////////////////////////////////
clientSocket.send(buf, HEADER_SIZE, 0, serverPort, serverHost, function() {
  // Timeout if no response within TIMEOUT_DURATION milliseconds
  timer = setTimeout(function() {
    console.log("No response from " + serverHost);
    timer = null;

    // send a GOODBYE
    var goodbyeHeader = makeHeaderString(3);
    clientSocket.send(goodbyeHeader, HEADER_SIZE, 0, serverPort, serverHost, function() {
      closing = true;
    });
    
  }, TIMEOUT_DURATION);
});


// Look for messages from the server and delegate depending on type
clientSocket.on('message', function(message) {
  // If hello, cancel timer and transition to ready
  var msgType = message.substring(25, 33);
  var command = parseInt(msgType, 2);

  if (type == 0) {
    // HELLO, cancel timer and transition to ready
    timer = null;
  } else if (type == 2) {
    if (timer != null) {
      timer = null;
    }
  } else {
    if (!closing) {
      console.log("server shut down. Closing connection.");
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
});

/////////////////////////////////////////////
// Register handler for user input
/////////////////////////////////////////////
process.stdin.on('data', function(dataPiece) {
  var data = makeHeaderString(1) + dataPiece.toString().trim();
  var message = new Buffer(data);

  // Take the user input and send it to the server as DATA
  clientSocket.send(message, HEADER_SIZE, message.length, serverPort,
    serverHost, function(err, bytes) {
      sequenceNum++;
      if (err) throw err;
  });

  // If there is not already a timer set, set the timer
  if (timer == null) {
    timer = setTimeout(function() {
      console.log("No response to DATA from server");
      timer = null;
  
      // send a GOODBYE
      var goodbyeHeader = makeHeaderString(3);
      clientSocket.send(goodbyeHeader, HEADER_SIZE, 0, serverPort, serverHost, function() {
        closing = true;
      });
  
    }, 5000);
  }
});

process.stdin.on('end', function() {
  console.log("eof");
  // send a GOODBYE
  var goodbyeHeader = makeHeaderString(3);
  clientSocket.send(goodbyeHeader, HEADER_SIZE, 0, serverPort, serverHost, function() {
    closing = true;
  });
});

//////////////////////////////////////////
// Create a header based on the given type
////////////////////////////////////////// 
function makeHeaderString(requestType) {
  var magic = (50273).toString(2);
  var version = "00000001";
  var command;
  if (requestType == 0) {
    command = "00000000";
  } else if (requestType == 1) {
    command = "00000001";
  } else if (requestType == 2) {
    command = "00000010";
  } else {
    command = "00000011";
  }
  var binarySequence = sequenceNum.toString(2);
   for(var i=0; i<(32-binarySequence.length()); ++i){
    binarySequence = "0" + binarySequence;
  }
  return magic + version + command + binarySequence + sessionId;
}