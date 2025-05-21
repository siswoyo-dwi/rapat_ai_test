import { ChatOpenAI } from "@langchain/openai";
import { object, z } from "zod";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();


interface Word {
  speaker_id: string;
  text: string;
}

interface Transcription {
  words: Word[];
}

interface SpeakerSegment {
  speaker: string;
  text: string;
}

function convert_transcription(transcription: Transcription = { words: [] }): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  console.log(transcription.length);
  
  if (!transcription.words || transcription.words.length === 0) {
    return segments;
  }

  let currentSpeaker: string | null = null;
  let currentText = '';

  transcription.words.forEach((word, index) => {
    // Initialize if first word
    if (currentSpeaker === null) {
      currentSpeaker = word.speaker_id;
      currentText = word.text;
      return;
    }

    // Continue building text if same speaker
    if (word.speaker_id === currentSpeaker) {
      currentText += ' ' + word.text;
    } 
    // Push segment and start new one when speaker changes
    else {
      segments.push({
        speaker: currentSpeaker,
        text: currentText.trim()
      });

      currentSpeaker = word.speaker_id;
      currentText = word.text;
    }

    // Push the last segment
    if (index === transcription.words.length - 1) {
      segments.push({
        speaker: currentSpeaker,
        text: currentText.trim()
      });
    }
  });

  return segments;
}
// 1. Setup Model
const llm = new ChatOpenAI({
  modelName: "gpt-4-turbo",
  temperature: 0.2,  // Lebih deterministik
  maxTokens: 500,
  apiKey: process.env.OPENAI_API_KEY
});

// 2. Schema Sederhana
const TopicSchema = z.object({
  case_title: z.string(),
  main_topics: z.array(
    z.object({
      topic_name: z.string(),
      summary: z.string(),
      supporting_evidence: z.array(z.string()).optional()
    })
  ).length(3) // Pastikan selalu 3 topik
});
// 3. Fungsi Analisis Utama
async function extractMainTopics(transcript: string) {
  const structuredModel = llm.withStructuredOutput(TopicSchema);
  
  const prompt = `
  ANALYZE THIS COURT TRANSCRIPT AND EXTRACT 3 MAIN TOPICS:

  INSTRUCTIONS:
  1. Focus only on substantive legal discussions
  2. Ignore procedural parts (opening, attendance, etc)
  3. Each topic must have:
     - Clear name (in Indonesian)
     - 1-sentence summary
     - Optional: key evidence mentioned
  4. Prioritize topics that occupy the most discussion time

  TRANSCRIPT:
  ${transcript}
  `;

  try {
    const result = await structuredModel.invoke(prompt);
    console.log(result,'result');
    
    return {
      case_title: result.case_title,
      topics: result.main_topics
    };
  } catch (error) {
    console.error("Analysis error:", error);
    return getFallbackTopics(transcript);
  }
}

// 4. Fallback Minimalis
function getFallbackTopics(transcript: string) {
  // Cari kalimat paling panjang sebagai fallback
  const sentences = transcript.split(/[.!?]/)
    .filter(s => s.length > 30)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
    
  return {
    topics: sentences.map((s, i) => ({
      name: `Topik ${i+1}`,
      summary: s.trim().substring(0, 150)
    }))
  };
}

// 5. Fungsi Pemrosesan File
async function processAudioTranscript(filePath: string) {
  try {
    // Baca file transkrip
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(rawData) || {words:[]};      
    let text = convert_transcription(json) 
    let full_text = ''
    console.log(text,'text');
    
    text.forEach((a:object) =>
      full_text+= `word: ${a.text}, speakerTag: ${a.speaker}`
    );
    console.log(full_text,'full_text');
    
    // Ekstrak topik
    const analysis = await extractMainTopics(full_text);
    console.log(analysis);
        const outputPath2 = path.join(__dirname, `./analisis/analysis_json_${Date.now()}.json`);
    fs.writeFileSync(outputPath2, JSON.stringify(analysis, null, 2));
    
    // Format output
    const result = {
      file: path.basename(filePath),
      transcript_length: full_text.length,
      main_topics: analysis.topics
    };
    
    // Simpan hasil
    const outputPath = path.join(__dirname, `./analisis/topics_analysis_${Date.now()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    
    analysis.topics.forEach((topic, i) => {
      console.log(`${i+1}. ${topic.topic_name}: ${topic.summary}`);
    });
    
    return result;
  } catch (error) {
    console.error("Processing failed:", error);
    throw error;
  }
}

// 6. Contoh Penggunaan
(async () => {
  await processAudioTranscript('transkripsi.json');
})();