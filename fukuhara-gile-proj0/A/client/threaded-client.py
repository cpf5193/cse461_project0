import sys
import socket
import threading
from struct import pack, unpack
from collections import namedtuple
from binascii import hexlify

DEBUG_LEVEL = 1
MAGIC = 0xC461
VERSION = 1
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3
HEADER_FORMAT = '!Hbbii'

def header(cmd, seq, id):
	return pack(HEADER_FORMAT, MAGIC, VERSION, cmd, seq, id);

def debug(message):
	if(DEBUG_LEVEL > 0):
		print(message)

def main():
	host = sys.argv[1]
	port = int(sys.argv[2])
	debug("listening to %s:%d" % (host, port))
	debug("Example header: %s" % hexlify(header(1, 2, 3)));

main()
