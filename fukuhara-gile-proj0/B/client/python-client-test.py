import socket

# Get local machine name
host = socket.gethostname()
port = 33333

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((host, port))
msg = raw_input('Input message to send:\n')
s.sendall(msg)
s.close()