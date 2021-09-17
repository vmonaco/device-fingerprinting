var sub = new Worker ("timer2.js") ;
sub.postMessage(0);
var count = 0;

sub.onmessage = msg;
this.onmessage = msg;

function msg(event) {
 if (event.data != 0) {
   count = event.data;
   sub.postMessage(0);
 } else {
   self.postMessage(count) ;
 }
}
