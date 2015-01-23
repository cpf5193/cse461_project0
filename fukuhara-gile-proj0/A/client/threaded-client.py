# Chip Fukuhara and Jacob Gile
# Zahorjan
# CSE 461
# Project 0

# Simple client using threads
import sys, socket, threading, os, fileinput
from struct import pack, unpack
from collections import namedtuple
from binascii import hexlify
from random import randint

#Header and Packet constants
DEBUG_LEVEL = 1
MAGIC = 0xC461
VERSION = 1
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3
HEADER_FORMAT = '!HbbII'
HEADER_SIZE = 12
MESSAGE_SIZE = 1024
MAX_ID = 0xFFFFFFFF
MIN_ID = 0x00000000
TIMEOUT = 10.0

#Sequence increments with each packet sent
sequence = 0;
#Session id uniquely identifies this client instance
sessionId = randint(MIN_ID, MAX_ID);
#Allow for manual exit if connected by tty
tty = sys.stdin.isatty()
#UDP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
#Global flag to indicate the client will stop reading input
closing = False

#Increments the sequence number of the next packet
def incrementSequence():
	global sequence
	sequence += 1

#Close the session 
def endSession():
	debug("endSession()");
	if(not closing):
		sendGoodbye()
	os._exit(0);

#Wait for the close timeout, and then close the session
#The close timeout resets for each ALIVE message received
def waitAndClose():
	debug("waitAndClose()")
	timer.cancel()
	global closing
	closing = True
	sendGoodbye()
	closeTimer = threading.Timer(TIMEOUT, endSession)
	closeTimer.start()
	while True:
		msg = receiveMessage()
		if(msg is ALIVE):
			debug("\n  Got ALIVE after EOF")
			closeTimer.cancel()
			closeTimer = threading.Timer(TIMEOUT, endSession)
			closeTimer.start()
		if(msg is GOODBYE):
			endSession()

#Set a global timer to transition to the closing state after
#TIMEOUT seconds
timer = threading.Timer(TIMEOUT, waitAndClose)

#Restart the global timeout
def restartTimer():
	global timer
	debug("restartTimer()");
	timer.cancel()
	timer = threading.Timer(TIMEOUT, waitAndClose)
	timer.start()

#Create a header with the magic number,
#version number command id, sequence number, and 
#session id
def header(cmd, seq, id):
	return pack(HEADER_FORMAT, MAGIC, VERSION, cmd , seq, id);

#Print diagnostic information if global flag is set
def debug(message):
	if(DEBUG_LEVEL > 0):
		print("DEBUG::" + str(message))
		
#Ensure that a received message has correct header format
def validateHeader(msg):
	(magic, version, cmd, seq, id) = unpack(HEADER_FORMAT, msg)
	debug(msg)
	if(magic != MAGIC or version != VERSION or id != sessionId):
		return -1
	return cmd

##Receive a message from the remote server
def receiveMessage():
	debug("receiveMessage()")
	msg = sock.recv(HEADER_SIZE)
	debug("Message length: " +  str(len(msg)))
	cmd = validateHeader(msg)
	debug("cmd = " + str(cmd))
	if(len(msg) != HEADER_SIZE or cmd < 0):
		debug("Improperly formatted header")
		endSession();
	return cmd

#Connect to a remote server and listen for ALIVE messages,
#end the session if a GOODBYE is heard
def main():
	#Set up the port
	host = sys.argv[1]
	port = int(sys.argv[2])
	sock.connect((host, port));
	
	debug("Connected to " + host + " " + str(port));

	#Use different input thread if input comes from tty
	if(tty):
		stdinThread = threading.Thread(target=readStdin, args=())
		stdinThread.start()

	#Send and wait for a HELLO from the server
	try:
		sendHello()
	except socket.error:
		endSession()

	#Use different input thread if input comes from piped file
	if(not tty):
		fileThread = threading.Thread(target=readFile, args=())
		fileThread.start()
		
	debug("Speaking to %s:%d" % (host, port))
	debug("Example header: %s" % hexlify(header(1, 2, MAX_ID)));		
	
	#Listen for ALIVE messages to reset the timer,
	#and transition to closing state if GOODBYE is found
	global closing
	try:
		while True and not closing:
			msg = receiveMessage();
			if(msg is ALIVE):
				debug("Cancelling timer")
				timer.cancel()
				debug(timer.isAlive())
			else:
				debug("GOODBYE from server")
				closing = True
				endSession()
	except KeyboardInterrupt:
		debug("KeyboardInterrupt\n")
		endSession()
	except socket.error:
		debug("Connection refused")
		endSession()

#Prepend a header to a string payload for a particular
#command, sequence number, and session id
def prependHeader(cmd, seq, id, message):
	return "%s%s" % (header(cmd, seq, id), message)

#Send a datagram to the remote server and increment
#the packet sequencenumber
def sendData(payload):
	debug("sending: [" + str(sequence) + "] " + payload);
	sock.send(prependHeader(DATA, sequence, sessionId, payload));
	incrementSequence()

#send HELLO to ther server, and end the session
#if a HELLO is not returned within TIMEOUT seconds
def sendHello():
	sock.send(header(HELLO, sequence, sessionId));
	restartTimer();
	msg = receiveMessage();
	if(msg != HELLO):
		endSession()
	timer.cancel()
	incrementSequence()

#send GOODBYE to the server
def sendGoodbye():
	debug("SENDING GOODBYE")
	sock.send(header(GOODBYE, sequence, sessionId))

#Read from a TTY. Send lines to the server that are not 'q'.
#Transition to closing state if end of file is reached.
#Set the global timeout if it hasn't been set
def readStdin():
	while True:
		line = sys.stdin.readline()
		if(not line):
			debug("Read EOF")
			print("eof")
			waitAndClose()
		elif(line.strip() is 'q'):
			debug("Read q")
			endSession()
		elif(sequence < 1):
			continue
		else:
			debug("Read '" + line.strip() + "'")
			if(not timer.isAlive):
				retartTimer()
			sendData(line.strip())

#Read from a piped file. Send lines to the server
#until end of file is reached.
#Set the global timeout if it hasn't been set
def readFile():
	for line in sys.stdin:
		debug("Read '" + line.strip() + "'");
		if(not timer.isAlive):
			restartTimer()
		sendData(line.strip())
	print("eof")
	waitAndClose()

if __name__ == "__main__":
	main()
