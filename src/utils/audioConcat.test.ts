import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClipTimeline,
  concatenateChannelData,
  encodeWavBytes,
  extractWaveformPeaks,
  formatBytes,
  formatDuration,
  reorderClips,
  sanitizeOutputFilename,
} from './audioConcat';

test('formatDuration formats seconds into precise MM:SS.cc and HH:MM:SS.cc strings', () => {
  assert.equal(formatDuration(0), '00:00.00');
  assert.equal(formatDuration(-5), '00:00.00');
  assert.equal(formatDuration(5.25), '00:05.25');
  assert.equal(formatDuration(65.4), '01:05.40');
  assert.equal(formatDuration(3661.08), '01:01:01.08');
});

test('formatBytes formats byte sizes cleanly', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.00 MB');
});

test('computeClipTimeline computes sequential offsets with and without gaps', () => {
  const clips = [
    { id: 'a', name: 'Intro.mp3', duration: 2.5 },
    { id: 'b', name: 'Body.mp3', duration: 4.0 },
    { id: 'c', name: 'Outro.mp3', duration: 1.5 },
  ];

  const seamless = computeClipTimeline(clips, 0);
  assert.equal(seamless.totalDuration, 8.0);
  assert.deepEqual(
    seamless.segments.map((s) => [s.start, s.end]),
    [
      [0, 2.5],
      [2.5, 6.5],
      [6.5, 8.0],
    ],
  );

  const gapped = computeClipTimeline(clips, 0.5);
  assert.equal(gapped.totalDuration, 9.0);
  assert.deepEqual(
    gapped.segments.map((s) => [s.start, s.end]),
    [
      [0, 2.5],
      [3.0, 7.0],
      [7.5, 9.0],
    ],
  );
});

test('reorderClips moves items without mutating the source array', () => {
  const initial = ['clip-1', 'clip-2', 'clip-3'];
  const movedUp = reorderClips(initial, 2, 0);
  assert.deepEqual(movedUp, ['clip-3', 'clip-1', 'clip-2']);
  assert.deepEqual(initial, ['clip-1', 'clip-2', 'clip-3']);

  const outOfBounds = reorderClips(initial, 0, -1);
  assert.deepEqual(outOfBounds, ['clip-1', 'clip-2', 'clip-3']);
});

test('concatenateChannelData stitches sequential clips, inserts silence gaps, and normalizes when requested', () => {
  const clipA = {
    sampleRate: 10000,
    channelData: [new Float32Array([0.2, 0.4, 0.2])],
  };
  const clipB = {
    sampleRate: 10000,
    channelData: [new Float32Array([-0.5, 0.5])],
  };

  const merged = concatenateChannelData([clipA, clipB], {
    targetSampleRate: 10000,
    targetChannels: 2,
    gapSeconds: 0.0002, // 2 samples at 10kHz
    normalize: false,
  });

  assert.equal(merged.length, 2);
  assert.equal(merged[0].length, 7);
  // Clip A
  assert.ok(Math.abs(merged[0][0] - 0.2) < 1e-6);
  assert.ok(Math.abs(merged[0][1] - 0.4) < 1e-6);
  assert.ok(Math.abs(merged[0][2] - 0.2) < 1e-6);
  // 2-sample silence gap
  assert.equal(merged[0][3], 0);
  assert.equal(merged[0][4], 0);
  // Clip B
  assert.ok(Math.abs(merged[0][5] - -0.5) < 1e-6);
  assert.ok(Math.abs(merged[0][6] - 0.5) < 1e-6);
  // Stereo mirror from mono
  assert.ok(Math.abs(merged[1][1] - 0.4) < 1e-6);

  const normalized = concatenateChannelData([clipA], {
    targetSampleRate: 10000,
    targetChannels: 1,
    gapSeconds: 0,
    normalize: true,
  });
  // Peak of clipA (0.4) should scale to 0.94
  assert.ok(Math.abs(normalized[0][1] - 0.94) < 1e-5);
});

test('encodeWavBytes writes a valid RIFF/WAVE PCM header and payload length', () => {
  const left = new Float32Array([0, 1, -1, 0.5]);
  const right = new Float32Array([0, -1, 1, -0.5]);
  const wav = encodeWavBytes([left, right], 44100);

  // 44 header bytes + 4 samples * 2 channels * 2 bytes = 60 bytes
  assert.equal(wav.byteLength, 60);
  const headerText = String.fromCharCode(...wav.slice(0, 4));
  const waveText = String.fromCharCode(...wav.slice(8, 12));
  assert.equal(headerText, 'RIFF');
  assert.equal(waveText, 'WAVE');
});

test('extractWaveformPeaks returns bounded normalized values', () => {
  const peaks = extractWaveformPeaks([new Float32Array([0.1, 0.5, 0.2, 0.8])], 4);
  assert.equal(peaks.length, 4);
  for (const p of peaks) {
    assert.ok(p >= 0.04 && p <= 1);
  }
  assert.equal(peaks[3], 1);
});

test('sanitizeOutputFilename normalizes names and enforces target extension', () => {
  assert.equal(sanitizeOutputFilename('My Voice Note.mp3', 'mp3'), 'My-Voice-Note.mp3');
  assert.equal(sanitizeOutputFilename('   ///   ', 'wav'), 'stitched-voice.wav');
  assert.equal(sanitizeOutputFilename('Episode 04', 'mp3'), 'Episode-04.mp3');
});
