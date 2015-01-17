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
        thread = threading.Thread(target=handleMessage, args=(data,))
        thread.start()
    except KeyboardInterrupt:
      print "\nInterrupted! Server shutting down."
      # send goodbye message to clients
      return;
    except socket.error, msg:
      print "Socket error: %s" % msg
      break

def handleMessage(data):
  print "Handling message"

main()

