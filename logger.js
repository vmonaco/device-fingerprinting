function hook(element, evnt, funct) {
  if (element.attachEvent)
    return element.attachEvent('on' + evnt, funct);
  else
    return element.addEventListener(evnt, funct, false);
}

function unhook(element, evnt, funct) {
  if (element.detachEvent)
    return element.detachEvent('on' + evnt, funct);
  else
    return element.removeEventListener(evnt, funct, false);
}

function BufferedEventLogger(eventTypes, timeSources, bufferSize) {
  let that = this;

  this.eventTypes = eventTypes;
  this.timeSources = timeSources;
  this.bufferSize = bufferSize;

  // buffer is indexed by [eventType][timeSource]
  this.buffer = Object.fromEntries(this.eventTypes.map(x => [x,
    Object.fromEntries(this.timeSources.map(y => [y, []]))
  ]));

  // used for the webworker time source
  this.ts = null;
  that.timestamp = 0;

  this.addEvent = function(e, eventType) {
    if (that.buffer[eventType][that.timeSources[0]].length >= that.bufferSize) {
      return;
    }
    // fetch the worker timestamp
    that.buffer[eventType]['date'].push(Date.now());
    that.buffer[eventType]['performance'].push(performance.now());
    that.buffer[eventType]['timeStamp'].push(e.timeStamp);

    if (that.ts != null) {
      that.ts.postMessage(0);
      that.buffer[eventType]['worker'].push(that.timestamp);
    }
  };

  this.emptyBuffer = function(eventType) {
    let events = that.buffer[eventType];
    that.buffer[eventType] = Object.fromEntries(that.timeSources.map(y => [y, []]));
    events.N = events[that.timeSources[0]].length;
    return events;
  };

  this.startLogging = function() {
    for (const eventType of that.eventTypes) {
      hook(
        window,
        eventType,
        function(e) {
          that.addEvent(e, eventType);
        },
      );
    };
  };

  this.enableWorker = function() {
    that.ts = new Worker('timer.js');
    that.ts.postMessage(0);
    that.ts.addEventListener("message" , function(event) {
      that.timestamp = (event.data/10);
    });
  };

  this.disableWorker = function() {
    if (that.ts == null) {
      return;
    }
    that.ts.terminate();
    that.ts = null;
  };
};
