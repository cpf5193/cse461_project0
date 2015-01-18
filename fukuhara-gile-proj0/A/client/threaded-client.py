import sys
import socket
import threading
from struct import pack, unpack
from collections import namedtuple
from binascii import hexlify
from random import randint

DEBUG_LEVEL = 1
MAGIC = 0xC461
VERSION = 1
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3
HEADER_FORMAT = '!HbbII'
HEADER_SIZE = 96
MESSAGE_SIZE = 1024
MAX_ID = 0xFFFFFFFF
MIN_ID = 0x00000000

def header(cmd, seq, id):
	return pack(HEADER_FORMAT, MAGIC, VERSION, cmd , seq, id);

def debug(message):
	if(DEBUG_LEVEL > 0):
		print(message)

def main():
	host = sys.argv[1]
	port = int(sys.argv[2])
	
	sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM);
	sock.connect((host, port));
		
	debug("Speaking to %s:%d" % (host, port))
	debug("Example header: %s" % hexlify(header(1, 2, MAX_ID)));
	
	startSession(sock)
	
def getSessionId():
	return randint(MIN_ID, MAX_ID);
	
def prependHeader(cmd, seq, id, message):
	return "%s%s" % (header(cmd, seq, id), message)
	
def startSession(s):
	seq = 1
	sessId = getSessionId();
	debug(str(sessId))
	m = header(HELLO, seq, sessId);
	s.send(m);

if __name__ == "__main__":
	main()
