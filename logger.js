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

function makeTextFile(textFile, text) {
  let data = new Blob([text], {
    type: 'text/plain'
  });
  if (textFile !== null) {
    window.URL.revokeObjectURL(textFile);
  }

  textFile = window.URL.createObjectURL(data);
  return textFile;
};

function BufferedEventLogger(eventTypes, timeSources, bufferSize) {
  let that = this;

  this.eventTypes = eventTypes;
  this.timeSources = timeSources;
  this.bufferSize = bufferSize;

  // buffer is indexed by [eventType][timeSource]
  this.buffer = Object.fromEntries(this.eventTypes.map(x => [x,
    Object.fromEntries(this.timeSources.map(y => [y, []]))
  ]));

  this.addEvent = function(e, eventType) {
    if (that.buffer[eventType][that.timeSources[0]].length >= that.bufferSize) {
      return;
    }

    that.buffer[eventType]['date'].push(Date.now());
    that.buffer[eventType]['performance'].push(performance.now());
    that.buffer[eventType]['timeStamp'].push(e.timeStamp);
  };

  this.emptyBuffer = function(eventType) {
    let events = that.buffer[eventType];
    that.buffer[eventType] = Object.fromEntries(this.timeSources.map(y => [y, []]));
    events.N = events[that.timeSources[0]].length;
    return events;
  };

  this.startLogging = function() {
    for (const eventType of this.eventTypes) {
      hook(
        window,
        eventType,
        function(e) {
          that.addEvent(e, eventType);
        },
      );
    };
  };
};
