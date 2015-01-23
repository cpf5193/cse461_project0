# Chip Fukuhara and Jacob Gile
# Zahorjan
# CSE 461
# Project 0

# Simple echo server using threads

################################
## Import Statements
################################
import sys, socket, os, threading
from struct import pack, unpack
from binascii import hexlify

################################
## Global State
################################
sessions = {}
timers = {}
serverSocket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
serverSeqNum = 0

################################
## Constants
################################
MAGIC = 0xC461
VERSION = 1
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3
HEADER_FORMAT = '!HbbII'
HEADER_SIZE = 12
MESSAGE_SIZE = 1024
INACTIVITY_DURATION = 60

def main():
  host = socket.gethostname()
  port = int(sys.argv[1])
  serverSocket.bind((host, port))
  print "Waiting on port %s..." % sys.argv[1]

  # Spawn a thread to deal with stdin input
  thread = threading.Thread(target=handleUserInput, args=())
  thread.start()

  # Loop, listening for messages on the port
  while True:
    try:
      message, addr = serverSocket.recvfrom(MESSAGE_SIZE)
      if not message:
        print "Empty message"
        break
      else:
        delegateMessage(message, addr)
    except KeyboardInterrupt:
      print "\nInterrupted! Server shutting down."
      closeServer()
    except socket.error, msg:
      print "Socket error: %s" % msg
      break

########################################################################
## Reads in the raw message sent by a client, validates the message,
##   and delegates to another action based on the type of message
## msg: The message (header+payload) to delegate
## addr: A duple (hostname, port) representing the address of the client
########################################################################
def delegateMessage(msg, addr):
  global timers, sessions

  # Get the header elements and the payload out of the message
  (magic, version, command, sequenceNumber, sessionId) = unpack(HEADER_FORMAT, msg[0:HEADER_SIZE])
  if (command == DATA):
    message = msg[HEADER_SIZE:]
  
  # Validate the header
  if (magic != MAGIC or version != VERSION):
    print 'Protocol Error: Invalid header'
    return

  #Check that this is an appropriate packet for the state of the server/session
  elif (sessionId in sessions):
    # This session has already been established
    if (command == HELLO or command == GOODBYE):
      # If this session has been seen before, but it is another hello
      # or a goodbye message is sent, close session
      if (command == GOODBYE):
        print "%s [%d] GOODBYE from client." % (hex(sessionId), sessions[sessionId][0] + 1)
      sendGoodbye(sessionId)
    elif (sessions[sessionId][0] + 1 < sequenceNumber):
      for x in range(sessions[sessionId][0]+1, sequenceNumber):
        print "%s [%d] Lost Packet!" % (hex(sessionId), x)
      sessions[sessionId] = (sequenceNumber, addr)
      handleData(sessionId, message) 
    elif (sessions[sessionId][0] == sequenceNumber):
      print "Duplicate packet"
      return
    elif (sessions[sessionId][0] > sequenceNumber):
      print "Packets out of order: received sequenceNum %d" % sequenceNumber
    else:
      # Valid and expected packet, update session state
      sessions[sessionId] = (sequenceNumber, addr)
      handleData(sessionId, message)
  elif (command == HELLO):
    # New session
    sessions[sessionId] = (sequenceNumber, addr)
    handleHello(sessionId)
  else:
    if (command == GOODBYE):
      print "%s [%d] GOODBYE from client." % (hex(sessionId), sessions[sessionId][0] + 1)
    # else it is a DATA message sent before a HELLO, still send goodbye
    sendGoodbye(sessionId)

###############################################################
## Adds a session into server state and returns a HELLO message
##   to the given session
## sessionId: the id of the session from which a hello was sent
###############################################################
def handleHello(sessionId):
  global serverSeqNum, timers
  helloMsg = createMessage(HELLO, sessionId, None)
  addrPort = (sessions[sessionId][1][0], sessions[sessionId][1][1])
  serverSocket.sendto(helloMsg, addrPort)
  serverSeqNum += 1
  print "%s [%d] Session created" % (hex(sessionId), sessions[sessionId][0])
  timers[sessionId] = threading.Timer(INACTIVITY_DURATION, sendGoodbye, [sessionId])
  timers[sessionId].start()

###################################################################
## Takes a data message from the client and sends an alive response
##    while resetting the session's timeout
## sessionId: the id of the session from which the data was sent
## message: The message that the client is sending to the server
###################################################################
def handleData(sessionId, message):
  global serverSeqNum, timers
  aliveMsg = createMessage(ALIVE, sessionId, None)
  timers[sessionId].cancel()
  serverSocket.sendto(aliveMsg, sessions[sessionId][1])
  serverSeqNum += 1
  print "%s [%d] %s" % (hex(sessionId), sessions[sessionId][0], message)
  timers[sessionId] = threading.Timer(INACTIVITY_DURATION, sendGoodbye, [sessionId])
  timers[sessionId].start()

#################################################################
## Creates a message of the given type and for the given session,
##    With an optional message if it is a data message
## type: The integer indicating the type of message to be sent
## sessionId: the id of the session to which data is to be sent
## message: The message that the client is sending to the server
#################################################################
def createMessage(type, sessionId, message):
  command = type
  sid = sessionId
  msg = ''
  if (message):
    msg = message
  return "%s%s" % (pack(HEADER_FORMAT, MAGIC, VERSION, command, serverSeqNum, sid), msg)

#########################################################################
## Listens to stdin, closing server if the user sends an eof or types 'q'
#########################################################################
def handleUserInput():
  # Look for 'q' lines and handle keyboard interrupt
  while True:
    try: # read from stdin line by line, looking for 'q'
      line =  sys.stdin.readline()
      if line == '' or line == "q\n":
        closeServer()
    except KeyboardInterrupt:
      print "\nInterrupted! Server shutting down."
      closeServer()

####################################################################
## Sends a goodbye message to the given session
## sessionId: the id of the session to which a goodbye is to be sent
####################################################################
def sendGoodbye(sessionId):
  global serverSeqNum
  savedAddr = sessions[sessionId][1]
  headerString = createMessage(GOODBYE, sessionId, None)
  serverSocket.sendto(headerString, savedAddr)
  serverSeqNum += 1
  if sessionId in sessions:
    killSession(sessionId)

#################################################################
## Removes the session and its associated timer from server state
## sessionId: the id of the session to close
#################################################################
def killSession(sessionId):
  global sessions, timers
  if sessionId in sessions:
    sessions.pop(sessionId)
  if sessionId in timers:
    timers[sessionId].cancel()
    timers.pop(sessionId)
  print "%s Session closed" % hex(sessionId)

###################################################
## Closes all existing client connections and exits
###################################################
def closeServer():
  keys = list(sessions.keys())
  for key in keys:
    sendGoodbye(key)
  os._exit(0)

main()
