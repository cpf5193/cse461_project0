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
var HEADER_SIZE = 12;
var alivesReceived = 0;
var sessionId = Math.floor((Math.random() * 2147483647)).toString(16);
var clientSocket = datagram.createSocket('udp4');

var MAGIC = 0xC461
var MAGIC_OFFSET = 0
var VERSION = 1
var VERSION_OFFSET = 2
var HELLO = 0
var DATA = 1
var ALIVE = 2
var GOODBYE = 3
var COMMAND_OFFSET = 3
var SEQUENCE_OFFSET = 4
var SESSION_OFFSET = 8
var MESSAGE_SIZE = 1024

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
var buf = makeHeaderString(HELLO);
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
  command = message.readUInt8(COMMAND_OFFSET);
  if (command == HELLO) {
    // HELLO, cancel timer and transition to ready
    clearTimeout(timer);
    timer = null;
  } else if (command == ALIVE) {
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
      console.log("Server closed session. Closing connection.");
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
  var data = makeHeaderString(DATA, input);
  //console.log(data);

  // Take the user input and send it to the server as DATA
  clientSocket.send(data, 0, data.length, serverPort,
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
      localAlives = alivesReceived;
    } else {
      clearInterval(interval);
      sendGoodbye();
    }
  }, 500);
});

//////////////////////////////////////////
// Create a header based on the given type
////////////////////////////////////////// 
function makeHeaderString(requestType, data) {
  var headerSize = (data == null) ? HEADER_SIZE : HEADER_SIZE + data.length;
  var buf = new Buffer(headerSize);
  buf.writeUInt16BE(MAGIC, MAGIC_OFFSET);
  buf.writeUInt8(VERSION, VERSION_OFFSET);
  buf.writeUInt8(requestType, COMMAND_OFFSET);
  buf.writeUInt32BE(sequenceNum, SEQUENCE_OFFSET);
  buf.writeUInt32BE(parseInt(sessionId,16), SESSION_OFFSET);
  if (data != null) {
    buf.write(data, HEADER_SIZE); 
  }
  return buf;
}

///////////////////////////////////
// Send a GOODBYE message to server
///////////////////////////////////
function sendGoodbye() {
  // send a GOODBYE to the server
  var goodbyeHeader = makeHeaderString(GOODBYE);
  clientSocket.send(goodbyeHeader, 0, HEADER_SIZE, serverPort,
    serverHost, function() {
      goodbyeTimer = setTimeout(function() {
	      closing = true;
        console.log("No GOODBYE response from server. Closing connection.");
        process.exit(0);
      }, TIMEOUT_DURATION);
  });
  closing = true;
}