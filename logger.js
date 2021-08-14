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

function EventLogger(events) {
  let that = this;

  this.events = events;

  this.buffer = {
    'date': Object.fromEntries(this.events.map(x => [x, []])),
    'performance': Object.fromEntries(this.events.map(x => [x, []])),
    'native': Object.fromEntries(this.events.map(x => [x, []])),
  };

  this.addEvent = function(e, eventType) {
    that.buffer['date'][eventType].push(Date.now());
    that.buffer['performance'][eventType].push(performance.now());
    that.buffer['native'][eventType].push(e.timeStamp);
  };

  this.gatherTimestamps = function(timeSource, eventTypes) {
    return that.buffer[timeSource].reduce(function(filtered, x) {
      if (eventTypes.includes(x.type)) {
        filtered.push(x.time);
      }
      return filtered;
    }, []);
  };

  this.emptyBuffer = function(timeSource, eventType) {
    // console.log(timeSource, eventType);
    const events = that.buffer[timeSource][eventType];
    that.buffer[timeSource][eventType] = [];
    return events;
  };

  this.startLogging = function() {
    for (const eventType of this.events) {
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
