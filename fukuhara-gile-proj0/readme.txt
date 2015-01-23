A: Jacob Gile
B: Christon Fukuhara

For client B, out-of-order packets are occasionally an issue, even
after resolving the DNS to a raw IP as suggested in the message board.
After some testing, we found that this tends to happen early, but if the program
is allowed to keep executing after an out-of-order packet is detected,
it turns out that there are relatively few out-of-order packets.