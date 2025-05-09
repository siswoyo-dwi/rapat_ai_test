import express, { RequestHandler } from 'express';
import multer from 'multer';
import fs from 'fs';
import { ElevenLabsClient } from 'elevenlabs';
import 'dotenv/config';

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Perbaikan: definisikan handler sesuai tipe
const handler: RequestHandler = async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const audioStream = fs.createReadStream(req.file.path);

    const transcription = await client.speechToText.convert({
      file: audioStream,
      model_id: 'scribe_v1',
      tag_audio_events: true,
      language_code: 'id',
      diarize: true,
    });

    res.json(transcription);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
};


app.post('/upload-audio', upload.single('audio'), handler);

app.listen(port, () => {
  console.log(`Server ready at http://localhost:${port}`);
});
