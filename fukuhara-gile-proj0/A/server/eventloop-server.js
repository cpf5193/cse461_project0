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

//Import networkign libraries
var datagram = require('dgram');
var readline = require('readline');
var tty = require('tty');

//Header Constants
var DEBUG_LEVEL = 1
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
var TIMEOUT_DURATION = 20000;


var sessions = new Array();
var timers = new Array();
var remotes = new Array();
var mySequence = 0;

var portNum = process.argv[2];

var port = datagram.createSocket('udp4');
port.bind(portNum)

console.log("Waiting on port " + portNum + "...");

function debug(msg) {
	if(DEBUG_LEVEL > 0) {
		console.log("DEBUG::" + msg);
	}
}

process.stdin.on('readable', function() {
	var input = process.stdin.read();
	if(input !== null && input.toString().trim() === 'q') {
		endAll(0);
	}
});


process.stdin.on('end', function() {
	endAll(1);
});

function endAll(errno) {
	debug("endall()");
	debug(JSON.stringify(Object.keys(sessions)));
	Object.keys(remotes).forEach(function(i) {
  		debug("sendGoodbye(" + i + ")");
		debug(JSON.stringify(remotes[i]));
		sendGoodbye(i);
	});
	setTimeout(process.exit, 500);
}

function Message(m) {
	this.magicNum = m.readUInt16BE(MAGIC_OFFSET);
	this.version = m.readUInt8(VERSION_OFFSET);
	this.command = m.readUInt8(COMMAND_OFFSET);
	this.seq = m.readUInt32BE(SEQUENCE_OFFSET);
	this.id = m.readUInt32BE(SESSION_OFFSET);
	this.payload = m.slice(HEADER_SIZE);
}

function linePrefix(id, seq) {
	return "0x" + id.toString(16) + " [" + 
			seq + "] "
}

//////////////////////////////////
// Handle messages from the server
//////////////////////////////////
port.on('message', function(msg, rinfo) {
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

function processHello(id, seq, r) {
	debug("processHello(" + id + ", " + seq + ", " + JSON.stringify(r)
		+ ")");
	if(sessionExists(id)) {
		debug("Unexpected HELLO from " + id);
		quit(1);
	} else {
		startSession(id, r);
		console.log(linePrefix(id, seq) + "Session created");
	}
}

function getSessionSeq(id) {
	if(sessions[id] > -1) {
		return sessions[id];
	}
	else return undefined;
}

function resetTimer(id) {
	debug("resetTimer(" + id + ")");
	clearTimeout(timers[id]);
	timers[id] = setTimeout(function() {
		sendGoodbye(id);
	}, TIMEOUT_DURATION);
}

function startSession(id, r) {
	sessions[id] = 0;
	remotes[id] = r;
	sendHello(id)
	resetTimer(id);
}

function endSession(id) {
	delete sessions[id];
	delete remotes[id];
	clearTimeout(timers[id]);
	delete timers[id];
}

function sessionExists(id) {
	return getSessionSeq(id) !== undefined;
}

function processData(id, seq, payload) {
	debug("processData(" + id + " , " + seq + ", "+ payload + ")");
	if(!sessionExists(id)) {
		debug("Unepected DATA from " + id);
		quit(0);
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


function processGoodbye(id, seq) {
	debug("processGoodbye(" + id + ", " + seq + ")");
	if(!sessionExists(id)) {
		debug("Unexpected GOODBYE from " + id);
		quit(1);
	}
	sendGoodbye(id);
}

function sendGoodbye(id) {
	sendMessage(GOODBYE, id);
	endSession(id);
	console.log(goodbyePrefix(id), "Session closed");
	debug("Timers left: " + Object.keys(timers).length);
	debug("Sessions left: " + Object.keys(sessions).length);
	debug("remotes left: " + Object.keys(remotes).length);
}

function sendHello(id) {
	sendMessage(HELLO, id);
}

function sendAlive(id) {
	resetTimer(id);
	sessions[id]++;
	sendMessage(ALIVE, id);
}

function goodbyePrefix(id) {
	return "0x" + id.toString(16);
}

function linePrefix(id, seq) {
	return "0x" + id.toString(16) + " [" + seq + "] ";
}

function printLostPackets(id, start, end, payload) {
	debug("printLostPackets(" + id + ", " + start + 
		", " + end + ")");
	for(var i = start; i < end; i++) {
		console.log(linePrefix(id, i) + "Lost packet!");
	}
}

function quit(errno) {
	process.exit(errno);
}

function Header(command, id) {
	var header = new Buffer(HEADER_SIZE);
	header.writeUInt16BE(MAGIC, MAGIC_OFFSET);
	header.writeUInt8(VERSION, VERSION_OFFSET);
	header.writeUInt8(command, COMMAND_OFFSET);
	header.writeUInt32BE(mySequence, SEQUENCE_OFFSET);
	header.writeUInt32BE(id, SESSION_OFFSET);
	return header;
}

function sendMessage(command, id) {
	var head = Header(command, id);
	if(!sessionExists(id)) {
		quit(1)
	}
	debug("Sending: '" + JSON.stringify(new Message(head)) + "'");
	debug("to: " + JSON.stringify(remotes[id]));
	port.send(head, 0, HEADER_SIZE, remotes[id].port,
		remotes[id].address);
	mySequence++;
}
