const eventTypes = [
  'keydown',
  'keyup',
  'mousemove',
  'wheel',
  'mousedown',
  'mouseup',
];

// max number of events to update at once
// this is mainly to rate limit mousemove events
const maxPostEvents = 50;

// time between worker callbacks
const updateTimeout = 200;

// Hz from 20 to 1020 inclusive
const freqs = [...Array(1001).keys()].map(i => i + 20);
const zeros = Array(freqs.length).fill(0);

const layout = {
  autosize: true,
  height: 200,
  xaxis: {
    zeroline: false,
  },
  yaxis: {
    showgrid: false,
    zeroline: false,
    showticklabels: false,
  },
  margin: {
    t: 20,
    l: 20,
    r: 20,
    b: 20
  },
};
