# Video Cross-Browser Measurement Evidence

The four local video capabilities are measured on Chromium, Firefox, and WebKit using a real generated WebM input containing video and an audio track.

Per tool/browser the evidence records:
- wall-clock execution time;
- input and output byte size;
- input and output audio stream count;
- decoded duration;
- decoded output width/height;
- actual compressor size reduction.

Constraints:
- The current local media contract is WebM; this evidence does not establish MP4/MOV/MKV support.
- Execution time is measured as real browser wall-clock processing time; it is not treated as a media-duration guarantee.
- Compressor evidence requires output bytes to be smaller than the real input bytes.
- Audio is measured explicitly and is not assumed to be preserved through a browser canvas pipeline.
- Crop acceptance is represented by decoded geometry; the existing video-media assurance suite additionally verifies crop pixel-color geometry.
- Public claims are not changed by this document. A compressor/public-scope claim remains subject to evidence and the owner decision record.
