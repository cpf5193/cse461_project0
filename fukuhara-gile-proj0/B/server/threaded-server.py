import sys
import socket
import threading

sessions = {}
timers = {}
serverSocket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

def main():
  host = socket.gethostname()
  port = int(sys.argv[1])
  serverSocket.bind((host, port))
  print "Server bound to %s, %s" % (host, port)
  print "Listening on port %s" % sys.argv[1]

  #Spawn a thread to deal with stdin input
  thread = threading.Thread(target=handleUserInput, args=())

  while True:
    try:
      message, addr = serverSocket.recvfrom(1024)
      print message
      print 'Incoming connection from ', addr
      if not message:
        print "No message"
        break
      else:
        print "Received message: %s" % message
        delegateMessage(message, addr)
    except KeyboardInterrupt: # move this to the stdin handler
      print "\nInterrupted! Server shutting down."
      # send goodbye message to all clients
      for key in sessions:
        sendGoodbye(key)
      sys.exit()
    except socket.error, msg:
      print "Socket error: %s" % msg
      break

def delegateMessage(msg, addr):
  magic = int(msg[0:16], 2)
  version = int(msg[16:24], 2)
  command = int(msg[24:32], 2)
  sequenceNumber = int(msg[32:64], 2)
  sessionId = int(msg[64:96], 2)
  if (command == 1):
    message = msg[96:]
  if (magic != 50273 or version != 1):
    return
  #Check that this is an appropriate packet for the state of the server/session
  elif (sessionId in sessions):
    if (command == 0):
      #If this session has been seen before, but it is another hello, close session
      sendGoodbye(sessionId)
    elif (sessions[sessionId][0] + 1 < sequenceNumber):
      print "sessions[sessionId][0]: " + str(sessions[sessionId][0])
      print "sequenceNumber: " + str(sequenceNumber)
      numlost = sequenceNumber - sessions[sessionId][0] - 1
      for x in range(0, numlost):
        print "Lost Packet"
    elif (sessions[sessionId][0] == sequenceNumber):
      print "Duplicate packet"
      return
    elif (sessions[sessionId][0] > sequenceNumber):
      print "packets out of order"
      sendGoodbye(sessionId)
    else:
      print "handling data"
      sequenceNumber += 1
      sessions[sessionId] = (sequenceNumber, addr)
      clearTimeout(timers[sessionId])
      timers[sessionId] = threading.Timer(60, killSession, [sessionId])
      handleData(sessionId, message)
  elif (command == 0):
    print "starting hello"
    sessions[sessionId] = (sequenceNumber, addr)
    handleHello(sessionId)
  elif (command == 1):
    handleGoodbye(sessionId)
  else:
    print "handling data"
    handleData(sessionId, message)

def handleHello(sessionId):
  helloMsg = createMessage(0, sessionId, None)
  print "helloMsg: "
  print helloMsg
  serverSocket.sendto(helloMsg, sessions[sessionId][1])
  timers[sessionId] = threading.Timer(60, killSession, [sessionId])
  timers[sessionId].start()

def handleGoodbye(sessionId):
  sendGoodbye(sessionId)

def handleData(sessionId, message):
  aliveMsg = createMessage(2, sessionId, None)
  serverSocket.sendto(aliveMsg, sessions[sessionId][1])
  timers[sessionId] = threading.Timer(60, killSession, [sessionId])
  timers[sessionId].start()
  print "Received data message: " + message

def createMessage(type, sessionId, message):
  magic = bin(50273)[2:]
  version = str(1).zfill(8)
  command = str(type).zfill(8)
  if sessionId in sessions:
    sequenceNumber = str(sessions[sessionId][0]).zfill(32)
  else:
    sequenceNumber = "0".zfill(32)
  sid = bin(sessionId)[2:]
  msg = ''
  if (message):
    msg = message
  return magic + version + command + sequenceNumber + sid + msg

def handleUserInput():
  # Look for 'q' lines and handle keyboard interrupt
  while True:
    try: # read from stdin line by line, looking for 'q'
      for line in sys.stdin:
        if line == "q":
          for key in sessions:
            sendGoodbye(key)
          sys.exit()
    except KeyboardInterrupt: # move this to the stdin handler
      print "\nInterrupted! Server shutting down."
      # send goodbye message to all clients
      for key in sessions:
        sendGoodbye(key)
      sys.exit()

def sendGoodbye(sessionId):
  killSession(sessionId)
  headerString = createMessage(3, sessionId, None)
  serverSocket.sendto(headerString, sessions[sessionId][1])

def killSession(sessionId):
  if sessionId in sessions:
    sessions.pop(sessionId)
  if sessionId in timers:
    timers.pop(sessionId)

main()
