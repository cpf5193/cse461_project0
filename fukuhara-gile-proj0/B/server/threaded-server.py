import sys
import socket
import threading

sequenceNum = 0
host = null
port = null
serverSocket = null
timer = null

def main():
  serverSocket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  host = socket.gethostname()
  port = int(sys.argv[1])
  serverSocket.bind((host, port))
  print "Server bound to %s, %s" % (host, port)
  print "Listening on port %s" % sys.argv[1]

  while True:
    try:
      data, addr = serverSocket.recvfrom(1024)
      print 'Incoming connection from ', addr
      if not data:
        print "No data"
        break
      else:
        print "Received data: %s" % data
        thread = threading.Thread(target=delegateMessage, args=(data,))
        thread.start()
    except KeyboardInterrupt:
      print "\nInterrupted! Server shutting down."
      # send goodbye message to clients
      return;
    except socket.error, msg:
      print "Socket error: %s" % msg
      break

def delegateMessage(data):
  magic = int(data[0:16], 2)
  version = int(data[16:24], 2)
  command = int(data[24:32], 2)
  sequenceNumber = int(data[32:64], 2)
  sessionId = int(data[64:96], 2)
  if (command == 1):
    message = data[96:]

  #check duplicate, lost packet, etc.

  if (magic != 50273 || version != 1) {
    #silently discard the connection
  }

  if (command == 0):
    handleHello(command, sessionId);
  elif (command == 1):
    handleGoodbye(command, sessionId);
  else:
    handleData(command, sessionId, message);

def handleHello(command, sessionId):
  helloMsg = createMessage(command, sessionId, null)
  print helloMsg
  serverSocket.sendto(helloMsg, (host, port))
  #set timer

def handleGoodbye(command, sessionId):
  #send goodbye
  #shut down
  print "Received goodbye message"

def handleData():
  #send alive message
  #reset timer
  #timeout for each connection? Or just one timeout and implicitly a timer will be created
  print "Received data message"

def createMessage(type, sessionId, message):
  magic = str(int(50273, 2))
  version = str(1).zfill(8)
  command = str(type).zfill(8)
  sequenceNumber = str(sequenceNum).zfill(32)
  sid = str(sessionId)
  msg = ''
  if (message):
    msg = message
  return magic + version + command + sequenceNumber + sid + msg

main()