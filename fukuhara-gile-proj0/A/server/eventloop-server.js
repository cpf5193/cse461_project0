/*
Chip Fukuhara and Jacob Gile
Zahorjan
CSE 461
Project 0

Simple echo server using non-blocking IO
*/

//Check for correct arguments
if (process.argv.length != 3) {
  console.log("Usage: ./server <port> (using script)");
  process.exit(1);
}

//Import networking libraries
var datagram = require('dgram');
var readline = require('readline');
var tty = require('tty');

//Header Constants
var DEBUG_LEVEL = 0
var MAGIC = 0xC461
var MAGIC_OFFSET = 0
var MAGIC_LENGTH = 2
var VERSION = 1
var VERSION_OFFSET = MAGIC_LENGTH
var VERSION_LENGTH = 1
var HELLO = 0
var DATA = 1
var ALIVE = 2
var GOODBYE = 3
var COMMAND_OFFSET = VERSION_OFFSET + VERSION_LENGTH
var COMMAND_LENGTH = 1;
var SEQUENCE_OFFSET = COMMAND_OFFSET + COMMAND_LENGTH
var SEQUENCE_LENGTH = 4
var SESSION_OFFSET = SEQUENCE_OFFSET + SEQUENCE_LENGTH
var SESSION_LENGTH = 4
var HEADER_SIZE = SESSION_OFFSET + SESSION_LENGTH
var MESSAGE_SIZE = 1024
var TIMEOUT_DURATION = 60000;

//Keep track of remote sessions information
var sessions = new Array();
var timers = new Array();
var remotes = new Array();

//Global flags for packet number and closing status
var mySequence = 0;
var closing = false;

//Bind a UDP port according to command line arguments
var portNum = process.argv[2];
var port = datagram.createSocket('udp4');
port.bind(portNum)
console.log("Waiting on port " + portNum + "...");

//Constructor for reading a Datagram
function Message(m) {
	this.magicNum = m.readUInt16BE(MAGIC_OFFSET);
	this.version = m.readUInt8(VERSION_OFFSET);
	this.command = m.readUInt8(COMMAND_OFFSET);
	this.seq = m.readUInt32BE(SEQUENCE_OFFSET);
	this.id = m.readUInt32BE(SESSION_OFFSET);
	this.payload = m.slice(HEADER_SIZE);
}

//Constructor for a packet header to be sent
function Header(command, id) {
	var header = new Buffer(HEADER_SIZE);
	header.writeUInt16BE(MAGIC, MAGIC_OFFSET);
	header.writeUInt8(VERSION, VERSION_OFFSET);
	header.writeUInt8(command, COMMAND_OFFSET);
	header.writeUInt32BE(mySequence, SEQUENCE_OFFSET);
	header.writeUInt32BE(id, SESSION_OFFSET);
	return header;
}

//Process client messages
port.on('message', function(msg, rinfo) {
	if(closing) {
		return;
	}
	if(msg.byteLength < HEADER_SIZE) {
		console.log("Received packet less than minmum header size");
		process.exit(1);
	}
		 
	var message = new Message(msg);
	
	if(message.magicNum != MAGIC || message.version != 1) {
		return;
	}
	
	switch(message.command) {
		case HELLO:
			processHello(message.id, message.seq, rinfo);
			break;
		case DATA:
			processData(message.id, message.seq, message.payload);
			break;
		case GOODBYE:
			processGoodbye(message.id, message.seq);
			break;
		default:
			endAll(1);
			break;
	}
});

//Process a HELLO by returning a HELLO. Terminate if HELLO
//is from an already-known session
function processHello(id, seq, r) {
	debug("processHello(" + id + ", " + seq + ", " + JSON.stringify(r)
		+ ")");
	if(sessionExists(id)) {
		debug("Unexpected HELLO from " + id);
		process.exit(1);
	} else {
		startSession(id, r);
		console.log(linePrefix(id, seq) + "Session created");
	}
}

//Process DATA from client by printing the packet payload
//Terminate if DATA is from an unfamiliar client
//Send and ALIVE back to the client and reset the timer
function processData(id, seq, payload) {
	debug("processData(" + id + " , " + seq + ", "+ payload + ")");
	if(!sessionExists(id)) {
		debug("Unepected DATA from " + id);
		process.exit(1);
	}
	else {
		var lastSeq = getSessionSeq(id);
		if (lastSeq > seq - 1) {
			console.log("Got " + seq + " expected " + (lastSeq + 1));
			sendGoodbye(id);
		} else {
			sendAlive(id);
			if (lastSeq < seq - 1) {
				printLostPackets(id, lastSeq, seq, payload);
			}
			console.log(linePrefix(id, seq) + payload);
			sessions[id] = seq;
		}
	}
}

//Process GOODBYE from client by sending a GOODBYE in return
//Terminate if GOODBYE is from an unfamiliar client
function processGoodbye(id, seq) {
	debug("processGoodbye(" + id + ", " + seq + ")");
	if(!sessionExists(id)) {
		debug("Unexpected GOODBYE from " + id);
		process.exit(1);
	}
	sendGoodbye(id);
}

//Sends message of type 'command' to client with session id 'id'
function sendMessage(command, id) {
	var head = Header(command, id);
	if(!sessionExists(id)) {
		process.exit(1)
	}
	debug("Sending: '" + JSON.stringify(new Message(head)) + "'");
	debug("to: " + JSON.stringify(remotes[id]));
	port.send(head, 0, HEADER_SIZE, remotes[id].port,
		remotes[id].address);
	mySequence++;
}

//Send GOODBYE to session with 'id' as its session id
//and terminate its session
function sendGoodbye(id) {
	sendMessage(GOODBYE, id);
	endSession(id);
	console.log(goodbyePrefix(id), "Session closed");
	debug("Timers left: " + Object.keys(timers).length);
	debug("Sessions left: " + Object.keys(sessions).length);
	debug("remotes left: " + Object.keys(remotes).length);
}

//Send HELLO to client with session id 'id'
function sendHello(id) {
	sendMessage(HELLO, id);
}

//Send ALIVE to client with session id 'id'
function sendAlive(id) {
	resetTimer(id);
	sessions[id]++;
	sendMessage(ALIVE, id);
}

//Start a session with session id 'id' and
//remote host address information 'r'
//Begin the timer for that session
function startSession(id, r) {
	sessions[id] = 0;
	remotes[id] = r;
	sendHello(id)
	resetTimer(id);
}

//Get the next expected packet sequence number for client with 
//session id 'id'
function getSessionSeq(id) {
	if(sessions[id] > -1) {
		return sessions[id];
	}
	else return undefined;
}

//True if session with session id 'id' exists, else false
function sessionExists(id) {
	return getSessionSeq(id) !== undefined;
}

//Terminates a session with session id 'id' and deletes associated
//host information
function endSession(id) {
	delete sessions[id];
	delete remotes[id];
	clearTimeout(timers[id]);
	delete timers[id];
}

//Resets the timer associated with session 'id'
function resetTimer(id) {
	debug("resetTimer(" + id + ")");
	clearTimeout(timers[id]);
	timers[id] = setTimeout(function() {
		sendGoodbye(id);
	}, TIMEOUT_DURATION);
}

//Print 'lost packet' message for each expected packet in the range
//[start, end)
function printLostPackets(id, start, end) {
	debug("printLostPackets(" + id + ", " + start + 
		", " + end + ")");
	for(var i = start; i < end; i++) {
		console.log(linePrefix(id, i) + "Lost packet!");
	}
}

//End all sessions and terminate
function endAll(errno) {
	debug("endall()");
	closing = true;
	debug(JSON.stringify(Object.keys(sessions)));
	var numSess = Object.keys(sessions).length
	if(numSess < 1) {
		process.exit(0);
	}
	for(var i = 0; i < numSess - 1; i++) {
		var id = Object.keys(sessions)[i];
  		debug("sendGoodbye(" + i + ")");
		sendGoodbye(id)
	}
	lastGoodbye(Object.keys(sessions)[numSess - 1]);
}


//Send a goodbye and terminate the server afterward
function lastGoodbye(id) {
	debug("Sending final goodbye to " + id);
	port.send(Header(GOODBYE, id), 0, HEADER_SIZE, remotes[id].port,
		remotes[id].address, process.exit);
}

//Terminate if end of file is read from user input
process.stdin.on('end', function() {
	endAll(1);
});

//Terminate if q is read from user input
process.stdin.on('readable', function() {
	var input = process.stdin.read();
	if(input !== null && input.toString().trim() === 'q') {
		endAll(0);
	}
});

//Prefix Goodbyes without a sequence number
function goodbyePrefix(id) {
	return "0x" + id.toString(16);
}

//Prefix output with session id and packet sequence number
function linePrefix(id, seq) {
	return "0x" + id.toString(16) + " [" + 
			seq + "] "
}

//Print diagnostic info if flag is set
function debug(msg) {
	if(DEBUG_LEVEL > 0) {
		console.log("DEBUG::" + msg);
	}
}
