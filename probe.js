const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
console.log('ffmpegPath=', ffmpegPath);
const p = spawn(ffmpegPath, ['-f', 'lavfi', '-i', 'color=c=blue:s=64x64:d=1', '-vf', 'format=yuv420p', '-t', '1', '-pix_fmt', 'yuv420p', 'tmp_probe.mp4']);
p.on('error', (e) => console.log('ERR', e.message));
p.stderr.on('data', (d) => console.log('STDERR', d.toString().slice(0, 200)));
p.on('close', (code) => console.log('CLOSE', code));
setTimeout(() => console.log('done wait'), 5000);
