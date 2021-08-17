importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/9.4.4/math.js');
importScripts('config.js');

// 2 * pi * i
const pi2i = math.chain(math.pi)
  .multiply(2)
  .multiply(math.complex('i'))
  .done()

// compute the fourier transform of point events t over frequencies freqs
function fourier(freqs, t) {
  t = math.matrixFromRows(t);
  freqs = math.matrixFromColumns(freqs);

  // convert ms to s
  t = math.divide(t, 1000);

  Pxx = math.chain(freqs)
    .multiply(t)
    .multiply(pi2i)
    .exp()
    .done();

  // sum over t, result is a vector with length == num freqs
  Pxx = math.apply(Pxx, 1, math.sum);

  return Pxx;
}

// updates a PSD estimate over freqs given new point events
// this avoids recomputing the entire PSD for each update
function IncrementalPSD(freqs) {
  let that = this;

  this.freqs = freqs;
  this.Pxx = math.zeros(freqs.length).toArray();
  this.FT = math.zeros(freqs.length).toArray();
  this.N = 0;

  // incrementally update the PSD given new timestamps
  this.update = function(t) {
    if (t.length == 0) {
      return;
    }

    that.N += t.length;

    // update the fourier transform, only consider new events
    that.FT = math.add(that.FT, fourier(that.freqs, t));

    // normalize to get the updated PSD
    that.Pxx = math.chain(that.FT)
      .abs()
      .square()
      .divide(that.N)
      .done();
  };

  // detect dominant frequencies using a simple peak detection:
  // * at least 8IQR above the median and greater
  // * greater than everything within length 9 window centered on the peak
  this.dominantFreqs = function() {
    // need at least 2 events to estimate something
    if (that.N < 2) {
      return [0, [], []];
    }

    let zipped = that.freqs.map((x, i) => [x, that.Pxx[i]]);
    zipped.sort((a, b) => a[1] < b[1] ? -1 : ((a[1] == b[1]) ? 0 : 1))

    const Q25 = Math.floor(0.25 * zipped.length);
    const Q50 = Math.floor(0.50 * zipped.length);
    const Q75 = Math.floor(0.75 * zipped.length);
    const IQR = zipped[Q75][1] - zipped[Q25][1];
    const thresh = zipped[Q50][1] + 8 * IQR;

    let domFreqs = [];
    let domPxx = [];
    let step = false;
    for (let i = 0; i < that.freqs.length; i++) {
      if ((that.Pxx[i] >= thresh) &&
          (that.Pxx[i] > (that.Pxx[i-1] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i-2] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i-3] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i-4] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i+1] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i+2] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i+3] || 0)) &&
          (that.Pxx[i] > (that.Pxx[i+4] || 0))
        ) {
        domFreqs.push(that.freqs[i]);
        domPxx.push(that.Pxx[i]);
      }
    }

    // fundamental frequency is the lowest dominant frequency
    if (domFreqs.length > 0) {
      fundFreq = domFreqs[0];
    } else {
      fundFreq = 0;
    }

    return [fundFreq, domFreqs, domPxx];
  }

  this.peak = function() {
    let domFreq = 0;
    let domPxx = 0;
    for (let i = 0; i < that.freqs.length; i++) {
      if (that.Pxx[i] > domPxx) {
        domFreq = that.freqs[i]
        domPxx = that.Pxx[i];
      }
    }
    return [domFreq, domPxx];
  }
}

function DeviceFingerprint(freqs) {
  let that = this;

  this.psd = new IncrementalPSD(freqs);
  this.skewEstimates = {};
  this.fundFreqWeights = {};
  this.fundFreq = 0;
  // this.skew = 0;

  // update the psd and skew estimates for all dominant frequencies
  this.update = function(t) {
    if (t.length == 0) {
      return;
    }

    that.N += t.length;

    // rounded to the nearest 0.1ms, used to compute psd and domFreq
    const tRounded = math.round(t, 1);
    that.psd.update(tRounded);

    const [fundFreq, domFreqs, domPxx] = that.psd.dominantFreqs();

    // peak detection is noisy, avoid recomputing the psd around every peak
    // dominant frequencies are weighted by how often they appear
    if (!(fundFreq in that.fundFreqWeights)) {
      that.fundFreqWeights[fundFreq] = 0;
    }
    that.fundFreqWeights[fundFreq] += t.length

    // set the dominant freq to the peak with the max weight
    that.fundFreq = parseInt(Object.keys(that.fundFreqWeights)
      .reduce((a, b) => that.fundFreqWeights[a] > that.fundFreqWeights[b] ? a : b));

    if (that.fundFreq > 0) {
      // create a fine grained psd around the dominant frequency
      if (!(that.fundFreq in that.skewEstimates)) {
        const skewFreqs = math.range(that.fundFreq - 0.5, that.fundFreq + 0.5, 0.001).toArray();
        that.skewEstimates[that.fundFreq] = new IncrementalPSD(skewFreqs);
      }

      // update psd around the dominant frequency
      // note the skew estimate uses domFreq and not fundFreq
      that.skewEstimates[that.fundFreq].update(t);
      that.skew = math.round(that.skewEstimates[that.fundFreq].peak()[0], 3);
    } else {
      that.skew = 0;
    }

    return {
      N: that.psd.N,
      freqs: that.psd.freqs,
      Pxx: that.psd.Pxx,
      fundFreq: that.fundFreq,
      skew: that.skew,
      domFreqs: domFreqs,
      domPxx: domPxx,
      maxPxx: that.psd.peak()[1],
    }
  };
};

// map time sources to device fingerprints
let fp = Object.fromEntries(timeSources.map(y => [y, new DeviceFingerprint(math.range(...defaultHzRange).toArray())]));

this.onmessage = function(event) {
  // no updates, send back an empty message
  if (event.data.N == 0) {
    this.postMessage(null);
    return;
  }

  // update estimates and post the new fingerprint
  let data = {}
  for (const timeSource of timeSources) {
    data[timeSource] = fp[timeSource].update(event.data[timeSource]);
  }
  // N is the same for every time source
  data.N = data[timeSources[0]].N;

  this.postMessage(data);
};
