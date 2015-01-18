var dgram = require('dgram');
var util = require('util');

var serverPort = process.argv[2];
console.log("serverPort: " + serverPort);
var serverSocket = dgram.createSocket('udp4');

serverSocket.on('listening', function() {
    var address = serverSocket.address();
    util.log("UDP server listening on " + address.address + ":" + address.port);
});

serverSocket.on('message', function(message, remote) {
    util.log(remote.address + ':' + remote.port + ' - ' + message);
});

serverSocket.bind(serverPort);

process.stdin.on('data', function(data){});

process.stdin.on('end', function() {
    util.log('shutdown requested');
    process.exit(0);
});