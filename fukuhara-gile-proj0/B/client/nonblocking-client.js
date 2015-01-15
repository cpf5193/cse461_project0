var datagram = require('dgram');

var timer = null;
var closing = false;
var TIMEOUT_DURATION = 5000;
var HEADER_SIZE = 12;
var sequenceNum = 0;
var alivesReceived = 0;
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
    if (closing) { process.exit(0); }
    timer = null;

    sendGoodbye();
    
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
    // ALIVE, cancel timer if it is in ready state with timer set
    if (timer != null && !closing) {
      timer = null;
    }
    alivesReceived++;
  } else {
    // Goodbye
    if (!closing) {
      // Received a GOODBYE in an unexpected state
      console.log("Server shut down. Closing connection.");
      process.exit(1);
    } else {
      console.log("Connection closed.");
      process.exit(0);
    }
  }
});

/////////////////////////////////////////////
// Register handler for user input
/////////////////////////////////////////////
process.stdin.on('data', function(dataPiece) {
  var input = dataPiece.toString().trim();
  if (input == "q") {
    sendGoodbye();
  }
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
      if (closing) { process.exit(0); }
      timer = null;
  
      sendGoodbye();
  
    }, 5000);
  }
});

process.stdin.on('end', function() {
  // Try to wait until all outgoing messages have been put on the network
  // We will wait at most 20 seconds
  var tries = 0;
  console.log("closing connection...");
  while(alivesReceived != sequenceNum && tries < 20) {
    setTimeout(function() {}, 1000);
  }
  console.log("eof");
  sendGoodbye();
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

function sendGoodbye() {
  // send a GOODBYE to the server
  var goodbyeHeader = makeHeaderString(3);
  clientSocket.send(goodbyeHeader, HEADER_SIZE, 0, serverPort, serverHost, function() {
    closing = true;
  });
}