import sys
import socket
import threading

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
        # Do something
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
  magic = int(data[0:16], 2);
  version = int(data[16:24], 2);
  command = int(data[24:32], 2);
  sequenceNumber = int(data[32:64], 2);
  sessionId = int(data[64:96], 2);
  message = data[96:];

  #check duplicate, lost packet, etc.

  if (command == 0):
    handleHello();
  elif (command == 1):
    handleGoodbye();
  else:
    handleData(message);

def handleHello():
  print "Received hello message"

def handleGoodbye():
  print "Received goodbye message"

def handleData():
  print "Received data message"

main()
