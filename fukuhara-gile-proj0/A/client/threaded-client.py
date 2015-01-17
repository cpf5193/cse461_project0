import sys
import socket
import threading

DEBUG_LEVEL = 1

def debug(message):
	if(DEBUG_LEVEL > 0):
		print(message)

def main():
	host = sys.argv[1]
	port = int(sys.argv[2])
	debug("listening to " + host + ":" + str(port))

main()
