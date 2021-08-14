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

// estimate fundamental frequency from the power spectral density
function fundamentalFreq(freqs, Pxx) {
  let zipped = freqs.map((x, i) => [x, Pxx[i]]);
  zipped.sort((a, b) => a[1] < b[1] ? -1 : ((a[1] == b[1]) ? 0 : 1)).reverse()

  const Q25 = Math.floor(0.25 * zipped.length);
  const Q50 = Math.floor(0.50 * zipped.length);
  const Q75 = Math.floor(0.75 * zipped.length);
  const IQR = zipped[Q25][1] - zipped[Q75][1];
  const thresh = zipped[Q50][1] + 6 * IQR;

  let domFreqs = [];
  for (let i = 0; i < zipped.length; i++) {
    if (zipped[i][1] >= thresh) {
      domFreqs.push(zipped[i]);
    } else {
      break;
    }
  }

  // no dom freq
  if (domFreqs.length == 0) {
    return 0;
  }

  // only one dom freq
  if (domFreqs.length == 1) {
    return domFreqs[0][0];
  }

  // if the lowest freq is at least 25% height of the peak, then use that
  const peak = domFreqs[0];
  const lowest = domFreqs.reduce((prev, curr) => prev[0] < curr[0] ? prev : curr);

  if (lowest[1] >= 0.5 * peak[1]) {
    return lowest[0];
  }

  // otherwise use the peak
  return peak[0];
}

// updates a PSD estimate over freqs given new point events
// this avoids recomputing the entire PSD for each update
function IncrementalPSD(freqs) {
  let that = this;

  this.freqs = freqs;
  this.Pxx = math.zeros(freqs.length).toArray();
  this.FT = math.zeros(freqs.length).toArray();
  this.N = 0;
  this.fundFreq = 0;
  this.domFreq = 0;

  // incrementally update the PSD given new timestamps
  this.update = function(t) {
    if ((t.length == 0) || (t.length == that.N)) {
      return;
    }

    // take the new events before updating the total length
    const tNew = t.slice(that.N);
    that.N = t.length;

    // update the fourier transform, only consider new events
    that.FT = math.add(that.FT, fourier(that.freqs, tNew));

    // normalize to get the updated PSD
    that.Pxx = math.chain(that.FT)
      .abs()
      .square()
      .divide(that.N)
      .done();

    // fundamental frequency is the lowest frequency with a peak
    that.fundFreq = fundamentalFreq(that.freqs, that.Pxx);

    // dominant frequency is the frequency with the most power
    that.domFreq = that.freqs[that.Pxx.indexOf(Math.max.apply(null, that.Pxx))];
  };
}

function DeviceFingerprint(freqs) {
  let that = this;

  this.psd = new IncrementalPSD(freqs);
  this.skewEstimates = {};
  this.fundFreqWeights = {};
  this.t = [];
  this.tRounded = [];
  that.N = 0;
  this.fundFreq = 0;
  this.skew = 0;

  // update the psd and skew estimates for all dominant frequencies
  this.update = function(t) {
    if (t.length == 0) {
      return;
    }

    // store all timestamps seen so far
    that.t.push(...t);
    that.N = that.t.length;

    // rounded to the nearest 0.1ms, used to compute psd and domFreq
    that.tRounded.push(...math.round(t, 1));
    that.psd.update(that.tRounded);

    // peak detection is noisy, avoid recomputing the psd around every peak
    // dominant frequencies are weighted by how often they appear
    if (!(that.psd.fundFreq in that.fundFreqWeights)) {
      that.fundFreqWeights[that.psd.fundFreq] = 0;
    }
    that.fundFreqWeights[that.psd.fundFreq] += t.length

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
      that.skewEstimates[that.fundFreq].update(that.t);
      that.skew = math.round(that.skewEstimates[that.fundFreq].domFreq, 3);
    } else {
      that.skew = 0;
    }
  };

  this.fingerprint = function() {
    return {
      freqs: that.psd.freqs,
      Pxx: that.psd.Pxx,
      fundFreq: that.fundFreq,
      skew: that.skew,
      N: that.N,
    };
  }
};

let fpMap = {};

this.onmessage = function(event) {
  if (!(event.data.timeSource in fpMap)) {
    fpMap[event.data.timeSource] = new DeviceFingerprint(freqs);
  }

  // no updates, send back an empty message
  if ((event.data.t.length == 0) && (!event.data.forceUpdate)) {
    this.postMessage(null);
    return;
  }

  fpMap[event.data.timeSource].update(event.data.t);
  const data = fpMap[event.data.timeSource].fingerprint();
  this.postMessage(data);
};
