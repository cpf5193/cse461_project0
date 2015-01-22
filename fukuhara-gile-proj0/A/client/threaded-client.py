# Chip Fukuhara and Jacob Gile
# Zahorjan
# CSE 461
# Project 0

# Simple client using threads

import sys, socket, threading, os
from struct import pack, unpack
from collections import namedtuple
from binascii import hexlify
from random import randint

DEBUG_LEVEL = 0
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
TIMEOUT_CLOSE = 0.5

sequence = 0;
sessionId = randint(MIN_ID, MAX_ID);
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
closing = False
tty = sys.stdin.isatty()

def incrementSequence():
	global sequence
	sequence += 1

def endSession():
	debug("endSession()");
	sendGoodbye()
	os._exit(0);

def waitAndClose():
	debug("waitAndClose()")
	global closing
	closing = True
	closeTimer = threading.Timer(TIMEOUT_CLOSE, endSession)
	closeTimer.start()
	while True:
		msg = receiveMessage()
		if(msg is ALIVE):
			closeTimer.cancel()
			closeTimer = threading.Timer(TIMEOUT_CLOSE, endSession)
			closeTimer.start()
		if(msg is GOODBYE):
			endSession()

timer = threading.Timer(TIMEOUT, waitAndClose)
	

def restartTimer():
	global timer
	debug("restartTimer()");
	timer.cancel()
	timer = threading.Timer(TIMEOUT, endSession)
	timer.start()

def header(cmd, seq, id):
	return pack(HEADER_FORMAT, MAGIC, VERSION, cmd , seq, id);

def debug(message):
	if(DEBUG_LEVEL > 0):
		print("DEBUG::" + str(message))
		
def validateHeader(msg):
	(magic, version, cmd, seq, id) = unpack(HEADER_FORMAT, msg)
	debug(msg)
	if(magic != MAGIC or version != VERSION or id != sessionId):
		return -1
	return cmd
	
def receiveMessage():
	msg = sock.recv(HEADER_SIZE)
	debug("Message length: " +  str(len(msg)))
	cmd = validateHeader(msg)
	if(len(msg) != HEADER_SIZE or cmd < 0):
		debug("Improperly formatted header")
		endSession();
	return cmd



def main():
	host = sys.argv[1]
	port = int(sys.argv[2])
	
	sock.connect((host, port));
	
	debug("Connected to " + host + " " + str(port));


	stdinThread = threading.Thread(target=readStdin, args=())
	stdinThread.start()
		
	sendHello()
	restartTimer()
		
	debug("Speaking to %s:%d" % (host, port))
	debug("Example header: %s" % hexlify(header(1, 2, MAX_ID)));
	
	try:
		while True and not closing:
			msg = receiveMessage();
			if(msg is ALIVE):
				debug("Cancelling timer")
				timer.cancel()
				debug(timer.isAlive())
			else:
				endSession()
	except KeyboardInterrupt:
		debug("KeyboardInterrupt\n")
		endSession()
	except socket.error:
		debug("Connection refused")
		endSession()
		
		

		
def prependHeader(cmd, seq, id, message):
	return "%s%s" % (header(cmd, seq, id), message)
	

def sendData(payload):
	sock.send(prependHeader(DATA, sequence, sessionId, payload));
	incrementSequence()
	
def sendHello():
	sock.send(header(HELLO, sequence, sessionId));
	restartTimer();
	msg = receiveMessage();
	if(msg != HELLO):
		endSession()
	timer.cancel()
	incrementSequence()

def sendGoodbye():
	sock.send(header(GOODBYE, sequence, sessionId))

def readStdin():
	while True:
		line = sys.stdin.readline();
		if(not line):
			debug("Read EOF")
			print("eof")
			waitAndClose()
		elif(line.strip() is 'q' and tty):
			debug("Read q")
			endSession()
		elif(sequence < 1):
			continue
		else:
			debug("Read '" + line.strip() + "'");
			restartTimer();
			sendData(line.strip());

if __name__ == "__main__":
	main()
