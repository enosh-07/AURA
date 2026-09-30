const fs = require('fs');
const path = require('path');

const storageDir = path.join(__dirname, 'storage', 'audio');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

function createWavBuffer(seconds, sampleRate, noteGenerator) {
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const totalSamples = seconds * sampleRate;
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [leftVal, rightVal] = noteGenerator(t, i);

    const intLeft = Math.max(-32767, Math.min(32767, Math.floor(leftVal * 32767)));
    const intRight = Math.max(-32767, Math.min(32767, Math.floor(rightVal * 32767)));

    buffer.writeInt16LE(intLeft, offset);
    buffer.writeInt16LE(intRight, offset + 2);
    offset += 4;
  }

  return buffer;
}

const sampleRate = 44100;
const durationSeconds = 30; // 30-second loopable high-fidelity soundscapes

const tracks = [
  {
    id: 'track-1', // Synthwave arpeggio
    gen: (t) => {
      const chords = [220, 261.63, 329.63, 392]; // Am7 arpeggio
      const note = chords[Math.floor(t * 4) % chords.length];
      const bass = Math.sin(2 * Math.PI * 55 * t) * 0.35;
      const arp = Math.sin(2 * Math.PI * note * t) * 0.25;
      const kick = Math.exp(-15 * (t % 0.5)) * Math.sin(2 * Math.PI * 60 * t) * 0.4;
      const val = bass + arp + kick;
      return [val, val * 0.9];
    },
  },
  {
    id: 'track-2', // Lo-Fi Rain & Rhodes
    gen: (t) => {
      const chord = 196 + Math.sin(t * 0.5) * 10;
      const rhodes = (Math.sin(2 * Math.PI * chord * t) + Math.sin(2 * Math.PI * (chord * 1.25) * t) * 0.5) * 0.3;
      const vinylNoise = (Math.random() - 0.5) * 0.04;
      return [rhodes + vinylNoise, rhodes * 0.95 + vinylNoise];
    },
  },
  {
    id: 'track-3', // Deep Quantum Ambient
    gen: (t) => {
      const drone1 = Math.sin(2 * Math.PI * 110 * t) * 0.25;
      const drone2 = Math.sin(2 * Math.PI * 164.81 * t + Math.sin(t * 0.2)) * 0.2;
      const sub = Math.sin(2 * Math.PI * 55 * t) * 0.3;
      return [drone1 + sub, drone2 + sub];
    },
  },
  {
    id: 'track-4', // Solar Flare Electronic
    gen: (t) => {
      const kick = Math.exp(-20 * (t % 0.46)) * Math.sin(2 * Math.PI * 75 * t) * 0.5;
      const saw = ((t * 130) % 1 - 0.5) * 0.2;
      return [kick + saw, kick - saw];
    },
  },
  {
    id: 'track-5', // Classical Piano Cadence
    gen: (t) => {
      const pianoNotes = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0];
      const note = pianoNotes[Math.floor(t * 1.5) % pianoNotes.length];
      const piano = Math.sin(2 * Math.PI * note * t) * Math.exp(-2 * (t % 0.66)) * 0.35;
      return [piano, piano];
    },
  },
  {
    id: 'track-6', // Dreamwave
    gen: (t) => {
      const pad = (Math.sin(2 * Math.PI * 174.61 * t) + Math.sin(2 * Math.PI * 220 * t)) * 0.25;
      const shimmer = Math.sin(2 * Math.PI * 880 * t + Math.sin(t * 2)) * 0.1;
      return [pad + shimmer, pad - shimmer];
    },
  },
];

console.log('Generating local audio storage assets...');
tracks.forEach((t) => {
  const filePath = path.join(storageDir, `${t.id}.wav`);
  const wavBuf = createWavBuffer(durationSeconds, sampleRate, t.gen);
  fs.writeFileSync(filePath, wavBuf);
  console.log(`Generated: ${filePath} (${(wavBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
});
console.log('Local audio storage generated successfully.');
