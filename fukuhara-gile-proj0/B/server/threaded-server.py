import sys
import socket
import threading

def main():
  serverSocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  host = socket.gethostname()
  port = int(sys.argv[1])
  serverSocket.bind((host, port))
  print "Server bound to %s" % (host, port)
  print "Listening on port %s" % sys.argv[1]

  serverSocket.listen(5)

  while True:
    try:
      conn, addr = serverSocket.accept()
      print 'Incoming connection from ', addr
      while True:
        data = conn.recv(1024)
        if not data:
          conn.close()
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

