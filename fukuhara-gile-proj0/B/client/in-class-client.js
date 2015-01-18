var dgram = require('dgram');
var util = require('util');

// holds currently active timeout timer, if any
var timer = null;

//------------------------------------------------------
// Set up datagram socket
//------------------------------------------------------

// Server's port is hardwired
var SERVER_PORT = 33333;

// Obtain server's host from command line arg
if ( process.argv.length != 3 ) {
    util.log("Usage: nodejs client server_name");
    process.exit(1);
}
var serverHost = process.argv[2];

// create a datagram (UDP) socket, IPv4
var clientSocket = dgram.createSocket('udp4');

//------------------------------------------------------
// Set up socket and stdin handlers
//------------------------------------------------------

// When a packet arrives on it, print what it contains
clientSocket.on('message', function(message,remote) {
    util.log(remote.address + ':' + remote.port +' - ' + message);
    if ( timer ) clearTimeout(timer);
    timer = null;
});

// When the user types something, send it to the server
process.stdin.on('data', function(chunk) {
    chunk = chunk.toString().trim();
    var message = new Buffer(chunk);
    clientSocket.send(message, 0, message.length, SERVER_PORT, serverHost, function(err, bytes) {
	if (err) throw err;
    });
    if ( timer == null ) 
	timer = setTimeout(function() { 
                          util.log("No response");
                          timer = null;
                       }, 5000);
});
    
// On stdin eof, done
process.stdin.on('end', function() { 
    util.log("eof");
    process.exit(0);
});