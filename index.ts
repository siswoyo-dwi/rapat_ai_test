import express, { RequestHandler } from 'express';
import multer from 'multer';
import fs from 'fs';
import { ElevenLabsClient } from 'elevenlabs';
import 'dotenv/config';
import { OpenAI } from "openai";
import path from 'path';

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Perbaikan: definisikan handler sesuai tipe
// const handler: RequestHandler = async (req, res) => {
async function handler(){

  // if (!req.file) {
  //   res.status(400).json({ error: 'No file uploaded' });
  //   return;
  // }

  try {
    const audioStream = fs.createReadStream('videoplayback.mp3');

    const transcription = await client.speechToText.convert({
      file: audioStream,
      model_id: 'scribe_v1',
      tag_audio_events: true,
      language_code: 'id',
      diarize: true,
    });
    console.log(transcription);
    fs.writeFileSync(
      path.join(__dirname, `transkripsi-${new Date()}.json`),
      JSON.stringify(transcription, null, 2),
      'utf-8'
    );
    console.log('✅ Hasil transkripsi disimpan ke transkripsi.json');
    let text = ''
    let wordsInfo = transcription.words
    wordsInfo.forEach(a =>
  // console.log(` word: ${a.text}, speakerTag: ${a.speaker_id}`)
  text+=` word: ${a.text}, speakerTag: ${a.speaker_id}`
);
    // res.json(transcription);
  //  await summarizeConversation(text)
  } catch (err: any) {
    console.error(err);
    // res.status(500).json({ error: err.message || 'Internal error' });
  }
};
// handler()

async function summarizeConversation(text: string) {
  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "Kamu adalah asisten yang merangkum percakapan dari transkripsi audio.",
      },
      {
        role: "user",
        content: `Berikut ini adalah hasil transkripsi percakapan:\n\n${text}\n\nTolong ringkas isi percakapan ini menjadi poin-poin penting.`,
      },
    ],
  });

  const summary = chat.choices[0].message.content;
  console.log("Ringkasan Percakapan:\n", summary);
}
// Baca file
fs.readFile('transkripsi.json', 'utf8', (err, data) => {
  if (err) throw err;
  
  // Parse JSON
  const transcriptionData = JSON.parse(data);
  const textToSummarize = transcriptionData.text;
  
  // Kirim ke LLM
  summarizeConversation(textToSummarize);
  console.log();

});
// app.post('/upload-audio', upload.single('audio'), handler);

// app.listen(port, () => {
//   console.log(`Server ready at http://localhost:${port}`);
// });
