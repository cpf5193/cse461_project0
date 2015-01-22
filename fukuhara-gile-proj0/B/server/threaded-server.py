import sys, socket, os, threading
from struct import pack, unpack
from binascii import hexlify

sessions = {}
timers = {}
serverSocket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

MAGIC = 0xC461
VERSION = 1
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3
HEADER_FORMAT = '!HbbII'
HEADER_SIZE = 12
MESSAGE_SIZE = 1024


def main():
  host = socket.gethostname()
  port = int(sys.argv[1])
  serverSocket.bind((host, port))
  print "Waiting on port %s..." % sys.argv[1]

  #Spawn a thread to deal with stdin input
  thread = threading.Thread(target=handleUserInput, args=())
  thread.start()

  while True:
    try:
      #print "listening"
      message, addr = serverSocket.recvfrom(MESSAGE_SIZE)
      #print 'Incoming connection from ', addr
      if not message:
        print "No message"
        break
      else:
        delegateMessage(message, addr)
    except KeyboardInterrupt: # move this to the stdin handler
      print "\nInterrupted! Server shutting down."
      # send goodbye message to all clients
      closeServer()
    except socket.error, msg:
      print "Socket error: %s" % msg
      break

def delegateMessage(msg, addr):
  #print "delegating message"
  (magic, version, command, sequenceNumber, sessionId) = unpack(HEADER_FORMAT, msg[0:12])
  if (command == DATA):
    message = msg[HEADER_SIZE:]
  if (magic != MAGIC or version != VERSION):
    print 'no match'
    return
  #Check that this is an appropriate packet for the state of the server/session
  elif (sessionId in sessions):
    #print "session in sessions"
    if (command == HELLO or command == GOODBYE):
      if (command == GOODBYE):
        print "%s [%d] GOODBYE from client." % (hex(sessionId), sessions[sessionId][0] + 1)
      # If this session has been seen before, but it is another hello
      # or a goodbye message is sent, close session
      # print "sending goodbye"
      sendGoodbye(sessionId)
    elif (sessions[sessionId][0] + 1 < sequenceNumber):
      for x in range(sessions[sessionId][0]+1, sequenceNumber+1):
        print "%s [%d] Lost Packet!" % (hex(sessionId), x)
      #print "current sequenceNum: " + str(sessions[sessionId][0])
      #print "incoming sequenceNum: " + str(sequenceNumber)
      sessions[sessionId] = (sequenceNumber, addr)
      
    elif (sessions[sessionId][0] == sequenceNumber):
      print "Duplicate packet"
      return
    elif (sessions[sessionId][0] > sequenceNumber):
      #print "current sequenceNum: " + str(sessions[sessionId][0])
      #print "incoming sequenceNum: " + str(sequenceNumber)
      print "packets out of order: received sequenceNum %d" % sequenceNumber
      #sendGoodbye(sessionId)
    else:
      #print "sessions[sessionId][0]: " + str(sessions[sessionId][0])
      #print "sequenceNumber: " + str(sequenceNumber)
     # print "handling data"
      sessions[sessionId] = (sequenceNumber, addr)
      timers[sessionId].cancel()
      timers[sessionId] = threading.Timer(60, killSession, [sessionId])
      handleData(sessionId, message)
  elif (command == HELLO):
    #print "starting hello"
    #print "sequence number: " + str(sequenceNumber)
    sessions[sessionId] = (sequenceNumber, addr)
    handleHello(sessionId)
  elif (command == DATA or command == GOODBYE):
    if (command == GOODBYE):
      print "%s [%d] GOODBYE from client." % (hex(sessionId), sessions[sessionId][0] + 1)
    # If 1, it is a DATA message sent before a HELLO
    #print "processing goodbye"
    sendGoodbye(sessionId)
  else:
    #print "handling data"
    handleData(sessionId, message)

def handleHello(sessionId):
  helloMsg = createMessage(HELLO, sessionId, None)
  addrPort = (sessions[sessionId][1][0], sessions[sessionId][1][1])
  serverSocket.sendto(helloMsg, addrPort)
  print "%s [%d] Session created" % (hex(sessionId), sessions[sessionId][0])
  timers[sessionId] = threading.Timer(60, killSession, [sessionId])
  timers[sessionId].start()

def handleData(sessionId, message):
  aliveMsg = createMessage(ALIVE, sessionId, None)
  serverSocket.sendto(aliveMsg, sessions[sessionId][1])
  print "%s [%d] %s" % (hex(sessionId), sessions[sessionId][0], message)
  timers[sessionId] = threading.Timer(60, killSession, [sessionId])
  timers[sessionId].start()
  #print "Received data message: " + message

def createMessage(type, sessionId, message):
  command = type
  if sessionId in sessions:
    sequenceNumber = sessions[sessionId][0]
  else:
    sequenceNumber = 0
  sid = sessionId
  msg = ''
  if (message):
    msg = message
  return "%s%s" % (pack(HEADER_FORMAT, MAGIC, VERSION, command, sequenceNumber, sid), msg)

def handleUserInput():
  # Look for 'q' lines and handle keyboard interrupt
  while True:
    try: # read from stdin line by line, looking for 'q'
      line = ""
      for char in sys.stdin.readline():
        line += char
      if line == "q\n":
        closeServer()
      #else:
        #print line
    except KeyboardInterrupt: # move this to the stdin handle
      print "\nInterrupted! Server shutting down."
      # send goodbye message to all clients
      closeServer()

def sendGoodbye(sessionId):
  #print "in sendGoodbye"
  #print "addr: "
  #print sessions[sessionId][1]
  savedAddr = sessions[sessionId][1]
  headerString = createMessage(GOODBYE, sessionId, None)
  serverSocket.sendto(headerString, savedAddr)
  #print "Killing session"
  if sessionId in sessions:
    killSession(sessionId)

def killSession(sessionId):
  if sessionId in sessions:
    sessions.pop(sessionId)
  if sessionId in timers:
    timers[sessionId].cancel()
    timers.pop(sessionId)
  print "%s Session closed" % hex(sessionId)

def closeServer():
  keys = list(sessions.keys())
  for key in keys:
    sendGoodbye(key)
  os._exit(1)

main()
