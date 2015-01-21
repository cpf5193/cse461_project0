///////////////////////////////////////
// Require statements
///////////////////////////////////////
var datagram = require('dgram');
var readline = require('readline');
var tty = require('tty');

///////////////////////////////////////
// Global variables
///////////////////////////////////////
var timer = null;
var goodbyeTimer = null
var closing = false;
var TIMEOUT_DURATION = 10000;
var sequenceNum = 0;
var HEADER_SIZE = 96;
var alivesReceived = 0;
var sessionId = Math.floor((Math.random() * 2147483647)).toString(2);
var paddingLength = 32 - sessionId.length;
for(var i=0; i<paddingLength; ++i) { sessionId = "0" + sessionId; }
var clientSocket = datagram.createSocket('udp4');

///////////////////////////////////////
// Process command line arguments
///////////////////////////////////////
if (process.argv.length != 4) {
  console.log("Usage: ./client <server> <port> (using script)");
  process.exit(1);
}
var serverHost = process.argv[2];
var serverPort = process.argv[3];

//////////////////////////////////
// Send initial HELLO to server
//////////////////////////////////
var buf = new Buffer(makeHeaderString(0));
clientSocket.send(buf, 0, HEADER_SIZE, serverPort, serverHost, function() {
  // Timeout if no response within TIMEOUT_DURATION milliseconds
  timer = setTimeout(function() {
    console.log("No HELLO response from " + serverHost);
    if (closing) { process.exit(0); }
    clearTimeout(timer);
    timer = null;
    
    sendGoodbye();
    
  }, TIMEOUT_DURATION);
});
sequenceNum++;

//////////////////////////////////
// Handle messages from the server
//////////////////////////////////
clientSocket.on('message', function(message) {
  var msg = message.toString();
  // If hello, cancel timer and transition to ready
  var msgType = msg.substring(24, 32);
  var command = parseInt(msgType, 2); 
  if (command == 0) {
    // HELLO, cancel timer and transition to ready
    clearTimeout(timer);
    timer = null;
  } else if (command == 2) {
    //console.log("received ALIVE");
    if (goodbyeTimer != null) {
      clearTimeout(goodbyeTimer);
      goodbyeTimer = null;
    }
    // ALIVE, cancel timer if it is in ready state with timer set
    if (timer != null && !closing) {
      //console.log("clearing timeout")
      clearTimeout(timer);
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
      //console.log("Connection closed.");
      process.exit(0);
    }
  }
});

/////////////////////////////////////////////
// Register handler for user input
/////////////////////////////////////////////
var reader = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

reader.on('line', function(line) {
  var input = line.toString().trim();
  if (input == "q") {
    sendGoodbye();
    return;
  }
  var data = makeHeaderString(1) + input;
  //console.log(data);
  var message = new Buffer(data);

  // Take the user input and send it to the server as DATA
  clientSocket.send(message, 0, message.length, serverPort,
    serverHost, function(err, bytes) {
      if (err) throw err;
  });
  sequenceNum++;

  // If there is not already a timer set, set the timer
  if (timer == null) {
    timer = setTimeout(function() {
      if (timer != null) {
	if (closing) { process.exit(0); }
        console.log("No response to DATA from server: " + timer);
	
	clearTimeout(timer);
	timer = null;
	  
	sendGoodbye();
      }
    }, TIMEOUT_DURATION);
  }
});


//////////////////////////////////
// Handle eof and user cancelling
//////////////////////////////////
var haveTTY = tty.isatty(process.stdin);

process.stdin.on('end', function() {
  console.log('eof');
  var localAlives = 0;
  // While ALIVEs are still being received, keep waiting to end
  var interval = setInterval(function() {
    if (localAlives != alivesReceived) {
      /*console.log("waiting to end");
      console.log("localAlives: " + localAlives);
      console.log("alivesReceived: " + alivesReceived);*/
      localAlives = alivesReceived;
    } else {
      clearInterval(interval);
      /*console.log("localAlives: " + localAlives);
      console.log("alivesReceived: " + alivesReceived);
      console.log("done waiting. sending goodbye.");*/
      sendGoodbye();
    }
  }, 500);
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
  var lengthLeft = 32 - binarySequence.length;
  for(var i=0; i<lengthLeft; ++i){
    binarySequence = "0" + binarySequence;
  }
  //console.log("binarySequence: " + binarySequence);
  //console.log("sessionId: " + sessionId);
  //console.log("sessionId length: " + sessionId.length);
  return magic + version + command + binarySequence + sessionId;
}

///////////////////////////////////
// Send a GOODBYE message to server
///////////////////////////////////
function sendGoodbye() {
  // send a GOODBYE to the server
  var goodbyeHeader = makeHeaderString(3);
  clientSocket.send(new Buffer(goodbyeHeader), 0, HEADER_SIZE, serverPort,
    serverHost, function() {
      goodbyeTimer = setTimeout(function() {
	closing = true;
        console.log("No GOODBYE response from server. Closing connection.");
        process.exit(0);
      }, 5000);
  });
  closing = true;
}