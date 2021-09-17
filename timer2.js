 var count = 0;

 this.onmessage = function(event) {
   count++;
   this.postMessage(count);
 }
